import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { handle } from './handlers.js';

export function createApp(staticDir?: string) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });

  app.use('/api', express.json({ limit: '64kb' }));

  app.all('/api/:route', async (req: Request, res: Response) => {
    const result = await handle(String(req.params.route), req.method, req.body, req.ip ?? 'anon');
    for (const [k, v] of Object.entries(result.headers ?? {})) res.setHeader(k, v);
    res.setHeader('Cache-Control', 'no-store');
    res.status(result.status).json(result.body);
  });

  // JSON malformado ou corpo grande demais.
  app.use('/api', (err: { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const tooLarge = err?.type === 'entity.too.large';
    res.status(tooLarge ? 413 : 400).json({
      error: { code: 'invalid_input', message: tooLarge ? 'Requisição grande demais.' : 'JSON inválido.' },
    });
  });

  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir, { maxAge: '1h', index: false }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }
  return app;
}
