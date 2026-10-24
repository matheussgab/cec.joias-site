-- Tentativas de login por IP (antes ficavam na memória do processo, que na Vercel não é compartilhada).
CREATE TABLE login_attempts (
  ip        text PRIMARY KEY,
  count     int  NOT NULL,
  reset_at  timestamptz NOT NULL
);
