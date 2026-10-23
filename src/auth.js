// Login do painel: senha com scrypt, sessão em cookie httpOnly guardada (como hash) no banco.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';
import { pool } from './db.js';
import { HttpError } from './http.js';

const scrypt = promisify(scryptCb);
const N = 2 ** 15, R = 8, P = 1, KEYLEN = 64, MAXMEM = 64 * 1024 * 1024;
const SESSION_DAYS = 7;
export const COOKIE = config.production ? '__Host-sid' : 'sid';

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const [alg, n, r, p, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: +n, r: +r, p: +p, maxmem: MAXMEM });
  return timingSafeEqual(actual, expected);
}

// Usado quando o e-mail não existe, para a resposta levar o mesmo tempo.
const DUMMY = await hashPassword(randomBytes(12).toString('hex'));

const sha256 = t => createHash('sha256').update(t).digest('hex');

export async function login(email, password) {
  const { rows } = await pool.query('SELECT id, password_hash FROM admins WHERE email = $1', [email]);
  const ok = await verifyPassword(password, rows[0]?.password_hash ?? DUMMY);
  if (!rows[0] || !ok) return null;
  const token = randomBytes(32).toString('base64url');
  await pool.query('DELETE FROM sessions WHERE expires_at < now()');
  await pool.query(`INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`, [sha256(token), rows[0].id]);
  return token;
}

export function sessionCookie(token) {
  const maxAge = token ? SESSION_DAYS * 86400 : 0;
  return `${COOKIE}=${token || ''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.production ? '; Secure' : ''}`;
}

function readToken(req) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}

export async function logout(req) {
  const token = readToken(req);
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
}

export async function currentAdmin(req) {
  const token = readToken(req);
  if (!token) return null;
  const { rows } = await pool.query(
    'SELECT a.id, a.email FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = $1 AND s.expires_at > now()',
    [sha256(token)]);
  return rows[0] || null;
}

// Bloqueia requisições de alteração vindas de outro site (CSRF), além do SameSite=Strict.
export function checkOrigin(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const origin = req.headers.origin;
  let host = null;
  try { host = origin && new URL(origin).host; } catch { }
  if (!host || host !== req.headers.host) throw new HttpError(403, 'Origem não permitida.');
}

export async function requireAdmin(req) {
  checkOrigin(req);
  const admin = await currentAdmin(req);
  if (!admin) throw new HttpError(401, 'Faça login novamente.');
  return admin;
}

// Limite simples de tentativas de login por IP (memória do processo).
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000, MAX_ATTEMPTS = 10;

export function clientIp(req) {
  if (config.trustProxy && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress;
}

export function checkLoginRate(ip) {
  const now = Date.now();
  if (attempts.size > 5000) for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
  const a = attempts.get(ip);
  if (!a || a.reset < now) { attempts.set(ip, { count: 1, reset: now + WINDOW_MS }); return; }
  if (++a.count > MAX_ATTEMPTS) throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos.');
}

export function clearLoginRate(ip) { attempts.delete(ip); }
