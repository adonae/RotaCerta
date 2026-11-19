import {
  STATUS, isActive, loadOrders, saveOrders, loadProfile, saveProfile,
  loadPos, savePos, createOrder, setStatus, buildTrackingPayload, encodePayload,
  formatTime, formatDateTime, timeAgo, isToday, todayLabel,
  esc, waLink, mapsLink, initials, TONE_COLOR, statusChip,
  DB_KEY, SEQ_KEY
} from './shared.js';

/* ----------------------------- ícones ----------------------------- */

const ICONS = {
  route: '<path d="M5 19c6 0 8-14 14-14"/><circle cx="5" cy="19" r="2.2" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="2.2" fill="currentColor" stroke="none"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  navigation: '<path d="m3 11 19-9-9 19-2-8-8-2Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.8L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* ----------------------------- estado ----------------------------- */

const state = {
  orders: loadOrders(),
  profile: loadProfile(),
  filter: 'todas',
  search: '',
  currentId: null,
  tracking: {
    state: 'off',
    watchId: null,
    pos: loadPos(),
    follow: true,
    lastAttach: 0,
    error: ''
  }
};

let map = null;
let mapLayer = null;
let meMarker = null;
let accuracyCircle = null;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ------------------------------ init ------------------------------ */

function init() {
  renderProfileBits();
  const label = $('#today-label');
  if (label) label.textContent = todayLabel();
  renderAll();
  renderGps();
  bindEvents();
  route();
  setInterval(updateAgos, 5000);
}

function bindEvents() {
  const search = $('#search-input');
  if (search) {
    search.addEventListener('input', (e) => {
      state.search = e.target.value;
      renderOrders();
    });
  }

  const form = $('#form-nova');
  if (form) form.addEventListener('submit', submitNewOrder);

  document.addEventListener('click', handleClick);
  document.addEventListener('change', handleChange);
  document.addEventListener('keydown', handleKey);
  window.addEventListener('hashchange', route);
}

/* ------------------------------ rotas ----------------------------- */

const PAGES = ['entregas', 'nova', 'mapa'];

function currentPage() {
  const raw = location.hash.replace(/^#\/?/, '');
  return PAGES.includes(raw) ? raw : 'entregas';
}

function route() {
  const page = currentPage();
  $$('.page').forEach((p) => p.classList.toggle('is-active', p.dataset.page === page));
  $$('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === page));
  document.body.dataset.page = page;

  if (page === 'mapa') {
    ensureMap();
    renderGps();
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 100);
  }
  if (page === 'entregas') {
    renderStats();
    renderOrders();
  }
  window.scrollTo(0, 0);
}

function go(page) {
  const hash = '#/' + page;
  if (location.hash === hash) route();
  else location.hash = hash;
}

/* ---------------------------- renderização ------------------------ */

const FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'ativas', label: 'Ativas' },
  { key: 'pendente', label: 'Pendentes' },
  { key: 'em_rota', label: 'Em rota' },
  { key: 'entregue', label: 'Entregues' },
  { key: 'cancelada', label: 'Canceladas' }
];

function renderProfileBits() {
  const initial = initials(state.profile.nome || 'Motoboy');
  const nameEl = $('#profile-name');
  const initEl = $('#profile-initial');
  const topEl = $('#topbar-initial');
  if (nameEl) nameEl.textContent = state.profile.nome || 'Motoboy';
  if (initEl) initEl.textContent = initial;
  if (topEl) topEl.textContent = initial;
}

function renderAll() {
  renderStats();
  renderFilters();
  renderOrders();
  renderMapOrders();
}

function computeStats() {
  return {
    ativas: state.orders.filter((o) => isActive(o.status)).length,
    rota: state.orders.filter((o) => o.status === 'coletada' || o.status === 'em_rota').length,
    entreguesHoje: state.orders.filter((o) => o.status === 'entregue' && isToday(o.atualizadoEm)).length,
    pendentes: state.orders.filter((o) => o.status === 'pendente').length
  };
}

function renderStats() {
  const box = $('#stats');
  if (!box) return;
  const s = computeStats();
  const items = [
    { label: 'Ativas', value: s.ativas, hint: 'em andamento', icon: 'route', tone: 'brand' },
    { label: 'Em rota', value: s.rota, hint: 'a caminho do cliente', icon: 'navigation', tone: 'violet' },
    { label: 'Entregues hoje', value: s.entreguesHoje, hint: 'concluídas hoje', icon: 'check', tone: 'green' },
    { label: 'Pendentes', value: s.pendentes, hint: 'aguardando aceite', icon: 'clock', tone: 'amber' }
  ];
  box.innerHTML = items.map((i) => `
    <div class="stat stat--${i.tone}">
      <div class="stat__top">
        <span class="stat__label">${i.label}</span>
        <span class="stat__icon">${icon(i.icon)}</span>
      </div>
      <div class="stat__value">${i.value}</div>
      <div class="stat__hint">${i.hint}</div>
    </div>`).join('');
}

function filterCount(key) {
  if (key === 'todas') return state.orders.length;
  if (key === 'ativas') return state.orders.filter((o) => isActive(o.status)).length;
  if (key === 'em_rota') return state.orders.filter((o) => o.status === 'coletada' || o.status === 'em_rota').length;
  return state.orders.filter((o) => o.status === key).length;
}

function renderFilters() {
  const box = $('#filters');
  if (!box) return;
  box.innerHTML = FILTERS.map((f) => `
    <button type="button" class="chip-filter${state.filter === f.key ? ' is-active' : ''}"
      data-filter="${f.key}" role="tab" aria-selected="${state.filter === f.key}">
      ${f.label}<span class="chip-filter__count">${filterCount(f.key)}</span>
    </button>`).join('');
}

function matchesFilter(o) {
  if (state.filter === 'todas') return true;
  if (state.filter === 'ativas') return isActive(o.status);
  if (state.filter === 'em_rota') return o.status === 'coletada' || o.status === 'em_rota';
  return o.status === state.filter;
}

function visibleOrders() {
  const q = state.search.trim().toLowerCase();
  const rank = { em_rota: 0, coletada: 1, aceita: 2, pendente: 3, entregue: 4, cancelada: 5 };
  return state.orders
    .filter(matchesFilter)
    .filter((o) => {
      if (!q) return true;
      return [o.cliente, o.telefone, o.coleta, o.destino, o.codigo]
        .some((v) => String(v || '').toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const d = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (d !== 0) return d;
      return new Date(b.atualizadoEm || 0) - new Date(a.atualizadoEm || 0);
    });
}

function renderOrders() {
  const box = $('#orders');
  if (!box) return;

  if (!state.orders.length) {
    box.innerHTML = `
      <div class="empty">
        <div class="empty__art">${icon('box')}</div>
        <h3>Nenhuma entrega por aqui</h3>
        <p>Cadastre sua primeira entrega para acompanhar o status e compartilhar o link com o cliente.</p>
        <div class="empty__actions">
          <a class="btn btn--primary" href="#/nova">${icon('plus')} Nova entrega</a>
          <button class="btn btn--ghost" type="button" data-demo>Carregar exemplos</button>
        </div>
      </div>`;
    return;
  }

  const list = visibleOrders();
  if (!list.length) {
    box.innerHTML = `
      <div class="empty">
        <div class="empty__art">${icon('search')}</div>
        <h3>Nenhum resultado</h3>
        <p>Ajuste a busca ou escolha outro filtro para ver suas entregas.</p>
        <button class="btn btn--ghost" type="button" data-filter="todas">Ver todas</button>
      </div>`;
    return;
  }

  box.innerHTML = list.map(orderCardHTML).join('');
}

function orderCardHTML(o) {
  const meta = STATUS[o.status] || { label: o.status, tone: 'red' };
  const tone = TONE_COLOR[meta.tone] || '#cbd5e1';
  const action = meta.next ? `
    <button class="btn btn--soft btn--sm" type="button" data-advance="${o.id}">${esc(meta.action)}</button>` : `
    <button class="btn btn--ghost btn--sm" type="button" data-open="${o.id}">Detalhes</button>`;

  return `
    <article class="order ${isActive(o.status) ? '' : 'order--done'}"
      style="--tone:${tone}" data-open="${o.id}" tabindex="0" role="button"
      aria-label="Abrir entrega ${esc(o.codigo)} de ${esc(o.cliente)}">
      <div class="order__head">
        <span class="order__code">${esc(o.codigo)}</span>
        ${statusChip(o.status)}
      </div>
      <h3 class="order__client">${esc(o.cliente || 'Sem nome')}</h3>
      <div class="route">
        <div class="route__row">
          <span class="route__dot route__dot--pickup"></span>
          <span class="route__col">
            <span class="route__k">Coleta</span>
            <span class="route__v">${esc(o.coleta || 'Não informado')}</span>
          </span>
        </div>
        <div class="route__row">
          <span class="route__dot route__dot--drop"></span>
          <span class="route__col">
            <span class="route__k">Entrega</span>
            <span class="route__v">${esc(o.destino || '—')}</span>
          </span>
        </div>
      </div>
      <div class="order__foot">
        <span class="order__meta">Criada <span data-ago="${o.criadoEm}">${timeAgo(o.criadoEm)}</span></span>
        <div class="order__actions">${action}</div>
      </div>
    </article>`;
}

/* ------------------------------ drawer ---------------------------- */

function openDrawer(id) {
  const o = state.orders.find((x) => x.id === id);
  if (!o) return;
  state.currentId = id;
  renderDrawer();
  const drawer = $('#drawer');
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  syncScrollLock();
  const close = drawer.querySelector('[data-close-drawer]');
  if (close) close.focus();
}

function closeDrawer() {
  const drawer = $('#drawer');
  if (!drawer) return;
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  state.currentId = null;
  syncScrollLock();
}

function eventTime(iso) {
  return isToday(iso) ? formatTime(iso) : formatDateTime(iso);
}

function posLineHTML(o) {
  const pos = o.posicao;
  if (!pos) {
    return `${icon('pin')}<span>Nenhuma localização registrada ainda. Ative o rastreamento na aba <strong>Mapa</strong>.</span>`;
  }
  const acc = Number.isFinite(pos.acc) ? ` · precisão ±${Math.round(pos.acc)} m` : '';
  return `${icon('pin')}<span>Localização registrada <strong>${esc(timeAgo(pos.em))}</strong>${acc}</span>`;
}

function renderDrawer() {
  const panel = $('#drawer-panel');
  if (!panel) return;
  const o = state.orders.find((x) => x.id === state.currentId);
  if (!o) {
    closeDrawer();
    return;
  }

  const meta = STATUS[o.status] || { tone: 'red', label: o.status };
  const events = (Array.isArray(o.timeline) ? o.timeline : [])
    .slice()
    .sort((a, b) => new Date(a.em) - new Date(b.em));

  const timeline = events.map((ev, i) => {
    const st = STATUS[ev.status] || { label: ev.status };
    const label = ev.status === 'pendente' ? 'Entrega criada' : st.label;
    const done = i < events.length - 1;
    const current = i === events.length - 1;
    return `
      <li class="${done ? 'is-done' : ''}${current ? ' is-current' : ''}">
        <span class="timeline__dot">${done ? icon('check') : ''}</span>
        <span class="timeline__label">${esc(label)}</span>
        <span class="timeline__time">${esc(eventTime(ev.em))}</span>
      </li>`;
  }).join('');

  const phone = String(o.telefone || '').trim();
  const waText = `Olá! Sobre a entrega ${o.codigo}${o.destino ? ' para ' + o.destino : ''}.`;

  panel.innerHTML = `
    <div class="drawer__head">
      <div class="drawer__heading">
        <span class="order__code">${esc(o.codigo)}</span>
        <h2 id="drawer-title">${esc(o.cliente || 'Sem nome')}</h2>
        ${statusChip(o.status)}
      </div>
      <button class="btn btn--icon btn--ghost" type="button" data-close-drawer aria-label="Fechar detalhes">${icon('x')}</button>
    </div>

    <div class="drawer__body">
      ${phone ? `
      <div class="quick-actions">
        <a class="btn btn--ghost btn--sm" href="tel:${esc(phone.replace(/[^\d+]/g, ''))}">${icon('phone')} Ligar</a>
        <a class="btn btn--ghost btn--sm" href="${esc(waLink(phone, waText))}" target="_blank" rel="noopener">${icon('chat')} WhatsApp</a>
      </div>` : ''}

      <section class="block">
        <h3 class="block__title">Rota</h3>
        <div class="route-card">
          <div class="route__row">
            <span class="route__dot route__dot--pickup"></span>
            <span class="route__col">
              <span class="route__k">Coleta</span>
              <span class="route__v">${esc(o.coleta || 'Não informado')}</span>
            </span>
          </div>
          <div class="route__row">
            <span class="route__dot route__dot--drop"></span>
            <span class="route__col">
              <span class="route__k">Entrega</span>
              <span class="route__v">${esc(o.destino || '—')}</span>
            </span>
          </div>
          ${o.referencia ? `<p class="route__note"><strong>Referência:</strong> ${esc(o.referencia)}</p>` : ''}
          ${o.observacao ? `<p class="route__note"><strong>Observação:</strong> ${esc(o.observacao)}</p>` : ''}
          <div class="route-card__actions">
            ${o.destino ? `<a class="btn btn--ghost btn--sm" href="${esc(mapsLink(o.destino))}" target="_blank" rel="noopener">${icon('external')} Abrir no Maps</a>` : ''}
            <button class="btn btn--ghost btn--sm" type="button" data-geocode="${o.id}">${icon('pin')} ${o.destinoCoords ? 'Atualizar no mapa' : 'Localizar no mapa'}</button>
          </div>
        </div>
      </section>

      <section class="block">
        <h3 class="block__title">Localização</h3>
        <div class="pos-line" data-pos-line>${posLineHTML(o)}</div>
      </section>

      <section class="block">
        <h3 class="block__title">Linha do tempo</h3>
        <ul class="timeline">${timeline}</ul>
      </section>

      <section class="block share-box">
        <h3 class="block__title">Link de acompanhamento</h3>
        <p class="muted">Gere um link para o cliente acompanhar o status e a última localização registrada.</p>
        <button class="btn btn--soft btn--block" type="button" data-share="${o.id}">${icon('external')} Gerar link para o cliente</button>
      </section>
    </div>

    <div class="drawer__foot">
      ${meta.next ? `<button class="btn btn--primary btn--block" type="button" data-advance="${o.id}">${esc(meta.action)}</button>` : ''}
      ${isActive(o.status)
        ? `<button class="btn btn--ghost btn--block btn--danger-text" type="button" data-cancel="${o.id}">Cancelar entrega</button>`
        : `<button class="btn btn--ghost btn--block btn--danger-text" type="button" data-delete="${o.id}">${icon('trash')} Excluir entrega</button>`}
    </div>`;
}

/* ----------------------------- ações ----------------------------- */

function submitNewOrder(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const data = Object.fromEntries(new FormData(form));

  $$('.field', form).forEach((f) => f.classList.remove('is-invalid'));
  $$('.error', form).forEach((p) => { p.textContent = ''; });

  const errors = {};
  if (!String(data.cliente || '').trim()) errors.cliente = 'Informe o nome do cliente.';
  if (!String(data.destino || '').trim()) errors.destino = 'Informe o endereço de entrega.';

  if (Object.keys(errors).length) {
    Object.entries(errors).forEach(([key, message]) => {
      const input = form.querySelector(`[name="${key}"]`);
      const field = input ? input.closest('.field') : null;
      if (field) field.classList.add('is-invalid');
      const err = form.querySelector(`[data-error="${key}"]`);
      if (err) err.textContent = message;
    });
    const first = form.querySelector('.field.is-invalid input');
    if (first) first.focus();
    return;
  }

  const order = createOrder(data);
  state.orders.push(order);
  saveOrders(state.orders);
  form.reset();
  renderAll();
  toast('Entrega ' + order.codigo + ' criada');
  go('entregas');
  openDrawer(order.id);
}

function advanceOrder(id) {
  const o = state.orders.find((x) => x.id === id);
  if (!o) return;
  const meta = STATUS[o.status];
  if (!meta || !meta.next) return;

  const before = { status: o.status, atualizadoEm: o.atualizadoEm, timeline: o.timeline.slice() };
  setStatus(o, meta.next, loadPos());
  saveOrders(state.orders);
  renderAll();
  if (state.currentId === id) renderDrawer();

  const messages = {
    aceita: 'Entrega aceita',
    coletada: 'Coleta confirmada',
    em_rota: 'Entrega em rota',
    entregue: 'Entrega concluída!'
  };
  toast(messages[meta.next] || 'Status atualizado', {
    actionLabel: 'Desfazer',
    onAction: () => {
      o.status = before.status;
      o.atualizadoEm = before.atualizadoEm;
      o.timeline = before.timeline;
      saveOrders(state.orders);
      renderAll();
      if (state.currentId === id) renderDrawer();
      toast('Alteração desfeita');
    }
  });
}

function confirmCancel(id) {
  const o = state.orders.find((x) => x.id === id);
  if (!o) return;
  confirmModal({
    title: 'Cancelar esta entrega?',
    message: `A entrega <strong>${esc(o.codigo)}</strong> de ${esc(o.cliente)} ficará com o status <strong>Cancelada</strong>.`,
    confirmLabel: 'Cancelar entrega',
    onConfirm: () => {
      const before = { status: o.status, atualizadoEm: o.atualizadoEm, timeline: o.timeline.slice() };
      setStatus(o, 'cancelada');
      saveOrders(state.orders);
      renderAll();
      renderDrawer();
      toast('Entrega cancelada', {
        actionLabel: 'Desfazer',
        onAction: () => {
          o.status = before.status;
          o.atualizadoEm = before.atualizadoEm;
          o.timeline = before.timeline;
          saveOrders(state.orders);
          renderAll();
          if (state.currentId === id) renderDrawer();
          toast('Cancelamento desfeito');
        }
      });
    }
  });
}

function confirmDelete(id) {
  const o = state.orders.find((x) => x.id === id);
  if (!o) return;
  const index = state.orders.indexOf(o);
  confirmModal({
    title: 'Excluir esta entrega?',
    message: `A entrega <strong>${esc(o.codigo)}</strong> de ${esc(o.cliente)} será removida deste aparelho. Essa ação pode ser desfeita logo depois.`,
    confirmLabel: 'Excluir',
    onConfirm: () => {
      state.orders.splice(index, 1);
      saveOrders(state.orders);
      if (state.currentId === id) closeDrawer();
      renderAll();
      toast('Entrega excluída', {
        actionLabel: 'Desfazer',
        onAction: () => {
          state.orders.splice(index, 0, o);
          saveOrders(state.orders);
          renderAll();
          toast('Entrega restaurada');
        }
      });
    }
  });
}

async function geocodeOrder(id) {
  const o = state.orders.find((x) => x.id === id);
  if (!o || !o.destino) return;
  const btn = document.querySelector(`[data-geocode="${id}"]`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Localizando…';
  }
  try {
    const query = [o.destino, 'Brasil'].filter(Boolean).join(', ');
    const res = await fetch(
      'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=' +
      encodeURIComponent(query),
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error('Endereço não encontrado');
    o.destinoCoords = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
    saveOrders(state.orders);
    renderMapOrders();
    toast('Destino localizado no mapa');
  } catch (err) {
    toast('Não foi possível localizar o endereço. Inclua número e cidade e tente novamente.', { tone: 'error' });
  } finally {
    if (state.currentId === id) renderDrawer();
  }
}

/* ------------------------------ mapa ------------------------------ */

function ensureMap() {
  if (map) return;
  const el = document.getElementById('map');
  if (!el) return;

  if (!window.L) {
    el.innerHTML = '<div class="map-missing">Carregando mapa…</div>';
    window.addEventListener('load', () => {
      if (window.L) {
        el.innerHTML = '';
        ensureMap();
      } else {
        el.innerHTML = '<div class="map-missing">Mapa indisponível sem conexão. Verifique a internet e recarregue a página.</div>';
      }
    }, { once: true });
    return;
  }

  map = window.L.map(el, { zoomControl: false, attributionControl: true })
    .setView([-23.5505, -46.6333], 13);

  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  window.L.control.zoom({ position: 'bottomright' }).addTo(map);
  mapLayer = window.L.layerGroup().addTo(map);

  map.on('dragstart', () => {
    if (state.tracking.follow) {
      state.tracking.follow = false;
      if (state.tracking.state === 'on') renderGps();
    }
  });

  const pos = state.tracking.pos;
  if (pos) {
    upsertMe(pos);
    map.setView([pos.lat, pos.lng], 15);
  }
  renderMapOrders();
}

function meIcon() {
  return window.L.divIcon({
    className: 'me-icon',
    html: '<span class="me-pulse"></span><span class="me-dot"></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

function destIcon() {
  return window.L.divIcon({
    className: 'dest-icon',
    html: '<span class="dest-pin"></span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
}

function upsertMe(pos) {
  if (!map) return;
  const latlng = [pos.lat, pos.lng];
  if (!meMarker) {
    meMarker = window.L.marker(latlng, { icon: meIcon(), zIndexOffset: 1000 }).addTo(map);
    accuracyCircle = window.L.circle(latlng, {
      radius: pos.acc || 25, color: '#f0522b', weight: 1,
      fillColor: '#f0522b', fillOpacity: 0.08
    }).addTo(map);
  } else {
    meMarker.setLatLng(latlng);
    if (accuracyCircle) accuracyCircle.setLatLng(latlng).setRadius(pos.acc || 25);
  }
}

function renderMapOrders() {
  const list = state.orders
    .filter((o) => isActive(o.status))
    .sort((a, b) => new Date(b.atualizadoEm || 0) - new Date(a.atualizadoEm || 0));

  const box = $('#map-orders');
  if (box) {
    box.innerHTML = list.length
      ? list.map((o) => `
        <button class="mini-order" type="button" data-focus="${o.id}">
          <span class="mini-order__top">
            <span class="mini-order__code">${esc(o.codigo)}</span>
            ${statusChip(o.status)}
          </span>
          <span class="mini-order__name">${esc(o.cliente)}</span>
          <span class="mini-order__addr">${icon('pin')} ${esc(o.destino)}</span>
        </button>`).join('')
      : '<p class="mini-empty">Nenhuma entrega em andamento.</p>';
  }

  const count = $('#map-count');
  if (count) count.textContent = String(list.length);

  if (!map || !mapLayer || !window.L) return;
  mapLayer.clearLayers();

  list.forEach((o) => {
    if (!o.destinoCoords) return;
    window.L.marker([o.destinoCoords.lat, o.destinoCoords.lng], { icon: destIcon() })
      .addTo(mapLayer)
      .bindPopup(`
        <div class="map-pop">
          <strong>${esc(o.cliente)}</strong>
          <span>${esc(o.destino)}</span>
          <button type="button" data-open="${o.id}">Ver detalhes</button>
        </div>`);
  });
}

function focusOrder(id) {
  const o = state.orders.find((x) => x.id === id);
  if (!o) return;
  if (o.destinoCoords && map) {
    map.setView([o.destinoCoords.lat, o.destinoCoords.lng], 16);
  } else {
    openDrawer(id);
    toast('Destino sem localização no mapa. Use "Localizar no mapa" nos detalhes.');
  }
}

/* ---------------------------- rastreamento ------------------------ */

const GEO_ERRORS = {
  1: 'Permissão de localização negada. Libere o acesso ao GPS nas configurações do navegador.',
  2: 'Sinal de GPS indisponível no momento.',
  3: 'O GPS demorou para responder. Tente novamente.'
};

function startTracking() {
  if (!('geolocation' in navigator)) {
    state.tracking.state = 'error';
    state.tracking.error = 'Este navegador não oferece suporte a GPS.';
    renderGps();
    return;
  }
  if (!window.isSecureContext) {
    state.tracking.state = 'error';
    state.tracking.error = 'O GPS exige HTTPS ou localhost.';
    renderGps();
    return;
  }

  stopWatchOnly();
  state.tracking.state = 'loading';
  state.tracking.error = '';
  renderGps();

  try {
    state.tracking.watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000
    });
  } catch (err) {
    state.tracking.state = 'error';
    state.tracking.error = 'Não foi possível iniciar o GPS.';
    renderGps();
  }
}

function stopWatchOnly() {
  if (state.tracking.watchId != null) {
    navigator.geolocation.clearWatch(state.tracking.watchId);
    state.tracking.watchId = null;
  }
}

function stopTracking() {
  stopWatchOnly();
  state.tracking.state = 'off';
  renderGps();
}

function onPosition(p) {
  const pos = {
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    acc: p.coords.accuracy,
    vel: p.coords.speed,
    em: new Date().toISOString()
  };
  const first = state.tracking.state !== 'on';
  state.tracking.pos = pos;
  state.tracking.state = 'on';
  savePos(pos);

  ensureMap();
  upsertMe(pos);
  if (state.tracking.follow && map) {
    map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 15), { animate: true });
  }

  if (Date.now() - state.tracking.lastAttach > 8000) {
    state.tracking.lastAttach = Date.now();
    attachPosition(pos);
  }

  if (first) renderGps();
  updateGpsMetrics();
}

function onPositionError(err) {
  stopWatchOnly();
  state.tracking.state = 'error';
  state.tracking.error = GEO_ERRORS[err && err.code] || 'Não foi possível obter sua localização.';
  renderGps();
}

function attachPosition(pos) {
  const targets = state.orders.filter((o) => ['aceita', 'coletada', 'em_rota'].includes(o.status));
  if (!targets.length) return;
  targets.forEach((o) => { o.posicao = pos; });
  saveOrders(state.orders);
  if (state.currentId) {
    const current = targets.find((o) => o.id === state.currentId);
    const line = document.querySelector('[data-pos-line]');
    if (current && line) line.innerHTML = posLineHTML(current);
  }
}

function centerOnMe() {
  const pos = state.tracking.pos;
  if (!pos || !map) {
    startTracking();
    return;
  }
  state.tracking.follow = true;
  map.setView([pos.lat, pos.lng], 16);
  if (state.tracking.state === 'on') renderGps();
}

function renderGps() {
  const card = $('#gps-card');
  if (!card) return;
  const t = state.tracking;
  const pos = t.pos;

  if (t.state === 'on' && pos) {
    const acc = Number.isFinite(pos.acc) ? `±${Math.round(pos.acc)} m` : '—';
    const speed = Number.isFinite(pos.vel) ? `${Math.round(pos.vel * 3.6)} km/h` : '—';
    card.innerHTML = `
      <div class="gps__head">
        <span class="gps__dot gps__dot--on"></span>
        <div><strong>Rastreamento ativo</strong><small>Posição anexada às entregas</small></div>
      </div>
      <div class="gps__metrics">
        <div><span>Precisão</span><strong id="gps-acc">${acc}</strong></div>
        <div><span>Velocidade</span><strong id="gps-speed">${speed}</strong></div>
      </div>
      <p class="gps__last">Atualizado <span data-ago="${pos.em}">${timeAgo(pos.em)}</span></p>
      <label class="switch">
        <input type="checkbox" id="follow-toggle" ${t.follow ? 'checked' : ''}>
        <span>Seguir minha posição no mapa</span>
      </label>
      <div class="gps__actions">
        <button class="btn btn--ghost btn--sm" type="button" data-gps="center">${icon('target')} Centralizar</button>
        <button class="btn btn--ghost btn--sm" type="button" data-gps="stop">Parar</button>
      </div>`;
  } else if (t.state === 'loading') {
    card.innerHTML = `
      <div class="gps__head">
        <span class="gps__dot gps__dot--wait"></span>
        <div><strong>Conectando ao GPS…</strong><small>Aguarde alguns segundos</small></div>
      </div>
      <p class="gps__text">Se o navegador pedir permissão, escolha <strong>Permitir</strong>.</p>
      <button class="btn btn--ghost btn--sm" type="button" data-gps="stop">Cancelar</button>`;
  } else if (t.state === 'error') {
    card.innerHTML = `
      <div class="gps__head">
        <span class="gps__dot gps__dot--err"></span>
        <div><strong>Não foi possível usar o GPS</strong><small>${esc(t.error)}</small></div>
      </div>
      <p class="gps__text">${window.isSecureContext
        ? 'Verifique a permissão de localização nas configurações do navegador e tente de novo.'
        : 'O navegador só libera o GPS em endereços HTTPS (ou localhost). Publique o site para usar no celular.'}</p>
      <button class="btn btn--primary btn--sm" type="button" data-gps="start">${icon('target')} Tentar novamente</button>`;
  } else {
    card.innerHTML = `
      <div class="gps__head">
        <span class="gps__dot"></span>
        <div><strong>Rastreamento desligado</strong><small>Ative o GPS para compartilhar sua posição</small></div>
      </div>
      <p class="gps__text">Sua localização é anexada automaticamente às entregas ativas e vai no link de acompanhamento.</p>
      ${pos ? `<p class="gps__last">Última posição <span data-ago="${pos.em}">${timeAgo(pos.em)}</span></p>` : ''}
      <div class="gps__actions">
        <button class="btn btn--primary btn--sm" type="button" data-gps="start">${icon('target')} Ativar rastreamento</button>
        ${pos ? `<button class="btn btn--ghost btn--sm" type="button" data-gps="center">${icon('pin')} Ver no mapa</button>` : ''}
      </div>`;
  }

  const headerBtn = $('#btn-track');
  if (headerBtn) {
    if (t.state === 'on') {
      headerBtn.dataset.gps = 'stop';
      headerBtn.className = 'btn btn--ghost';
      headerBtn.innerHTML = icon('x') + ' Parar rastreamento';
    } else if (t.state === 'loading') {
      headerBtn.dataset.gps = 'stop';
      headerBtn.className = 'btn btn--ghost';
      headerBtn.innerHTML = 'Conectando…';
    } else {
      headerBtn.dataset.gps = 'start';
      headerBtn.className = 'btn btn--primary';
      headerBtn.innerHTML = icon('target') + ' Ativar rastreamento';
    }
  }
  updateAgos();
}

function updateGpsMetrics() {
  const pos = state.tracking.pos;
  if (!pos) return;
  const acc = $('#gps-acc');
  const speed = $('#gps-speed');
  if (acc) acc.textContent = Number.isFinite(pos.acc) ? `±${Math.round(pos.acc)} m` : '—';
  if (speed) speed.textContent = Number.isFinite(pos.vel) ? `${Math.round(pos.vel * 3.6)} km/h` : '—';
  const ago = document.querySelector('#gps-card [data-ago]');
  if (ago) {
    ago.dataset.ago = pos.em;
    ago.textContent = timeAgo(pos.em);
  }
}

/* ------------------------------ link ------------------------------ */

function trackingUrl(order) {
  const payload = buildTrackingPayload(order, state.profile, loadPos());
  const url = new URL('tracking.html', window.location.href);
  url.hash = 'd=' + encodePayload(payload);
  return url.href;
}

function openShareModal(id) {
  const o = state.orders.find((x) => x.id === id);
  if (!o) return;
  const url = trackingUrl(o);
  const firstName = String(o.cliente || '').split(/\s+/)[0] || '';
  const waText = `Olá${firstName ? ', ' + firstName : ''}! Acompanhe a entrega ${o.codigo} por este link: ${url}`;

  const modal = openModal(`
    <div class="modal__head">
      <div>
        <h2>Link de acompanhamento</h2>
        <p class="modal__sub">${esc(o.codigo)} · ${esc(o.cliente)}</p>
      </div>
      <button class="btn btn--icon btn--ghost" type="button" data-close-modal aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal__body">
      <label class="field">
        <span>Link para o cliente</span>
        <input id="share-url" readonly value="${esc(url)}">
      </label>
      <div class="share-actions">
        <button class="btn btn--primary" type="button" data-copy-link>${icon('copy')} Copiar link</button>
        <a class="btn btn--ghost" href="${esc(url)}" target="_blank" rel="noopener">${icon('external')} Prévia</a>
        <a class="btn btn--ghost" href="${esc(waLink(o.telefone, waText))}" target="_blank" rel="noopener">${icon('chat')} WhatsApp</a>
      </div>
      <div class="notice">
        ${icon('clock')}
        <p>O link é um retrato da entrega <strong>agora</strong>. Sempre que mudar o status ou a localização, gere um novo link para o cliente ver a situação atualizada.</p>
      </div>
    </div>
    <div class="modal__foot">
      <button class="btn btn--ghost" type="button" data-close-modal>Fechar</button>
    </div>`);

  const copyBtn = modal.querySelector('[data-copy-link]');
  copyBtn.addEventListener('click', () => copyText(url));
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      toast('Link copiado');
      return;
    }
    throw new Error('clipboard indisponível');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast('Link copiado');
    } catch {
      toast('Não foi possível copiar. Selecione o link manualmente.', { tone: 'error' });
    }
    ta.remove();
  }
}

/* --------------------------- configurações ------------------------ */

function openSettings() {
  const p = state.profile;
  const modal = openModal(`
    <div class="modal__head">
      <div>
        <h2>Configurações</h2>
        <p class="modal__sub">Seus dados e segurança</p>
      </div>
      <button class="btn btn--icon btn--ghost" type="button" data-close-modal aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal__body stack">
      <div class="form__grid">
        <div class="field">
          <label for="set-nome">Seu nome</label>
          <input id="set-nome" value="${esc(p.nome)}" placeholder="Ex.: João Silva" autocomplete="name">
        </div>
        <div class="field">
          <label for="set-tel">Telefone</label>
          <input id="set-tel" value="${esc(p.telefone)}" placeholder="(11) 91234-5678" autocomplete="tel">
        </div>
      </div>
      <div class="field">
        <label for="set-veiculo">Veículo / placa</label>
        <input id="set-veiculo" value="${esc(p.veiculo)}" placeholder="Ex.: Honda CG 160 · ABC1D23">
      </div>
      <hr class="divider">
      <div class="settings-block">
        <h3>Backup dos dados</h3>
        <p class="muted">Tudo fica salvo neste navegador. Exporte um arquivo para não perder nada.</p>
        <div class="row">
          <button class="btn btn--ghost" type="button" data-export>${icon('download')} Exportar</button>
          <button class="btn btn--ghost" type="button" data-import>${icon('upload')} Importar</button>
        </div>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      </div>
      ${state.orders.length === 0 ? `
      <div class="settings-block">
        <h3>Dados de exemplo</h3>
        <p class="muted">Não quer começar do zero? Carregue três entregas de demonstração.</p>
        <button class="btn btn--ghost" type="button" data-demo>Carregar exemplos</button>
      </div>` : ''}
      <div class="settings-block settings-block--danger">
        <h3>Zona de risco</h3>
        <p class="muted">Apagar todas as entregas salvas neste aparelho.</p>
        <button class="btn btn--danger" type="button" data-clear>${icon('trash')} Apagar entregas</button>
      </div>
    </div>
    <div class="modal__foot">
      <button class="btn btn--ghost" type="button" data-close-modal>Fechar</button>
      <button class="btn btn--primary" type="button" data-save-settings>Salvar</button>
    </div>`);

  modal.querySelector('[data-save-settings]').addEventListener('click', () => {
    const nome = modal.querySelector('#set-nome').value.trim();
    state.profile = {
      nome: nome || 'Motoboy',
      telefone: modal.querySelector('#set-tel').value.trim(),
      veiculo: modal.querySelector('#set-veiculo').value.trim()
    };
    saveProfile(state.profile);
    renderProfileBits();
    closeModal(modal);
    toast('Configurações salvas');
  });

  modal.querySelector('[data-import]').addEventListener('click', () => {
    modal.querySelector('#import-file').click();
  });
  modal.querySelector('#import-file').addEventListener('change', (e) => importFile(e.target));
}

function exportData() {
  const data = {
    app: 'RotaCerta',
    versao: 1,
    exportadoEm: new Date().toISOString(),
    perfil: state.profile,
    entregas: state.orders
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rotacerta-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup exportado');
}

function importFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(String(reader.result || ''));
    } catch {
      toast('Arquivo inválido. Selecione um backup do RotaCerta.', { tone: 'error' });
      return;
    }
    const list = Array.isArray(parsed) ? parsed : parsed && parsed.entregas;
    if (!Array.isArray(list)) {
      toast('Arquivo inválido. Selecione um backup do RotaCerta.', { tone: 'error' });
      return;
    }
    const normalized = normalizeImported(list);
    if (!normalized.length) {
      toast('Nenhuma entrega encontrada no arquivo.', { tone: 'error' });
      return;
    }
    confirmModal({
      title: 'Substituir os dados atuais?',
      message: `O backup tem <strong>${normalized.length}</strong> entrega(s). As entregas atuais serão substituídas.`,
      confirmLabel: 'Importar',
      onConfirm: () => {
        state.orders = normalized;
        saveOrders(state.orders);
        closeDrawer();
        closeAllModals();
        renderAll();
        toast('Backup importado');
      }
    });
  };
  reader.readAsText(file);
}

function normalizeImported(list) {
  const seen = new Set();
  return list.filter((o) => o && typeof o === 'object' && typeof o.status === 'string')
    .map((o, i) => {
      let id = typeof o.id === 'string' ? o.id : 'ord_imp_' + i;
      while (seen.has(id)) id = id + '_' + i;
      seen.add(id);
      const created = o.criadoEm || new Date().toISOString();
      return {
        ...o,
        id,
        codigo: o.codigo || 'RC-' + String(i + 1).padStart(4, '0'),
        cliente: String(o.cliente || ''),
        destino: String(o.destino || ''),
        coleta: String(o.coleta || ''),
        timeline: Array.isArray(o.timeline) && o.timeline.length
          ? o.timeline
          : [{ status: o.status, em: o.atualizadoEm || created }],
        criadoEm: created,
        atualizadoEm: o.atualizadoEm || created,
        posicao: o.posicao || null,
        destinoCoords: o.destinoCoords || null
      };
    });
}

function confirmClear() {
  confirmModal({
    title: 'Apagar todas as entregas?',
    message: 'Todas as entregas salvas neste navegador serão removidas. Os códigos voltam a começar em RC-0001.',
    confirmLabel: 'Apagar tudo',
    onConfirm: () => {
      state.orders = [];
      localStorage.removeItem(DB_KEY);
      localStorage.removeItem(SEQ_KEY);
      closeDrawer();
      closeAllModals();
      renderAll();
      toast('Entregas apagadas');
    }
  });
}

/* --------------------------- dados de exemplo --------------------- */

function loadDemo() {
  if (state.orders.length) {
    toast('Já existem entregas salvas neste aparelho.');
    return;
  }
  const now = Date.now();
  const iso = (mins) => new Date(now - mins * 60000).toISOString();

  state.orders = [
    {
      id: 'demo_ana', codigo: 'RC-0001', cliente: 'Ana Souza', telefone: '(11) 98812-4477',
      coleta: 'Padaria Bella Vista — Rua Augusta, 1200', destino: 'Av. Paulista, 1578 — Bela Vista, São Paulo',
      referencia: 'Portaria azul', observacao: 'Entregar na recepção',
      status: 'em_rota', criadoEm: iso(48), atualizadoEm: iso(9),
      timeline: [
        { status: 'pendente', em: iso(48) }, { status: 'aceita', em: iso(42) },
        { status: 'coletada', em: iso(26) }, { status: 'em_rota', em: iso(9) }
      ],
      posicao: { lat: -23.5578, lng: -46.6617, acc: 12, em: iso(4) },
      destinoCoords: { lat: -23.5614, lng: -46.6559 }
    },
    {
      id: 'demo_carlos', codigo: 'RC-0002', cliente: 'Carlos Lima', telefone: '(11) 97744-2210',
      coleta: 'Farmácia Central — Rua da Consolação, 900', destino: 'Rua Oscar Freire, 500 — Jardins, São Paulo',
      referencia: '', observacao: '',
      status: 'aceita', criadoEm: iso(18), atualizadoEm: iso(12),
      timeline: [{ status: 'pendente', em: iso(18) }, { status: 'aceita', em: iso(12) }],
      posicao: null,
      destinoCoords: { lat: -23.5620, lng: -46.6690 }
    },
    {
      id: 'demo_juliana', codigo: 'RC-0003', cliente: 'Juliana Prado', telefone: '(11) 96633-8811',
      coleta: 'Mercado São Jorge — Av. Brigadeiro Luís Antônio, 2000', destino: 'Rua Pamplona, 800 — Jardim Paulista, São Paulo',
      referencia: 'Interfone 42', observacao: '',
      status: 'entregue', criadoEm: iso(120), atualizadoEm: iso(55),
      timeline: [
        { status: 'pendente', em: iso(120) }, { status: 'aceita', em: iso(112) },
        { status: 'coletada', em: iso(95) }, { status: 'em_rota', em: iso(80) },
        { status: 'entregue', em: iso(55) }
      ],
      posicao: null,
      destinoCoords: { lat: -23.5655, lng: -46.6520 }
    }
  ];

  saveOrders(state.orders);
  closeAllModals();
  renderAll();
  renderGps();
  toast('3 entregas de exemplo carregadas');
}

/* ----------------------------- modais ----------------------------- */

function openModal(html) {
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `
    <div class="modal__scrim" data-close-modal></div>
    <div class="modal__panel" role="dialog" aria-modal="true">${html}</div>`;
  $('#modal-root').appendChild(wrap);
  void wrap.offsetHeight;
  wrap.classList.add('is-open');
  syncScrollLock();
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-modal]')) closeModal(wrap);
  });
  syncScrollLock();
  const focusable = wrap.querySelector('input:not([type="file"]), button');
  if (focusable) setTimeout(() => focusable.focus(), 80);
  return wrap;
}

function closeModal(el) {
  if (!el || !el.parentNode) return;
  el.classList.remove('is-open');
  setTimeout(() => el.remove(), 220);
  syncScrollLock();
}

function closeAllModals() {
  $$('.modal').forEach((m) => { m.classList.remove('is-open'); setTimeout(() => m.remove(), 220); });
  syncScrollLock();
}

function confirmModal({ title, message, confirmLabel, onConfirm }) {
  const modal = openModal(`
    <div class="modal__head">
      <div><h2>${esc(title)}</h2></div>
      <button class="btn btn--icon btn--ghost" type="button" data-close-modal aria-label="Fechar">${icon('x')}</button>
    </div>
    <div class="modal__body">
      <p class="confirm-text">${message}</p>
    </div>
    <div class="modal__foot">
      <button class="btn btn--ghost" type="button" data-close-modal>Voltar</button>
      <button class="btn btn--danger" type="button" data-confirm>${esc(confirmLabel || 'Confirmar')}</button>
    </div>`);
  modal.querySelector('[data-confirm]').addEventListener('click', () => {
    closeModal(modal);
    onConfirm();
  });
  return modal;
}

function syncScrollLock() {
  const open = document.querySelectorAll('.drawer.is-open, .modal.is-open').length > 0;
  document.body.classList.toggle('no-scroll', open);
}

/* ----------------------------- eventos ---------------------------- */

function handleClick(e) {
  const target = e.target;

  const navLink = target.closest('[data-nav]');
  if (navLink) {
    closeDrawer();
    return;
  }

  const filterBtn = target.closest('[data-filter]');
  if (filterBtn) {
    e.preventDefault();
    state.filter = filterBtn.dataset.filter;
    renderFilters();
    renderOrders();
    return;
  }

  const advanceBtn = target.closest('[data-advance]');
  if (advanceBtn) {
    e.preventDefault();
    advanceOrder(advanceBtn.dataset.advance);
    return;
  }

  const shareBtn = target.closest('[data-share]');
  if (shareBtn) {
    e.preventDefault();
    openShareModal(shareBtn.dataset.share);
    return;
  }

  const geocodeBtn = target.closest('[data-geocode]');
  if (geocodeBtn) {
    e.preventDefault();
    geocodeOrder(geocodeBtn.dataset.geocode);
    return;
  }

  const cancelBtn = target.closest('[data-cancel]');
  if (cancelBtn) {
    e.preventDefault();
    confirmCancel(cancelBtn.dataset.cancel);
    return;
  }

  const deleteBtn = target.closest('[data-delete]');
  if (deleteBtn) {
    e.preventDefault();
    confirmDelete(deleteBtn.dataset.delete);
    return;
  }

  if (target.closest('[data-close-drawer]')) {
    closeDrawer();
    return;
  }

  if (target.closest('[data-open-settings]')) {
    openSettings();
    return;
  }

  if (target.closest('[data-export]')) {
    exportData();
    return;
  }

  if (target.closest('[data-demo]')) {
    loadDemo();
    return;
  }

  if (target.closest('[data-clear]')) {
    confirmClear();
    return;
  }

  const gpsBtn = target.closest('[data-gps]');
  if (gpsBtn) {
    const action = gpsBtn.dataset.gps;
    if (action === 'start') startTracking();
    else if (action === 'stop') stopTracking();
    else if (action === 'center') centerOnMe();
    return;
  }

  const focusBtn = target.closest('[data-focus]');
  if (focusBtn) {
    focusOrder(focusBtn.dataset.focus);
    return;
  }

  const openBtn = target.closest('[data-open]');
  if (openBtn) {
    e.preventDefault();
    openDrawer(openBtn.dataset.open);
  }
}

function handleChange(e) {
  if (e.target.id === 'follow-toggle') {
    state.tracking.follow = e.target.checked;
    if (state.tracking.follow) centerOnMe();
  }
}

function handleKey(e) {
  if (e.key === 'Escape') {
    const modals = $$('.modal.is-open');
    if (modals.length) {
      closeModal(modals[modals.length - 1]);
      return;
    }
    if ($('#drawer').classList.contains('is-open')) closeDrawer();
    return;
  }

  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('order')) {
    e.preventDefault();
    openDrawer(e.target.dataset.open);
  }
}

function updateAgos() {
  document.querySelectorAll('[data-ago]').forEach((el) => {
    el.textContent = timeAgo(el.dataset.ago);
  });
}

/* ------------------------------ toasts ---------------------------- */

function toast(message, opts = {}) {
  const wrap = $('#toasts');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast' + (opts.tone === 'error' ? ' toast--error' : '');
  const span = document.createElement('span');
  span.textContent = message;
  el.appendChild(span);

  if (opts.actionLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = opts.actionLabel;
    btn.addEventListener('click', () => {
      el.remove();
      if (opts.onAction) opts.onAction();
    });
    el.appendChild(btn);
  }

  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 260);
  }, opts.duration || 4200);
}

init();
