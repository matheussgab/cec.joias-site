// Postgres local para desenvolvimento (sem instalar nada): dados ficam em .localdb/.
// Em produção o banco é o servidor dedicado, configurado via DATABASE_URL.
import { existsSync } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';

const dir = '.localdb';
const fresh = !existsSync(dir);
const pg = new EmbeddedPostgres({
  databaseDir: dir, user: 'cec', password: 'cec', port: 5433, persistent: true,
  // Sem isso, no Windows o banco nasce em WIN1252 e recusa parte dos caracteres.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('cec');

console.log('Postgres local pronto: DATABASE_URL=postgres://cec:cec@127.0.0.1:5433/cec');
console.log('Ctrl+C para parar.');

const stop = async () => { await pg.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
