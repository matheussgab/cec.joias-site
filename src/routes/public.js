import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getCatalog } from '../catalog.js';
import { config } from '../config.js';
import { send } from '../http.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

let template = null;
async function indexHtml() {
  if (template && config.production) return template;
  template = await readFile(path.join(config.appDir, 'index.html'), 'utf8');
  return template;
}

// As prévias de link (WhatsApp, Instagram) não executam JS: as tags vão prontas no HTML.
function metaTags({ title, description, image, url }) {
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="C&amp;C Joias">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    image ? `<meta property="og:image" content="${esc(image)}">` : '',
    `<meta name="twitter:card" content="summary_large_image">`,
  ].filter(Boolean).join('\n');
}

async function page(res, status, meta) {
  const html = (await indexHtml()).replace('<!--meta-->', metaTags(meta));
  send(res, status, html, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
}

export function publicRoutes(router) {
  router.get('/api/catalog', async (req, res) => {
    const { body, etag } = await getCatalog();
    const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache', etag };
    if (req.headers['if-none-match'] === etag) send(res, 304, undefined, headers);
    else send(res, 200, body, headers);
  });

  router.get('/', async (req, res) => {
    await page(res, 200, {
      title: 'C&C Joias — joias, bolsas e relógios',
      description: 'Joias, bolsas, relógios e acessórios escolhidos para quem valoriza o detalhe. Peça pelo WhatsApp.',
      image: `${config.publicUrl}/assets/hero/hero-1-1600.webp`,
      url: `${config.publicUrl}/`,
    });
  });

  router.get('/p/:slug', async (req, res, { slug }) => {
    const { data } = await getCatalog();
    const p = data.products.find(x => x.slug === slug);
    if (!p) {
      await page(res, 404, { title: 'Produto não encontrado — C&C Joias', description: 'Este produto não está mais disponível.', url: `${config.publicUrl}/` });
      return;
    }
    await page(res, 200, {
      title: `${p.name} — ${money(p.price)} · C&C Joias`,
      description: p.desc || `${p.name}${p.brand ? ' · ' + p.brand : ''}`,
      image: p.imgs[0] ? `${config.publicUrl}/uploads/${p.imgs[0].k}-960.webp` : null,
      url: `${config.publicUrl}/p/${p.slug}`,
    });
  });

  router.get('/healthz', (req, res) => send(res, 200, 'ok', { 'content-type': 'text/plain' }));
}
