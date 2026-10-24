import path from 'node:path';

const env = process.env;

if (!env.DATABASE_URL) {
  console.error('DATABASE_URL não definido. Copie .env.example para .env e preencha.');
  process.exit(1);
}

// Fotos no Supabase Storage quando configurado (obrigatório na Vercel, que não tem disco permanente); senão, em disco.
const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/$/, '');
const storage = supabaseUrl && env.SUPABASE_SECRET_KEY
  ? { url: supabaseUrl, key: env.SUPABASE_SECRET_KEY, bucket: env.SUPABASE_BUCKET || 'fotos' }
  : null;

export const config = {
  port: Number(env.PORT || 3000),
  host: env.HOST || '127.0.0.1',
  databaseUrl: env.DATABASE_URL,
  // URL pública, usada nas tags de prévia (Open Graph) dos links compartilhados.
  publicUrl: (env.PUBLIC_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : `http://localhost:${env.PORT || 3000}`)).replace(/\/$/, ''),
  production: env.NODE_ENV === 'production',
  // Atrás do nginx ou da Vercel: confia no X-Forwarded-For para identificar o IP no limite de login.
  trustProxy: env.TRUST_PROXY === '1' || !!env.VERCEL,
  appDir: path.resolve('app'),
  uploadsDir: path.resolve(env.UPLOADS_DIR || 'uploads'),
  storage,
  // Onde o navegador busca as fotos: o próprio site (/uploads) ou o bucket público do Supabase.
  imgBase: storage ? `${storage.url}/storage/v1/object/public/${storage.bucket}` : '/uploads',
};
