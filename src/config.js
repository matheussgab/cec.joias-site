import path from 'node:path';

const env = process.env;

if (!env.DATABASE_URL) {
  console.error('DATABASE_URL não definido. Copie .env.example para .env e preencha.');
  process.exit(1);
}

export const config = {
  port: Number(env.PORT || 3000),
  host: env.HOST || '127.0.0.1',
  databaseUrl: env.DATABASE_URL,
  // URL pública, usada nas tags de prévia (Open Graph) dos links compartilhados.
  publicUrl: (env.PUBLIC_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
  production: env.NODE_ENV === 'production',
  // Atrás do nginx: confia no X-Forwarded-For para identificar o IP no limite de login.
  trustProxy: env.TRUST_PROXY === '1',
  appDir: path.resolve('app'),
  uploadsDir: path.resolve(env.UPLOADS_DIR || 'uploads'),
};
