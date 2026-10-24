// Aplica, em ordem, os arquivos de src/migrations que ainda não rodaram.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, tx } from './db.js';
import { ensureBucket } from './images.js';

const dir = path.resolve('src/migrations');

const { rows: [enc] } = await pool.query('SHOW server_encoding');
if (enc.server_encoding !== 'UTF8') {
  console.error(`O banco está em ${enc.server_encoding}; crie-o com ENCODING 'UTF8' (veja deploy/README.md).`);
  process.exit(1);
}

await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
const { rows } = await pool.query('SELECT name FROM schema_migrations');
const applied = new Set(rows.map(r => r.name));

const files = (await readdir(dir)).filter(f => f.endsWith('.sql')).sort();
let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = await readFile(path.join(dir, file), 'utf8');
  await tx(async c => {
    await c.query(sql);
    await c.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
  });
  console.log('aplicada:', file);
  count++;
}
console.log(count ? `${count} migração(ões) aplicada(s).` : 'Banco já está atualizado.');
if (await ensureBucket()) console.log('bucket de fotos criado no Supabase Storage.');
await pool.end();
