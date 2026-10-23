'use strict';

(() => {
  const PAGE_SIZE = 12;
  const WIDTHS = [480, 960, 1600];
  const CARD_SIZES = '(min-width: 1100px) 24vw, (min-width: 720px) 31vw, 48vw';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const norm = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const imgSrc = (k, w) => `/uploads/${k}-${w}.webp`;
  const imgSet = k => WIDTHS.map(w => `${imgSrc(k, w)} ${w}w`).join(', ');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  const saved = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { } },
  };

  const state = {
    catalog: null,
    storeId: null,
    bags: saved.get('cc_bags', {}),
    variant: null,
    prefetched: new Set(),
  };

  // ---- dados ------------------------------------------------------------

  const C = () => state.catalog;
  const store = () => C().stores.find(s => s.id === state.storeId) || C().stores[0];
  const others = () => C().stores.filter(s => s.id !== state.storeId);
  const product = id => C().products.find(p => p.id === id);
  const category = slug => C().categories.find(c => c.slug === slug);
  const qty = (p, sid, v) => p.variants.find(x => x.n === v)?.s[sid] || 0;
  const total = (p, sid) => p.variants.reduce((a, v) => a + (v.s[sid] || 0), 0);
  const available = (p, sid = state.storeId) => total(p, sid) > 0;
  const bag = (sid = state.storeId) => state.bags[sid] || [];
  const bagCount = sid => bag(sid).reduce((a, l) => a + l.q, 0);
  const showVariants = p => p.variants.length > 1 || (p.variants[0] && p.variants[0].n !== 'Única');

  function setBag(lines) {
    state.bags = { ...state.bags, [state.storeId]: lines };
    saved.set('cc_bags', state.bags);
    renderBagCount(true);
  }

  // Remove da sacola o que saiu do catálogo e ajusta quantidades ao estoque atual.
  function reconcileBags() {
    const bags = {};
    for (const [sid, lines] of Object.entries(state.bags)) {
      if (!C().stores.some(s => s.id === sid)) continue;
      bags[sid] = lines.filter(l => product(l.id)).map(l => {
        const max = qty(product(l.id), sid, l.v);
        return max > 0 && l.q > max ? { ...l, q: max } : l;
      });
    }
    state.bags = bags;
    saved.set('cc_bags', bags);
  }

  // ---- utilidades de interface ----------------------------------------

  let toastTimer;
  function toast(text, action) {
    const el = $('[data-toast]');
    el.innerHTML = esc(text) + (action ? ` <button type="button" class="linkish">${esc(action.label)}</button>` : '');
    if (action) $('button', el).onclick = () => { el.classList.remove('show'); action.run(); };
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
  }

  function scrollToEl(el) {
    el?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
  }

  for (const dialog of $$('dialog')) {
    dialog.addEventListener('click', e => {
      if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
    });
  }

  const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2l-.5-.3Z"/></svg>';
  const waLink = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

  // ---- loja atual ---------------------------------------------------------

  function setStore(id, { announce = false } = {}) {
    const prev = state.storeId;
    state.storeId = C().stores.some(s => s.id === id) ? id : C().stores[0].id;
    saved.set('cc_store', state.storeId);
    const s = store();
    document.documentElement.style.setProperty('--accent', s.accent);
    $$('[data-store-name]').forEach(el => { el.textContent = s.short; });
    $('#storebar').hidden = C().stores.length < 2;
    $('[data-two-stores]').hidden = C().stores.length < 2;
    renderBagCount(false);
    renderContact();
    if (announce && prev && prev !== state.storeId) {
      const left = bagCount(prev);
      const prevStore = C().stores.find(x => x.id === prev);
      toast(left ? `Agora você está na ${s.short}. Os itens da sacola da ${prevStore.short} continuam salvos.` : `Agora você está na ${s.short}.`);
    }
  }

  function renderStorePicker() {
    $('[data-store-pick]').innerHTML = C().stores.map(s => `
      <li><button type="button" data-store="${esc(s.id)}" aria-current="${s.id === state.storeId}">
        <strong>${esc(s.name)}</strong>
        ${s.address ? `<span>${esc(s.address)}</span>` : ''}
        ${bagCount(s.id) ? `<span>${plural(bagCount(s.id), 'item', 'itens')} na sacola</span>` : ''}
      </button></li>`).join('');
  }

  $('[data-store-pick]').addEventListener('click', e => {
    const btn = e.target.closest('[data-store]');
    if (!btn) return;
    $('#stores-dialog').close();
    setStore(btn.dataset.store, { announce: true });
    route();
  });

  document.addEventListener('click', e => {
    if (e.target.closest('[data-open-stores]')) { renderStorePicker(); openDialog($('#stores-dialog')); }
  });

  function renderContact() {
    const s = store();
    const cta = $('[data-contact-cta]');
    if (s.whatsapp) {
      cta.innerHTML = `<a class="btn btn-light" href="${esc(waLink(s.whatsapp, `Olá, ${s.name}! Vim pelo site e gostaria de ajuda para escolher uma peça.`))}" target="_blank" rel="noopener">${WA_ICON}Conversar no WhatsApp</a>`;
    } else if (s.instagram) {
      cta.innerHTML = `<a class="btn btn-light" href="https://www.instagram.com/${esc(s.instagram)}/" target="_blank" rel="noopener">Falar pelo Instagram</a>`;
    } else {
      cta.innerHTML = '';
    }
    $('[data-stores]').innerHTML = C().stores.map(x => `
      <li>
        <h3>${esc(x.name)}</h3>
        ${x.intro ? `<p>${esc(x.intro)}</p>` : ''}
        ${x.address ? `<p>${esc(x.address)}</p>` : ''}
        ${x.hours ? `<p>${esc(x.hours)}</p>` : ''}
        ${x.instagram ? `<p><a href="https://www.instagram.com/${esc(x.instagram)}/" target="_blank" rel="noopener">@${esc(x.instagram)}</a></p>` : ''}
      </li>`).join('');
  }

  // ---- cards ----------------------------------------------------------------

  function card(p) {
    const out = !available(p);
    const [a, b] = p.imgs;
    const tag = out ? 'Esgotado' : p.isNew ? 'Novo' : '';
    return `<li class="card${out ? ' is-out' : ''}">
      <a class="card-link" href="/p/${esc(p.slug)}">
        <div class="card-media"${b ? ` data-alt-key="${esc(b.k)}" data-alt-pos="${esc(b.pos)}"` : ''}>
          ${a ? `<img src="${imgSrc(a.k, 480)}" srcset="${imgSet(a.k)}" sizes="${CARD_SIZES}" alt="${esc(a.alt || p.name)}" loading="lazy" decoding="async" style="object-position:${esc(a.pos)}">` : ''}
          ${tag ? `<span class="card-tag">${tag}</span>` : ''}
        </div>
        <div class="card-body">
          ${p.brand ? `<span class="card-brand">${esc(p.brand)}</span>` : ''}
          <span class="card-name">${esc(p.name)}</span>
          <span class="card-price">${money(p.price)}</span>
        </div>
      </a>
    </li>`;
  }

  // A segunda foto só é criada e baixada quando o mouse chega no card.
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const media = e.target.closest('.card')?.querySelector('.card-media[data-alt-key]');
    if (!media || media.querySelector('.alt-img')) return;
    const img = new Image();
    img.className = 'alt-img';
    img.alt = '';
    img.decoding = 'async';
    img.style.objectPosition = media.dataset.altPos;
    img.sizes = CARD_SIZES;
    img.onload = () => requestAnimationFrame(() => img.classList.add('ready'));
    img.srcset = imgSet(media.dataset.altKey);
    media.querySelector('img')?.after(img);
  });

  // ---- coleção: filtros, página e pré-carregamento --------------------------

  function readFilters() {
    const u = new URLSearchParams(location.search);
    return {
      cat: category(u.get('cat') || '') ? u.get('cat') : '',
      q: (u.get('q') || '').slice(0, 80),
      ord: ['asc', 'desc'].includes(u.get('ord')) ? u.get('ord') : '',
      disp: u.get('disp') === '1',
      p: Math.max(1, parseInt(u.get('p'), 10) || 1),
    };
  }

  function filtersUrl(f) {
    const u = new URLSearchParams();
    if (f.cat) u.set('cat', f.cat);
    if (f.q) u.set('q', f.q);
    if (f.ord) u.set('ord', f.ord);
    if (f.disp) u.set('disp', '1');
    if (f.p > 1) u.set('p', f.p);
    const qs = u.toString();
    return '/' + (qs ? '?' + qs : '');
  }

  function setFilters(change, { push = true, scroll = false } = {}) {
    const f = { ...readFilters(), p: 1, ...change };
    history[push ? 'pushState' : 'replaceState'](null, '', filtersUrl(f));
    renderCollection();
    if (scroll) scrollToEl($('#colecao'));
  }

  function filtered(f) {
    const q = norm(f.q.trim());
    const list = C().products.filter(p =>
      (!f.cat || p.cat === f.cat) &&
      (!q || norm(`${p.name} ${p.brand} ${category(p.cat)?.name || ''}`).includes(q)) &&
      (!f.disp || available(p)));
    if (f.ord === 'asc') return list.sort((a, b) => a.price - b.price);
    if (f.ord === 'desc') return list.sort((a, b) => b.price - a.price);
    return list;
  }

  function pageNumbers(current, last) {
    const set = new Set([1, last, current - 1, current, current + 1].filter(n => n >= 1 && n <= last));
    const nums = [...set].sort((a, b) => a - b);
    const out = [];
    nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push('…'); out.push(n); });
    return out;
  }

  let currentList = [];

  function renderCollection() {
    const f = readFilters();
    const list = filtered(f);
    currentList = list;
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const page = Math.min(f.p, pages);
    const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    $('[data-chips]').innerHTML = [{ slug: '', name: 'Tudo' }, ...C().categories]
      .map(c => `<button type="button" class="chip" data-cat="${esc(c.slug)}" aria-pressed="${f.cat === c.slug}">${esc(c.name)}</button>`).join('');
    $$('#header-nav a').forEach(a => a.setAttribute('aria-current', String(a.dataset.cat === f.cat)));

    const form = $('[data-toolbar]');
    if (document.activeElement !== form.q) form.q.value = f.q;
    form.disp.checked = f.disp;
    form.ord.value = f.ord;

    const where = f.cat ? ` em ${category(f.cat).name}` : '';
    $('[data-result-count]').textContent = list.length
      ? `${plural(list.length, 'peça', 'peças')}${where}${pages > 1 ? ` · página ${page} de ${pages}` : ''}`
      : '';
    $('[data-collection-sub]').textContent = f.cat ? `${category(f.cat).name} na vitrine da ${store().short}.` : `Tudo o que está na vitrine da ${store().short}.`;

    const grid = $('[data-grid]');
    grid.innerHTML = slice.map(card).join('');
    grid.removeAttribute('aria-busy');
    $('[data-empty]').hidden = list.length > 0;

    const pager = $('[data-pager]');
    if (pages < 2) { pager.innerHTML = ''; return; }
    const link = (n, label, cls = '') => `<a href="${esc(filtersUrl({ ...f, p: n }))}" data-page="${n}" class="${cls}"${n === page && !cls ? ' aria-current="page"' : ''}${label ? ` aria-label="${label}"` : ''}>`;
    pager.innerHTML =
      (page > 1 ? link(page - 1, 'Página anterior', 'pager-step') : '<span class="pager-step" aria-disabled="true">') +
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>Anterior' + (page > 1 ? '</a>' : '</span>') +
      pageNumbers(page, pages).map(n => n === '…' ? '<span class="gap" aria-hidden="true">…</span>' : `${link(n, `Página ${n}`)}${n}</a>`).join('') +
      (page < pages ? link(page + 1, 'Próxima página', 'pager-step') : '<span class="pager-step" aria-disabled="true">') +
        'Próxima<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>' + (page < pages ? '</a>' : '</span>');
  }

  // Baixa as fotos de uma página antes do clique, para ela abrir pronta.
  function prefetchPage(n) {
    const key = filtersUrl({ ...readFilters(), p: n });
    if (state.prefetched.has(key)) return;
    state.prefetched.add(key);
    for (const p of currentList.slice((n - 1) * PAGE_SIZE, n * PAGE_SIZE)) {
      if (!p.imgs[0]) continue;
      const img = new Image();
      img.sizes = CARD_SIZES;
      img.srcset = imgSet(p.imgs[0].k);
    }
  }

  const pagerEl = $('[data-pager]');
  for (const type of ['pointerover', 'focusin', 'touchstart']) {
    pagerEl.addEventListener(type, e => {
      const a = e.target.closest('a[data-page]');
      if (a) prefetchPage(Number(a.dataset.page));
    }, { passive: true });
  }

  // Quando o cliente chega ao fim da página, a próxima já começa a carregar.
  if ('IntersectionObserver' in window && !navigator.connection?.saveData) {
    new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting) || !C()) return;
      const next = pagerEl.querySelector('a[aria-label="Próxima página"]');
      if (next) prefetchPage(Number(next.dataset.page));
    }, { rootMargin: '0px 0px 300px 0px' }).observe(pagerEl);
  }

  pagerEl.addEventListener('click', e => {
    const a = e.target.closest('a[data-page]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    setFilters({ p: Number(a.dataset.page) }, { scroll: true });
  });

  $('[data-chips]').addEventListener('click', e => {
    const chip = e.target.closest('[data-cat]');
    if (chip) setFilters({ cat: chip.dataset.cat });
  });

  const toolbar = $('[data-toolbar]');
  let searchTimer;
  toolbar.addEventListener('submit', e => { e.preventDefault(); toolbar.q.blur(); });
  toolbar.q.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setFilters({ q: toolbar.q.value }, { push: false }), 220);
  });
  toolbar.disp.addEventListener('change', () => setFilters({ disp: toolbar.disp.checked }));
  toolbar.ord.addEventListener('change', () => setFilters({ ord: toolbar.ord.value }));
  $('[data-clear]').addEventListener('click', () => {
    toolbar.q.value = '';
    setFilters({ cat: '', q: '', ord: '', disp: false });
  });

  function renderNav() {
    $('#header-nav').innerHTML = C().categories.slice(0, 6)
      .map(c => `<a href="/?cat=${esc(c.slug)}" data-cat="${esc(c.slug)}">${esc(c.name)}</a>`).join('');
  }

  $('#header-nav').addEventListener('click', e => {
    const a = e.target.closest('a[data-cat]');
    if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    if (currentView !== 'home') { history.pushState(null, '', a.getAttribute('href')); route(); }
    else setFilters({ cat: a.dataset.cat });
    scrollToEl($('#colecao'));
  });

  // ---- página do produto ----------------------------------------------------

  function renderProduct(slug) {
    const p = C().products.find(x => x.slug === slug);
    const box = $('[data-product]');
    $('[data-related]').hidden = true;
    if (!p) {
      $('[data-crumbs]').innerHTML = '';
      box.innerHTML = `<div class="not-found"><h1>Esta peça não está mais na vitrine.</h1><p>Ela pode ter sido vendida ou retirada do catálogo.</p><a class="btn btn-dark" href="/">Ver a coleção</a></div>`;
      document.title = 'Peça não encontrada · C&C Joias';
      return;
    }
    document.title = `${p.name} · C&C Joias`;
    const cat = category(p.cat);
    $('[data-crumbs]').innerHTML = `<a href="/">Início</a><span aria-hidden="true">/</span>${cat ? `<a href="/?cat=${esc(cat.slug)}">${esc(cat.name)}</a><span aria-hidden="true">/</span>` : ''}<span>${esc(p.name)}</span>`;

    if (!p.variants.some(v => v.n === state.variant)) {
      const firstAvail = p.variants.find(v => (v.s[state.storeId] || 0) > 0);
      state.variant = (firstAvail || p.variants[0])?.n || null;
    }

    const main = p.imgs[0];
    box.innerHTML = `
      <div class="gallery">
        <div class="gallery-main">${main ? `<img src="${imgSrc(main.k, 960)}" srcset="${imgSet(main.k)}" sizes="(min-width: 900px) 52vw, 100vw" alt="${esc(main.alt || p.name)}" style="object-position:${esc(main.pos)}" data-main-img>` : ''}</div>
        ${p.imgs.length > 1 ? `<div class="gallery-thumbs" role="group" aria-label="Fotos da peça">${p.imgs.map((im, i) => `
          <button type="button" data-thumb="${i}" aria-current="${i === 0}" aria-label="Foto ${i + 1} de ${p.imgs.length}">
            <img src="${imgSrc(im.k, 480)}" alt="" style="object-position:${esc(im.pos)}" loading="lazy">
          </button>`).join('')}</div>` : ''}
      </div>
      <div class="info">
        <div>
          ${p.brand ? `<p class="info-brand">${esc(p.brand)}</p>` : ''}
          <h1>${esc(p.name)}</h1>
        </div>
        <p class="info-price">${money(p.price)}</p>
        ${showVariants(p) ? `<fieldset class="variants"><legend>Variação</legend><div class="variants-list">${p.variants.map(v => `
          <label class="variant${(v.s[state.storeId] || 0) > 0 ? '' : ' is-out'}">
            <input type="radio" name="variant" value="${esc(v.n)}"${v.n === state.variant ? ' checked' : ''}>
            <span>${esc(v.n)}</span>
          </label>`).join('')}</div></fieldset>` : ''}
        <div data-buy></div>
        ${p.desc ? `<p class="info-desc">${esc(p.desc)}</p>` : ''}
        ${p.sku ? `<p class="info-sku">Código ${esc(p.sku)}</p>` : ''}
      </div>`;

    box.querySelector('.gallery-thumbs')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-thumb]');
      if (!btn) return;
      const im = p.imgs[Number(btn.dataset.thumb)];
      const img = box.querySelector('[data-main-img]');
      img.srcset = imgSet(im.k);
      img.src = imgSrc(im.k, 960);
      img.alt = im.alt || p.name;
      img.style.objectPosition = im.pos;
      $$('[data-thumb]', box).forEach(b => b.setAttribute('aria-current', String(b === btn)));
    });
    box.querySelector('.variants')?.addEventListener('change', e => {
      state.variant = e.target.value;
      renderBuy(p);
    });
    renderBuy(p);

    const related = C().products.filter(x => x.cat === p.cat && x.id !== p.id)
      .sort((a, b) => available(b) - available(a)).slice(0, 4);
    if (related.length) {
      $('[data-related]').hidden = false;
      $('[data-related-title]').textContent = cat ? `Mais em ${cat.name}` : 'Mais peças';
      $('[data-related-list]').innerHTML = related.map(card).join('');
    }
  }

  function renderBuy(p) {
    const s = store();
    const v = state.variant;
    const here = qty(p, s.id, v) > 0;
    const elsewhere = others().filter(o => qty(p, o.id, v) > 0);
    const ask = `Olá, ${s.name}! Tenho interesse nesta peça:\n\n${p.name}${p.sku ? ` (${p.sku})` : ''}${showVariants(p) ? `\nVariação: ${v}` : ''}\n${money(p.price)}\n${location.origin}/p/${p.slug}`;
    $('[data-buy]').innerHTML = `
      <div class="buy">
        <p class="avail${here ? '' : ' is-out'}">${here ? `Disponível na ${esc(s.short)}` : `Esgotado na ${esc(s.short)}`}</p>
        ${!here && elsewhere.length ? `<p class="avail-other">Disponível na ${esc(elsewhere[0].short)}. <button type="button" class="linkish" data-switch="${esc(elsewhere[0].id)}">Ver nessa loja</button></p>` : ''}
        <button type="button" class="btn btn-accent btn-block" data-add${here ? '' : ' disabled'}>${here ? 'Adicionar à sacola' : 'Esgotado nesta loja'}</button>
        ${s.whatsapp ? `<a class="btn btn-line btn-block" href="${esc(waLink(s.whatsapp, ask))}" target="_blank" rel="noopener">${WA_ICON}Perguntar no WhatsApp</a>` : ''}
      </div>`;
    $('[data-add]').addEventListener('click', () => addToBag(p));
    $('[data-switch]')?.addEventListener('click', e => { setStore(e.target.dataset.switch, { announce: true }); route(); });
  }

  function addToBag(p) {
    const v = state.variant;
    const max = qty(p, state.storeId, v);
    if (!max) return;
    const lines = bag().slice();
    const i = lines.findIndex(l => l.id === p.id && l.v === v);
    const inBag = i >= 0 ? lines[i].q : 0;
    if (inBag >= max) {
      toast('Você já tem na sacola todas as unidades disponíveis desta peça.', { label: 'Ver sacola', run: openBag });
      return;
    }
    if (i >= 0) lines[i] = { ...lines[i], q: inBag + 1 };
    else lines.push({ id: p.id, v, q: 1 });
    setBag(lines);
    toast(`${p.name} foi para a sacola.`, { label: 'Ver sacola', run: openBag });
  }

  // ---- sacola ---------------------------------------------------------------

  function renderBagCount(bump) {
    const n = bagCount();
    const el = $('[data-bag-count]');
    el.hidden = n === 0;
    el.textContent = n;
    $('[data-open-bag]').setAttribute('aria-label', n ? `Abrir sacola, ${plural(n, 'item', 'itens')}` : 'Abrir sacola');
    if (bump && n) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  }

  function orderMessage(s, lines) {
    let sub = 0;
    const items = lines.map((l, i) => {
      const p = product(l.id);
      sub += p.price * l.q;
      return `${i + 1}. ${p.name}${p.sku ? ` (${p.sku})` : ''}` +
        (showVariants(p) ? `\n   Variação: ${l.v}` : '') +
        `\n   Qtd: ${l.q} · ${money(p.price * l.q)}` +
        `\n   ${location.origin}/p/${p.slug}`;
    });
    return `Olá, ${s.name}! Gostaria de fazer este pedido:\n\n${items.join('\n\n')}\n\nSubtotal: ${money(sub)}\n\nSei que disponibilidade, entrega e pagamento são confirmados no atendimento.`;
  }

  function renderBag() {
    const s = store();
    const lines = bag();
    const body = $('[data-bag-body]');
    $('#bag-title').textContent = C().stores.length > 1 ? `Sacola · ${s.short}` : 'Sacola';
    const otherNote = others().filter(o => bagCount(o.id))
      .map(o => `<p class="bag-other">Você também tem ${plural(bagCount(o.id), 'item', 'itens')} na sacola da ${esc(o.short)}. <button type="button" class="linkish" data-open-stores>Trocar loja</button></p>`).join('');

    if (!lines.length) {
      body.innerHTML = `<div class="bag-empty"><h3>Sua sacola está vazia.</h3><p>Escolha as peças e envie o pedido pronto para a loja pelo WhatsApp.</p><a class="btn btn-dark" href="/#colecao" data-close data-scroll="colecao">Ver a coleção</a></div>${otherNote}`;
      return;
    }

    let sub = 0, blocked = false;
    const rows = lines.map((l, i) => {
      const p = product(l.id);
      const max = qty(p, s.id, l.v);
      sub += p.price * l.q;
      if (!max) blocked = true;
      const im = p.imgs[0];
      return `<li class="bag-line">
        ${im ? `<img src="${imgSrc(im.k, 480)}" alt="" style="object-position:${esc(im.pos)}">` : '<span></span>'}
        <div>
          <a class="bag-line-name" href="/p/${esc(p.slug)}" data-close>${esc(p.name)}</a>
          ${showVariants(p) ? `<p class="bag-line-meta">${esc(l.v)}</p>` : ''}
          ${!max ? '<p class="bag-line-warn">Esgotada nesta loja. Remova para enviar o pedido.</p>' : ''}
          <div class="bag-line-row">
            <div class="stepper" role="group" aria-label="Quantidade de ${esc(p.name)}">
              <button type="button" data-dec="${i}" aria-label="Diminuir"${l.q <= 1 ? ' disabled' : ''}>−</button>
              <output aria-live="polite">${l.q}</output>
              <button type="button" data-inc="${i}" aria-label="Aumentar"${l.q >= max ? ' disabled' : ''}>+</button>
            </div>
            <span class="bag-line-price">${money(p.price * l.q)}</span>
          </div>
          <button type="button" class="remove" data-remove="${i}">Remover</button>
        </div>
      </li>`;
    }).join('');

    const msg = orderMessage(s, lines);
    let send;
    if (blocked) {
      send = '<button type="button" class="btn btn-accent btn-block" disabled>Remova as peças esgotadas para enviar</button>';
    } else if (s.whatsapp) {
      send = `<a class="btn btn-accent btn-block" href="${esc(waLink(s.whatsapp, msg))}" target="_blank" rel="noopener">${WA_ICON}Enviar pedido pelo WhatsApp</a>`;
    } else {
      send = `<button type="button" class="btn btn-accent btn-block" data-copy>Copiar mensagem do pedido</button>
        <p class="bag-note">O WhatsApp desta loja ainda não foi cadastrado.${s.instagram ? ` Cole a mensagem no direct do <a href="https://www.instagram.com/${esc(s.instagram)}/" target="_blank" rel="noopener">@${esc(s.instagram)}</a>.` : ''}</p>`;
    }

    body.innerHTML = `
      <ul class="bag-lines">${rows}</ul>
      <div class="bag-total"><span>Subtotal</span><strong>${money(sub)}</strong></div>
      <p class="bag-note">Entrega e pagamento são combinados com a loja na conversa.</p>
      <div class="message">
        <p class="message-label">Mensagem que será enviada</p>
        <div class="bubble">${esc(msg)}</div>
      </div>
      ${send}
      ${otherNote}`;

    $('[data-copy]', body)?.addEventListener('click', async e => {
      try { await navigator.clipboard.writeText(msg); e.target.textContent = 'Mensagem copiada'; }
      catch { toast('Não foi possível copiar. Selecione o texto da mensagem e copie manualmente.'); }
    });
  }

  $('[data-bag-body]').addEventListener('click', e => {
    const t = e.target.closest('[data-inc],[data-dec],[data-remove]');
    if (!t) return;
    const lines = bag().slice();
    if (t.dataset.remove != null) lines.splice(Number(t.dataset.remove), 1);
    else {
      const i = Number(t.dataset.inc ?? t.dataset.dec);
      const max = qty(product(lines[i].id), state.storeId, lines[i].v);
      const q = lines[i].q + (t.dataset.inc != null ? 1 : -1);
      lines[i] = { ...lines[i], q: Math.max(1, Math.min(q, max || lines[i].q)) };
    }
    setBag(lines);
    renderBag();
  });

  function openBag() {
    renderBag();
    openDialog($('#bag'));
  }
  $('[data-open-bag]').addEventListener('click', openBag);

  // ---- hero -----------------------------------------------------------------

  const track = $('[data-hero-track]');
  if (track) {
    const slides = $$('.hero-slide', track);
    const current = () => Math.round(track.scrollLeft / track.clientWidth);
    const go = i => track.scrollTo({ left: ((i + slides.length) % slides.length) * track.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
    $('[data-hero-prev]').addEventListener('click', () => go(current() - 1));
    $('[data-hero-next]').addEventListener('click', () => go(current() + 1));
    track.addEventListener('scroll', () => {
      const i = current();
      $('[data-hero-count]').textContent = `${i + 1} / ${slides.length}`;
      slides.forEach((s, j) => s.setAttribute('aria-hidden', String(j !== i)));
    }, { passive: true });
    track.closest('.hero-media').addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') go(current() + 1);
      if (e.key === 'ArrowLeft') go(current() - 1);
    });
  }

  // ---- rotas ----------------------------------------------------------------

  let currentView = null;

  function route() {
    if (!C()) return;
    const m = location.pathname.match(/^\/p\/([^/]+)\/?$/);
    const view = m ? 'product' : 'home';
    $$('[data-view]').forEach(el => { el.hidden = el.dataset.view !== view; });
    if (view === 'product') renderProduct(decodeURIComponent(m[1]));
    else { document.title = 'C&C Joias — joias, bolsas e relógios'; renderCollection(); }
    if (view !== 'home') $$('#header-nav a').forEach(a => a.removeAttribute('aria-current'));
    currentView = view;
  }

  // Links internos trocam de tela sem recarregar a página.
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !(url.pathname === '/' || url.pathname.startsWith('/p/'))) return;
    e.preventDefault();
    const dialog = a.closest('dialog');
    if (dialog) dialog.close();
    const target = a.dataset.scroll;
    const samePage = url.pathname === location.pathname && url.search === location.search;
    if (!samePage) history.pushState(null, '', url.pathname + url.search);
    if (!samePage || currentView !== (url.pathname === '/' ? 'home' : 'product')) route();
    if (target) scrollToEl(document.getElementById(target));
    else if (!samePage) window.scrollTo(0, 0);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('[data-focus-search]')) return;
    if (currentView !== 'home') { history.pushState(null, '', '/'); route(); }
    scrollToEl($('#colecao'));
    setTimeout(() => $('#busca').focus({ preventScroll: true }), reduceMotion ? 0 : 450);
  });

  addEventListener('popstate', route);

  // ---- carga inicial: uma única chamada traz o catálogo inteiro -------------

  async function boot() {
    try {
      const res = await fetch('/api/catalog');
      if (!res.ok) throw new Error(res.status);
      state.catalog = await res.json();
    } catch {
      $('[data-grid]').innerHTML = '';
      $('[data-result-count]').innerHTML = 'Não foi possível carregar a coleção. <button type="button" class="linkish" data-retry>Tentar de novo</button>';
      $('[data-retry]').addEventListener('click', () => location.reload());
      return;
    }
    if (!C().stores.length) return;
    reconcileBags();
    renderNav();
    setStore(saved.get('cc_store', null));
    route();
    if (location.hash) scrollToEl(document.getElementById(location.hash.slice(1)));
  }

  boot();
})();
