/* ============================================================
   RotaCerta v2 — acompanhamento do cliente
   ============================================================ */

import {
  $, api, icon, esc, formatTime, formatDateTime, formatDistance, timeAgo,
  initials, waLink, telLink, ensureLeaflet, createMap, divIcon, riderIcon,
  fitMap, geometryLatLngs, remainingEta
} from './common.js';

const TOKEN = new URL(location.href).searchParams.get('t') || '';

const state = {
  token: TOKEN,
  data: null,
  lastStatus: null,
  timer: null,
  map: null,
  layer: null,
  mapFitted: false
};

init();

async function init() {
  if (!TOKEN) {
    renderError('Este link não tem um código de acompanhamento. Peça um novo link para a loja.', false);
    return;
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.data) refresh({ silent: true });
  });
  await refresh({ silent: false });
}

/* ------------------------------ atualização ------------------------- */

async function refresh({ silent = true } = {}) {
  try {
    const data = await api(`/api/acompanhar/${state.token}`, { token: null, timeout: 15000 });
    const changed = !state.data || state.lastStatus !== data.order.status;
    state.data = data;

    if (changed) {
      state.lastStatus = data.order.status;
      render();
    } else {
      updateLive();
      if (state.map) updateMap();
      else if ($('#track-map')) mountMap();
    }

    schedule();
  } catch (err) {
    if (err.status === 404) {
      renderError('Este link de acompanhamento é inválido ou expirou. Peça um novo link para a loja.', false);
      return;
    }
    if (!state.data) {
      renderError(err.message || 'Não foi possível carregar sua entrega. Verifique sua internet e tente novamente.', true);
      return;
    }
    schedule();
  }
}

function schedule() {
  clearTimeout(state.timer);
  const status = state.data?.order.status;
  if (!status || status === 'delivered' || status === 'canceled') return;

  const delay = status === 'en_route' ? 4000 : 12000;
  state.timer = setTimeout(() => {
    if (document.hidden) {
      schedule();
      return;
    }
    refresh();
  }, delay);
}

/* -------------------------------- render ---------------------------- */

function render() {
  const data = state.data;
  if (!data) return;
  const { order, route, driver, store } = data;
  const status = order.status;

  teardownMap();

  document.title = ({
    pending: 'Aguardando entrega · RotaCerta',
    en_route: 'Entrega em rota · RotaCerta',
    delivered: 'Entrega concluída · RotaCerta',
    canceled: 'Entrega cancelada · RotaCerta'
  })[status] || 'Acompanhar entrega · RotaCerta';

  $('#track-root').innerHTML = `
    <div class="track-head">
      <a class="brand" href="/" aria-label="RotaCerta">
        <span class="brand__mark brand__mark--sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M5 19c6 0 8-14 14-14"/><circle cx="5" cy="19" r="2.2" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="2.2" fill="currentColor" stroke="none"/>
          </svg>
        </span>
        <span>
          <span class="brand__name">RotaCerta</span>
          <span class="brand__tag">acompanhamento</span>
        </span>
      </a>
      <span class="track-head__badge">${status === 'en_route' ? 'AO VIVO' : 'PEDIDO'}</span>
    </div>

    ${heroHtml(data)}

    ${status === 'en_route' ? `
      <section class="track-section">
        <div class="track-map-wrap">
          <div class="track-map" id="track-map">
            <div class="track-map__live"><span class="dot"></span> AO VIVO</div>
          </div>
        </div>
        <div class="track-map__foot">
          <span id="live-updated">${data.position ? `Atualizado ${esc(timeAgo(data.position.updatedAt))}` : 'Aguardando sinal do GPS…'}</span>
          <span id="live-numbers">${liveNumbersHtml(data)}</span>
        </div>
      </section>` : ''}

    ${status !== 'canceled' ? timelineCard(order) : ''}

    ${driver && (status === 'en_route' || status === 'delivered') ? driverCard(driver, order) : ''}

    ${orderCard(order, route, store)}

    <div class="track-help">
      ${status === 'en_route'
        ? 'O mapa atualiza sozinho a cada poucos segundos. Mantenha esta página aberta.'
        : status === 'pending'
          ? 'Esta página se atualiza sozinha. O mapa aparece no momento em que o entregador sair.'
          : status === 'delivered'
            ? 'Obrigado por acompanhar!'
            : 'Fale com a loja para mais informações sobre esta entrega.'}
    </div>

    <div class="track-footer">RotaCerta · acompanhamento seguro da sua entrega</div>`;

  if (status === 'en_route') {
    mountMap();
    updateLive();
  }
}

function heroHtml(data) {
  const { order, route, position } = data;
  const status = order.status;
  const eta = remainingEta(order.remainingM ? order.remainingM * 1.2 : null);

  if (status === 'pending') {
    return `
      <section class="track-hero">
        <div class="track-icon track-icon--pulse">${icon('clock')}</div>
        <h1>Seu pedido está aguardando</h1>
        <p>Assim que o entregador sair da loja, o mapa ao vivo aparece aqui automaticamente.</p>
        <span class="track-code"><span class="chip chip--ink">${icon('package')} ${esc(order.code)}</span></span>
        <div class="track-hero__meta">
          <div class="track-meta">
            <strong>${order.queuePosition != null ? `${order.queuePosition}º` : '—'}</strong>
            <span>na fila</span>
          </div>
          <div class="track-meta">
            <strong>${route.total ?? '—'}</strong>
            <span>na rota</span>
          </div>
          <div class="track-meta">
            <strong>${route.delivered ?? 0}</strong>
            <span>concluídas</span>
          </div>
        </div>
      </section>`;
  }

  if (status === 'en_route') {
    return `
      <section class="track-hero">
        <div class="track-icon track-icon--pulse">${icon('navigation')}</div>
        <h1>Seu pedido saiu para entrega</h1>
        <p>O entregador está a caminho. Acompanhe a localização no mapa abaixo.</p>
        <span class="track-code"><span class="chip chip--violet">${icon('bike')} ${esc(order.code)} · em rota</span></span>
        <div class="track-hero__meta">
          <div class="track-meta">
            <strong id="hero-eta">${eta ? `~${eta} min` : 'Calculando'}</strong>
            <span>estimativa</span>
          </div>
          <div class="track-meta">
            <strong id="hero-distance">${order.remainingM != null ? formatDistance(order.remainingM) : '—'}</strong>
            <span>distância</span>
          </div>
          <div class="track-meta">
            <strong>${order.queuePosition != null ? `${order.queuePosition}ª` : '—'}</strong>
            <span>parada</span>
          </div>
        </div>
      </section>`;
  }

  if (status === 'delivered') {
    return `
      <section class="track-hero track-hero--green">
        <div class="track-icon track-icon--green">${icon('check')}</div>
        <h1>Entrega concluída!</h1>
        <p>Seu pedido foi entregue${order.deliveredAt ? ` às ${esc(formatTime(order.deliveredAt))}` : ''}. Obrigado por acompanhar.</p>
        <span class="track-code"><span class="chip chip--green">${icon('check')} ${esc(order.code)}</span></span>
        <div class="track-hero__meta">
          <div class="track-meta">
            <strong>${order.queuePosition != null ? `${order.queuePosition}ª` : '—'}</strong>
            <span>parada</span>
          </div>
          <div class="track-meta">
            <strong>${route.total ?? '—'}</strong>
            <span>na rota</span>
          </div>
          <div class="track-meta">
            <strong>Concluída</strong>
            <span>status</span>
          </div>
        </div>
      </section>`;
  }

  return `
    <section class="track-hero track-hero--muted">
      <div class="track-icon track-icon--muted">${icon('x')}</div>
      <h1>Entrega cancelada</h1>
      <p>Esta entrega foi cancelada. Fale com a loja para mais informações.</p>
      <span class="track-code"><span class="chip chip--red">${icon('x')} ${esc(order.code)}</span></span>
    </section>`;
}

function liveNumbersHtml(data) {
  const order = data.order;
  if (!order.remainingM) return '—';
  const eta = remainingEta(order.remainingM * 1.2);
  return `<strong>${esc(formatDistance(order.remainingM))}</strong> · ~${eta} min`;
}

function timelineCard(order) {
  const status = order.status;
  const steps = [
    {
      title: 'Pedido confirmado',
      at: order.createdAt,
      state: 'done',
      icon: 'check'
    },
    {
      title: 'Saiu para entrega',
      at: order.enRouteAt,
      state: status === 'delivered' ? 'done' : status === 'en_route' ? 'active' : 'pending',
      icon: status === 'en_route' ? 'navigation' : status === 'delivered' ? 'check' : 'clock'
    },
    {
      title: 'Entregue',
      at: order.deliveredAt,
      state: status === 'delivered' ? 'done' : 'pending',
      icon: status === 'delivered' ? 'check' : 'home'
    }
  ];

  return `
    <section class="card track-section">
      <div class="card__head"><h2>Andamento</h2></div>
      <div class="card__body">
        <div class="timeline">
          ${steps.map((step) => `
            <div class="timeline-step is-${step.state}">
              <span class="timeline-step__dot">${icon(step.icon)}</span>
              <div class="timeline-step__body">
                <div class="timeline-step__title">${esc(step.title)}</div>
                <div class="timeline-step__time">${step.at
                  ? esc(formatDateTime(step.at))
                  : step.state === 'active'
                    ? 'Em andamento'
                    : 'Aguardando'}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </section>`;
}

function driverCard(driver, order) {
  const wa = driver.phone
    ? waLink(driver.phone, `Olá, ${driver.name}! Estou acompanhando minha entrega ${order.code}.`)
    : '';
  const tel = driver.phone ? telLink(driver.phone) : '';
  return `
    <section class="card track-section">
      <div class="card__body">
        <div class="driver-card">
          <span class="driver-avatar">${esc(initials(driver.name))}</span>
          <div class="driver-card__body">
            <div class="driver-card__name">${esc(driver.name)}</div>
            <div class="driver-card__sub">${order.status === 'delivered' ? 'Fez a sua entrega' : 'Seu entregador'}</div>
          </div>
          <div class="driver-card__actions">
            ${tel ? `<a class="driver-action" href="${esc(tel)}" title="Ligar para o entregador" aria-label="Ligar">${icon('phone')}</a>` : ''}
            ${wa ? `<a class="driver-action driver-action--wa" href="${esc(wa)}" target="_blank" rel="noopener" title="WhatsApp do entregador" aria-label="WhatsApp">${icon('whatsapp')}</a>` : ''}
          </div>
        </div>
      </div>
    </section>`;
}

function orderCard(order, route, store) {
  return `
    <section class="card track-section">
      <div class="card__head">
        <h2>Seu pedido</h2>
        <div class="spacer"></div>
        <span class="badge">${esc(order.code)}</span>
      </div>
      <div class="card__body">
        <div class="info-list">
          <div class="info-row">
            ${icon('mapPin')}
            <div>
              <div class="info-row__label">Endereço de entrega</div>
              <div class="info-row__value">${esc(order.address)}${order.reference ? `<br><span class="muted">${esc(order.reference)}</span>` : ''}</div>
            </div>
          </div>
          <div class="info-row">
            ${icon('store')}
            <div>
              <div class="info-row__label">Loja</div>
              <div class="info-row__value">${esc(store?.name || 'RotaCerta')}</div>
            </div>
          </div>
          <div class="info-row">
            ${icon('route')}
            <div>
              <div class="info-row__label">Rota</div>
              <div class="info-row__value">${order.queuePosition ?? '—'} de ${route.total ?? '—'} paradas</div>
            </div>
          </div>
        </div>
      </div>
    </section>`;
}

/* --------------------------------- mapa ----------------------------- */

async function mountMap() {
  const el = $('#track-map');
  if (!el || !state.data) return;
  try {
    await ensureLeaflet();
    if (!document.body.contains(el) || !$('#track-map')) return;
    teardownMap();
    const order = state.data.order;
    const position = state.data.position;
    const center = hasCoords(order)
      ? [order.lat, order.lng]
      : hasCoords(position)
        ? [position.lat, position.lng]
        : [-7.122, -34.877];
    state.map = createMap(el, center, 15);
    state.layer = window.L.layerGroup().addTo(state.map);
    state.mapFitted = false;
    updateMap();
    setTimeout(() => {
      try { state.map?.invalidateSize(); } catch { /* ignore */ }
    }, 150);
  } catch {
    const target = $('#track-map');
    if (target) {
      target.outerHTML = `<div class="track-map-empty">
        ${icon('alert')}
        <div>Não foi possível carregar o mapa agora. O restante das informações continua atualizando.</div>
      </div>`;
    }
  }
}

function updateMap() {
  if (!state.map || !state.layer || !state.data) return;
  const L = window.L;
  const { order, position, driver } = state.data;
  const layer = state.layer;
  layer.clearLayers();

  const geometry = geometryLatLngs(state.data.route.geometry);
  if (geometry.length > 1) {
    L.polyline(geometry, { color: '#f0522b', weight: 4, opacity: 0.3 }).addTo(layer);
  }

  const points = [];
  if (hasCoords(order)) {
    const homeIcon = divIcon(
      `<div class="map-pin map-pin--pickup"><span>${icon('home')}</span></div>`,
      32,
      [16, 16]
    );
    L.marker([order.lat, order.lng], { icon: homeIcon })
      .addTo(layer)
      .bindPopup(`<strong>Seu endereço</strong><br>${esc(order.address)}`);
    points.push({ lat: order.lat, lng: order.lng });
  }

  if (hasCoords(position)) {
    if (hasCoords(order)) {
      L.polyline(
        [[position.lat, position.lng], [order.lat, order.lng]],
        { color: '#2563eb', weight: 3, opacity: 0.7, dashArray: '7 9' }
      ).addTo(layer);
    }
    L.marker([position.lat, position.lng], { icon: riderIcon() })
      .addTo(layer)
      .bindPopup(`<strong>${esc(driver?.name || 'Entregador')}</strong><br><span style="color:#64748b">${esc(timeAgo(position.updatedAt))}</span>`);
    points.push({ lat: position.lat, lng: position.lng });
  }

  if (!state.mapFitted) {
    if (points.length) {
      fitMap(state.map, points, { padding: [34, 34], maxZoom: 16 });
      state.mapFitted = true;
    } else if (geometry.length) {
      state.map.fitBounds(L.latLngBounds(geometry), { padding: [34, 34], maxZoom: 15 });
      state.mapFitted = true;
    }
  }

  updateLive();
}

function updateLive() {
  const data = state.data;
  if (!data) return;
  const { order, position } = data;
  const eta = remainingEta(order.remainingM ? order.remainingM * 1.2 : null);

  const updated = $('#live-updated');
  if (updated) {
    updated.textContent = position
      ? `Atualizado ${timeAgo(position.updatedAt)}`
      : 'Aguardando sinal do GPS…';
  }
  const numbers = $('#live-numbers');
  if (numbers) {
    numbers.innerHTML = liveNumbersHtml(data);
  }
  const heroEta = $('#hero-eta');
  if (heroEta) heroEta.textContent = eta ? `~${eta} min` : 'Calculando';
  const heroDistance = $('#hero-distance');
  if (heroDistance) {
    heroDistance.textContent = order.remainingM != null ? formatDistance(order.remainingM) : '—';
  }
}

function teardownMap() {
  try { state.map?.remove(); } catch { /* ignore */ }
  state.map = null;
  state.layer = null;
  state.mapFitted = false;
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

function renderError(message, retry) {
  clearTimeout(state.timer);
  teardownMap();
  document.body.className = 'track-body';
  document.body.innerHTML = `
    <main class="error-screen">
      <div class="error-screen__card">
        <div class="error-screen__icon">${icon('alert')}</div>
        <h1>Não foi possível abrir o acompanhamento</h1>
        <p>${esc(message)}</p>
        <div class="stack" style="margin-top:18px">
          ${retry ? '<a class="btn btn--primary btn--block" href="">Tentar novamente</a>' : ''}
          <a class="btn btn--outline btn--block" href="/">Ir para o início</a>
        </div>
      </div>
    </main>`;
}
