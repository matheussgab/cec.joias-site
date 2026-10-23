// Cria um administrador ou redefine a senha de um existente.
//   npm run admin:create -- email@dominio.com
// A senha vem de ADMIN_PASSWORD; sem ela, uma senha forte é gerada e mostrada uma única vez.
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../src/auth.js';
import { pool } from '../src/db.js';

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Uso: npm run admin:create -- email@dominio.com');
  process.exit(1);
}

const password = process.env.ADMIN_PASSWORD || randomBytes(12).toString('base64url');
if (password.length < 10) {
  console.error('A senha precisa ter pelo menos 10 caracteres.');
  process.exit(1);
}

await pool.query(
  `INSERT INTO admins (email, password_hash) VALUES ($1, $2)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
  [email, await hashPassword(password)]);
await pool.query('DELETE FROM sessions WHERE admin_id = (SELECT id FROM admins WHERE email = $1)', [email]);

console.log(`Administrador: ${email}`);
if (!process.env.ADMIN_PASSWORD) console.log(`Senha gerada: ${password}  (guarde agora, ela não será mostrada de novo)`);
await pool.end();
