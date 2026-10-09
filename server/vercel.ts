import type { IncomingMessage, ServerResponse } from 'node:http';
import { handle } from './handlers.js';

// Adaptador para as Vercel Functions (runtime Node.js). O Vercel já entrega
// req.body com o JSON interpretado; sem dependência do pacote @vercel/node.
type VercelRequest = IncomingMessage & { body?: unknown };

export function vercelHandler(route: string) {
  return async (req: VercelRequest, res: ServerResponse) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'anon';
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = undefined;
      }
    }
    const result = await handle(route, req.method ?? 'GET', body, ip);
    res.statusCode = result.status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    for (const [k, v] of Object.entries(result.headers ?? {})) res.setHeader(k, v);
    res.end(JSON.stringify(result.body));
  };
}
