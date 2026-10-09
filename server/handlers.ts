import { z } from 'zod';
import type {
  ApiErrorBody,
  ChatResponse,
  FlashcardsResponse,
  HealthResponse,
  InsightsResponse,
  QuizQuestion,
  QuizResponse,
} from '../shared/api.js';
import { getConfig } from './config.js';
import { ApiError } from './errors.js';
import { generate } from './ai/provider.js';
import { checkRateLimit } from './rateLimit.js';
import { flashcardsPrompt, insightsPrompt, quizPrompt, tutorSystemPrompt } from './prompts.js';

// Mensagens de validação em português.
z.config(z.locales.pt());

// ── Validação de entrada ────────────────────────────────────────────────
const text = (max: number) => z.string().trim().min(1).max(max);
const level = z.enum(['iniciante', 'intermediario', 'avancado']);

const chatSchema = z.object({
  subject: text(80).optional(),
  topic: text(120).optional(),
  level,
  mode: z.enum(['explicar', 'exemplos', 'resumo', 'exercicio']),
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: text(4000) }))
    .min(1)
    .max(20)
    .refine((m) => m.length > 0 && m[m.length - 1].role === 'user', 'A última mensagem deve ser do estudante.'),
});

const quizSchema = z.object({
  subject: text(80),
  topic: text(120).optional(),
  level,
  count: z.number().int().min(3).max(10),
});

const flashcardsSchema = z.object({
  subject: text(80),
  topic: text(120).optional(),
  level,
  count: z.number().int().min(3).max(15),
});

const insightsSchema = z.object({
  level,
  summary: z
    .array(
      z.object({
        subject: text(80),
        topic: text(120),
        attempts: z.number().int().min(0).max(100_000),
        accuracy: z.number().min(0).max(1),
      }),
    )
    .max(60),
  minutesLast7Days: z.number().min(0).max(100_000),
  pendingTasks: z.number().int().min(0).max(10_000),
  upcomingExams: z.array(z.object({ subject: text(80), daysLeft: z.number().int().min(-365).max(3650) })).max(30),
});

// ── Validação da saída da IA ─────────────────────────────────────────────
/** Aceita a lista "solta" (sem o objeto envolvente), formato que alguns modelos devolvem. */
const wrapList = (key: string) => (v: unknown) => (Array.isArray(v) ? { [key]: v } : v);

const aiQuizSchema = z.preprocess(
  wrapList('questions'),
  z.object({
    questions: z
      .array(
        z.object({
          question: text(3000),
          options: z.array(z.string().trim().min(1).max(600)).length(4),
          answer: z.coerce.number().int().min(0).max(3),
          explanation: text(5000),
          topic: z.string().trim().max(80).optional().default('Geral'),
        }),
      )
      .min(1),
  }),
);

const aiCardsSchema = z.preprocess(
  wrapList('cards'),
  z.object({
    cards: z
      .array(z.object({ front: text(600), back: text(1200), topic: z.string().trim().max(80).optional().default('Geral') }))
      .min(1),
  }),
);

export function parseJsonLoose(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const candidates = [cleaned, start >= 0 && end > start ? cleaned.slice(start, end + 1) : ''];
  for (const text of candidates.filter(Boolean)) {
    for (const attempt of [text, fixEscapes(text)]) {
      try {
        return JSON.parse(attempt);
      } catch {
        /* tenta a próxima forma */
      }
    }
  }
  throw new ApiError(502, 'bad_output', 'A IA respondeu em um formato inesperado. Tente gerar novamente.');
}

/** Corrige barras invertidas soltas (ex.: fórmulas como \frac) e quebras de linha cruas dentro de strings. */
function fixEscapes(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') {
        const next = text[i + 1] ?? '';
        if (/["\\/bfnrt]/.test(next) || (next === 'u' && /^[0-9a-f]{4}$/i.test(text.slice(i + 2, i + 6)))) {
          out += c + next;
          i++;
        } else {
          out += '\\\\';
        }
        continue;
      }
      if (c === '"') inString = false;
      if (c === '\n') {
        out += '\\n';
        continue;
      }
      if (c === '\r' || c === '\t') {
        out += ' ';
        continue;
      }
    } else if (c === '"') {
      inString = true;
    }
    out += c;
  }
  return out;
}

/** Gera JSON com a IA, valida com o esquema e tenta mais uma vez se a resposta vier com defeito. */
async function generateValidated<T>(
  config: ReturnType<typeof getConfig>,
  input: Parameters<typeof generate>[1],
  schema: z.ZodType<T>,
  invalidMessage: string,
): Promise<{ data: T; model: string }> {
  let lastError: ApiError | undefined;
  for (let i = 0; i < 2; i++) {
    if (i > 0 && input.deadline && input.deadline - Date.now() < 5000) break;
    const out = await generate(config, input);
    try {
      const parsed = schema.safeParse(parseJsonLoose(out.text));
      if (parsed.success) return { data: parsed.data, model: out.model };
      lastError = new ApiError(502, 'bad_output', invalidMessage);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      lastError = err;
    }
    console.warn(`[StudyOS] resposta da IA descartada (${out.model}, ${out.text.length} caracteres); gerando novamente.`);
  }
  throw lastError!;
}

function validate<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.length ? ` (${first.path.join('.')})` : '';
    throw new ApiError(400, 'invalid_input', `Dados inválidos${where}: ${first?.message ?? 'verifique os campos.'}`);
  }
  return result.data;
}

// ── Rotas ────────────────────────────────────────────────────────────────
export type Route = 'health' | 'chat' | 'quiz' | 'flashcards' | 'insights';

export interface HandlerResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export async function handle(route: string, method: string, body: unknown, clientKey: string): Promise<HandlerResult> {
  try {
    const config = getConfig();
    if (route === 'health') {
      const res: HealthResponse = {
        ok: true,
        aiConfigured: Boolean(config.apiKey),
        provider: config.provider,
        model: config.model,
        limits: { perMinute: config.perMinute, perDay: config.perDay },
      };
      return { status: 200, body: res };
    }
    if (!['chat', 'quiz', 'flashcards', 'insights'].includes(route)) {
      throw new ApiError(404, 'not_found', 'Rota não encontrada.');
    }
    if (method !== 'POST') throw new ApiError(405, 'invalid_input', 'Use o método POST.');

    // Valida antes de consumir cota de requisições.
    const parsed =
      route === 'chat'
        ? validate(chatSchema, body)
        : route === 'quiz'
          ? validate(quizSchema, body)
          : route === 'flashcards'
            ? validate(flashcardsSchema, body)
            : validate(insightsSchema, body);

    checkRateLimit(clientKey, config.perMinute, config.perDay);
    // Margem abaixo do limite de 60 s das funções serverless.
    const deadline = Date.now() + 50_000;

    switch (route) {
      case 'chat': {
        const input = parsed as z.infer<typeof chatSchema>;
        const out = await generate(config, {
          system: tutorSystemPrompt(input.level, input.mode, input.subject, input.topic),
          messages: input.messages,
          temperature: 0.6,
          deadline,
        });
        return ok<ChatResponse>({ reply: out.text, model: out.model });
      }
      case 'quiz': {
        const input = parsed as z.infer<typeof quizSchema>;
        const out = await generateValidated(
          config,
          {
            system: 'Você é um elaborador de avaliações educacionais rigoroso. Responda apenas com JSON.',
            messages: [{ role: 'user', content: quizPrompt(input.subject, input.topic, input.level, input.count) }],
            json: true,
            temperature: 0.8,
            maxTokens: 6144,
            deadline,
          },
          aiQuizSchema,
          'A IA gerou questões incompletas. Tente novamente.',
        );
        const questions: QuizQuestion[] = out.data.questions.slice(0, input.count).map((q) => ({
          ...q,
          topic: q.topic || input.topic || 'Geral',
        }));
        return ok<QuizResponse>({ questions, model: out.model });
      }
      case 'flashcards': {
        const input = parsed as z.infer<typeof flashcardsSchema>;
        const out = await generateValidated(
          config,
          {
            system: 'Você cria flashcards objetivos para repetição espaçada. Responda apenas com JSON.',
            messages: [{ role: 'user', content: flashcardsPrompt(input.subject, input.topic, input.level, input.count) }],
            json: true,
            temperature: 0.6,
            maxTokens: 4096,
            deadline,
          },
          aiCardsSchema,
          'A IA gerou flashcards incompletos. Tente novamente.',
        );
        return ok<FlashcardsResponse>({ cards: out.data.cards.slice(0, input.count), model: out.model });
      }
      default: {
        const input = parsed as z.infer<typeof insightsSchema>;
        const out = await generate(config, {
          system: insightsPrompt(input.level),
          messages: [{ role: 'user', content: JSON.stringify(input) }],
          temperature: 0.4,
          deadline,
        });
        return ok<InsightsResponse>({ analysis: out.text, model: out.model });
      }
    }
  } catch (err) {
    if (err instanceof ApiError) {
      const body: ApiErrorBody = {
        error: { code: err.code, message: err.message, retryAfterSeconds: err.retryAfterSeconds },
      };
      return {
        status: err.status,
        body,
        headers: err.retryAfterSeconds ? { 'retry-after': String(err.retryAfterSeconds) } : undefined,
      };
    }
    console.error('[StudyOS] erro inesperado:', err);
    return { status: 500, body: { error: { code: 'upstream_error', message: 'Erro interno inesperado.' } } };
  }
}

function ok<T>(body: T): HandlerResult {
  return { status: 200, body };
}
