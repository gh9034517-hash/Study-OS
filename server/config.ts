// Configuração do backend lida exclusivamente de variáveis de ambiente.
// Nenhuma chave é embutida no código: sem chave, a IA responde "não configurada".

export type ProviderName = 'gemini' | 'groq';

export interface ServerConfig {
  provider: ProviderName;
  apiKey: string | undefined;
  model: string;
  perMinute: number;
  perDay: number;
  timeoutMs: number;
}

const DEFAULT_MODELS: Record<ProviderName, string> = {
  // Alias mantido pelo Google que aponta para o Flash estável mais recente (camada gratuita).
  gemini: 'gemini-flash-latest',
  groq: 'llama-3.3-70b-versatile',
};

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getConfig(): ServerConfig {
  const provider: ProviderName = process.env.AI_PROVIDER?.trim().toLowerCase() === 'groq' ? 'groq' : 'gemini';
  const apiKey = (provider === 'groq' ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY)?.trim() || undefined;
  return {
    provider,
    apiKey,
    model: process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider],
    perMinute: intFromEnv('RATE_LIMIT_PER_MINUTE', 12),
    perDay: intFromEnv('RATE_LIMIT_PER_DAY', 200),
    timeoutMs: intFromEnv('AI_TIMEOUT_MS', 30_000),
  };
}
