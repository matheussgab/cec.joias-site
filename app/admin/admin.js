'use strict';

(() => {
  const MAX_UPLOAD = 20 * 1024 * 1024;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const norm = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const money = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const priceText = cents => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const thumb = (k, w = 480) => `/uploads/${k}-${w}.webp`;

  // "1.290,50" ou "1290.5" → 129050
  function parsePrice(text) {
    let t = String(text).replace(/[R$\s]/g, '');
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    const n = Number(t);
    return t && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  }

  const state = { products: [], categories: [], stores: [], dirty: false, query: '', status: '' };

  // ---- API -------------------------------------------------------------------

  class ApiError extends Error {}

  async function api(path, { method = 'GET', body, form } = {}) {
    const opts = { method, headers: {} };
    if (form) opts.body = form;
    else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['content-type'] = 'application/json'; }
    let res;
    try { res = await fetch(path, opts); } catch { throw new ApiError('Sem conexão com o servidor. Verifique a internet e tente de novo.'); }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/api/admin/login') { showLogin(); throw new ApiError('Sua sessão expirou. Entre novamente.'); }
    if (!res.ok) throw new ApiError(data.error || 'Algo deu errado. Tente novamente.');
    return data;
  }

  let toastTimer;
  function toast(text, error = false) {
    const el = $('[data-toast]');
    el.textContent = text;
    el.classList.toggle('error', error);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), error ? 6000 : 3000);
  }

  const fail = err => toast(err.message, true);

  // ---- login -----------------------------------------------------------------

  function showLogin() {
    $('[data-screen="app"]').hidden = true;
    $('[data-screen="login"]').hidden = false;
    $('[data-login]').email.focus();
  }

  async function showApp(email) {
    $('[data-screen="login"]').hidden = true;
    $('[data-screen="app"]').hidden = false;
    $('[data-who]').textContent = email;
    await load();
    route();
  }

  $('[data-login]').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const err = $('[data-login-error]');
    err.textContent = '';
    if (!f.email.value || !f.password.value) { err.textContent = 'Preencha e-mail e senha.'; return; }
    const btn = $('button', f);
    btn.disabled = true;
    try {
      const { email } = await api('/api/admin/login', { method: 'POST', body: { email: f.email.value, password: f.password.value } });
      f.password.value = '';
      await showApp(email);
    } catch (e2) {
      err.textContent = e2.message;
    } finally {
      btn.disabled = false;
    }
  });

  $('[data-logout]').addEventListener('click', async () => {
    if (state.dirty && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
    state.dirty = false;
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    showLogin();
  });

  // ---- dados -----------------------------------------------------------------

  async function load() {
    const data = await api('/api/admin/products');
    state.products = data.products;
    state.categories = data.categories;
    state.stores = data.stores;
  }

  // ---- rotas -----------------------------------------------------------------

  let lastHash = location.hash;

  function route() {
    const [tab, id] = (location.hash.replace(/^#\/?/, '') || 'produtos').split('/');
    $$('[data-tab]').forEach(a => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
    if (tab === 'lojas') renderStores();
    else if (id === 'novo') renderEditor(null);
    else if (id) renderEditor(state.products.find(p => p.id === Number(id)) || null, Number(id));
    else renderList();
    lastHash = location.hash;
  }

  addEventListener('hashchange', () => {
    if (state.dirty && !confirm('Há alterações não salvas. Descartar?')) {
      history.replaceState(null, '', lastHash || '#produtos');
      return;
    }
    state.dirty = false;
    route();
  });

  addEventListener('beforeunload', e => { if (state.dirty) e.preventDefault(); });

  // ---- lista -----------------------------------------------------------------

  function stockSummary(p) {
    return state.stores.map(s => {
      const n = p.variants.reduce((a, v) => a + (v.stock[s.id] || 0), 0);
      return `<span${n ? '' : ' class="zero"'}>${esc(s.short)}: ${n}</span>`;
    }).join(' · ');
  }

  function renderList() {
    const content = $('[data-content]');
    content.innerHTML = `
      <div class="page-head">
        <div>
          <h1>Produtos</h1>
          <p class="sub">${state.products.length} cadastrados · ${state.products.filter(p => p.active).length} visíveis no site</p>
        </div>
        <a class="btn btn-primary" href="#produtos/novo">+ Novo produto</a>
      </div>
      <div class="list-tools">
        <input type="search" placeholder="Buscar por nome, marca, SKU ou categoria" aria-label="Buscar produtos" data-q value="${esc(state.query)}">
        <select aria-label="Filtrar por situação" data-status>
          <option value="">Todos</option>
          <option value="on">Visíveis no site</option>
          <option value="off">Ocultos</option>
          <option value="zero">Sem estoque</option>
        </select>
      </div>
      <div data-rows></div>`;
    $('[data-status]').value = state.status;
    $('[data-q]').addEventListener('input', e => { state.query = e.target.value; renderRows(); });
    $('[data-status]').addEventListener('change', e => { state.status = e.target.value; renderRows(); });
    renderRows();
  }

  function renderRows() {
    const q = norm(state.query.trim());
    const list = state.products.filter(p =>
      (!q || norm(`${p.name} ${p.brand} ${p.sku} ${p.category}`).includes(q)) &&
      (state.status !== 'on' || p.active) &&
      (state.status !== 'off' || !p.active) &&
      (state.status !== 'zero' || p.variants.every(v => Object.values(v.stock).every(n => !n))));
    const box = $('[data-rows]');
    if (!state.products.length) {
      box.innerHTML = '<div class="empty-state"><p>Nenhum produto ainda.</p><p><a href="#produtos/novo">Cadastre o primeiro</a>.</p></div>';
      return;
    }
    if (!list.length) { box.innerHTML = '<div class="empty-state">Nenhum produto encontrado com esses filtros.</div>'; return; }
    box.innerHTML = `<table class="table">
      <thead><tr><th></th><th>Produto</th><th>Categoria</th><th class="num">Preço</th><th>Estoque</th><th>Site</th></tr></thead>
      <tbody>${list.map(p => `<tr data-id="${p.id}">
        <td>${p.images[0] ? `<img class="thumb" src="${thumb(p.images[0].key)}" alt="" loading="lazy" style="object-position:${esc(p.images[0].pos)}">` : '<span class="thumb-empty">sem foto</span>'}</td>
        <td><a class="p-name" href="#produtos/${p.id}">${esc(p.name)}</a><div class="p-meta">${esc([p.brand, p.sku].filter(Boolean).join(' · '))}</div></td>
        <td>${esc(p.category)}</td>
        <td class="num">${money(p.priceCents)}</td>
        <td class="stock-cell">${stockSummary(p)}</td>
        <td>${p.active ? '<span class="badge badge-on">Visível</span>' : '<span class="badge badge-off">Oculto</span>'}</td>
      </tr>`).join('')}</tbody></table>`;
    box.querySelector('tbody').addEventListener('click', e => {
      if (e.target.closest('a')) return;
      const tr = e.target.closest('tr[data-id]');
      if (tr) location.hash = `#produtos/${tr.dataset.id}`;
    });
  }

  // ---- editor ----------------------------------------------------------------

  function blankProduct() {
    return {
      id: null, name: '', sku: '', brand: '', category: '', priceCents: null, description: '',
      isNew: true, featured: false, active: true, images: [],
      variants: [{ name: 'Única', stock: Object.fromEntries(state.stores.map(s => [s.id, 0])) }],
    };
  }

  function renderEditor(found, missingId) {
    const content = $('[data-content]');
    if (!found && missingId) {
      content.innerHTML = '<a class="back" href="#produtos">← Produtos</a><div class="empty-state">Produto não encontrado. Ele pode ter sido excluído.</div>';
      return;
    }
    // Cópia de trabalho: só vai para o servidor ao salvar.
    const p = structuredClone(found || blankProduct());
    state.dirty = false;

    content.innerHTML = `
      <a class="back" href="#produtos">← Produtos</a>
      <div class="page-head"><div><h1>${p.id ? esc(p.name) : 'Novo produto'}</h1>
        ${p.id ? `<p class="sub"><a href="/p/${esc(p.slug)}" target="_blank" rel="noopener">Ver no site</a></p>` : ''}</div></div>
      <form class="editor" data-editor novalidate>
        <div class="col">
          <section class="panel">
            <h2>Informações</h2>
            <label>Nome da peça
              <input type="text" name="name" maxlength="120" required value="${esc(p.name)}">
            </label>
            <div class="row">
              <label>Categoria
                <input type="text" name="category" maxlength="60" list="cat-list" required value="${esc(p.category)}">
                <span class="hint">Escolha uma existente ou digite uma nova.</span>
              </label>
              <label>Preço
                <span class="price-field"><span>R$</span><input type="text" name="price" inputmode="decimal" required value="${p.priceCents == null ? '' : priceText(p.priceCents)}" placeholder="0,00"></span>
              </label>
            </div>
            <div class="row">
              <label>Marca <span class="hint">opcional</span>
                <input type="text" name="brand" maxlength="60" value="${esc(p.brand)}">
              </label>
              <label>Código (SKU) <span class="hint">opcional, vai na mensagem do pedido</span>
                <input type="text" name="sku" maxlength="40" value="${esc(p.sku)}">
              </label>
            </div>
            <label>Descrição
              <textarea name="description" maxlength="2000">${esc(p.description)}</textarea>
              <span class="hint">Só informe material, banho ou medidas que a loja confirmou.</span>
            </label>
            <datalist id="cat-list">${state.categories.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
          </section>

          <section class="panel">
            <div class="panel-head"><h2>Fotos</h2><span class="hint">A primeira é a capa. Clique na foto para escolher o ponto de foco do recorte.</span></div>
            <div data-photos></div>
          </section>
        </div>

        <div class="col">
          <section class="panel">
            <h2>No site</h2>
            <div class="flags">
              <label class="check"><input type="checkbox" name="active"${p.active ? ' checked' : ''}> Visível no site</label>
              <label class="check"><input type="checkbox" name="isNew"${p.isNew ? ' checked' : ''}> Marcar como novo</label>
              <label class="check"><input type="checkbox" name="featured"${p.featured ? ' checked' : ''}> Destaque</label>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head"><h2>Variações e estoque</h2></div>
            <p class="hint">Use "Única" para peças sem tamanho ou cor. Com estoque zero na loja, a peça aparece como esgotada nela.</p>
            <table class="variants-table">
              <thead><tr><th>Variação</th>${state.stores.map(s => `<th>${esc(s.short)}</th>`).join('')}<th></th></tr></thead>
              <tbody data-variants></tbody>
            </table>
            <button type="button" class="btn btn-secondary" data-add-variant>+ Adicionar variação</button>
          </section>
        </div>
      </form>
      <div class="savebar">
        <span class="status" data-save-status>${p.id ? 'Tudo salvo' : 'Produto novo, ainda não salvo'}</span>
        ${p.id ? '<button type="button" class="btn btn-danger" data-delete>Excluir</button>' : ''}
        <button type="button" class="btn btn-primary" data-save>${p.id ? 'Salvar alterações' : 'Criar produto'}</button>
      </div>`;

    const form = $('[data-editor]');
    const markDirty = () => {
      state.dirty = true;
      const s = $('[data-save-status]');
      s.textContent = 'Alterações não salvas';
      s.classList.add('dirty');
    };
    form.addEventListener('input', markDirty);
    form.addEventListener('change', markDirty);

    // variações
    function renderVariants() {
      $('[data-variants]').innerHTML = p.variants.map((v, i) => `<tr>
        <td><input type="text" data-vname="${i}" maxlength="40" value="${esc(v.name)}" aria-label="Nome da variação ${i + 1}"></td>
        ${state.stores.map(s => `<td><input type="number" min="0" max="99999" step="1" inputmode="numeric" data-vstock="${i}" data-store="${esc(s.id)}" value="${v.stock[s.id] || 0}" aria-label="Estoque de ${esc(v.name || 'variação')} na ${esc(s.short)}"></td>`).join('')}
        <td>${p.variants.length > 1 ? `<button type="button" class="icon-x" data-vdel="${i}" aria-label="Remover variação ${esc(v.name)}">×</button>` : ''}</td>
      </tr>`).join('');
    }
    renderVariants();
    $('[data-variants]').addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.vname != null) p.variants[t.dataset.vname].name = t.value;
      if (t.dataset.vstock != null) p.variants[t.dataset.vstock].stock[t.dataset.store] = Math.max(0, Math.floor(Number(t.value) || 0));
    });
    $('[data-variants]').addEventListener('click', e => {
      const b = e.target.closest('[data-vdel]');
      if (!b) return;
      p.variants.splice(Number(b.dataset.vdel), 1);
      renderVariants();
      markDirty();
    });
    $('[data-add-variant]').addEventListener('click', () => {
      p.variants.push({ name: '', stock: Object.fromEntries(state.stores.map(s => [s.id, 0])) });
      renderVariants();
      markDirty();
      $(`[data-vname="${p.variants.length - 1}"]`).focus();
    });

    // fotos
    function renderPhotos() {
      const box = $('[data-photos]');
      if (!p.id) {
        box.innerHTML = '<p class="locked">Crie o produto primeiro; depois as fotos podem ser enviadas aqui.</p>';
        return;
      }
      box.innerHTML = `
        ${p.images.length ? `<div class="photos">${p.images.map((im, i) => {
          const [x, y] = im.pos.split(' ');
          return `<div class="photo">
            <div class="photo-frame" data-focal="${i}" title="Clique para definir o ponto de foco">
              <img src="${thumb(im.key)}" alt="" style="object-position:${esc(im.pos)}">
              <span class="dot" style="left:${esc(x)};top:${esc(y)}"></span>
              ${i === 0 ? '<span class="first">Capa</span>' : ''}
            </div>
            <input type="text" data-alt="${i}" maxlength="200" value="${esc(im.alt)}" placeholder="Descrição da foto" aria-label="Descrição da foto ${i + 1}">
            <div class="photo-actions">
              <span>
                <button type="button" data-move="${i}" data-dir="-1" aria-label="Mover para a esquerda"${i === 0 ? ' disabled' : ''}>←</button>
                <button type="button" data-move="${i}" data-dir="1" aria-label="Mover para a direita"${i === p.images.length - 1 ? ' disabled' : ''}>→</button>
              </span>
              <button type="button" class="del" data-del-photo="${i}">Excluir</button>
            </div>
          </div>`;
        }).join('')}</div>` : ''}
        <label class="drop" data-drop>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic" multiple data-file>
          <span><strong>Escolher fotos</strong> ou arraste aqui</span>
          <span class="hint">JPG, PNG, WebP ou HEIC, até 20 MB cada. O site otimiza automaticamente.</span>
        </label>
        <p class="hint" data-upload-status aria-live="polite"></p>`;
    }
    renderPhotos();

    const photos = $('[data-photos]');
    photos.addEventListener('click', async e => {
      const frame = e.target.closest('[data-focal]');
      if (frame) {
        const r = frame.getBoundingClientRect();
        const x = Math.round(((e.clientX - r.left) / r.width) * 100);
        const y = Math.round(((e.clientY - r.top) / r.height) * 100);
        p.images[frame.dataset.focal].pos = `${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`;
        renderPhotos();
        markDirty();
        return;
      }
      const mv = e.target.closest('[data-move]');
      if (mv) {
        const i = Number(mv.dataset.move), j = i + Number(mv.dataset.dir);
        [p.images[i], p.images[j]] = [p.images[j], p.images[i]];
        renderPhotos();
        markDirty();
        return;
      }
      const del = e.target.closest('[data-del-photo]');
      if (del) {
        const im = p.images[del.dataset.delPhoto];
        if (!confirm('Excluir esta foto? Isso não pode ser desfeito.')) return;
        try {
          await api(`/api/admin/images/${im.id}`, { method: 'DELETE' });
          p.images = p.images.filter(x => x !== im);
          syncSaved({ images: p.images });
          renderPhotos();
          toast('Foto excluída.');
        } catch (err) { fail(err); }
      }
    });
    photos.addEventListener('input', e => {
      if (e.target.dataset.alt != null) p.images[e.target.dataset.alt].alt = e.target.value;
    });
    photos.addEventListener('change', e => {
      if (e.target.matches('[data-file]')) upload([...e.target.files]);
    });
    photos.addEventListener('dragover', e => {
      const d = e.target.closest('[data-drop]');
      if (d) { e.preventDefault(); d.classList.add('over'); }
    });
    photos.addEventListener('dragleave', e => e.target.closest('[data-drop]')?.classList.remove('over'));
    photos.addEventListener('drop', e => {
      const d = e.target.closest('[data-drop]');
      if (!d) return;
      e.preventDefault();
      d.classList.remove('over');
      upload([...e.dataTransfer.files].filter(f => f.type.startsWith('image/')));
    });

    async function upload(files) {
      if (!files.length) return;
      const status = () => $('[data-upload-status]');
      let done = 0;
      for (const file of files) {
        if (file.size > MAX_UPLOAD) { toast(`${file.name} passa de 20 MB e foi ignorada.`, true); continue; }
        status().textContent = `Enviando ${done + 1} de ${files.length}…`;
        const form = new FormData();
        form.append('file', file);
        try {
          const im = await api(`/api/admin/products/${p.id}/images`, { method: 'POST', form });
          p.images.push(im);
          syncSaved({ images: [...(state.products.find(x => x.id === p.id)?.images || []), im] });
          done++;
          renderPhotos();
        } catch (err) { fail(new Error(`${file.name}: ${err.message}`)); }
      }
      if (status()) status().textContent = done ? `${done} foto(s) enviada(s).` : '';
    }

    // Mantém a lista em memória igual ao servidor depois de ações imediatas (fotos).
    function syncSaved(change) {
      const i = state.products.findIndex(x => x.id === p.id);
      if (i >= 0) state.products[i] = { ...state.products[i], ...change };
    }

    // salvar / excluir
    $('[data-save]').addEventListener('click', async () => {
      const f = form.elements;
      const priceCents = parsePrice(f.price.value);
      f.price.setAttribute('aria-invalid', String(priceCents == null));
      if (!f.name.value.trim()) { toast('Preencha o nome da peça.', true); f.name.focus(); return; }
      if (!f.category.value.trim()) { toast('Preencha a categoria.', true); f.category.focus(); return; }
      if (priceCents == null) { toast('Preço inválido. Use o formato 1.290,00.', true); f.price.focus(); return; }
      if (p.variants.some(v => !v.name.trim())) { toast('Dê um nome a todas as variações (ex.: Única).', true); return; }

      const body = {
        name: f.name.value, sku: f.sku.value, brand: f.brand.value, category: f.category.value,
        priceCents, description: f.description.value,
        isNew: f.isNew.checked, featured: f.featured.checked, active: f.active.checked,
        variants: p.variants.map(v => ({ name: v.name.trim(), stock: v.stock })),
        images: p.images.map(im => ({ id: im.id, alt: im.alt, pos: im.pos })),
      };
      const btn = $('[data-save]');
      btn.disabled = true;
      try {
        const saved = await api(p.id ? `/api/admin/products/${p.id}` : '/api/admin/products', { method: p.id ? 'PUT' : 'POST', body });
        const i = state.products.findIndex(x => x.id === saved.id);
        if (i >= 0) state.products[i] = saved; else state.products.unshift(saved);
        if (!state.categories.includes(saved.category)) state.categories.push(saved.category);
        state.dirty = false;
        toast(p.id ? 'Alterações salvas.' : 'Produto criado. Agora você pode enviar as fotos.');
        if (!p.id) { lastHash = `#produtos/${saved.id}`; history.replaceState(null, '', lastHash); }
        renderEditor(saved);
      } catch (err) {
        fail(err);
      } finally {
        btn.disabled = false;
      }
    });

    $('[data-delete]')?.addEventListener('click', async () => {
      if (!confirm(`Excluir "${p.name}" e todas as fotos? Isso não pode ser desfeito.\n\nPara só tirar do site, desmarque "Visível no site".`)) return;
      try {
        await api(`/api/admin/products/${p.id}`, { method: 'DELETE' });
        state.products = state.products.filter(x => x.id !== p.id);
        state.dirty = false;
        toast('Produto excluído.');
        location.hash = '#produtos';
      } catch (err) { fail(err); }
    });
  }

  // ---- lojas -----------------------------------------------------------------

  function renderStores() {
    const content = $('[data-content]');
    content.innerHTML = `
      <div class="page-head"><div><h1>Lojas</h1><p class="sub">Contatos usados no site e no envio dos pedidos pelo WhatsApp.</p></div></div>
      <div class="stores-grid">${state.stores.map(s => `
        <form class="panel" data-store="${esc(s.id)}" novalidate>
          <h2>${esc(s.name)}</h2>
          <div class="row">
            <label>Nome<input type="text" name="name" maxlength="80" value="${esc(s.name)}"></label>
            <label>Nome curto<input type="text" name="short" maxlength="40" value="${esc(s.short)}"></label>
          </div>
          <label>WhatsApp
            <input type="tel" name="whatsapp" maxlength="20" placeholder="5551999998888" value="${esc(s.whatsapp)}">
            <span class="hint">Só números, com 55 + DDD. Sem ele, o pedido vira mensagem para copiar.</span>
          </label>
          <label>Instagram<input type="text" name="instagram" maxlength="60" placeholder="cec.joias" value="${esc(s.instagram)}"></label>
          <label>Endereço<input type="text" name="address" maxlength="200" value="${esc(s.address)}"></label>
          <label>Horário<input type="text" name="hours" maxlength="120" placeholder="Seg. a sex. 9h–18h · Sáb. 9h–13h" value="${esc(s.hours)}"></label>
          <label>Apresentação<textarea name="intro" maxlength="400">${esc(s.intro)}</textarea></label>
          <div class="row">
            <label>Cor da loja<span class="color-row"><input type="color" name="accent" value="${esc(s.accent)}"><span class="hint">Botões e destaques</span></span></label>
            <label class="check"><input type="checkbox" name="active"${s.active ? ' checked' : ''}> Loja ativa no site</label>
          </div>
          <div><button type="submit" class="btn btn-primary">Salvar loja</button></div>
        </form>`).join('')}
      </div>`;
    $$('[data-store]', content).forEach(f => f.addEventListener('submit', async e => {
      e.preventDefault();
      const el = f.elements;
      const btn = $('button[type="submit"]', f);
      btn.disabled = true;
      try {
        const saved = await api(`/api/admin/stores/${f.dataset.store}`, {
          method: 'PUT',
          body: {
            name: el.name.value, short: el.short.value, whatsapp: el.whatsapp.value, instagram: el.instagram.value,
            address: el.address.value, hours: el.hours.value, intro: el.intro.value, accent: el.accent.value, active: el.active.checked,
          },
        });
        state.stores = state.stores.map(s => s.id === saved.id ? saved : s);
        toast('Loja salva.');
        renderStores();
      } catch (err) { fail(err); } finally { btn.disabled = false; }
    }));
  }

  // ---- início ----------------------------------------------------------------

  (async () => {
    try {
      const me = await fetch('/api/admin/me');
      if (me.ok) await showApp((await me.json()).email);
      else showLogin();
    } catch {
      showLogin();
    }
  })();
})();
