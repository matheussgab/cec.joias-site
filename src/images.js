// Fotos enviadas pelo painel: reconvertidas para WebP em 3 larguras, sem metadados (EXIF/GPS).
import { randomBytes } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { config } from './config.js';
import { HttpError } from './http.js';

export const WIDTHS = [480, 960, 1600];
const KEY = /^[a-f0-9]{16}$/;

export async function saveImage(buffer) {
  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: 60e6 }).metadata();
  } catch {
    throw new HttpError(415, 'Arquivo não é uma imagem válida.');
  }
  if (!['jpeg', 'png', 'webp', 'avif', 'heif'].includes(meta.format)) throw new HttpError(415, 'Use JPG, PNG, WebP, AVIF ou HEIC.');

  const key = randomBytes(8).toString('hex');
  await mkdir(config.uploadsDir, { recursive: true });
  const base = sharp(buffer, { limitInputPixels: 60e6 }).rotate();
  await Promise.all(WIDTHS.map(w => base.clone()
    .resize({ width: w, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(config.uploadsDir, `${key}-${w}.webp`))));
  return key;
}

export async function removeImage(key) {
  if (!KEY.test(key)) return;
  await Promise.all(WIDTHS.map(w => rm(path.join(config.uploadsDir, `${key}-${w}.webp`), { force: true })));
}
