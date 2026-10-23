-- Catálogo
CREATE TABLE stores (
  id          text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{2,40}$'),
  name        text NOT NULL,
  short_name  text NOT NULL,
  intro       text NOT NULL DEFAULT '',
  whatsapp    text NOT NULL DEFAULT '' CHECK (whatsapp ~ '^([0-9]{10,15})?$'),
  instagram   text NOT NULL DEFAULT '',
  address     text NOT NULL DEFAULT '',
  hours       text NOT NULL DEFAULT '',
  accent      text NOT NULL DEFAULT '#A51C68' CHECK (accent ~ '^#[0-9A-Fa-f]{6}$'),
  sort        int  NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true
);

CREATE TABLE categories (
  id    serial PRIMARY KEY,
  name  text NOT NULL UNIQUE,
  slug  text NOT NULL UNIQUE,
  sort  int  NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id           serial PRIMARY KEY,
  slug         text NOT NULL UNIQUE,
  sku          text UNIQUE,
  name         text NOT NULL,
  brand        text NOT NULL DEFAULT '',
  category_id  int  NOT NULL REFERENCES categories(id),
  price_cents  int  NOT NULL CHECK (price_cents >= 0),
  description  text NOT NULL DEFAULT '',
  is_new       boolean NOT NULL DEFAULT false,
  featured     boolean NOT NULL DEFAULT false,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON products(category_id);

CREATE TABLE product_images (
  id          serial PRIMARY KEY,
  product_id  int  NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_key    text NOT NULL UNIQUE CHECK (file_key ~ '^[a-f0-9]{16}$'),
  alt         text NOT NULL DEFAULT '',
  focal       text NOT NULL DEFAULT '50% 50%' CHECK (focal ~ '^[0-9]{1,3}% [0-9]{1,3}%$'),
  sort        int  NOT NULL DEFAULT 0
);
CREATE INDEX product_images_product_idx ON product_images(product_id, sort);

CREATE TABLE product_variants (
  id          serial PRIMARY KEY,
  product_id  int  NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        text NOT NULL,
  sort        int  NOT NULL DEFAULT 0,
  UNIQUE (product_id, name)
);

CREATE TABLE stock (
  variant_id  int  NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  store_id    text NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  qty         int  NOT NULL DEFAULT 0 CHECK (qty >= 0),
  PRIMARY KEY (variant_id, store_id)
);

-- Painel administrativo
CREATE TABLE admins (
  id             serial PRIMARY KEY,
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  admin_id    int  NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);

INSERT INTO stores (id, name, short_name, intro, instagram, accent, sort) VALUES
  ('cec-joias', 'C&C Joias', 'C&C Joias', 'Joias, bolsas, relógios e acessórios escolhidos para quem valoriza o detalhe.', 'cec.joias', '#A51C68', 0),
  ('loja-2', 'Loja 2', 'Loja 2', '', '', '#1F6F78', 1);
