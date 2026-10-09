import type { ServerConfig } from '../config.js';
import { ApiError } from '../errors.js';

export interface GenerateInput {
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Horário-limite (epoch ms) para toda a operação, incluindo reservas. */
  deadline?: number;
}

export interface GenerateOutput {
  text: string;
  model: string;
}

/**
 * Chama o provedor configurado e devolve apenas o texto gerado.
 * Se o modelo principal estiver sobrecarregado, fora do ar ou lento, tenta os modelos de reserva.
 */
export async function generate(config: ServerConfig, input: GenerateInput): Promise<GenerateOutput> {
  if (!config.apiKey) {
    throw new ApiError(
      503,
      'not_configured',
      'A IA ainda não foi configurada no servidor. Defina GEMINI_API_KEY (ou GROQ_API_KEY) nas variáveis de ambiente do backend.',
    );
  }
  let lastError: ApiError | undefined;
  for (const model of [config.model, ...config.fallbackModels]) {
    if (input.deadline && input.deadline - Date.now() < 3000) break;
    try {
      return await attempt(config, model, input);
    } catch (err) {
      if (!(err instanceof ApiError) || !err.retryable) throw err;
      lastError = err;
      console.warn(`[StudyOS] modelo ${model} indisponível (${err.code}); tentando reserva.`);
    }
  }
  throw lastError ?? new ApiError(504, 'timeout', 'A IA demorou demais para responder. Tente novamente em instantes.');
}

async function attempt(config: ServerConfig, model: string, input: GenerateInput): Promise<GenerateOutput> {
  const controller = new AbortController();
  const remaining = input.deadline ? input.deadline - Date.now() : Infinity;
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(config.timeoutMs, remaining)));
  try {
    return config.provider === 'groq'
      ? await callOpenAICompatible(config, model, input, controller.signal)
      : await callGemini(config, model, input, controller.signal);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError(504, 'timeout', 'A IA demorou demais para responder. Tente novamente em instantes.', undefined, true);
    }
    throw new ApiError(502, 'upstream_error', 'Não foi possível contatar o serviço de IA. Verifique a conexão do servidor.', undefined, true);
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(config: ServerConfig, model: string, input: GenerateInput, signal: AbortSignal): Promise<GenerateOutput> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const request = (thinking: boolean) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': config.apiKey! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.system }] },
        contents: input.messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: input.temperature ?? 0.7,
          maxOutputTokens: input.maxTokens ?? 2048,
          ...(input.json ? { responseMimeType: 'application/json' } : {}),
          // Raciocínio curto: respostas bem mais rápidas, adequado para estudo.
          ...(thinking ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
        },
      }),
      signal,
    });

  let res = await request(true);
  let data = (await res.json().catch(() => null)) as any;
  // Modelos que não aceitam o nível de raciocínio: repete sem a configuração.
  if (res.status === 400 && /thinking/i.test(data?.error?.message ?? '')) {
    res = await request(false);
    data = (await res.json().catch(() => null)) as any;
  }
  if (!res.ok) throw mapUpstreamError(res.status, data?.error?.message, res.headers.get('retry-after'));

  const candidate = data?.candidates?.[0];
  const text: string = (candidate?.content?.parts ?? [])
    .filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? '')
    .join('')
    .trim();
  if (!text) {
    const reason = candidate?.finishReason ?? data?.promptFeedback?.blockReason;
    if (reason === 'SAFETY' || reason === 'PROHIBITED_CONTENT') {
      throw new ApiError(502, 'bad_output', 'A IA recusou responder a esse conteúdo. Reformule a pergunta.');
    }
    throw new ApiError(502, 'bad_output', 'A IA retornou uma resposta vazia. Tente novamente.', undefined, true);
  }
  return { text, model: data?.modelVersion ?? model };
}

async function callOpenAICompatible(config: ServerConfig, model: string, input: GenerateInput, signal: AbortSignal): Promise<GenerateOutput> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model,
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
  if (!text) throw new ApiError(502, 'bad_output', 'A IA retornou uma resposta vazia. Tente novamente.', undefined, true);
  return { text, model: data?.model ?? model };
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
      true, // a cota é por modelo: o modelo de reserva pode ter cota livre
    );
  }
  if (status === 401 || status === 403 || detail.includes('api key')) {
    return new ApiError(503, 'invalid_key', 'A chave de API configurada no servidor é inválida ou não tem permissão.');
  }
  if (status === 404) {
    return new ApiError(503, 'upstream_error', 'O modelo de IA configurado não está disponível. Ajuste AI_MODEL no servidor.', undefined, true);
  }
  if (status >= 500) {
    const busy = detail.includes('demand') || detail.includes('overloaded') || status === 503;
    return new ApiError(
      503,
      'upstream_error',
      busy
        ? 'Os servidores gratuitos de IA estão sobrecarregados agora. Tente de novo em alguns instantes; o modo offline continua disponível.'
        : 'O serviço de IA está temporariamente indisponível. Tente novamente em alguns minutos.',
      30,
      true,
    );
  }
  return new ApiError(502, 'upstream_error', 'O serviço de IA recusou a requisição.');
}
