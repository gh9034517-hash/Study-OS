import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handle, parseJsonLoose } from '../server/handlers.ts';
import { checkRateLimit, resetRateLimits } from '../server/rateLimit.ts';

const realFetch = globalThis.fetch;
const env = { ...process.env };

function geminiReply(text: string, status = 200) {
  return async () =>
    new Response(JSON.stringify(status === 200 ? { candidates: [{ content: { parts: [{ text }] } }], modelVersion: 'gemini-test' } : { error: { message: text } }), {
      status,
      headers: { 'content-type': 'application/json' },
    });
}

beforeEach(() => {
  resetRateLimits();
  process.env = { ...env, AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key', RATE_LIMIT_PER_MINUTE: '50', RATE_LIMIT_PER_DAY: '500' };
});
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});

const chatBody = { level: 'iniciante', mode: 'explicar', subject: 'Matemática', messages: [{ role: 'user', content: 'O que é uma função?' }] };

test('health informa se a IA está configurada sem expor a chave', async () => {
  const res = await handle('health', 'GET', undefined, 'ip');
  assert.equal(res.status, 200);
  assert.equal((res.body as any).aiConfigured, true);
  assert.ok(!JSON.stringify(res.body).includes('test-key'));
});

test('sem chave retorna 503 not_configured', async () => {
  delete process.env.GEMINI_API_KEY;
  const res = await handle('chat', 'POST', chatBody, 'ip');
  assert.equal(res.status, 503);
  assert.equal((res.body as any).error.code, 'not_configured');
});

test('validação rejeita entradas inválidas com 400', async () => {
  for (const body of [
    {},
    { ...chatBody, messages: [] },
    { ...chatBody, level: 'mestre' },
    { ...chatBody, messages: [{ role: 'user', content: 'x'.repeat(4001) }] },
    { ...chatBody, messages: [{ role: 'assistant', content: 'oi' }] },
  ]) {
    const res = await handle('chat', 'POST', body, 'ip');
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 80));
    assert.equal((res.body as any).error.code, 'invalid_input');
  }
  const quiz = await handle('quiz', 'POST', { subject: 'Física', level: 'avancado', count: 50 }, 'ip');
  assert.equal(quiz.status, 400);
});

test('chat envia prompt de sistema e devolve resposta', async () => {
  let sent: any;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent = { url, body: JSON.parse(String(init.body)), headers: init.headers };
    return geminiReply('Uma função relaciona cada x a um único y.')();
  }) as typeof fetch;
  const res = await handle('chat', 'POST', chatBody, 'ip');
  assert.equal(res.status, 200);
  assert.equal((res.body as any).reply, 'Uma função relaciona cada x a um único y.');
  assert.match(sent.url, /generativelanguage\.googleapis\.com/);
  assert.match(sent.body.systemInstruction.parts[0].text, /Matemática/);
  assert.equal((sent.headers as any)['x-goog-api-key'], 'test-key');
});

test('quiz valida e normaliza o JSON gerado pela IA', async () => {
  const payload = {
    questions: [
      { question: 'Quanto é 2+2?', options: ['3', '4', '5', '6'], answer: 1, explanation: '2+2=4', topic: 'Aritmética' },
      { question: 'Quanto é 3x3?', options: ['6', '9', '12', '33'], answer: '1', explanation: '3x3=9' },
    ],
  };
  globalThis.fetch = geminiReply('```json\n' + JSON.stringify(payload) + '\n```') as typeof fetch;
  const res = await handle('quiz', 'POST', { subject: 'Matemática', level: 'iniciante', count: 3 }, 'ip');
  assert.equal(res.status, 200);
  const qs = (res.body as any).questions;
  assert.equal(qs.length, 2);
  assert.equal(qs[1].answer, 1);
  assert.equal(qs[1].topic, 'Geral');
});

test('quiz com saída malformada retorna bad_output', async () => {
  globalThis.fetch = geminiReply('{"questions":[{"question":"x","options":["a","b"],"answer":0,"explanation":"y"}]}') as typeof fetch;
  const res = await handle('quiz', 'POST', { subject: 'Matemática', level: 'iniciante', count: 3 }, 'ip');
  assert.equal(res.status, 502);
  assert.equal((res.body as any).error.code, 'bad_output');
});

test('erros do provedor são traduzidos (429, chave inválida, 5xx, timeout de rede)', async () => {
  globalThis.fetch = geminiReply('Resource exhausted', 429) as typeof fetch;
  let res = await handle('chat', 'POST', chatBody, 'ip');
  assert.equal(res.status, 429);
  assert.equal((res.body as any).error.code, 'upstream_rate_limited');

  globalThis.fetch = geminiReply('API key not valid. Please pass a valid API key.', 400) as typeof fetch;
  res = await handle('chat', 'POST', chatBody, 'ip');
  assert.equal((res.body as any).error.code, 'invalid_key');

  globalThis.fetch = geminiReply('backend error', 503) as typeof fetch;
  res = await handle('chat', 'POST', chatBody, 'ip');
  assert.equal(res.status, 503);

  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  res = await handle('chat', 'POST', chatBody, 'ip');
  assert.equal(res.status, 502);
  assert.equal((res.body as any).error.code, 'upstream_error');
});

test('limite de requisições por minuto bloqueia excesso', async () => {
  process.env.RATE_LIMIT_PER_MINUTE = '2';
  globalThis.fetch = geminiReply('ok') as typeof fetch;
  assert.equal((await handle('chat', 'POST', chatBody, 'a')).status, 200);
  assert.equal((await handle('chat', 'POST', chatBody, 'a')).status, 200);
  const third = await handle('chat', 'POST', chatBody, 'a');
  assert.equal(third.status, 429);
  assert.equal((third.body as any).error.code, 'rate_limited');
  assert.ok(third.headers?.['retry-after']);
  // Outro IP não é afetado.
  assert.equal((await handle('chat', 'POST', chatBody, 'b')).status, 200);
});

test('limite diário e janela deslizante', () => {
  const t0 = 1_000_000;
  checkRateLimit('x', 1, 2, t0);
  assert.throws(() => checkRateLimit('x', 1, 2, t0 + 1000));
  checkRateLimit('x', 1, 2, t0 + 61_000);
  assert.throws(() => checkRateLimit('x', 5, 2, t0 + 200_000), /diário/);
});

test('parseJsonLoose extrai JSON com texto em volta', () => {
  assert.deepEqual(parseJsonLoose('Aqui está: {"a":1} fim'), { a: 1 });
  assert.throws(() => parseJsonLoose('sem json'));
});
