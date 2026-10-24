import { checkLoginRate, checkOrigin, clearLoginRate, clientIp, currentAdmin, login, logout, requireAdmin, sessionCookie } from '../auth.js';
import { config } from '../config.js';
import { HttpError, json, readForm, readJson } from '../http.js';
import {
  addImage, createProduct, deleteImage, deleteProduct, listCategories, listProducts, listStores, parseProduct, updateProduct, updateStore,
} from '../products.js';

const MAX_UPLOAD = 20 * 1024 * 1024;

const id = v => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(404, 'Não encontrado.');
  return n;
};

export function adminRoutes(router) {
  router.post('/api/admin/login', async (req, res) => {
    checkOrigin(req);
    const ip = clientIp(req);
    await checkLoginRate(ip);
    const b = await readJson(req, 2000);
    const email = String(b.email || '').trim().toLowerCase();
    const token = await login(email, String(b.password || ''));
    if (!token) throw new HttpError(401, 'E-mail ou senha incorretos.');
    await clearLoginRate(ip);
    json(res, 200, { email }, { 'set-cookie': sessionCookie(token) });
  });

  router.post('/api/admin/logout', async (req, res) => {
    checkOrigin(req);
    await logout(req);
    json(res, 200, { ok: true }, { 'set-cookie': sessionCookie(null) });
  });

  router.get('/api/admin/me', async (req, res) => {
    const admin = await currentAdmin(req);
    if (!admin) throw new HttpError(401, 'Não autenticado.');
    json(res, 200, { email: admin.email });
  });

  router.get('/api/admin/products', async (req, res) => {
    await requireAdmin(req);
    const [products, categories, stores] = await Promise.all([listProducts(), listCategories(), listStores()]);
    json(res, 200, { products, categories, stores, imgBase: config.imgBase });
  });

  router.post('/api/admin/products', async (req, res) => {
    await requireAdmin(req);
    json(res, 201, await createProduct(await parseProduct(await readJson(req))));
  });

  router.put('/api/admin/products/:id', async (req, res, p) => {
    await requireAdmin(req);
    json(res, 200, await updateProduct(id(p.id), await parseProduct(await readJson(req))));
  });

  router.delete('/api/admin/products/:id', async (req, res, p) => {
    await requireAdmin(req);
    await deleteProduct(id(p.id));
    json(res, 200, { ok: true });
  });

  router.post('/api/admin/products/:id/images', async (req, res, p) => {
    await requireAdmin(req);
    const form = await readForm(req, MAX_UPLOAD);
    const file = form.get('file');
    if (!file || typeof file === 'string') throw new HttpError(400, 'Nenhum arquivo enviado.');
    json(res, 201, await addImage(id(p.id), Buffer.from(await file.arrayBuffer())));
  });

  router.delete('/api/admin/images/:id', async (req, res, p) => {
    await requireAdmin(req);
    await deleteImage(id(p.id));
    json(res, 200, { ok: true });
  });

  router.get('/api/admin/stores', async (req, res) => {
    await requireAdmin(req);
    json(res, 200, await listStores());
  });

  router.put('/api/admin/stores/:id', async (req, res, p) => {
    await requireAdmin(req);
    json(res, 200, await updateStore(p.id, await readJson(req, 10_000)));
  });
}
