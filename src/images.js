// Fotos enviadas pelo painel: reconvertidas para WebP em 3 larguras, sem metadados (EXIF/GPS).
// Ficam em disco (UPLOADS_DIR) ou, se configurado, no Supabase Storage.
import { randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from './config.js';
import { HttpError } from './http.js';

export const WIDTHS = [480, 960, 1600];
const KEY = /^[a-f0-9]{16}$/;
const s = config.storage;

async function storageFetch(pathname, init) {
  const res = await fetch(`${s.url}/storage/v1/${pathname}`, {
    ...init,
    headers: { apikey: s.key, authorization: `Bearer ${s.key}`, ...init.headers },
  });
  if (!res.ok) throw new Error(`Supabase Storage ${res.status} em ${pathname}: ${await res.text()}`);
  return res;
}

// Cria o bucket público das fotos, se ainda não existir (chamado pela migração).
export async function ensureBucket() {
  if (!s) return false;
  const res = await fetch(`${s.url}/storage/v1/bucket/${s.bucket}`, { headers: { apikey: s.key, authorization: `Bearer ${s.key}` } });
  if (res.ok) return false;
  await storageFetch('bucket', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: s.bucket, name: s.bucket, public: true, allowed_mime_types: ['image/webp'], file_size_limit: 10 * 1024 * 1024 }),
  });
  return true;
}

const store = s
  ? (name, buf) => storageFetch(`object/${s.bucket}/${name}`, {
    method: 'POST',
    // Nomes aleatórios e imutáveis: podem ficar em cache para sempre.
    headers: { 'content-type': 'image/webp', 'cache-control': 'max-age=31536000' },
    body: buf,
  })
  : (name, buf) => writeFile(path.join(config.uploadsDir, name), buf);

export async function saveImage(buffer) {
  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: 60e6 }).metadata();
  } catch {
    throw new HttpError(415, 'Arquivo não é uma imagem válida.');
  }
  if (!['jpeg', 'png', 'webp', 'avif', 'heif'].includes(meta.format)) throw new HttpError(415, 'Use JPG, PNG, WebP, AVIF ou HEIC.');

  const key = randomBytes(8).toString('hex');
  if (!s) await mkdir(config.uploadsDir, { recursive: true });
  const base = sharp(buffer, { limitInputPixels: 60e6 }).rotate();
  try {
    await Promise.all(WIDTHS.map(async w => store(`${key}-${w}.webp`, await base.clone()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer())));
  } catch (err) {
    await removeImage(key).catch(() => {});
    throw err;
  }
  return key;
}

export async function removeImage(key) {
  if (!KEY.test(key)) return;
  const names = WIDTHS.map(w => `${key}-${w}.webp`);
  if (s) {
    await storageFetch(`object/${s.bucket}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: names }) });
  } else {
    await Promise.all(names.map(n => rm(path.join(config.uploadsDir, n), { force: true })));
  }
}
