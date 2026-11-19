import {
  STATUS, STEP_STATUSES, formatTime, formatDateTime, timeAgo, isToday,
  esc, waLink, mapsLink, initials, statusChip, decodePayload
} from './shared.js';

const ICONS = {
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.8L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

const root = document.getElementById('track');

function readPayload() {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const raw = params.get('d');
    if (!raw) return null;
    const payload = decodePayload(raw);
    return payload && payload.v === 1 ? payload : null;
  } catch {
    return null;
  }
}

const payload = readPayload();

if (!payload || !payload.codigo) {
  renderError();
} else {
  renderTracking();
  setInterval(updateAgos, 30000);
}

/* ----------------------------- render ----------------------------- */

function renderError() {
  document.title = 'Link inválido · RotaCerta';
  root.innerHTML = `
    <section class="track-error">
      <div class="track-error__art">${icon('alert')}</div>
      <h1>Link inválido ou incompleto</h1>
      <p>Não conseguimos carregar os dados desta entrega. Peça ao entregador um novo link de acompanhamento.</p>
    </section>
    <p class="track-footer">RotaCerta · controle de entregas</p>`;
}

function validPos(pos) {
  return pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng) ? pos : null;
}

function eventTime(iso) {
  return isToday(iso) ? formatTime(iso) : formatDateTime(iso);
}

function lastEvent() {
  const events = Array.isArray(payload.timeline) ? payload.timeline : [];
  if (!events.length) return null;
  return events.slice().sort((a, b) => new Date(a.em) - new Date(b.em))[events.length - 1];
}

function heroCopy() {
  const status = payload.status;
  const copy = {
    pendente: ['Pedido recebido', 'Estamos aguardando o entregador iniciar o atendimento.'],
    aceita: ['O entregador aceitou o pedido', 'Em breve ele sai para a coleta.'],
    coletada: ['Pedido coletado', 'O pedido foi retirado e logo segue para você.'],
    em_rota: ['Sua entrega está a caminho', 'O entregador está em rota para o seu endereço.'],
    entregue: ['Entrega concluída', 'Seu pedido chegou ao destino. Obrigado por acompanhar!'],
    cancelada: ['Entrega cancelada', 'Esta entrega foi cancelada. Fale com o entregador se precisar de ajuda.']
  }[status] || ['Acompanhamento da entrega', 'Veja abaixo a situação mais recente do seu pedido.'];

  if (status === 'entregue') {
    const last = lastEvent();
    return [copy[0], last ? `Entregue em ${formatDateTime(last.em)}.` : copy[1]];
  }
  return copy;
}

function stepState(status, i) {
  const idx = STEP_STATUSES.indexOf(status);
  if (status === 'entregue') return i === STEP_STATUSES.length - 1 ? 'current' : 'done';
  if (idx === -1) return '';
  if (i < idx) return 'done';
  if (i === idx) return 'current';
  return '';
}

function renderStepper() {
  if (!STEP_STATUSES.includes(payload.status)) return '';
  const steps = STEP_STATUSES.map((status, i) => {
    const state = stepState(payload.status, i);
    const meta = STATUS[status] || { label: status };
    return `
      <div class="step ${state ? 'is-' + state : ''}">
        <span class="step__dot">${state === 'done' ? icon('check') : i + 1}</span>
        <span class="step__label">${esc(meta.label)}</span>
      </div>`;
  }).join('');
  return `<section class="steps" aria-label="Etapas da entrega">${steps}</section>`;
}

function renderDriver() {
  const driver = payload.entregador || {};
  const nome = driver.nome || 'Motoboy';
  const veiculo = String(driver.veiculo || '').trim();
  const telefone = String(driver.telefone || '').trim();
  const wa = telefone
    ? waLink(telefone, `Olá! Estou acompanhando a entrega ${payload.codigo}.`)
    : '';
  const tel = telefone.replace(/[^\d+]/g, '');

  return `
    <section class="track-card driver-card">
      <span class="avatar avatar--lg">${esc(initials(nome))}</span>
      <div class="driver-card__info">
        <span>Seu entregador</span>
        <strong>${esc(nome)}</strong>
        ${veiculo ? `<small>${esc(veiculo)}</small>` : ''}
      </div>
      <div class="quick-actions">
        ${tel ? `<a class="btn btn--ghost btn--sm" href="tel:${esc(tel)}" aria-label="Ligar para o entregador">${icon('phone')}</a>` : ''}
        ${wa ? `<a class="btn btn--soft btn--sm" href="${esc(wa)}" target="_blank" rel="noopener">${icon('chat')} WhatsApp</a>` : ''}
      </div>
    </section>`;
}

function renderPosition(pos) {
  return `
    <section class="track-card">
      <div class="track-card__head">
        <h2>Localização do entregador</h2>
        ${pos ? `<span>${esc(timeAgo(pos.em))}</span>` : ''}
      </div>
      ${pos ? `
        <div class="track-map" id="track-map" aria-label="Mapa com a última localização do entregador"></div>
        <p class="track-note">
          Última localização enviada em <strong>${esc(formatDateTime(pos.em))}</strong>.
          Atualize a página para buscar novidades.
        </p>` : `
        <div class="track-empty">O entregador ainda não compartilhou a localização.</div>`}
    </section>`;
}

function renderRoute() {
  const coleta = String(payload.coleta || '').trim();
  const destino = String(payload.destino || '').trim();
  const referencia = String(payload.referencia || '').trim();

  return `
    <section class="track-card">
      <h2>Rota da entrega</h2>
      <div class="track-route">
        <div class="route-line">
          <span class="route__dot route__dot--pickup"></span>
          <div>
            <span class="route__k">Coleta</span>
            <span class="route__v">${esc(coleta || 'Não informado')}</span>
          </div>
        </div>
        <div class="route-line">
          <span class="route__dot route__dot--drop"></span>
          <div>
            <span class="route__k">Entrega</span>
            <span class="route__v">${esc(destino || 'Não informado')}</span>
          </div>
        </div>
      </div>
      ${referencia ? `<p class="track-note"><strong>Referência:</strong> ${esc(referencia)}</p>` : ''}
      ${destino ? `<a class="btn btn--ghost btn--block" href="${esc(mapsLink(destino))}" target="_blank" rel="noopener">${icon('external')} Abrir endereço no Maps</a>` : ''}
    </section>`;
}

function renderTimeline() {
  const events = (Array.isArray(payload.timeline) ? payload.timeline : [])
    .slice()
    .sort((a, b) => new Date(a.em) - new Date(b.em));

  if (events.length < 2) return '';

  const items = events.map((ev, i) => {
    const meta = STATUS[ev.status] || { label: ev.status };
    const label = ev.status === 'pendente' ? 'Pedido recebido' : meta.label;
    const done = i < events.length - 1;
    const current = i === events.length - 1;
    return `
      <li class="${done ? 'is-done' : ''}${current ? ' is-current' : ''}">
        <span class="timeline__dot">${done ? icon('check') : ''}</span>
        <span class="timeline__label">${esc(label)}</span>
        <span class="timeline__time">${esc(eventTime(ev.em))}</span>
      </li>`;
  }).join('');

  return `
    <section class="track-card">
      <h2>Histórico</h2>
      <ul class="timeline" style="margin-top:12px">${items}</ul>
    </section>`;
}

function renderTracking() {
  const [title, subtitle] = heroCopy();
  const pos = validPos(payload.posicao);
  const status = payload.status;
  const meta = STATUS[status] || { label: status };

  document.title = `${meta.label} · Entrega ${payload.codigo} · RotaCerta`;

  root.innerHTML = `
    <section class="track-hero ${status === 'entregue' ? 'is-done' : ''}">
      <div class="track-hero__top">
        <span class="track-hero__code">${esc(payload.codigo)}</span>
        ${statusChip(status)}
      </div>
      <p class="track-hero__for">Entrega para <strong>${esc(payload.cliente || 'cliente')}</strong></p>
      <h1>${esc(title)}</h1>
      <p>${esc(subtitle)}</p>
      <div class="track-hero__foot">
        <span>Atualizado <span data-ago="${esc(payload.atualizadoEm)}">${esc(timeAgo(payload.atualizadoEm))}</span></span>
        <button class="linkbtn" type="button" data-reload>Atualizar página</button>
      </div>
    </section>

    ${renderStepper()}
    ${renderDriver()}
    ${renderPosition(pos)}
    ${renderRoute()}
    ${renderTimeline()}

    <p class="track-footer">
      Página gerada em ${esc(formatDateTime(payload.atualizadoEm))}.<br>
      Link pessoal — não compartilhe com outras pessoas.<br>
      RotaCerta · controle de entregas
    </p>`;

  const reload = root.querySelector('[data-reload]');
  if (reload) reload.addEventListener('click', () => window.location.reload());

  if (pos) setTimeout(() => initMap(pos), 50);
}

function initMap(pos) {
  const el = document.getElementById('track-map');
  if (!el) return;
  if (!window.L) {
    el.innerHTML = '<div class="map-missing">Mapa indisponível sem conexão.</div>';
    return;
  }

  const map = window.L.map(el, {
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: !window.L.Browser.mobile,
    attributionControl: true
  }).setView([pos.lat, pos.lng], 16);

  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  const iconMark = window.L.divIcon({
    className: 'me-icon',
    html: '<span class="me-pulse"></span><span class="me-dot"></span>',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  window.L.marker([pos.lat, pos.lng], { icon: iconMark }).addTo(map);
  window.L.circle([pos.lat, pos.lng], {
    radius: pos.acc || 25,
    color: '#f0522b',
    weight: 1,
    fillColor: '#f0522b',
    fillOpacity: 0.08
  }).addTo(map);

  setTimeout(() => map.invalidateSize(), 120);
}

function updateAgos() {
  document.querySelectorAll('[data-ago]').forEach((el) => {
    el.textContent = timeAgo(el.dataset.ago);
  });
}
