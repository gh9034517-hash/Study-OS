// Contratos da API compartilhados entre frontend e backend.

export type Level = 'iniciante' | 'intermediario' | 'avancado';
export type TutorMode = 'explicar' | 'exemplos' | 'resumo' | 'exercicio';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  subject?: string;
  topic?: string;
  level: Level;
  mode: TutorMode;
  messages: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
  model: string;
}

export interface QuizRequest {
  subject: string;
  topic?: string;
  level: Level;
  count: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  topic: string;
}

export interface QuizResponse {
  questions: QuizQuestion[];
  model: string;
}

export interface FlashcardsRequest {
  subject: string;
  topic?: string;
  level: Level;
  count: number;
}

export interface FlashcardsResponse {
  cards: { front: string; back: string; topic: string }[];
  model: string;
}

export interface InsightsRequest {
  level: Level;
  /** Resumo agregado do desempenho, calculado no navegador a partir do histórico real. */
  summary: {
    subject: string;
    topic: string;
    attempts: number;
    accuracy: number;
  }[];
  minutesLast7Days: number;
  pendingTasks: number;
  upcomingExams: { subject: string; daysLeft: number }[];
}

export interface InsightsResponse {
  analysis: string;
  model: string;
}

export interface HealthResponse {
  ok: boolean;
  aiConfigured: boolean;
  provider: string;
  model: string;
  limits: { perMinute: number; perDay: number };
}

export type ApiErrorCode =
  | 'not_configured'
  | 'invalid_input'
  | 'rate_limited'
  | 'upstream_rate_limited'
  | 'invalid_key'
  | 'upstream_error'
  | 'timeout'
  | 'bad_output'
  | 'not_found';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; retryAfterSeconds?: number };
}
