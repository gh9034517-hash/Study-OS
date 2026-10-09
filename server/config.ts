// Configuração do backend lida exclusivamente de variáveis de ambiente.
// Nenhuma chave é embutida no código: sem chave, a IA responde "não configurada".

export type ProviderName = 'gemini' | 'groq';

export interface ServerConfig {
  provider: ProviderName;
  apiKey: string | undefined;
  model: string;
  /** Modelos tentados, em ordem, quando o principal está sobrecarregado ou indisponível. */
  fallbackModels: string[];
  perMinute: number;
  perDay: number;
  timeoutMs: number;
}

const DEFAULT_MODELS: Record<ProviderName, string> = {
  // Alias do Google para o Flash-Lite mais recente: rápido e com menos recusas por alta demanda na camada gratuita.
  gemini: 'gemini-flash-lite-latest',
  groq: 'llama-3.3-70b-versatile',
};

// Reservas usadas quando o modelo principal recusa por alta demanda (comum na camada gratuita).
const DEFAULT_FALLBACKS: Record<ProviderName, string[]> = {
  gemini: ['gemini-flash-latest'],
  groq: ['llama-3.1-8b-instant'],
};

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getConfig(): ServerConfig {
  const provider: ProviderName = process.env.AI_PROVIDER?.trim().toLowerCase() === 'groq' ? 'groq' : 'gemini';
  const apiKey = (provider === 'groq' ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY)?.trim() || undefined;
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];
  const fallbackEnv = process.env.AI_FALLBACK_MODELS?.split(',').map((m) => m.trim()).filter(Boolean);
  return {
    provider,
    apiKey,
    model,
    fallbackModels: (fallbackEnv ?? DEFAULT_FALLBACKS[provider]).filter((m) => m !== model),
    perMinute: intFromEnv('RATE_LIMIT_PER_MINUTE', 12),
    perDay: intFromEnv('RATE_LIMIT_PER_DAY', 200),
    timeoutMs: intFromEnv('AI_TIMEOUT_MS', 25_000),
  };
}
