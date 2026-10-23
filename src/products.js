// Regras de cadastro usadas pelo painel e pelo script de importação do mockup.
import { pool, tx } from './db.js';
import { HttpError } from './http.js';
import { removeImage, saveImage } from './images.js';
import { invalidateCatalog } from './catalog.js';

export function slugify(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';
}

// ---- validação ---------------------------------------------------------

function str(v, label, max, required = false) {
  if (v != null && typeof v !== 'string') throw new HttpError(400, `${label}: valor inválido.`);
  const s = (v || '').trim();
  if (required && !s) throw new HttpError(400, `Preencha: ${label}.`);
  if (s.length > max) throw new HttpError(400, `${label}: máximo de ${max} caracteres.`);
  return s;
}

function int(v, label, min, max) {
  if (!Number.isInteger(v) || v < min || v > max) throw new HttpError(400, `${label}: valor inválido.`);
  return v;
}

const bool = v => v === true;
const FOCAL = /^[0-9]{1,3}% [0-9]{1,3}%$/;

export async function parseProduct(b) {
  if (!b || typeof b !== 'object') throw new HttpError(400, 'Dados inválidos.');
  const storeIds = new Set((await pool.query('SELECT id FROM stores')).rows.map(r => r.id));

  if (!Array.isArray(b.variants) || !b.variants.length) throw new HttpError(400, 'Cadastre ao menos uma variação (ex.: "Única").');
  if (b.variants.length > 40) throw new HttpError(400, 'Máximo de 40 variações.');
  const seen = new Set();
  const variants = b.variants.map(v => {
    const name = str(v?.name, 'Nome da variação', 40, true);
    if (seen.has(name.toLowerCase())) throw new HttpError(400, `Variação repetida: ${name}.`);
    seen.add(name.toLowerCase());
    const stock = {};
    for (const [sid, qty] of Object.entries(v.stock || {})) {
      if (!storeIds.has(sid)) throw new HttpError(400, `Loja desconhecida: ${sid}.`);
      stock[sid] = int(qty, `Estoque de ${name}`, 0, 99999);
    }
    return { name, stock };
  });

  const images = (Array.isArray(b.images) ? b.images : []).map(i => {
    const pos = str(i?.pos, 'Ponto focal', 9) || '50% 50%';
    if (!FOCAL.test(pos)) throw new HttpError(400, 'Ponto focal inválido.');
    return { id: int(i?.id, 'Foto', 1, 2 ** 31 - 1), alt: str(i?.alt, 'Descrição da foto', 200), pos };
  });

  return {
    name: str(b.name, 'Nome', 120, true),
    sku: str(b.sku, 'SKU', 40) || null,
    brand: str(b.brand, 'Marca', 60),
    category: str(b.category, 'Categoria', 60, true),
    priceCents: int(b.priceCents, 'Preço', 0, 100_000_000),
    description: str(b.description, 'Descrição', 2000),
    isNew: bool(b.isNew),
    featured: bool(b.featured),
    active: b.active !== false,
    variants,
    images,
  };
}

// Converte violações do Postgres em mensagens para o painel.
function dbError(err) {
  if (err.code === '23505' && /sku/.test(err.constraint)) return new HttpError(409, 'Já existe um produto com esse SKU.');
  if (err.code === '23505') return new HttpError(409, 'Registro duplicado.');
  if (err.code === '23503' || err.code === '23514') return new HttpError(400, 'Dados inválidos.');
  return err;
}

// ---- leitura -----------------------------------------------------------

export async function listProducts(id = null) {
  const where = id ? 'WHERE p.id = $1' : '';
  const params = id ? [id] : [];
  const [products, images, variants] = await Promise.all([
    pool.query(`SELECT p.*, c.name AS category FROM products p JOIN categories c ON c.id = p.category_id ${where}
                ORDER BY p.updated_at DESC, p.id DESC`, params),
    pool.query(`SELECT i.* FROM product_images i JOIN products p ON p.id = i.product_id ${where} ORDER BY i.sort, i.id`, params),
    pool.query(`SELECT v.product_id, v.name, COALESCE(jsonb_object_agg(s.store_id, s.qty) FILTER (WHERE s.store_id IS NOT NULL), '{}') AS stock
                FROM product_variants v JOIN products p ON p.id = v.product_id LEFT JOIN stock s ON s.variant_id = v.id ${where}
                GROUP BY v.id ORDER BY v.sort, v.id`, params),
  ]);
  const list = products.rows.map(p => ({
    id: p.id, slug: p.slug, sku: p.sku || '', name: p.name, brand: p.brand, category: p.category,
    priceCents: p.price_cents, description: p.description, isNew: p.is_new, featured: p.featured, active: p.active,
    updatedAt: p.updated_at,
    images: images.rows.filter(i => i.product_id === p.id).map(i => ({ id: i.id, key: i.file_key, alt: i.alt, pos: i.focal })),
    variants: variants.rows.filter(v => v.product_id === p.id).map(v => ({ name: v.name, stock: v.stock })),
  }));
  if (id && !list.length) throw new HttpError(404, 'Produto não encontrado.');
  return id ? list[0] : list;
}

export async function listCategories() {
  return (await pool.query('SELECT name FROM categories ORDER BY sort, name')).rows.map(r => r.name);
}

// ---- escrita -----------------------------------------------------------

async function categoryId(c, name) {
  const slug = slugify(name);
  const found = await c.query('SELECT id FROM categories WHERE slug = $1', [slug]);
  if (found.rows[0]) return found.rows[0].id;
  const { rows } = await c.query(
    'INSERT INTO categories (name, slug, sort) VALUES ($1, $2, (SELECT COALESCE(MAX(sort), 0) + 1 FROM categories)) RETURNING id', [name, slug]);
  return rows[0].id;
}

async function freeSlug(c, name) {
  const base = slugify(name);
  const { rows } = await c.query("SELECT slug FROM products WHERE slug = $1 OR slug LIKE $1 || '-%'", [base]);
  const taken = new Set(rows.map(r => r.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

async function saveVariants(c, productId, variants) {
  const existing = (await c.query('SELECT id, name FROM product_variants WHERE product_id = $1', [productId])).rows;
  const keep = [];
  for (const [i, v] of variants.entries()) {
    let id = existing.find(e => e.name === v.name)?.id;
    if (id) await c.query('UPDATE product_variants SET sort = $2 WHERE id = $1', [id, i]);
    else id = (await c.query('INSERT INTO product_variants (product_id, name, sort) VALUES ($1, $2, $3) RETURNING id', [productId, v.name, i])).rows[0].id;
    keep.push(id);
    for (const [sid, qty] of Object.entries(v.stock)) {
      await c.query(`INSERT INTO stock (variant_id, store_id, qty) VALUES ($1, $2, $3)
                     ON CONFLICT (variant_id, store_id) DO UPDATE SET qty = EXCLUDED.qty`, [id, sid, qty]);
    }
  }
  await c.query('DELETE FROM product_variants WHERE product_id = $1 AND NOT (id = ANY($2::int[]))', [productId, keep]);
}

export async function createProduct(p) {
  try {
    const id = await tx(async c => {
      const { rows } = await c.query(
        `INSERT INTO products (slug, sku, name, brand, category_id, price_cents, description, is_new, featured, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [await freeSlug(c, p.name), p.sku, p.name, p.brand, await categoryId(c, p.category), p.priceCents, p.description, p.isNew, p.featured, p.active]);
      await saveVariants(c, rows[0].id, p.variants);
      return rows[0].id;
    });
    invalidateCatalog();
    return listProducts(id);
  } catch (err) { throw dbError(err); }
}

export async function updateProduct(id, p) {
  try {
    await tx(async c => {
      const { rowCount } = await c.query(
        `UPDATE products SET sku = $2, name = $3, brand = $4, category_id = $5, price_cents = $6, description = $7,
         is_new = $8, featured = $9, active = $10, updated_at = now() WHERE id = $1`,
        [id, p.sku, p.name, p.brand, await categoryId(c, p.category), p.priceCents, p.description, p.isNew, p.featured, p.active]);
      if (!rowCount) throw new HttpError(404, 'Produto não encontrado.');
      await saveVariants(c, id, p.variants);
      for (const [i, img] of p.images.entries()) {
        await c.query('UPDATE product_images SET sort = $3, alt = $4, focal = $5 WHERE id = $1 AND product_id = $2', [img.id, id, i, img.alt, img.pos]);
      }
    });
    invalidateCatalog();
    return listProducts(id);
  } catch (err) { throw dbError(err); }
}

export async function deleteProduct(id) {
  const keys = await tx(async c => {
    const imgs = await c.query('SELECT file_key FROM product_images WHERE product_id = $1', [id]);
    const { rowCount } = await c.query('DELETE FROM products WHERE id = $1', [id]);
    if (!rowCount) throw new HttpError(404, 'Produto não encontrado.');
    return imgs.rows.map(r => r.file_key);
  });
  invalidateCatalog();
  await Promise.all(keys.map(removeImage));
}

export async function addImage(productId, buffer, { alt = '', pos = '50% 50%' } = {}) {
  const product = (await pool.query('SELECT name FROM products WHERE id = $1', [productId])).rows[0];
  if (!product) throw new HttpError(404, 'Produto não encontrado.');
  const key = await saveImage(buffer);
  try {
    const { rows } = await pool.query(
      `INSERT INTO product_images (product_id, file_key, alt, focal, sort)
       VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort), -1) + 1 FROM product_images WHERE product_id = $1))
       RETURNING id, file_key AS key, alt, focal AS pos`,
      [productId, key, alt || product.name, pos]);
    await pool.query('UPDATE products SET updated_at = now() WHERE id = $1', [productId]);
    invalidateCatalog();
    return rows[0];
  } catch (err) {
    await removeImage(key);
    throw err;
  }
}

export async function deleteImage(id) {
  const { rows } = await pool.query('DELETE FROM product_images WHERE id = $1 RETURNING file_key', [id]);
  if (!rows[0]) throw new HttpError(404, 'Foto não encontrada.');
  invalidateCatalog();
  await removeImage(rows[0].file_key);
}

// ---- lojas -------------------------------------------------------------

export async function listStores() {
  return (await pool.query('SELECT * FROM stores ORDER BY sort, name')).rows.map(s => ({
    id: s.id, name: s.name, short: s.short_name, intro: s.intro, whatsapp: s.whatsapp, instagram: s.instagram,
    address: s.address, hours: s.hours, accent: s.accent, active: s.active,
  }));
}

export async function updateStore(id, b) {
  if (!b || typeof b !== 'object') throw new HttpError(400, 'Dados inválidos.');
  const whatsapp = str(b.whatsapp, 'WhatsApp', 20).replace(/\D/g, '');
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) throw new HttpError(400, 'WhatsApp: use DDI + DDD + número, ex.: 5551999998888.');
  const accent = str(b.accent, 'Cor', 7) || '#A51C68';
  if (!/^#[0-9A-Fa-f]{6}$/.test(accent)) throw new HttpError(400, 'Cor inválida.');
  const s = {
    name: str(b.name, 'Nome', 80, true),
    short: str(b.short, 'Nome curto', 40, true),
    intro: str(b.intro, 'Apresentação', 400),
    instagram: str(b.instagram, 'Instagram', 60).replace(/^@/, ''),
    address: str(b.address, 'Endereço', 200),
    hours: str(b.hours, 'Horário', 120),
  };
  if (b.active === false) {
    const others = await pool.query('SELECT 1 FROM stores WHERE active AND id <> $1', [id]);
    if (!others.rowCount) throw new HttpError(400, 'Pelo menos uma loja precisa ficar ativa.');
  }
  const { rowCount } = await pool.query(
    `UPDATE stores SET name = $2, short_name = $3, intro = $4, whatsapp = $5, instagram = $6, address = $7, hours = $8, accent = $9, active = $10
     WHERE id = $1`,
    [id, s.name, s.short, s.intro, whatsapp, s.instagram, s.address, s.hours, accent, b.active !== false]);
  if (!rowCount) throw new HttpError(404, 'Loja não encontrada.');
  invalidateCatalog();
  return (await listStores()).find(x => x.id === id);
}
