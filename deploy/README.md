# Deploy — C&C Joias

Dois servidores Linux (Ubuntu/Debian):

| Servidor | O que roda | Exposto à internet |
|---|---|---|
| **Site** (`IP_SITE`) | nginx (HTTPS) + Node (site e API) + fotos em disco | portas 80 e 443 |
| **Banco** (`IP_BANCO`) | PostgreSQL | **nada**; a porta 5432 aceita só `IP_SITE` |

O navegador nunca fala com o banco: só a API, no servidor do site, se conecta a ele.

## 1. DNS

Na zona `ma24.com`, crie um registro `A` para `cecjoias` apontando para `IP_SITE`.

## 2. Servidor do banco

```bash
sudo apt install postgresql
sudo -u postgres psql <<'SQL'
CREATE ROLE cec LOGIN PASSWORD 'troque-por-uma-senha-longa';
CREATE DATABASE cec OWNER cec ENCODING 'UTF8' LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8' TEMPLATE template0;
SQL
```

O banco **precisa** ser UTF-8; a migração se recusa a rodar em outra codificação.

`postgresql.conf`:

```
listen_addresses = 'IP_BANCO'
ssl = on
```

`pg_hba.conf` (só o servidor do site, com TLS e senha):

```
hostssl  cec  cec  IP_SITE/32  scram-sha-256
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow from IP_SITE to any port 5432 proto tcp
sudo ufw enable
sudo systemctl restart postgresql
```

Backup diário (exemplo com cron do usuário `postgres`):

```
0 3 * * * pg_dump -Fc cec > /var/backups/cec-$(date +\%u).dump
```

## 3. Servidor do site

```bash
# Node 22+ (NodeSource ou nvm), nginx e certbot
sudo apt install nginx certbot python3-certbot-nginx
sudo useradd --system --home /opt/cec-joias --shell /usr/sbin/nologin cecjoias
sudo mkdir -p /opt/cec-joias /var/lib/cec-joias/uploads
sudo chown -R cecjoias: /var/lib/cec-joias

# código
sudo git clone <repositório> /opt/cec-joias
cd /opt/cec-joias && sudo npm ci --omit=dev
```

`/opt/cec-joias/.env` (permissão 600, dono `cecjoias`):

```
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
TRUST_PROXY=1
PUBLIC_URL=https://cecjoias.ma24.com
UPLOADS_DIR=/var/lib/cec-joias/uploads
DATABASE_URL=postgres://cec:SENHA@IP_BANCO:5432/cec?sslmode=require
```

Banco e primeiro acesso:

```bash
cd /opt/cec-joias
sudo -u cecjoias npm run migrate
sudo -u cecjoias npm run admin:create -- email@da-loja.com   # mostra a senha gerada uma vez
```

Serviço e nginx:

```bash
sudo cp deploy/cec-joias.service /etc/systemd/system/
sudo systemctl enable --now cec-joias

sudo cp deploy/nginx.conf /etc/nginx/sites-available/cecjoias.ma24.com
sudo ln -s /etc/nginx/sites-available/cecjoias.ma24.com /etc/nginx/sites-enabled/
sudo certbot certonly --nginx -d cecjoias.ma24.com
sudo nginx -t && sudo systemctl reload nginx

sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

Inclua `/var/lib/cec-joias/uploads` no backup: as fotos ficam ali, não no banco.

## Atualizar

```bash
cd /opt/cec-joias
sudo git pull
sudo npm ci --omit=dev
sudo -u cecjoias npm run migrate
sudo systemctl restart cec-joias
```

## Conferir

- `curl -I https://cecjoias.ma24.com/healthz` → 200
- `https://cecjoias.ma24.com/admin` → tela de login
- Do seu computador, `nc -zv IP_BANCO 5432` deve **falhar** (banco fechado para fora).
