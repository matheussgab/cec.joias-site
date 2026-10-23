// Utilitários HTTP mínimos: roteador, leitura de corpo, respostas e arquivos estáticos.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export class Router {
  routes = [];

  add(method, pattern, handler) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    this.routes.push({ method, re, keys, handler });
  }
  get(p, h) { this.add('GET', p, h); }
  post(p, h) { this.add('POST', p, h); }
  put(p, h) { this.add('PUT', p, h); }
  delete(p, h) { this.add('DELETE', p, h); }

  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method && !(method === 'HEAD' && r.method === 'GET')) continue;
      const m = r.re.exec(pathname);
      if (!m) continue;
      try {
        return { handler: r.handler, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
      } catch {
        throw new HttpError(400, 'Endereço inválido.');
      }
    }
    return null;
  }
}

export async function readBody(req, limit) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > limit) throw new HttpError(413, 'Arquivo ou requisição grande demais.');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Arquivo ou requisição grande demais.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req, limit = 100_000) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Envie JSON.');
  try {
    return JSON.parse((await readBody(req, limit)).toString('utf8'));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, 'JSON inválido.');
  }
}

// Usa o parser multipart nativo do Node (undici) sobre o corpo já limitado.
export async function readForm(req, limit) {
  const body = await readBody(req, limit);
  try {
    return await new Request('http://local/', { method: 'POST', headers: { 'content-type': req.headers['content-type'] || '' }, body }).formData();
  } catch {
    throw new HttpError(400, 'Envio de arquivo inválido.');
  }
}

export function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(res.req.method === 'HEAD' ? undefined : body);
}

export function json(res, status, data, headers = {}) {
  send(res, status, JSON.stringify(data), { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// Serve um arquivo de dentro de root; devolve false se não existir.
export async function serveFile(req, res, root, relPath, cacheControl) {
  const file = path.resolve(root, '.' + path.posix.normalize('/' + relPath));
  if (file !== root && !file.startsWith(root + path.sep)) return false;
  let info;
  try { info = await stat(file); } catch { return false; }
  if (!info.isFile()) return false;
  const etag = `"${info.size.toString(36)}-${Math.floor(info.mtimeMs).toString(36)}"`;
  const headers = { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': cacheControl, etag };
  if (req.headers['if-none-match'] === etag) { send(res, 304, undefined, headers); return true; }
  res.writeHead(200, { ...headers, 'content-length': info.size });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).pipe(res);
  return true;
}
