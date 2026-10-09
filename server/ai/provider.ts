import type { ServerConfig } from '../config.js';
import { ApiError } from '../errors.js';

export interface GenerateInput {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateOutput {
  text: string;
  model: string;
}

/** Chama o provedor configurado e devolve apenas o texto gerado. */
export async function generate(config: ServerConfig, input: GenerateInput): Promise<GenerateOutput> {
  if (!config.apiKey) {
    throw new ApiError(
      503,
      'not_configured',
      'A IA ainda não foi configurada no servidor. Defina GEMINI_API_KEY (ou GROQ_API_KEY) nas variáveis de ambiente do backend.',
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    return config.provider === 'groq'
      ? await callOpenAICompatible(config, input, controller.signal)
      : await callGemini(config, input, controller.signal);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError(504, 'timeout', 'A IA demorou demais para responder. Tente novamente em instantes.');
    }
    throw new ApiError(502, 'upstream_error', 'Não foi possível contatar o serviço de IA. Verifique a conexão do servidor.');
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(config: ServerConfig, input: GenerateInput, signal: AbortSignal): Promise<GenerateOutput> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: input.system }] },
    contents: input.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: input.temperature ?? 0.7,
      maxOutputTokens: input.maxTokens ?? 2048,
      ...(input.json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': config.apiKey! },
    body: JSON.stringify(body),
    signal,
  });
  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) throw mapUpstreamError(res.status, data?.error?.message, res.headers.get('retry-after'));

  const candidate = data?.candidates?.[0];
  const text: string = (candidate?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '')
    .join('')
    .trim();
  if (!text) {
    const reason = candidate?.finishReason ?? data?.promptFeedback?.blockReason;
    throw new ApiError(
      502,
      'bad_output',
      reason === 'SAFETY' || reason === 'PROHIBITED_CONTENT'
        ? 'A IA recusou responder a esse conteúdo. Reformule a pergunta.'
        : 'A IA retornou uma resposta vazia. Tente novamente.',
    );
  }
  return { text, model: data?.modelVersion ?? config.model };
}

async function callOpenAICompatible(config: ServerConfig, input: GenerateInput, signal: AbortSignal): Promise<GenerateOutput> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: input.temperature ?? 0.7,
      max_tokens: input.maxTokens ?? 2048,
      messages: [{ role: 'system', content: input.system }, ...input.messages],
      ...(input.json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal,
  });
  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) throw mapUpstreamError(res.status, data?.error?.message, res.headers.get('retry-after'));
  const text: string = data?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!text) throw new ApiError(502, 'bad_output', 'A IA retornou uma resposta vazia. Tente novamente.');
  return { text, model: data?.model ?? config.model };
}

function mapUpstreamError(status: number, message: string | undefined, retryAfter: string | null): ApiError {
  const detail = (message ?? '').toLowerCase();
  if (status === 429) {
    const seconds = retryAfter ? Number.parseInt(retryAfter, 10) : undefined;
    return new ApiError(
      429,
      'upstream_rate_limited',
      'A cota gratuita do provedor de IA foi atingida (limite por minuto ou por dia). Aguarde e tente novamente; o modo offline continua disponível.',
      Number.isFinite(seconds) ? seconds : 60,
    );
  }
  if (status === 401 || status === 403 || detail.includes('api key')) {
    return new ApiError(503, 'invalid_key', 'A chave de API configurada no servidor é inválida ou não tem permissão.');
  }
  if (status === 404) {
    return new ApiError(503, 'upstream_error', 'O modelo de IA configurado não está disponível. Ajuste AI_MODEL no servidor.');
  }
  if (status >= 500) {
    return new ApiError(503, 'upstream_error', 'O serviço de IA está temporariamente indisponível. Tente novamente em alguns minutos.');
  }
  return new ApiError(502, 'upstream_error', 'O serviço de IA recusou a requisição.');
}
