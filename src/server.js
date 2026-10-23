import http from 'node:http';
import { config } from './config.js';
import { HttpError, json, Router, send, serveFile } from './http.js';
import { adminRoutes } from './routes/admin.js';
import { publicRoutes } from './routes/public.js';

const router = new Router();
publicRoutes(router);
adminRoutes(router);

const SECURITY_HEADERS = {
  'content-security-policy': [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' https://fonts.googleapis.com",
    "style-src-attr 'unsafe-inline'",
    "font-src https://fonts.gstatic.com",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

async function handle(req, res) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  const { pathname } = new URL(req.url, 'http://local');

  const route = router.match(req.method, pathname);
  if (route) return route.handler(req, res, route.params);
  if (pathname.startsWith('/api/')) throw new HttpError(404, 'Rota não encontrada.');
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Método não permitido.');

  if (pathname === '/admin' || pathname === '/admin/') {
    res.setHeader('x-robots-tag', 'noindex, nofollow');
    if (await serveFile(req, res, config.appDir, 'admin/index.html', 'no-cache')) return;
  }
  if (pathname.startsWith('/uploads/')) {
    // Nomes aleatórios e imutáveis: podem ficar em cache para sempre.
    if (await serveFile(req, res, config.uploadsDir, pathname.slice('/uploads/'.length), 'public, max-age=31536000, immutable')) return;
  } else if (pathname !== '/index.html' && await serveFile(req, res, config.appDir, pathname, 'no-cache')) {
    return;
  }
  send(res, 404, 'Não encontrado', { 'content-type': 'text/plain; charset=utf-8' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(err => {
    if (!(err instanceof HttpError)) console.error(new Date().toISOString(), req.method, req.url, err);
    if (res.headersSent) { res.destroy(); return; }
    const status = err instanceof HttpError ? err.status : 500;
    json(res, status, { error: err instanceof HttpError ? err.message : 'Erro interno. Tente novamente.' });
  });
});

server.listen(config.port, config.host, () => {
  console.log(`C&C Joias rodando em http://${config.host}:${config.port}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
