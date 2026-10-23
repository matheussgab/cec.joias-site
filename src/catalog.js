// Catálogo público: montado do banco uma vez e mantido em memória até o painel alterar algo.
import { createHash } from 'node:crypto';
import { pool } from './db.js';

let cache = null;
let generation = 0;

export function invalidateCatalog() {
  generation++;
  cache = null;
}

export async function getCatalog() {
  if (cache) return cache;
  const gen = generation;

  const [stores, categories, products, images, variants] = await Promise.all([
    pool.query(`SELECT id, name, short_name, intro, whatsapp, instagram, address, hours, accent
                FROM stores WHERE active ORDER BY sort, name`),
    pool.query(`SELECT c.slug, c.name FROM categories c
                WHERE EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id AND p.active)
                ORDER BY c.sort, c.name`),
    pool.query(`SELECT p.id, p.slug, p.sku, p.name, p.brand, c.slug AS cat, p.price_cents, p.description, p.is_new, p.featured
                FROM products p JOIN categories c ON c.id = p.category_id
                WHERE p.active ORDER BY p.featured DESC, p.is_new DESC, p.created_at DESC, p.id DESC`),
    pool.query(`SELECT i.product_id, i.file_key, i.alt, i.focal FROM product_images i
                JOIN products p ON p.id = i.product_id WHERE p.active ORDER BY i.product_id, i.sort, i.id`),
    pool.query(`SELECT v.product_id, v.name, COALESCE(jsonb_object_agg(s.store_id, s.qty) FILTER (WHERE s.store_id IS NOT NULL), '{}') AS stock
                FROM product_variants v JOIN products p ON p.id = v.product_id
                LEFT JOIN stock s ON s.variant_id = v.id
                WHERE p.active GROUP BY v.id ORDER BY v.product_id, v.sort, v.id`),
  ]);

  const byProduct = (rows, map) => rows.reduce((acc, r) => ((acc[r.product_id] ||= []).push(map(r)), acc), {});
  const imgs = byProduct(images.rows, r => ({ k: r.file_key, alt: r.alt, pos: r.focal }));
  const vars = byProduct(variants.rows, r => ({ n: r.name, s: r.stock }));

  const data = {
    stores: stores.rows.map(s => ({ id: s.id, name: s.name, short: s.short_name, intro: s.intro, whatsapp: s.whatsapp, instagram: s.instagram, address: s.address, hours: s.hours, accent: s.accent })),
    categories: categories.rows,
    products: products.rows.map(p => ({
      id: p.id, slug: p.slug, sku: p.sku || '', name: p.name, brand: p.brand, cat: p.cat,
      price: p.price_cents, desc: p.description, isNew: p.is_new, featured: p.featured,
      imgs: imgs[p.id] || [], variants: vars[p.id] || [],
    })),
  };

  const body = JSON.stringify(data);
  const built = { data, body, etag: '"' + createHash('sha1').update(body).digest('base64url') + '"' };
  if (gen === generation) cache = built;
  return built;
}
