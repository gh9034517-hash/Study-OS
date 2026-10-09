import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { getConfig } from './config.js';

try {
  process.loadEnvFile?.();
} catch {
  /* sem arquivo .env: usa apenas as variáveis do ambiente */
}

const here = path.dirname(fileURLToPath(import.meta.url));
// Em produção (build/server/index.js) o frontend fica em ../../dist; em dev (server/index.ts) em ../dist.
const candidates = [path.resolve(here, '../../dist'), path.resolve(here, '../dist')];
const staticDir = candidates.find((dir) => existsSync(path.join(dir, 'index.html')));

const port = Number(process.env.PORT ?? 8787);
const config = getConfig();
createApp(staticDir).listen(port, () => {
  console.log(`StudyOS API em http://localhost:${port}`);
  console.log(
    config.apiKey
      ? `IA: ${config.provider} · modelo ${config.model}`
      : 'IA: NÃO configurada (defina GEMINI_API_KEY no .env). O app funciona em modo offline.',
  );
});
