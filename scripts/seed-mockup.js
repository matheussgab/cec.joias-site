// Importa para o banco os produtos DEMONSTRATIVOS do mockup (mockup/cc-config.js + fotos).
// Só roda com o catálogo vazio, para não duplicar nada.
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { pool } from '../src/db.js';
import { addImage, createProduct, parseProduct, slugify } from '../src/products.js';

const { rows } = await pool.query('SELECT count(*)::int AS n FROM products');
if (rows[0].n > 0) {
  console.log(`Já existem ${rows[0].n} produtos no banco; nada foi importado.`);
  await pool.end();
  process.exit(0);
}

const sandbox = { window: {} };
vm.runInNewContext(await readFile('mockup/cc-config.js', 'utf8'), sandbox);
const C = sandbox.window.CC_CONFIG;

const main = C.stores.find(s => s.id === 'cec-joias');
await pool.query('UPDATE stores SET intro = $1, instagram = $2 WHERE id = $3', [main.intro, main.instagram, main.id]);
for (const [i, cat] of C.categories.entries()) {
  const slug = slugify(cat.n);
  await pool.query('INSERT INTO categories (name, slug, sort) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [cat.n, slug, i]);
}

// Ordem inversa: os primeiros do mockup ficam como os mais recentes.
for (const p of C.products.slice().reverse()) {
  const input = await parseProduct({
    name: p.name, sku: p.sku, brand: p.brand, category: p.cat, priceCents: Math.round(p.price * 100),
    description: p.desc, isNew: !!p.novo, featured: !!p.destaque,
    variants: p.variants.map(v => ({ name: v, stock: Object.fromEntries(Object.entries(p.stock).map(([sid, s]) => [sid, s[v] || 0])) })),
  });
  const created = await createProduct(input);
  for (const [file, pos] of p.imgs) {
    await addImage(created.id, await readFile('mockup/' + file), { alt: p.name, pos });
  }
  console.log('importado:', p.name);
}

console.log(`${C.products.length} produtos demonstrativos importados.`);
await pool.end();
