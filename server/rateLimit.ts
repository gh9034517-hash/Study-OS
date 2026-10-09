import { ApiError } from './errors.js';

// Limitador em memória por IP: janela deslizante de 1 minuto + teto diário.
// Em hospedagem serverless cada instância tem sua própria memória, então o limite
// é aproximado — ele protege a cota gratuita contra abuso, não substitui a cota do provedor.

interface Bucket {
  minute: number[];
  dayStart: number;
  dayCount: number;
}

const buckets = new Map<string, Bucket>();
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export function checkRateLimit(key: string, perMinute: number, perDay: number, now = Date.now()): void {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { minute: [], dayStart: now, dayCount: 0 };
    buckets.set(key, bucket);
  }
  if (now - bucket.dayStart >= DAY) {
    bucket.dayStart = now;
    bucket.dayCount = 0;
  }
  bucket.minute = bucket.minute.filter((t) => now - t < MINUTE);

  if (bucket.dayCount >= perDay) {
    const retry = Math.ceil((bucket.dayStart + DAY - now) / 1000);
    throw new ApiError(429, 'rate_limited', `Limite diário de ${perDay} requisições de IA atingido para este acesso.`, retry);
  }
  if (bucket.minute.length >= perMinute) {
    const retry = Math.ceil((bucket.minute[0] + MINUTE - now) / 1000);
    throw new ApiError(429, 'rate_limited', `Muitas requisições seguidas. Aguarde ${retry}s e tente novamente.`, retry);
  }
  bucket.minute.push(now);
  bucket.dayCount += 1;

  // Limpeza simples para evitar crescimento ilimitado do mapa.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now - b.dayStart >= DAY) buckets.delete(k);
  }
}

export function resetRateLimits(): void {
  buckets.clear();
}
