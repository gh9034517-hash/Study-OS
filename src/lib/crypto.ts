import type { PasswordLock } from './types';

// Senha local protegida com PBKDF2-SHA-256 + sal aleatório (nunca em texto puro).
const ITERATIONS = 210_000;

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return toB64(bits);
}

export async function createLock(password: string): Promise<PasswordLock> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toB64(salt), hash: await derive(password, salt, ITERATIONS), iterations: ITERATIONS };
}

export async function verifyLock(password: string, lock: PasswordLock): Promise<boolean> {
  const hash = await derive(password, fromB64(lock.salt), lock.iterations);
  // Comparação em tempo constante.
  if (hash.length !== lock.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ lock.hash.charCodeAt(i);
  return diff === 0;
}
