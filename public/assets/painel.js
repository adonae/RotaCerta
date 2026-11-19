/* ============================================================
   RotaCerta v2 — painel da loja
   ============================================================ */

import {
  $, $$, api, clearToken, setToken, getToken, icon, esc, toast,
  showDialog, confirmDialog, openProgress, copyText,
  formatDate, formatTime, formatDateTime, formatDistance, formatDuration,
  formatLongDate, routeDateLabel, timeAgo, todayISO, statusChip, routeStatusChip,
  formatCep,
  initials, waLink, mapsLink, ensureLeaflet, createMap, stopIcon, pickupIcon,
  riderIcon, fitMap, geometryLatLngs
} from './common.js';

const state = {
  settings: null,
  isDefaultPassword: false,
  routes: [],
  route: null,
  orders: [],
  position: null,
  currentView: 'routes',
  map: null,
  mapLayer: null,
  mapLoading: false,
  mapFitKey: null,
  pollTimer: null
};

/* ------------------------------ inicialização ----------------------- */

init();

async function init() {
  bindEvents();
  if (!getToken()) {
    showLogin();
    return;
  }
  try {
    const data = await api('/api/me');
    state.settings = data.settings;
    state.isDefaultPassword = Boolean(data.isDefaultPassword);
    showApp();
  } catch (err) {
    if (err.status === 401) {
      clearToken();
      showLogin('Sua sessão expirou. Entre novamente.');
    } else {
      showLogin(err.message || 'Não foi possível conectar ao servidor.');
    }
  }
}

function bindEvents() {
  $('#login-form')?.addEventListener('submit', onLogin);
  $('#app-view')?.addEventListener('click', onAppClick);
  window.addEventListener('hashchange', handleHash);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.currentView === 'detail' && state.route) {
      refreshRoute(true);
    }
  });
}

async function onLogin(event) {
  event.preventDefault();
  const input = $('#login-password');
  const error = $('#login-error');
  const btn = $('#login-btn');
  const password = input.value;
  error.textContent = '';
  if (!password) {
    error.textContent = 'Digite a senha do painel.';
    input.focus();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Entrando…';
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: { password },
      token: null
    });
    setToken(data.token);
    state.settings = data.settings;
    state.isDefaultPassword = Boolean(data.isDefaultPassword);
    input.value = '';
    showApp();
  } catch (err) {
    if (err.status === 401) error.textContent = 'Senha incorreta. Tente novamente.';
    else if (err.status === 429) error.textContent = err.message;
    else error.textContent = err.message || 'Não foi possível entrar.';
    input.select();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

function showLogin(message = '') {
  stopPolling();
  teardownMap();
  $('#app-view').classList.add('hidden');
  $('#login-view').classList.remove('hidden');
  $('#login-error').textContent = message;
  document.title = 'Entrar · RotaCerta';
  setTimeout(() => $('#login-password')?.focus(), 80);
}

function showApp() {
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  updateSidebar();
  if (!location.hash || location.hash === '#' || location.hash === '#/') {
    history.replaceState(null, '', '#/rotas');
    renderRoutes();
  } else {
    handleHash();
  }
}

function updateSidebar() {
  const s = state.settings;
  if (!s) return;
  $('#side-store-name').textContent = s.storeName;
  $('#side-store-addr').textContent = s.pickupAddress;
  $('#top-avatar').textContent = initials(s.storeName);
}

function handleHash() {
  if (!getToken() || !state.settings) return;
  const match = location.hash.match(/^#\/rota\/([A-Za-z0-9_-]+)/);
  if (match) loadRoute(match[1]);
  else renderRoutes();
}

function handleApiError(err) {
  if (err?.status === 401) {
    clearToken();
    state.settings = null;
    showLogin('Sua sessão expirou. Entre novamente.');
    return;
  }
  toast(err?.message || 'Não foi possível concluir a operação.', 'error');
}

/* -------------------------------- rotas ----------------------------- */

async function renderRoutes() {
  if (!getToken() || !state.settings) return;
  stopPolling();
  teardownMap();
  state.currentView = 'routes';
  state.route = null;
  state.orders = [];
  document.title = 'Rotas · RotaCerta';
  setTopTitle('Painel da loja');
  $('#panel-page').innerHTML = `
    <div class="empty">
      <div class="empty__icon">${icon('route')}</div>
      <h3>Carregando rotas…</h3>
    </div>`;

  let data;
  try {
    data = await api('/api/routes');
  } catch (err) {
    handleApiError(err);
    return;
  }

  state.routes = Array.isArray(data.routes) ? data.routes : [];
  const routes = state.routes;
  const pending = routes.reduce((n, r) => n + r.pending, 0);
  const enRoute = routes.reduce((n, r) => n + r.enRoute, 0);
  const delivered = routes.reduce((n, r) => n + r.delivered, 0);
  const openRoutes = routes.filter((r) => r.status !== 'done').length;

  const cards = routes.length
    ? routes.map(routeCard).join('')
    : `<div class="card">
        <div class="empty">
          <div class="empty__icon">${icon('route')}</div>
          <h3>Nenhuma rota ainda</h3>
          <p>Crie a rota do dia, adicione os pedidos e o sistema calcula a melhor ordem de entrega.</p>
          <button class="btn btn--primary" type="button" data-action="new-route">${icon('plus')} Criar primeira rota</button>
        </div>
      </div>`;

  $('#panel-page').innerHTML = `
    <div class="page-head">
      <div>
        <p class="eyebrow">${esc(cap(formatLongDate(new Date())))}</p>
        <h1 class="page-title">Suas rotas</h1>
        <p class="page-sub">Cadastre os pedidos do dia, calcule a melhor ordem e envie um link para o entregador.</p>
      </div>
      <div class="page-head__actions">
        <button class="btn btn--primary" type="button" data-action="new-route">${icon('plus')} Nova rota</button>
      </div>
    </div>

    ${state.isDefaultPassword ? `
      <div class="alert alert--danger" style="margin-bottom:16px">
        ${icon('shield')}
        <div><strong>Senha inicial em uso.</strong> Altere a senha do painel antes de compartilhar o sistema.
          <button class="btn-link" type="button" data-action="settings" style="margin-top:3px">Alterar senha</button>
        </div>
      </div>` : ''}

    <div class="stat-grid">
      <div class="stat">
        <div class="stat__label">Rotas abertas</div>
        <div class="stat__value">${openRoutes}</div>
        <div class="stat__hint">${routes.length} no total</div>
      </div>
      <div class="stat stat--brand">
        <div class="stat__label">Pendentes</div>
        <div class="stat__value">${pending}</div>
        <div class="stat__hint">aguardando saída</div>
      </div>
      <div class="stat">
        <div class="stat__label">Em rota</div>
        <div class="stat__value">${enRoute}</div>
        <div class="stat__hint">no momento</div>
      </div>
      <div class="stat stat--green">
        <div class="stat__label">Entregues</div>
        <div class="stat__value">${delivered}</div>
        <div class="stat__hint">concluídas</div>
      </div>
    </div>

    <div class="toolbar">
      <h2>Rotas de entrega</h2>
      <span class="badge">${routes.length}</span>
    </div>

    <div class="route-grid">${cards}</div>
  `;
}

function routeCard(r) {
  const progress = r.total ? Math.round((r.delivered / r.total) * 100) : 0;
  const when = r.optimizedAt ? `Otimizada ${timeAgo(r.optimizedAt)}` : 'Aguardando cálculo da rota';
  return `
    <button class="route-card" type="button" data-action="open-route" data-id="${esc(r.id)}">
      <div class="route-card__head">
        <span class="route-card__icon">${icon('route')}</span>
        <span style="flex:1;min-width:0">
          <span class="route-card__name" style="display:block">${esc(r.name)}</span>
          <span class="route-card__date" style="display:block">${esc(routeDateLabel(r.date))} · ${r.total} parada${r.total === 1 ? '' : 's'}</span>
        </span>
        ${routeStatusChip(r.status)}
      </div>
      <div class="route-card__meta">
        <span><strong>${r.pending}</strong> pendentes</span>
        <span><strong>${r.enRoute}</strong> em rota</span>
        <span><strong>${r.delivered}</strong> entregues</span>
        ${r.distanceM != null ? `<span><strong>${formatDistance(r.distanceM)}</strong> · ${formatDuration(r.durationS)}</span>` : ''}
      </div>
      <div class="route-card__bar">
        <div class="route-card__bar-label"><span>Progresso</span><span>${progress}%</span></div>
        <div class="progress ${r.delivered === r.total && r.total ? 'progress--green' : ''}">
          <div class="progress__bar" style="width:${progress}%"></div>
        </div>
      </div>
      <div class="route-card__foot">
        <span>${esc(when)}</span>
        <span class="go">Abrir ${icon('arrowRight')}</span>
      </div>
    </button>`;
}

/* ----------------------------- detalhe da rota ---------------------- */

async function loadRoute(id) {
  stopPolling();
  state.currentView = 'detail';
  document.title = 'Rota · RotaCerta';
  $('#panel-page').innerHTML = `
    <div class="empty">
      <div class="empty__icon">${icon('route')}</div>
      <h3>Carregando rota…</h3>
    </div>`;

  try {
    const data = await api(`/api/routes/${id}`);
    state.route = data.route;
    state.orders = data.orders || [];
    state.position = data.position || null;
    state.settings = data.settings || state.settings;
    updateSidebar();
    renderRouteDetail();
    startPolling();
  } catch (err) {
    if (err.status === 404) {
      toast('Rota não encontrada.', 'error');
      history.replaceState(null, '', '#/rotas');
      renderRoutes();
      return;
    }
    handleApiError(err);
  }
}

function renderRouteDetail() {
  const route = state.route;
  if (!route) return;
  const link = routeLinkFor(route.token);
  const total = state.orders.length;

  state.map?.remove();
  state.map = null;
  state.mapLayer = null;
  state.mapFitKey = null;

  document.title = `${route.name} · RotaCerta`;
  setTopTitle(route.name);

  const optimizeLabel = route.optimizedAt ? 'Recalcular rota' : 'Calcular rota';

  $('#panel-page').innerHTML = `
    <button class="breadcrumb" type="button" data-action="go-routes">
      ${icon('chevronLeft')} Todas as rotas
    </button>

    <div class="detail-head">
      <div>
        <h1>${esc(route.name)}</h1>
        <div class="page-sub">
          <span>${esc(routeDateLabel(route.date))}</span>
          <span class="muted">·</span>
          <span id="detail-status">${routeStatusChip(route.status)}</span>
          <span class="muted">·</span>
          <span id="detail-count">${total} parada${total === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div class="detail-head__actions">
        <button class="btn btn--outline" type="button" data-action="share-route">${icon('link')} Link do motoboy</button>
        <button class="btn btn--outline" type="button" data-action="add-orders">${icon('plus')} Pedidos</button>
        <button class="btn btn--primary" type="button" data-action="optimize" id="optimize-btn">${icon('sparkles')} ${optimizeLabel}</button>
      </div>
    </div>

    <div class="stat-grid" id="detail-stats"></div>
    <div id="warn-slot"></div>

    <div class="detail-grid">
      <div>
        <div class="map-frame route-map" id="route-map">
          <div class="map-overlay" id="map-overlay">${icon('mapPin')} Carregando mapa…</div>
        </div>

        <div class="section-label">Paradas <span class="badge" id="stops-count">0</span></div>
        <div class="stop-list" id="stop-list"></div>
      </div>

      <aside class="detail-aside">
        <div class="card">
          <div class="card__head">
            <h2>Resumo da rota</h2>
            <div class="spacer"></div>
            <span id="summary-status"></span>
          </div>
          <div class="card__body">
            <div class="summary-list">
              ${summaryItem('route', 'Distância otimizada', 'summary-distance')}
              ${summaryItem('clock', 'Tempo estimado', 'summary-duration')}
              ${summaryItem('package', 'Paradas', 'summary-orders')}
              ${summaryItem('sparkles', 'Último cálculo', 'summary-optimized')}
              ${summaryItem('store', 'Retirada', 'summary-pickup')}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__head"><h2>Link do motoboy</h2></div>
          <div class="card__body stack">
            <p class="small muted">Envie este link para o entregador. Ele abre a rota em ordem e libera os botões de cada parada.</p>
            <div class="link-box">
              <input id="route-link" readonly value="${esc(link)}" aria-label="Link da rota para o motoboy">
              <button class="btn btn--primary btn--sm" type="button" data-action="copy-route-link" title="Copiar link">${icon('copy')}</button>
            </div>
            <div class="row row--wrap">
              <a class="btn btn--outline btn--sm" href="${esc(link)}" target="_blank" rel="noopener">${icon('eye')} Abrir</a>
              <a class="btn btn--outline btn--sm" href="${esc(routeWhatsApp(link))}" target="_blank" rel="noopener">${icon('whatsapp')} Enviar</a>
            </div>
            <hr class="divider">
            <button class="btn btn--soft btn--block" type="button" data-action="share-customers">${icon('users')} Links dos clientes</button>
          </div>
        </div>

        <div class="card">
          <div class="card__body row">
            <button class="btn btn--danger btn--sm" type="button" data-action="delete-route">${icon('trash')} Excluir rota</button>
            <div class="spacer"></div>
            <span class="small muted" id="detail-foot-count">${total} pedido${total === 1 ? '' : 's'}</span>
          </div>
        </div>
      </aside>
    </div>`;

  updateRouteLive();
}

function updateRouteLive() {
  const route = state.route;
  if (!route || !$('#panel-page') || !$('#stop-list')) return;

  const orders = state.orders;
  const active = orders.find((o) => o.status === 'en_route');
  const pending = orders.filter((o) => o.status === 'pending');
  const delivered = orders.filter((o) => o.status === 'delivered');
  const missing = pending.filter((o) => !hasCoords(o));
  const total = orders.length;

  const statusEl = $('#detail-status');
  if (statusEl) statusEl.innerHTML = routeStatusChip(route.status);
  const countEl = $('#detail-count');
  if (countEl) countEl.textContent = `${total} parada${total === 1 ? '' : 's'}`;

  const stats = $('#detail-stats');
  if (stats) {
    stats.innerHTML = `
      <div class="stat">
        <div class="stat__label">Paradas</div>
        <div class="stat__value">${total}</div>
        <div class="stat__hint">${delivered.length} entregues</div>
      </div>
      <div class="stat stat--brand">
        <div class="stat__label">Pendentes</div>
        <div class="stat__value">${pending.length}</div>
        <div class="stat__hint">aguardando saída</div>
      </div>
      <div class="stat">
        <div class="stat__label">Em rota</div>
        <div class="stat__value">${active ? 1 : 0}</div>
        <div class="stat__hint">${active ? esc(firstName(active.customer)) : 'nenhuma agora'}</div>
      </div>
      <div class="stat stat--green">
        <div class="stat__label">Entregues</div>
        <div class="stat__value">${delivered.length}</div>
        <div class="stat__hint">${total ? Math.round((delivered.length / total) * 100) : 0}% da rota</div>
      </div>`;
  }

  const warn = $('#warn-slot');
  if (warn) {
    const blocks = [];
    if (missing.length) {
      blocks.push(`
        <div class="warn-banner">
          ${icon('alert')}
          <div>
            <strong>${missing.length} pedido${missing.length === 1 ? '' : 's'} sem localização no mapa</strong>
            Use “Calcular rota” para buscar os endereços automaticamente. Se o endereço não for encontrado, ajuste o pino manualmente em cada pedido.
            <div class="row" style="margin-top:8px">
              <button class="btn btn--outline btn--sm" type="button" data-action="show-missing">Ver pedido${missing.length === 1 ? '' : 's'}</button>
            </div>
          </div>
        </div>`);
    }
    if (route.optimizedAt && route.geometrySource !== 'osrm') {
      blocks.push(`
        <div class="alert alert--info" style="margin-bottom:14px">
          ${icon('info')}
          <div><strong>Rota estimada.</strong> O serviço de ruas não respondeu; a ordem foi calculada por distância aproximada. Tente recalcular mais tarde.</div>
        </div>`);
    }
    warn.innerHTML = blocks.join('');
  }

  const list = $('#stop-list');
  if (list) {
    list.innerHTML = orders.length
      ? orders.map((order, index) => stopRowHtml(order, index, active)).join('')
      : `<div class="card"><div class="empty">
          <div class="empty__icon">${icon('package')}</div>
          <h3>Nenhum pedido nesta rota</h3>
          <p>Adicione os pedidos do dia para calcular a melhor ordem de entrega.</p>
          <button class="btn btn--primary" type="button" data-action="add-orders">${icon('plus')} Adicionar pedidos</button>
        </div></div>`;
  }

  const stopsCount = $('#stops-count');
  if (stopsCount) stopsCount.textContent = String(total);

  const optimizeBtn = $('#optimize-btn');
  if (optimizeBtn) {
    optimizeBtn.innerHTML = `${icon('sparkles')} ${route.optimizedAt ? 'Recalcular rota' : 'Calcular rota'}`;
  }

  const footCount = $('#detail-foot-count');
  if (footCount) footCount.textContent = `${total} pedido${total === 1 ? '' : 's'}`;

  const summaryStatus = $('#summary-status');
  if (summaryStatus) summaryStatus.innerHTML = routeStatusChip(route.status);

  setText('summary-distance', route.distanceM != null ? formatDistance(route.distanceM) : 'Ainda não calculada');
  setText('summary-duration', route.durationS != null ? formatDuration(route.durationS) : '—');
  setText('summary-orders', `${total} parada${total === 1 ? '' : 's'} · ${delivered.length} entregue${delivered.length === 1 ? '' : 's'}`);
  setText(
    'summary-optimized',
    route.optimizedAt
      ? `${formatDateTime(route.optimizedAt)}${route.geometrySource === 'osrm' ? ' · por ruas' : route.geometrySource === 'estimate' ? ' · estimada' : ''}`
      : 'Ainda não calculada'
  );
  setText('summary-pickup', route.pickupAddress || '—', route.pickupAddress || '');
  const linkInput = $('#route-link');
  if (linkInput) linkInput.value = routeLinkFor(route.token);

  if ($('#route-map')) {
    if (state.map) updateRouteMap();
    else mountRouteMap();
  }
}

function stopRowHtml(order, index, active) {
  const seq = order.seq ?? index + 1;
  const missing = !hasCoords(order) && order.status !== 'canceled';
  const classes = [
    'stop-row',
    order.status === 'en_route' ? 'stop-row--enroute' : '',
    order.status === 'delivered' ? 'stop-row--delivered' : '',
    missing ? 'stop-row--missing' : ''
  ].filter(Boolean).join(' ');

  const link = customerLinkFor(order.token);
  const wa = order.phone
    ? waLink(order.phone, customerMessage(order, link))
    : '';

  const actions = [
    order.hasPhoto ? `<button class="btn btn--icon" type="button" data-action="view-photo" data-id="${esc(order.id)}" title="Ver foto da entrega" aria-label="Ver foto da entrega">${icon('camera')}</button>` : '',
    `<button class="btn btn--icon" type="button" data-action="copy-order-link" data-id="${esc(order.id)}" title="Copiar link do cliente" aria-label="Copiar link do cliente">${icon('link')}</button>`,
    wa ? `<a class="btn btn--icon" href="${esc(wa)}" target="_blank" rel="noopener" title="Enviar link no WhatsApp" aria-label="Enviar link no WhatsApp">${icon('whatsapp')}</a>` : '',
    `<a class="btn btn--icon" href="${esc(mapsLink(order))}" target="_blank" rel="noopener" title="Abrir endereço no Google Maps" aria-label="Abrir no mapa">${icon('navigation')}</a>`,
    `<button class="btn btn--icon ${missing ? 'btn--soft' : ''}" type="button" data-action="pin-order" data-id="${esc(order.id)}" title="Ajustar localização no mapa" aria-label="Ajustar localização">${icon('mapPin')}</button>`,
    `<button class="btn btn--icon" type="button" data-action="edit-order" data-id="${esc(order.id)}" title="Editar pedido" aria-label="Editar pedido">${icon('edit')}</button>`,
    `<button class="btn btn--icon is-danger" type="button" data-action="delete-order" data-id="${esc(order.id)}" title="Excluir pedido" aria-label="Excluir pedido">${icon('trash')}</button>`
  ].filter(Boolean).join('');

  return `
    <div class="${classes}" id="stop-${esc(order.id)}" data-order-id="${esc(order.id)}">
      <span class="stop-num">${order.status === 'delivered' ? icon('check') : esc(seq)}</span>
      <div class="stop-row__body">
        <div class="stop-row__top">
          <span class="stop-row__name">${esc(order.customer)}</span>
          <span class="stop-row__code">${esc(order.code)}</span>
          ${statusChip(order.status)}
          ${missing ? `<span class="chip chip--amber"><span class="chip__dot"></span>Sem localização</span>` : ''}
          ${!missing && order.geocodeSource === 'cep' ? `<span class="chip chip--ink" title="Localização aproximada pelo CEP"><span class="chip__dot"></span>Aproximada (CEP)</span>` : ''}
        </div>
        <div class="stop-row__addr">${esc(order.address)}</div>
        ${order.cep || order.reference ? `<div class="stop-row__ref">${[
          order.cep ? `CEP ${formatCep(order.cep)}` : '',
          order.reference ? `Referência: ${esc(order.reference)}` : ''
        ].filter(Boolean).join(' · ')}</div>` : ''}
        ${order.notes ? `<div class="stop-row__notes">${esc(order.notes)}</div>` : ''}
      </div>
      <div class="stop-row__actions">${actions}</div>
    </div>`;
}

function summaryItem(iconName, label, id) {
  return `
    <div class="summary-item">
      <span class="summary-item__icon">${icon(iconName)}</span>
      <div class="summary-item__body">
        <div class="summary-item__label">${esc(label)}</div>
        <div class="summary-item__value" id="${esc(id)}">—</div>
      </div>
    </div>`;
}

function setText(id, value, title = null) {
  const el = doc(id);
  if (!el) return;
  el.textContent = value;
  if (title !== null) el.title = title;
}

function doc(id) {
  return document.getElementById(id);
}

/* ------------------------------- mapa ------------------------------- */

async function mountRouteMap() {
  if (state.mapLoading) return;
  const el = $('#route-map');
  if (!el) return;
  state.mapLoading = true;
  try {
    await ensureLeaflet();
    if (!document.body.contains(el) || !$('#route-map')) return;
    state.map?.remove();
    const pickup = { lat: state.route.pickupLat, lng: state.route.pickupLng };
    const center = hasCoords(pickup)
      ? [pickup.lat, pickup.lng]
      : hasCoords(state.position)
        ? [state.position.lat, state.position.lng]
        : [-7.122, -34.877];
    state.map = createMap(el, center, 13);
    state.mapLayer = window.L.layerGroup().addTo(state.map);
    state.mapFitKey = null;
    updateRouteMap();
    setTimeout(() => {
      try { state.map?.invalidateSize(); } catch { /* ignore */ }
    }, 150);
  } catch (err) {
    toast(err.message || 'Não foi possível carregar o mapa.', 'error');
  } finally {
    state.mapLoading = false;
  }
}

function updateRouteMap() {
  if (!state.map || !state.mapLayer || !state.route) return;
  const L = window.L;
  const layer = state.mapLayer;
  layer.clearLayers();

  const points = [];
  const pickup = { lat: state.route.pickupLat, lng: state.route.pickupLng };
  if (hasCoords(pickup)) {
    L.marker([pickup.lat, pickup.lng], { icon: pickupIcon() })
      .addTo(layer)
      .bindPopup(`<strong>Retirada</strong><br>${esc(state.route.pickupAddress || '')}`);
    points.push(pickup);
  }

  const located = state.orders
    .filter((o) => o.status !== 'canceled' && hasCoords(o))
    .sort((a, b) => (a.seq ?? 9999) - (b.seq ?? 9999));

  located.forEach((order, index) => {
    const kind = order.status === 'delivered' ? 'done' : order.status === 'en_route' ? 'next' : '';
    L.marker([order.lat, order.lng], { icon: stopIcon(order.seq ?? index + 1, kind) })
      .addTo(layer)
      .bindPopup(
        `<strong>${esc(order.customer)}</strong><br>${esc(order.address)}<br>` +
        `<span style="color:#64748b">${esc(order.code)} · ${esc(statusLabel(order.status))}</span>`
      );
    points.push({ lat: order.lat, lng: order.lng });
  });

  const geometry = geometryLatLngs(state.route.geometry);
  if (geometry.length > 1) {
    L.polyline(geometry, { color: '#ffffff', weight: 9, opacity: 0.9 }).addTo(layer);
    L.polyline(geometry, { color: '#f0522b', weight: 4, opacity: 0.82 }).addTo(layer);
  }

  if (hasCoords(state.position)) {
    L.marker([state.position.lat, state.position.lng], { icon: riderIcon() })
      .addTo(layer)
      .bindPopup(`<strong>Entregador</strong><br><span style="color:#64748b">${esc(timeAgo(state.position.updatedAt))}</span>`);
    points.push({ lat: state.position.lat, lng: state.position.lng });
  }

  const overlay = $('#map-overlay');
  if (overlay) {
    const activeTotal = state.orders.filter((o) => o.status !== 'canceled').length;
    overlay.innerHTML = activeTotal
      ? `${icon('mapPin')} ${located.length} de ${activeTotal} no mapa${state.route.distanceM != null ? ` · ${formatDistance(state.route.distanceM)}` : ''}`
      : `${icon('store')} Ponto de retirada`;
  }

  const fitKey = `${state.route.id}:${state.route.optimizedAt || ''}:${state.orders.length}`;
  if (state.mapFitKey !== fitKey) {
    state.mapFitKey = fitKey;
    fitMap(state.map, points, { padding: [42, 42] });
  }
}

function teardownMap() {
  try { state.map?.remove(); } catch { /* ignore */ }
  state.map = null;
  state.mapLayer = null;
  state.mapFitKey = null;
}

/* --------------------------- polling da rota ------------------------ */

function startPolling() {
  stopPolling();
  state.pollTimer = setInterval(() => {
    if (!document.hidden && state.currentView === 'detail' && state.route) {
      refreshRoute(true);
    }
  }, 10000);
}

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

async function refreshRoute(silent = false) {
  const id = state.route?.id;
  if (!id) return;
  try {
    const data = await api(`/api/routes/${id}`);
    if (state.route?.id !== id) return;
    state.route = data.route;
    state.orders = data.orders || [];
    state.position = data.position || null;
    state.settings = data.settings || state.settings;
    updateSidebar();
    if (state.currentView === 'detail') updateRouteLive();
  } catch (err) {
    if (err.status === 401) {
      handleApiError(err);
      return;
    }
    if (!silent) toast(err.message, 'error');
  }
}

/* --------------------------- ações do painel ------------------------ */

async function onAppClick(event) {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;

  try {
    switch (action) {
      case 'go-routes':
        goRoutes();
        break;
      case 'new-route':
        openNewRouteDialog();
        break;
      case 'open-route':
        if (id) location.hash = `#/rota/${id}`;
        break;
      case 'settings':
        openSettings();
        break;
      case 'logout':
        await logout();
        break;
      case 'add-orders':
        openAddOrders();
        break;
      case 'optimize':
        await optimize();
        break;
      case 'share-route':
        openShareRoute();
        break;
      case 'share-customers':
        openShareCustomers();
        break;
      case 'copy-route-link':
        if (state.route) await copy(routeLinkFor(state.route.token), 'Link do motoboy copiado.');
        break;
      case 'copy-order-link': {
        const order = findOrder(id);
        if (order) await copy(customerLinkFor(order.token), 'Link do cliente copiado.');
        break;
      }
      case 'edit-order':
        openEditOrder(id);
        break;
      case 'pin-order':
        openPinOrder(id);
        break;
      case 'view-photo':
        await openOrderPhoto(id);
        break;
      case 'delete-order':
        await deleteOrder(id);
        break;
      case 'delete-route':
        await deleteRoute();
        break;
      case 'show-missing':
        showFirstMissing();
        break;
      default:
        break;
    }
  } catch (err) {
    handleApiError(err);
  }
}

function goRoutes() {
  if (location.hash === '#/rotas') renderRoutes();
  else location.hash = '#/rotas';
}

async function logout() {
  try { await api('/api/logout', { method: 'POST' }); } catch { /* ignore */ }
  clearToken();
  state.settings = null;
  state.isDefaultPassword = false;
  state.route = null;
  state.orders = [];
  stopPolling();
  teardownMap();
  history.replaceState(null, '', location.pathname);
  showLogin();
}

function openNewRouteDialog() {
  const settings = state.settings;
  const defaultName = `Rota de ${cap(formatLongDate(new Date()))}`;
  showDialog({
    title: 'Nova rota',
    subtitle: 'Crie a rota de entregas do dia.',
    body: `
      <div class="stack">
        <div class="field">
          <label for="route-name">Nome da rota</label>
          <input class="input" id="route-name" name="name" value="${esc(defaultName)}" maxlength="80">
        </div>
        <div class="field">
          <label for="route-date">Data</label>
          <input class="input" id="route-date" name="date" type="date" value="${todayISO()}">
        </div>
        <div class="alert alert--info">
          ${icon('store')}
          <div><strong>Ponto de retirada</strong><br>${esc(settings?.pickupAddress || 'Configure o endereço nas preferências.')}</div>
        </div>
      </div>`,
    actions: [
      { label: 'Cancelar', variant: 'outline' },
      {
        label: 'Criar rota',
        variant: 'primary',
        icon: 'plus',
        onClick: async (dialog) => {
          const name = dialog.querySelector('[name="name"]').value.trim();
          const date = dialog.querySelector('[name="date"]').value;
          if (!name) {
            toast('Informe um nome para a rota.', 'error');
            return false;
          }
          const data = await api('/api/routes', { method: 'POST', body: { name, date } });
          toast('Rota criada.', 'success');
          setTimeout(() => { location.hash = `#/rota/${data.route.id}`; }, 60);
        }
      }
    ]
  });
}

async function deleteRoute() {
  const route = state.route;
  if (!route) return;
  const ok = await confirmDialog({
    title: 'Excluir rota',
    message: `Excluir <strong>${esc(route.name)}</strong> e todos os pedidos dela? Esta ação não pode ser desfeita.`,
    confirmLabel: 'Excluir rota',
    tone: 'danger'
  });
  if (!ok) return;
  await api(`/api/routes/${route.id}`, { method: 'DELETE' });
  toast('Rota excluída.', 'success');
  state.route = null;
  stopPolling();
  teardownMap();
  history.replaceState(null, '', '#/rotas');
  renderRoutes();
}

/* ------------------------------- pedidos ---------------------------- */

function findOrder(id) {
  return state.orders.find((o) => o.id === id) || null;
}

/* --------------------------- rascunho de pedido ---------------------- */

const ADD_DRAFT_KEY = 'rotacerta.painel.add-draft.v1';
const ADD_DRAFT_FIELDS = ['customer', 'phone', 'cep', 'number', 'address', 'reference', 'notes', 'bulk'];

function readAddDraft() {
  try {
    const raw = sessionStorage.getItem(ADD_DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

function hasDraftData(draft) {
  return Boolean(draft) && ADD_DRAFT_FIELDS.some((name) => String(draft[name] ?? '').trim());
}

function saveAddDraft(dialog) {
  const data = {};
  for (const name of ADD_DRAFT_FIELDS) {
    const el = dialog.querySelector(`[name="${name}"]`);
    if (el) data[name] = el.value;
  }
  try {
    sessionStorage.setItem(ADD_DRAFT_KEY, JSON.stringify(data));
  } catch {
    /* armazenamento indisponível: o formulário continua funcionando */
  }
}

function clearAddDraft() {
  try {
    sessionStorage.removeItem(ADD_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

function openAddOrders() {
  if (!state.route) return;
  const draft = readAddDraft() || {};
  const restored = hasDraftData(draft);
  showDialog({
    title: 'Adicionar pedidos',
    subtitle: 'Cadastre um pedido por vez ou cole vários de uma vez.',
    wide: true,
    body: `
      <div class="stack">
        <div class="form-grid">
          <div class="field">
            <label for="add-customer">Nome do cliente <span>*</span></label>
            <input class="input" id="add-customer" name="customer" placeholder="Ex.: Ana Souza" maxlength="100" value="${esc(draft.customer || '')}">
          </div>
          <div class="field">
            <label for="add-phone">Telefone / WhatsApp</label>
            <input class="input" id="add-phone" name="phone" type="tel" inputmode="tel" placeholder="(83) 91234-5678" maxlength="40" value="${esc(draft.phone || '')}">
          </div>
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="add-cep">CEP</label>
            <input class="input" id="add-cep" name="cep" inputmode="numeric" autocomplete="postal-code" placeholder="58013-270" maxlength="9" value="${esc(formatCep(draft.cep || ''))}">
          </div>
          <div class="field">
            <label for="add-number">Número</label>
            <input class="input" id="add-number" name="number" placeholder="Ex.: 848" maxlength="20" value="${esc(draft.number || '')}">
          </div>
        </div>
        <p class="hint field-status" data-cep-status>Digite o CEP para preencher rua, bairro e cidade.</p>
        <div class="field">
          <label for="add-address">Endereço de entrega <span>*</span></label>
          <input class="input" id="add-address" name="address" placeholder="Rua, número, bairro, cidade" maxlength="240" value="${esc(draft.address || '')}">
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="add-reference">Ponto de referência</label>
            <input class="input" id="add-reference" name="reference" placeholder="Ex.: portão azul, ao lado da padaria" maxlength="160" value="${esc(draft.reference || '')}">
          </div>
          <div class="field">
            <label for="add-notes">Observações</label>
            <input class="input" id="add-notes" name="notes" placeholder="Ex.: entregar na portaria" maxlength="200" value="${esc(draft.notes || '')}">
          </div>
        </div>

        <details ${String(draft.bulk || '').trim() ? 'open' : ''}>
          <summary style="cursor:pointer;font-size:13px;font-weight:700;color:var(--brand-dark)">Adicionar vários de uma vez</summary>
          <div class="field" style="margin-top:10px">
            <label for="add-bulk">Um pedido por linha</label>
            <textarea class="textarea" id="add-bulk" name="bulk" rows="6" placeholder="Ana Souza; (83) 91234-5678; Rua das Flores, 120, Centro; Portão azul; ; 58013-270&#10;Carlos Lima; ; Av. Epitácio Pessoa, 1500, Miramar; Apto 302">${esc(draft.bulk || '')}</textarea>
            <p class="hint">Formato: <strong>Nome; Telefone; Endereço; Referência; Observação; CEP</strong>. Só nome e endereço são obrigatórios. Se usar este campo, os campos acima são ignorados.</p>
          </div>
        </details>
      </div>`,
    actions: [
      { label: 'Cancelar', variant: 'outline', onClick: () => { clearAddDraft(); } },
      {
        label: 'Adicionar',
        variant: 'primary',
        icon: 'plus',
        onClick: async (dialog) => {
          const bulk = dialog.querySelector('[name="bulk"]').value.trim();
          let orders;
          if (bulk) {
            try {
              orders = parseBulk(bulk);
            } catch (err) {
              toast(err.message, 'error');
              return false;
            }
          } else {
            const customer = dialog.querySelector('[name="customer"]').value.trim();
            let address = dialog.querySelector('[name="address"]').value.trim();
            if (!address && dialog.__cepFill) {
              await dialog.__cepFill();
              address = dialog.querySelector('[name="address"]').value.trim();
            }
            if (!customer || !address) {
              toast('Informe o nome e o endereço do pedido.', 'error');
              return false;
            }
            orders = [{
              customer,
              address,
              cep: dialog.querySelector('[name="cep"]').value.trim(),
              phone: dialog.querySelector('[name="phone"]').value.trim(),
              reference: dialog.querySelector('[name="reference"]').value.trim(),
              notes: dialog.querySelector('[name="notes"]').value.trim()
            }];
          }
          if (!orders.length) {
            toast('Nenhum pedido válido para adicionar.', 'error');
            return false;
          }
          const data = await api(`/api/routes/${state.route.id}/orders`, {
            method: 'POST',
            body: { orders }
          });
          clearAddDraft();
          toast(`${data.created} pedido${data.created === 1 ? '' : 's'} adicionado${data.created === 1 ? '' : 's'}.`, 'success');
          state.mapFitKey = null;
          await refreshRoute();
        }
      }
    ],
    closeOnBackdrop: false,
    onMount: (dialog) => {
      wireCepField(dialog);
      const persist = () => saveAddDraft(dialog);
      dialog.addEventListener('input', persist);
      dialog.addEventListener('change', persist);

      const cepEl = dialog.querySelector('[name="cep"]');
      const addressEl = dialog.querySelector('[name="address"]');
      if (restored && validCep(cepEl?.value) && !addressEl?.value.trim() && dialog.__cepFill) {
        dialog.__cepFill();
      }
      if (restored) toast('Rascunho recuperado.', 'info');
    }
  });
}

function parseBulk(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  const orders = [];
  lines.forEach((line, index) => {
    const parts = line.split(';').map((p) => p.trim());
    let customer;
    let phone = '';
    let address;
    let reference = '';
    let notes = '';
    let cep = '';

    if (parts.length === 2) {
      [customer, address] = parts;
    } else if (parts.length >= 3) {
      [customer, phone, address, reference = '', notes = '', cep = ''] = parts;
    } else {
      throw new Error(`Linha ${index + 1}: use Nome; Telefone; Endereço; Referência.`);
    }

    if (!customer || !address) {
      throw new Error(`Linha ${index + 1}: informe o nome e o endereço.`);
    }
    orders.push({ customer, phone, address, reference, notes, cep });
  });
  return orders;
}

function openEditOrder(id) {
  const order = findOrder(id);
  if (!order) return;
  showDialog({
    title: `Editar ${order.code}`,
    subtitle: order.customer,
    body: `
      <div class="stack">
        <div class="form-grid">
          <div class="field">
            <label>Nome do cliente <span>*</span></label>
            <input class="input" name="customer" value="${esc(order.customer)}" maxlength="100">
          </div>
          <div class="field">
            <label>Telefone / WhatsApp</label>
            <input class="input" name="phone" value="${esc(order.phone)}" maxlength="40" inputmode="tel">
          </div>
        </div>
        <div class="field">
          <label>CEP</label>
          <input class="input" name="cep" value="${esc(formatCep(order.cep))}" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="58013-270">
        </div>
        <p class="hint field-status" data-cep-status>Digite o CEP para atualizar o endereço automaticamente.</p>
        <div class="field">
          <label>Endereço de entrega <span>*</span></label>
          <input class="input" name="address" value="${esc(order.address)}" maxlength="240">
        </div>
        <div class="form-grid">
          <div class="field">
            <label>Ponto de referência</label>
            <input class="input" name="reference" value="${esc(order.reference)}" maxlength="160">
          </div>
          <div class="field">
            <label>Observações</label>
            <input class="input" name="notes" value="${esc(order.notes)}" maxlength="200">
          </div>
        </div>
        <div class="alert ${hasCoords(order) ? 'alert--info' : ''}">
          ${icon(hasCoords(order) ? 'mapPin' : 'alert')}
          <div>${hasCoords(order)
            ? 'Este pedido já tem localização no mapa. Se alterar o endereço, a localização será recalculada.'
            : 'Este pedido ainda não tem localização. Use o botão de pino na lista para ajustar no mapa.'}</div>
        </div>
      </div>`,
    actions: [
      { label: 'Cancelar', variant: 'outline' },
      {
        label: 'Salvar',
        variant: 'primary',
        icon: 'check',
        onClick: async (dialog) => {
          const value = (name) => dialog.querySelector(`[name="${name}"]`).value.trim();
          const customer = value('customer');
          let address = value('address');
          if (!address && dialog.__cepFill) {
            await dialog.__cepFill();
            address = value('address');
          }
          if (!customer || !address) {
            toast('Informe o nome e o endereço.', 'error');
            return false;
          }
          await api(`/api/orders/${order.id}`, {
            method: 'PATCH',
            body: {
              customer,
              phone: value('phone'),
              address,
              cep: value('cep'),
              reference: value('reference'),
              notes: value('notes')
            }
          });
          if (address !== order.address) {
            toast('Pedido atualizado. A localização será recalculada.', 'success');
            state.mapFitKey = null;
          } else {
            toast('Pedido atualizado.', 'success');
          }
          await refreshRoute();
        }
      }
    ],
    closeOnBackdrop: false,
    onMount: (dialog) => wireCepField(dialog, { numberName: null })
  });
}

async function deleteOrder(id) {
  const order = findOrder(id);
  if (!order) return;
  const ok = await confirmDialog({
    title: 'Excluir pedido',
    message: `Excluir o pedido de <strong>${esc(order.customer)}</strong>? O link do cliente deixará de funcionar.`,
    confirmLabel: 'Excluir pedido',
    tone: 'danger'
  });
  if (!ok) return;
  await api(`/api/orders/${order.id}`, { method: 'DELETE' });
  toast('Pedido excluído.', 'success');
  state.mapFitKey = null;
  await refreshRoute();
}

function showFirstMissing() {
  const el = document.querySelector('.stop-row--missing');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.style.boxShadow = '0 0 0 4px rgba(240, 82, 43, .25)';
  setTimeout(() => { el.style.boxShadow = ''; }, 1800);
}

/* -------------------------- ajustar pino ---------------------------- */

async function openPinOrder(id) {
  const order = findOrder(id);
  if (!order) return;

  showDialog({
    title: 'Ajustar localização',
    subtitle: `${order.customer} · ${order.address}`,
    wide: true,
    body: `
      <div class="map-frame" style="height:320px">
        <div id="pin-map" style="height:100%"></div>
      </div>
      <p class="hint" style="margin-top:10px">Toque no mapa para posicionar o pino no local exato da entrega. Você pode arrastar o pino para ajustar.</p>`,
    actions: [
      { label: 'Cancelar', variant: 'outline' },
      {
        label: 'Salvar localização',
        variant: 'primary',
        icon: 'mapPin',
        onClick: async (dialog) => {
          if (!dialog.__marker) {
            toast('Toque no mapa para marcar o local.', 'error');
            return false;
          }
          const pos = dialog.__marker.getLatLng();
          await api(`/api/orders/${order.id}`, {
            method: 'PATCH',
            body: { lat: pos.lat, lng: pos.lng, geocodeSource: 'manual' }
          });
          toast('Localização salva.', 'success');
          state.mapFitKey = null;
          await refreshRoute();
        }
      }
    ],
    onMount: async (dialog) => {
      try {
        await ensureLeaflet();
        const L = window.L;
        const el = dialog.querySelector('#pin-map');
        const pickup = { lat: state.route?.pickupLat, lng: state.route?.pickupLng };
        const center = hasCoords(order)
          ? [order.lat, order.lng]
          : hasCoords(pickup)
            ? [pickup.lat, pickup.lng]
            : [-7.122, -34.877];
        const map = createMap(el, center, hasCoords(order) ? 16 : 14);
        dialog.__map = map;
        const pin = stopIcon(order.seq ?? '•');
        if (hasCoords(order)) {
          dialog.__marker = L.marker([order.lat, order.lng], {
            icon: pin,
            draggable: true
          }).addTo(map);
        }
        map.on('click', (event) => {
          if (dialog.__marker) dialog.__marker.setLatLng(event.latlng);
          else {
            dialog.__marker = L.marker(event.latlng, {
              icon: pin,
              draggable: true
            }).addTo(map);
          }
        });
        setTimeout(() => {
          try { map.invalidateSize(); } catch { /* ignore */ }
        }, 150);
        dialog.addEventListener('close', () => {
          try { map.remove(); } catch { /* ignore */ }
        });
      } catch (err) {
        toast(err.message || 'Não foi possível abrir o mapa.', 'error');
      }
    }
  });
}

/* --------------------------- foto da entrega ------------------------- */

async function openOrderPhoto(id) {
  const order = findOrder(id);
  if (!order) return;

  const when = order.photoAt
    ? `Registrada em ${formatDateTime(order.photoAt)} · apagada automaticamente após 3 dias`
    : 'A foto fica disponível por 3 dias.';

  const dialog = showDialog({
    title: 'Foto da entrega',
    subtitle: `${order.customer} · ${order.code} · ${when}`,
    wide: true,
    body: `<div class="photo-viewer" data-photo-viewer>
      <p class="hint" style="text-align:center">Carregando foto…</p>
    </div>`,
    actions: [{ label: 'Fechar', variant: 'outline' }]
  });

  const viewer = dialog.querySelector('[data-photo-viewer]');
  let objectUrl = '';

  try {
    const res = await fetch(`/api/orders/${order.id}/photo`, {
      headers: { authorization: `Bearer ${getToken()}` },
      signal: AbortSignal.timeout(25000)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || 'Foto indisponível.');
    }
    const blob = await res.blob();
    if (!viewer.isConnected) return;
    objectUrl = URL.createObjectURL(blob);
    viewer.innerHTML = `<img src="${esc(objectUrl)}" alt="Foto da entrega de ${esc(order.customer)}">`;
    dialog.addEventListener('close', () => URL.revokeObjectURL(objectUrl), { once: true });
  } catch (err) {
    if (viewer.isConnected) {
      viewer.innerHTML = `<p class="hint" style="text-align:center">${esc(err.message || 'Não foi possível carregar a foto.')}</p>`;
    }
  }
}

/* ----------------------------- otimização --------------------------- */

async function optimize() {
  const route = state.route;
  if (!route) return;

  if (state.orders.some((o) => o.status === 'en_route')) {
    toast('Finalize a entrega em andamento antes de recalcular a rota.', 'error');
    return;
  }

  const pending = state.orders.filter((o) => o.status === 'pending');
  if (!pending.length) {
    toast('Não há entregas pendentes para otimizar.', 'info');
    return;
  }

  let missing = pending.filter((o) => !hasCoords(o));
  if (missing.length) {
    const search = await confirmDialog({
      title: 'Buscar endereços',
      message: `${missing.length} pedido${missing.length === 1 ? '' : 's'} ainda está sem localização. Deseja buscar os endereços automaticamente antes de calcular a rota?`,
      confirmLabel: 'Buscar endereços',
      cancelLabel: 'Agora não',
      tone: 'primary'
    });
    if (search) {
      const result = await geocodeMissing(pending);
      if (result.approximate) {
        toast(
          `${result.approximate} endereço${result.approximate === 1 ? '' : 's'} localizado${result.approximate === 1 ? '' : 's'} pelo CEP. Confira o pino no mapa antes de sair.`,
          'info',
          7000
        );
      }
      await refreshRoute(true);
      missing = state.orders.filter((o) => o.status === 'pending' && !hasCoords(o));
      if (result.failed.length || missing.length) {
        const proceed = await confirmDialog({
          title: 'Alguns endereços não foram encontrados',
          message: `${missing.length} pedido${missing.length === 1 ? '' : 's'} continua${missing.length === 1 ? '' : 'm'} sem localização. Você pode ajustar os pinos manualmente ou continuar e deixá-los no fim da rota.`,
          confirmLabel: 'Continuar mesmo assim',
          cancelLabel: 'Ajustar depois',
          tone: 'primary'
        });
        if (!proceed) {
          renderRouteDetail();
          return;
        }
      }
    }
  }

  const progress = openProgress('Calculando rota', 'Otimizando a ordem das entregas…');
  progress.set(18, 'Consultando as ruas e calculando a melhor sequência…');
  try {
    const data = await api(`/api/routes/${route.id}/optimize`, {
      method: 'POST',
      body: { allowMissing: true },
      timeout: 35000
    });
    progress.set(100, 'Rota pronta!');
    setTimeout(() => progress.close(), 500);
    toast(
      `Rota otimizada: ${data.optimized.count} paradas · ${formatDistance(data.optimized.distanceM)} · ${formatDuration(data.optimized.durationS)}`,
      'success',
      6000
    );
    state.mapFitKey = null;
    await refreshRoute();
  } catch (err) {
    progress.close();
    handleApiError(err);
  }
}

async function geocodeMissing(orders) {
  const missing = orders.filter((o) => o.status === 'pending' && !hasCoords(o));
  const result = { attempted: 0, found: 0, approximate: 0, failed: [] };
  if (!missing.length) return result;

  const progress = openProgress('Buscando endereços', 'Consultando o serviço de mapas…');
  for (let i = 0; i < missing.length; i += 1) {
    const order = missing[i];
    result.attempted += 1;
    progress.set(
      6 + Math.round((i / missing.length) * 88),
      `Buscando ${i + 1} de ${missing.length}: ${order.address}`
    );

    try {
      const found = await geocodeOrder(order);
      if (found) {
        await api(`/api/orders/${order.id}`, {
          method: 'PATCH',
          body: { lat: found.lat, lng: found.lng, geocodeSource: found.source }
        });
        order.lat = found.lat;
        order.lng = found.lng;
        order.geocodeSource = found.source;
        result.found += 1;
        if (found.source === 'cep') result.approximate += 1;
      } else {
        result.failed.push(order);
      }
    } catch (err) {
      console.warn('Geocodificação falhou:', order.address, err);
      result.failed.push(order);
    }
  }

  const parts = [];
  if (result.found) parts.push(`${result.found} endereço${result.found === 1 ? '' : 's'} localizado${result.found === 1 ? '' : 's'}`);
  if (result.approximate) parts.push(`${result.approximate} pelo CEP (aproximado)`);
  progress.set(100, parts.length ? `${parts.join(' · ')}.` : 'Nenhum endereço novo localizado.');
  setTimeout(() => progress.close(), 700);
  return result;
}

function buildGeocodeQuery(address, city) {
  const clean = String(address || '').replace(/\s+/g, ' ').trim();
  const hasCity = /jo[aã]o pessoa/i.test(clean);
  const hasCountry = /brasil/i.test(clean);
  return [clean, hasCity ? null : city, hasCountry ? null : 'Brasil'].filter(Boolean).join(', ');
}

let lastNominatimAt = 0;

async function geocodeQuery(query) {
  if (!query) return null;
  const wait = 1100 - (Date.now() - lastNominatimAt);
  if (wait > 0) await sleep(wait);
  lastNominatimAt = Date.now();

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { 'accept-language': 'pt-BR' },
    signal: AbortSignal.timeout(30000),
    referrerPolicy: 'strict-origin-when-cross-origin'
  });
  if (!res.ok) throw new Error(`Busca de endereço indisponível (${res.status}).`);
  const list = await res.json();
  if (!Array.isArray(list) || !list.length) return null;
  const lat = Number(list[0].lat);
  const lng = Number(list[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: list[0].display_name || '' };
}

async function geocodeAwesomeCep(cep) {
  const digits = validCep(cep);
  if (!digits) return null;
  const res = await fetch(`https://cep.awesomeapi.com.br/json/${digits}`, {
    signal: AbortSignal.timeout(10000),
    referrerPolicy: 'strict-origin-when-cross-origin'
  });
  if (!res.ok) return null;
  const data = await res.json();
  const lat = Number(data?.lat);
  const lng = Number(data?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, label: data?.address || '' };
}

async function geocodeOrder(order) {
  const city = state.settings?.city;
  let nominatimDown = false;

  try {
    const full = await geocodeQuery(buildGeocodeQuery(order.address, city));
    if (full) return { ...full, source: 'nominatim' };
  } catch (err) {
    nominatimDown = true;
    console.warn('Busca pelo endereço falhou:', order.address, err);
  }

  const cep = validCep(order.cep);
  if (!cep) return null;

  if (!nominatimDown) {
    try {
      const byCep = await geocodeQuery(buildGeocodeQuery(formatCep(cep), city));
      if (byCep) return { ...byCep, source: 'cep' };
    } catch (err) {
      console.warn('Busca pelo CEP falhou:', cep, err);
    }
  }

  try {
    const byCep = await geocodeAwesomeCep(cep);
    if (byCep) return { ...byCep, source: 'cep' };
  } catch (err) {
    console.warn('Busca pelo CEP (AwesomeAPI) falhou:', cep, err);
  }

  return null;
}

/* -------------------------------- CEP -------------------------------- */

const cepCache = new Map();

function cepDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 8);
}

function validCep(value) {
  const digits = cepDigits(value);
  return digits.length === 8 ? digits : '';
}

function normalizeCep(raw) {
  return {
    cep: cepDigits(raw?.cep),
    street: String(raw?.street || '').trim(),
    neighborhood: String(raw?.neighborhood || '').trim(),
    city: String(raw?.city || '').trim(),
    state: String(raw?.state || '').trim().toUpperCase()
  };
}

function composeCepAddress(info, number = '') {
  if (!info) return '';
  const parts = [];
  const houseNumber = String(number || '').trim();
  if (info.street) parts.push(houseNumber ? `${info.street}, ${houseNumber}` : info.street);
  if (info.neighborhood) parts.push(info.neighborhood);
  const city = [info.city, info.state].filter(Boolean).join(' - ');
  if (city) parts.push(city);
  return parts.join(', ');
}

async function lookupCep(value) {
  const digits = validCep(value);
  if (!digits) return null;
  if (cepCache.has(digits)) return cepCache.get(digits);

  const viaCep = async () => {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: AbortSignal.timeout(10000),
      referrerPolicy: 'strict-origin-when-cross-origin'
    });
    if (!res.ok) throw new Error(`ViaCEP ${res.status}`);
    const data = await res.json();
    if (!data || data.erro) return null;
    return normalizeCep({
      cep: data.cep,
      street: data.logradouro,
      neighborhood: data.bairro,
      city: data.localidade,
      state: data.uf
    });
  };

  const brasilApi = async () => {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${digits}`, {
      signal: AbortSignal.timeout(10000),
      referrerPolicy: 'strict-origin-when-cross-origin'
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`BrasilAPI ${res.status}`);
    const data = await res.json();
    return normalizeCep({
      cep: data.cep,
      street: data.street,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state
    });
  };

  let info = null;
  try {
    info = await viaCep();
  } catch (err) {
    console.warn('Consulta de CEP falhou no ViaCEP:', err);
  }
  if (!info) {
    try {
      info = await brasilApi();
    } catch (err) {
      console.warn('Consulta de CEP falhou no BrasilAPI:', err);
    }
  }

  if (info && info.cep) cepCache.set(digits, info);
  return info && info.cep ? info : null;
}

function wireCepField(dialog, { addressName = 'address', numberName = 'number' } = {}) {
  const input = dialog.querySelector('[name="cep"]');
  const address = dialog.querySelector(`[name="${addressName}"]`);
  const number = numberName ? dialog.querySelector(`[name="${numberName}"]`) : null;
  const status = dialog.querySelector('[data-cep-status]');
  if (!input || !address || !status) return;

  const hint = 'Digite o CEP para preencher rua, bairro e cidade.';
  const setStatus = (message, tone = '') => {
    status.textContent = message;
    status.className = `hint field-status${tone === 'error' ? ' error' : tone === 'ok' ? ' ok' : ''}`;
  };
  let dirty = false;
  let timer = null;
  let inFlight = null;
  let inFlightDigits = '';
  let lastComposed = '';

  input.value = formatCep(input.value);

  const run = async () => {
    const digits = validCep(input.value);
    if (!digits) { setStatus(hint); return; }
    if (inFlight && inFlightDigits === digits) return inFlight;

    inFlightDigits = digits;
    const task = (async () => {
      setStatus('Buscando endereço…');
      try {
        const info = await lookupCep(digits);
        if (validCep(input.value) !== digits) return;
        if (!info) {
          setStatus('CEP não encontrado. Confira o número ou preencha o endereço manualmente.', 'error');
          return;
        }
        input.value = formatCep(info.cep);
        lastComposed = composeCepAddress(info, number ? number.value : '');
        address.value = lastComposed;
        address.dispatchEvent(new Event('input', { bubbles: true }));
        if (number) {
          setStatus(`Endereço encontrado em ${info.city} - ${info.state}. Confira ou complete o número.`, 'ok');
        } else {
          setStatus('Endereço preenchido. Ajuste o número e o complemento se precisar.', 'ok');
        }
      } catch (err) {
        console.warn('Consulta de CEP indisponível:', err);
        setStatus('Não foi possível consultar o CEP agora. Preencha o endereço manualmente.', 'error');
      }
    })();

    inFlight = task;
    try {
      await task;
    } finally {
      if (inFlight === task) {
        inFlight = null;
        inFlightDigits = '';
      }
      dirty = false;
    }
    return task;
  };

  dialog.__cepFill = run;

  input.addEventListener('input', () => {
    input.value = formatCep(input.value);
    dirty = true;
    clearTimeout(timer);
    if (validCep(input.value)) {
      timer = setTimeout(run, 450);
    } else {
      setStatus(hint);
    }
  });
  input.addEventListener('blur', () => {
    clearTimeout(timer);
    if (dirty && validCep(input.value)) run();
  });

  if (number) {
    number.addEventListener('input', () => {
      const info = validCep(input.value) ? cepCache.get(validCep(input.value)) : null;
      if (!info) return;
      if (address.value.trim() && address.value !== lastComposed) return;
      lastComposed = composeCepAddress(info, number.value);
      address.value = lastComposed;
      address.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
}

/* ------------------------------- links ------------------------------ */

function routeLinkFor(token) {
  return `${location.origin}/rota?t=${encodeURIComponent(token)}`;
}
function customerLinkFor(token) {
  return `${location.origin}/acompanhar?t=${encodeURIComponent(token)}`;
}
function routeWhatsApp(link) {
  const phone = state.settings?.driverPhone || '';
  return waLink(phone, `Olá! Aqui está o link da rota de entregas de hoje: ${link}`);
}
function customerMessage(order, link) {
  return `Olá, ${firstName(order.customer)}! Acompanhe sua entrega ${order.code} em tempo real por este link: ${link}`;
}

async function copy(value, successMessage) {
  const ok = await copyText(value);
  toast(ok ? successMessage : 'Não foi possível copiar. Selecione o link manualmente.', ok ? 'success' : 'error');
}

function openShareRoute() {
  const route = state.route;
  if (!route) return;
  const link = routeLinkFor(route.token);
  showDialog({
    title: 'Link do motoboy',
    subtitle: 'Um único link com todas as paradas em ordem.',
    body: `
      <div class="stack">
        <p class="small muted">O entregador abre este link no celular. A página mostra as paradas numeradas e os botões “Em rota” e “Entregue”.</p>
        <div class="link-box">
          <input readonly value="${esc(link)}" aria-label="Link do motoboy">
          <button class="btn btn--primary btn--sm" type="button" data-copy-route>${icon('copy')}</button>
        </div>
        <div class="row row--wrap">
          <a class="btn btn--outline btn--sm" href="${esc(link)}" target="_blank" rel="noopener">${icon('eye')} Abrir link</a>
          <a class="btn btn--outline btn--sm" href="${esc(routeWhatsApp(link))}" target="_blank" rel="noopener">${icon('whatsapp')} Enviar no WhatsApp</a>
        </div>
        <div class="alert alert--info">
          ${icon('info')}
          <div>Mantenha esta página do motoboy aberta durante a rota. O GPS e a localização do cliente só funcionam com ela aberta.</div>
        </div>
      </div>`,
    actions: [
      {
        label: 'Links dos clientes',
        variant: 'soft',
        icon: 'users',
        onClick: () => { setTimeout(openShareCustomers, 140); }
      },
      { label: 'Fechar', variant: 'outline' }
    ],
    onMount: (dialog) => {
      dialog.querySelector('[data-copy-route]')?.addEventListener('click', () => copy(link, 'Link do motoboy copiado.'));
    }
  });
}

function openShareCustomers() {
  const route = state.route;
  if (!route) return;
  const orders = state.orders.filter((o) => o.status !== 'canceled');
  const allLinks = orders
    .map((o) => `${firstName(o.customer)} (${o.code}): ${customerLinkFor(o.token)}`)
    .join('\n');

  const rows = orders.length
    ? orders.map((order) => {
        const link = customerLinkFor(order.token);
        return `
          <div class="share-order">
            <span class="share-order__num">${order.seq ?? '·'}</span>
            <div class="share-order__body">
              <div class="share-order__name">${esc(order.customer)} <span class="muted small">${esc(order.code)}</span></div>
              <div class="share-order__addr">${esc(order.address)}${order.cep ? ` · CEP ${formatCep(order.cep)}` : ''}</div>
            </div>
            <div class="share-order__actions">
              <button class="btn btn--icon" type="button" data-copy-order="${esc(order.id)}" title="Copiar link">${icon('copy')}</button>
              ${order.phone ? `<a class="btn btn--icon" href="${esc(waLink(order.phone, customerMessage(order, link)))}" target="_blank" rel="noopener" title="Enviar no WhatsApp">${icon('whatsapp')}</a>` : ''}
              <a class="btn btn--icon" href="${esc(link)}" target="_blank" rel="noopener" title="Abrir link do cliente">${icon('eye')}</a>
            </div>
          </div>`;
      }).join('')
    : `<div class="empty"><div class="empty__icon">${icon('users')}</div><h3>Nenhum pedido ainda</h3><p>Adicione pedidos para gerar os links dos clientes.</p></div>`;

  showDialog({
    title: 'Links dos clientes',
    subtitle: 'Cada cliente recebe um link individual e seguro.',
    wide: true,
    body: `
      <p class="small muted" style="margin-bottom:6px">O cliente vê primeiro a tela de espera. Quando o entregador tocar em “Em rota”, o mapa ao vivo aparece automaticamente.</p>
      <div class="share-list">${rows}</div>`,
    actions: [
      {
        label: 'Copiar todos',
        variant: 'outline',
        icon: 'copy',
        onClick: async () => {
          if (!allLinks) {
            toast('Não há links para copiar.', 'error');
            return false;
          }
          await copy(allLinks, 'Links dos clientes copiados.');
          return false;
        }
      },
      { label: 'Fechar', variant: 'primary' }
    ],
    onMount: (dialog) => {
      dialog.querySelectorAll('[data-copy-order]').forEach((button) => {
        button.addEventListener('click', () => {
          const order = findOrder(button.dataset.copyOrder);
          if (order) copy(customerLinkFor(order.token), 'Link do cliente copiado.');
        });
      });
    }
  });
}

/* ---------------------------- configurações ------------------------- */

function openSettings() {
  const s = state.settings;
  if (!s) return;
  showDialog({
    title: 'Configurações',
    subtitle: 'Dados da loja, entregador e ponto de retirada.',
    wide: true,
    body: `
      <div class="settings-section">
        <h3>Loja e entregador</h3>
        <div class="form-grid">
          <div class="field">
            <label>Nome da loja</label>
            <input class="input" name="storeName" value="${esc(s.storeName)}" maxlength="80">
          </div>
          <div class="field">
            <label>Nome do entregador</label>
            <input class="input" name="driverName" value="${esc(s.driverName)}" maxlength="80">
          </div>
          <div class="field">
            <label>WhatsApp do entregador</label>
            <input class="input" name="driverPhone" value="${esc(s.driverPhone)}" maxlength="40" inputmode="tel" placeholder="(83) 91234-5678">
          </div>
          <div class="field">
            <label>Cidade das entregas</label>
            <input class="input" name="city" value="${esc(s.city)}" maxlength="80">
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Ponto de retirada</h3>
        <div class="field">
          <label>Endereço</label>
          <input class="input" name="pickupAddress" value="${esc(s.pickupAddress)}" maxlength="240">
        </div>
        <div class="form-grid form-grid--3" style="margin-top:12px">
          <div class="field">
            <label>Latitude</label>
            <input class="input" name="pickupLat" value="${s.pickupLat ?? ''}" inputmode="decimal">
          </div>
          <div class="field">
            <label>Longitude</label>
            <input class="input" name="pickupLng" value="${s.pickupLng ?? ''}" inputmode="decimal">
          </div>
          <div class="field">
            <label>&nbsp;</label>
            <button class="btn btn--outline" type="button" id="pickup-search">${icon('search')} Buscar coordenadas</button>
          </div>
        </div>
        <p class="hint" style="margin-top:6px">A rota sempre começa neste ponto. Use “Buscar coordenadas” se alterar o endereço.</p>
      </div>

      <div class="settings-section">
        <h3>Senha do painel</h3>
        ${state.isDefaultPassword ? `<div class="alert alert--danger" style="margin-bottom:10px">${icon('shield')}<div><strong>Senha inicial em uso.</strong> Altere agora para proteger o painel.</div></div>` : ''}
        <div class="form-grid form-grid--3">
          <div class="field">
            <label>Senha atual</label>
            <input class="input" type="password" name="currentPassword" autocomplete="current-password">
          </div>
          <div class="field">
            <label>Nova senha</label>
            <input class="input" type="password" name="newPassword" autocomplete="new-password" minlength="6">
          </div>
          <div class="field">
            <label>Confirmar nova senha</label>
            <input class="input" type="password" name="confirmPassword" autocomplete="new-password" minlength="6">
          </div>
        </div>
        <button class="btn btn--outline" type="button" id="change-password" style="margin-top:10px">${icon('key')} Alterar senha</button>
      </div>`,
    actions: [
      { label: 'Cancelar', variant: 'outline' },
      {
        label: 'Salvar alterações',
        variant: 'primary',
        icon: 'check',
        onClick: async (dialog) => {
          const value = (name) => dialog.querySelector(`[name="${name}"]`).value.trim();
          const latText = value('pickupLat').replace(',', '.');
          const lngText = value('pickupLng').replace(',', '.');
          if (!latText || !lngText) {
            toast('Informe as coordenadas do ponto de retirada.', 'error');
            return false;
          }
          const lat = Number(latText);
          const lng = Number(lngText);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            toast('Informe coordenadas válidas para o ponto de retirada.', 'error');
            return false;
          }
          const data = await api('/api/settings', {
            method: 'PUT',
            body: {
              storeName: value('storeName'),
              driverName: value('driverName'),
              driverPhone: value('driverPhone'),
              city: value('city'),
              pickupAddress: value('pickupAddress'),
              pickupLat: lat,
              pickupLng: lng
            }
          });
          state.settings = data.settings;
          updateSidebar();
          toast('Configurações salvas.', 'success');
          if (state.currentView === 'detail') {
            state.mapFitKey = null;
            await refreshRoute(true);
            setTimeout(() => { if (state.currentView === 'detail') renderRouteDetail(); }, 80);
          } else {
            renderRoutes();
          }
        }
      }
    ],
    onMount: (dialog) => {
      dialog.querySelector('#pickup-search')?.addEventListener('click', async (event) => {
        const btn = event.currentTarget;
        const address = dialog.querySelector('[name="pickupAddress"]').value.trim();
        const city = dialog.querySelector('[name="city"]').value.trim();
        if (!address) {
          toast('Informe o endereço de retirada.', 'error');
          return;
        }
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = 'Buscando…';
        try {
          const found = await geocodeQuery(buildGeocodeQuery(address, city));
          if (!found) {
            toast('Endereço não encontrado. Ajuste as coordenadas manualmente.', 'error');
            return;
          }
          dialog.querySelector('[name="pickupLat"]').value = found.lat.toFixed(7);
          dialog.querySelector('[name="pickupLng"]').value = found.lng.toFixed(7);
          toast('Coordenadas encontradas. Salve para aplicar.', 'success');
        } catch (err) {
          toast(err.message || 'Não foi possível buscar o endereço.', 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = original;
        }
      });

      dialog.querySelector('#change-password')?.addEventListener('click', async (event) => {
        const btn = event.currentTarget;
        const currentPassword = dialog.querySelector('[name="currentPassword"]').value;
        const newPassword = dialog.querySelector('[name="newPassword"]').value;
        const confirmPassword = dialog.querySelector('[name="confirmPassword"]').value;

        if (newPassword.length < 6) {
          toast('A nova senha precisa ter pelo menos 6 caracteres.', 'error');
          return;
        }
        if (newPassword !== confirmPassword) {
          toast('A confirmação não confere com a nova senha.', 'error');
          return;
        }

        btn.disabled = true;
        try {
          await api('/api/password', {
            method: 'POST',
            body: { currentPassword, newPassword }
          });
          state.isDefaultPassword = false;
          dialog.querySelector('[name="currentPassword"]').value = '';
          dialog.querySelector('[name="newPassword"]').value = '';
          dialog.querySelector('[name="confirmPassword"]').value = '';
          toast('Senha alterada com sucesso.', 'success');
        } finally {
          btn.disabled = false;
        }
      });
    }
  });
}

/* ------------------------------- helpers ---------------------------- */

function hasCoords(point) {
  if (!point) return false;
  const { lat, lng } = point;
  if (lat === null || lat === undefined || lat === '' || lng === null || lng === undefined || lng === '') {
    return false;
  }
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'cliente';
}

function cap(text) {
  const s = String(text || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function statusLabel(status) {
  return ({ pending: 'Pendente', en_route: 'Em rota', delivered: 'Entregue', canceled: 'Cancelado' })[status] || status;
}

function setTopTitle(title) {
  const el = $('#panel-top-title');
  if (el) el.innerHTML = `<strong>${esc(title)}</strong>`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
