import type {
  ApiErrorBody,
  ApiErrorCode,
  ChatRequest,
  ChatResponse,
  FlashcardsRequest,
  FlashcardsResponse,
  HealthResponse,
  InsightsRequest,
  InsightsResponse,
  QuizRequest,
  QuizResponse,
} from '../../shared/api';

export class AIRequestError extends Error {
  constructor(
    public code: ApiErrorCode | 'network',
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
  /** Erros em que vale oferecer o modo offline. */
  get offlineSuggested() {
    return ['not_configured', 'invalid_key', 'network', 'upstream_error', 'upstream_rate_limited', 'rate_limited', 'timeout'].includes(this.code);
  }
}

async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new AIRequestError('network', 'Sem conexão com o servidor do StudyOS. Verifique sua internet ou se o backend está rodando.');
  }
  const data = (await res.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!res.ok || !data) {
    const e = (data as ApiErrorBody | null)?.error;
    if (!e) {
      throw new AIRequestError(
        'network',
        res.status === 404 ? 'O backend do StudyOS não foi encontrado neste endereço (rotas /api ausentes).' : `Erro inesperado do servidor (${res.status}).`,
      );
    }
    throw new AIRequestError(e.code, e.message, e.retryAfterSeconds);
  }
  return data as T;
}

export const api = {
  health: (signal?: AbortSignal) => request<HealthResponse>('health', undefined, signal),
  chat: (body: ChatRequest, signal?: AbortSignal) => request<ChatResponse>('chat', body, signal),
  quiz: (body: QuizRequest, signal?: AbortSignal) => request<QuizResponse>('quiz', body, signal),
  flashcards: (body: FlashcardsRequest, signal?: AbortSignal) => request<FlashcardsResponse>('flashcards', body, signal),
  insights: (body: InsightsRequest, signal?: AbortSignal) => request<InsightsResponse>('insights', body, signal),
};
