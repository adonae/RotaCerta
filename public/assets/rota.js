/* ============================================================
   RotaCerta v2 — rota do entregador (celular)
   ============================================================ */

import {
  $, api, icon, esc, toast, confirmDialog, showDialog,
  formatTime, formatDistance, formatDuration, routeDateLabel, timeAgo,
  waLink, telLink, mapsLink, getRouteToken, formatCep
} from './common.js';

const state = {
  token: getRouteToken(),
  data: null,
  route: null,
  orders: [],
  settings: {},
  position: null,
  renderKey: null,
  loading: false,
  busy: false,
  pollTimer: null,
  gps: {
    watchId: null,
    last: null,
    lastAt: null,
    sentAt: 0,
    sending: false,
    error: null,
    errorToasted: false
  },
  wakeLock: null
};

init();

async function init() {
  $('#rider-root')?.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVisibility);

  if (!state.token) {
    renderError('Este link não tem um código de rota. Peça um novo link para a loja.');
    return;
  }

  await load({ silent: false });
}

/* ------------------------------ carregamento ------------------------ */

async function load({ silent = false, force = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  try {
    const data = await api(`/api/rota/${state.token}`, { token: null, timeout: 20000 });
    state.data = data;
    state.route = data.route;
    state.orders = data.orders || [];
    state.settings = data.settings || {};
    state.position = data.position || null;

    document.title = `${data.route.name} · RotaCerta`;

    const key = JSON.stringify({
      route: data.route,
      settings: data.settings,
      orders: state.orders.map((o) => ({
        id: o.id,
        status: o.status,
        seq: o.seq,
        customer: o.customer,
        address: o.address,
        phone: o.phone,
        reference: o.reference,
        notes: o.notes,
        lat: o.lat,
        lng: o.lng,
        enRouteAt: o.enRouteAt,
        deliveredAt: o.deliveredAt
      }))
    });

    if (force || key !== state.renderKey) {
      state.renderKey = key;
      render();
    } else {
      updateGpsChip();
      syncGps();
    }
    schedulePoll();
  } catch (err) {
    if (err.status === 404) {
      renderError('Este link de rota é inválido ou expirou. Peça um novo link para a loja.');
      return;
    }
    if (!silent || !state.data) {
      if (!state.data) {
        renderError(err.message || 'Não foi possível carregar a rota. Verifique sua internet e tente novamente.');
        return;
      }
      toast(err.message || 'Não foi possível atualizar a rota.', 'error');
    }
    schedulePoll();
  } finally {
    state.loading = false;
  }
}

function schedulePoll() {
  clearTimeout(state.pollTimer);
  if (!state.data) return;
  const hasActive = state.orders.some((o) => o.status === 'en_route');
  const delay = hasActive ? 10000 : 25000;
  state.pollTimer = setTimeout(async () => {
    if (document.hidden) {
      schedulePoll();
      return;
    }
    if (state.loading) {
      schedulePoll();
      return;
    }
    await load({ silent: true });
  }, delay);
}

function onVisibility() {
  if (!document.hidden && state.data) {
    load({ silent: true });
    if (state.orders.some((o) => o.status === 'en_route')) requestWakeLock();
  }
}

/* --------------------------------- tela ----------------------------- */

function render() {
  const root = $('#rider-root');
  if (!root || !state.route) return;

  const orders = state.orders;
  const active = orders.find((o) => o.status === 'en_route') || null;
  const pending = orders.filter((o) => o.status === 'pending');
  const delivered = orders.filter((o) => o.status === 'delivered');
  const total = orders.length;
  const percent = total ? Math.round((delivered.length / total) * 100) : 0;
  const nextStop = active || pending[0] || null;
  const routeSub = [
    routeDateLabel(state.route.date),
    state.settings.storeName,
    state.route.distanceM != null ? formatDistance(state.route.distanceM) : null,
    state.route.durationS != null ? formatDuration(state.route.durationS) : null
  ].filter(Boolean).join(' · ');

  const finished = total > 0 && delivered.length === total;

  root.innerHTML = `
    <header class="rider-hero">
      <div class="rider-hero__top">
        <a class="brand brand--light" href="/" aria-label="RotaCerta">
          <span class="brand__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M5 19c6 0 8-14 14-14"/><circle cx="5" cy="19" r="2.2" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="2.2" fill="currentColor" stroke="none"/>
            </svg>
          </span>
          <span>
            <span class="brand__name">RotaCerta</span>
            <span class="brand__tag">rota do entregador</span>
          </span>
        </a>
        <span class="chip" style="background:rgba(255,255,255,.14);color:#fff;border:0">
          <span class="chip__dot"></span>${esc(routeStatusLabel(state.route.status))}
        </span>
      </div>

      <h1>${esc(state.route.name)}</h1>
      <p class="rider-hero__sub">${esc(routeSub)}</p>

      <div class="rider-progress">
        <div class="rider-progress__label">
          <span>${delivered.length} de ${total} parada${total === 1 ? '' : 's'} concluída${total === 1 ? '' : 's'}</span>
          <strong>${percent}%</strong>
        </div>
        <div class="progress">
          <div class="progress__bar" style="width:${percent}%"></div>
        </div>
      </div>

      <div class="rider-tools">
        <button class="rider-tool" type="button" data-action="refresh">${icon('refresh')} Atualizar</button>
        ${nextStop ? `<a class="rider-tool" href="${esc(mapsLink(nextStop))}" target="_blank" rel="noopener">${icon('navigation')} Próxima no Maps</a>` : ''}
        <span class="rider-tool" id="gps-chip">${gpsChipContent()}</span>
      </div>
    </header>

    <div class="rider-content">
      ${!state.route.optimizedAt && total ? `
        <div class="rider-note">
          ${icon('info')}
          <div><strong>A loja ainda não calculou a rota.</strong> As paradas estão na ordem de cadastro. Toque em “Atualizar” em instantes.</div>
        </div>` : ''}

      ${state.gps.error && active ? `
        <div class="alert alert--danger" style="margin-bottom:12px">
          ${icon('alert')}
          <div><strong>GPS indisponível.</strong> Permita a localização no navegador para o cliente acompanhar o mapa ao vivo.</div>
        </div>` : ''}

      ${active ? `
        <div class="rider-note" style="background:var(--violet-soft);color:#5b21b6">
          ${icon('navigation')}
          <div><strong>Entrega em andamento.</strong> ${esc(active.customer)} está acompanhando pelo link. Toque em “Entregue” ao concluir.</div>
        </div>` : ''}

      ${finished ? finishedCard(delivered, total) : ''}

      ${orders.length ? orders.map((order, index) => stopCard(order, index, active, pending)).join('') : `
        <div class="card">
          <div class="empty">
            <div class="empty__icon">${icon('package')}</div>
            <h3>Nenhum pedido nesta rota</h3>
            <p>A loja ainda não adicionou pedidos. Toque em atualizar em alguns instantes.</p>
            <button class="btn btn--primary" type="button" data-action="refresh">${icon('refresh')} Atualizar</button>
          </div>
        </div>`}

      ${!finished && total ? `
        <div class="rider-note" style="margin-top:14px">
          ${icon('info')}
          <div>Mantenha esta página aberta durante a rota. Ao tocar em “Em rota”, o GPS liga e o cliente vê o mapa ao vivo.</div>
        </div>` : ''}

      <div class="rider-footer">
        Link exclusivo do entregador · ${esc(state.settings.storeName || 'RotaCerta')}<br>
        Não compartilhe este endereço.
      </div>
    </div>`;

  syncGps();
  updateGpsChip();
}

function stopCard(order, index, active, pending) {
  const isBranch = order.kind === 'branch';
  const isActive = order.status === 'en_route';
  const isDelivered = order.status === 'delivered';
  const blocked = Boolean(!isBranch && active && active.id !== order.id);
  const isNext = !active && pending[0]?.id === order.id;
  const cls = [
    'stop-card',
    isActive ? 'stop-card--enroute' : '',
    isDelivered ? 'stop-card--delivered' : '',
    isNext ? 'stop-card--next' : ''
  ].filter(Boolean).join(' ');

  const flag = isActive
    ? '<span class="stop-card__flag">Em rota agora</span>'
    : isNext
      ? '<span class="stop-card__flag">Próxima parada</span>'
      : '';

  const wa = !isBranch && order.phone
    ? waLink(order.phone, `Olá, ${firstName(order.customer)}! Estou a caminho com sua entrega ${order.code}.`)
    : '';
  const tel = !isBranch && order.phone ? telLink(order.phone) : '';

  const links = [];
  links.push(`<a class="mini-link" href="${esc(mapsLink(order))}" target="_blank" rel="noopener">${icon('navigation')} Abrir no Maps</a>`);
  if (wa) links.push(`<a class="mini-link mini-link--wa" href="${esc(wa)}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp</a>`);
  if (tel) links.push(`<a class="mini-link" href="${esc(tel)}">${icon('phone')} Ligar</a>`);

  let actions;
  if (isBranch) {
    if (isDelivered) {
      actions = `
        <div class="stop-card__done">${icon('check')} Parada concluída${order.deliveredAt ? ` às ${esc(formatTime(order.deliveredAt))}` : ''}</div>
        <div class="stop-card__link-row">
          <button class="mini-link" type="button" data-action="undo" data-id="${esc(order.id)}">${icon('undo')} Desfazer parada</button>
          ${links.join('')}
        </div>`;
    } else {
      actions = `
        <div class="stop-card__actions">
          <button class="btn btn--success btn--block" type="button" data-action="deliver" data-id="${esc(order.id)}">${icon('check')} Concluir parada</button>
        </div>
        <div class="stop-card__link-row">${links.join('')}</div>`;
    }
  } else if (isDelivered) {
    actions = `
      <div class="stop-card__done">${icon('check')} Entregue${order.deliveredAt ? ` às ${esc(formatTime(order.deliveredAt))}` : ''}${order.hasPhoto ? ' · foto registrada' : ''}</div>
      <div class="stop-card__link-row">
        <button class="mini-link" type="button" data-action="undo" data-id="${esc(order.id)}">${icon('undo')} Desfazer entrega</button>
        ${links.join('')}
      </div>`;
  } else if (isActive) {
    actions = `
      <div class="stop-card__actions">
        <button class="btn btn--success btn--block" type="button" data-action="deliver" data-id="${esc(order.id)}">${icon('check')} Entregue</button>
      </div>
      <div class="stop-card__link-row">
        <button class="mini-link" type="button" data-action="undo" data-id="${esc(order.id)}">${icon('undo')} Voltar para pendente</button>
        ${links.join('')}
      </div>`;
  } else {
    actions = `
      <div class="stop-card__actions">
        <button class="btn btn--primary" type="button" data-action="en-route" data-id="${esc(order.id)}" ${blocked ? 'disabled' : ''}>${icon('navigation')} Em rota</button>
        <button class="btn btn--outline" type="button" data-action="deliver" data-id="${esc(order.id)}" ${blocked ? 'disabled' : ''}>${icon('check')} Entregue</button>
      </div>
      <div class="stop-card__link-row">${links.join('')}</div>`;
  }

  return `
    <article class="${cls}" id="stop-${esc(order.id)}">
      ${flag}
      <div class="stop-card__head">
        <span class="stop-card__num">${isDelivered ? icon('check') : esc(order.seq ?? index + 1)}</span>
        <div class="stop-card__title-wrap">
          <div class="stop-card__title">${esc(order.customer)}</div>
          <div class="stop-card__code">${esc(order.code)} · ${order.seq ?? index + 1}ª parada</div>
        </div>
        ${isBranch ? '<span class="chip chip--ink"><span class="chip__dot"></span>Filial</span>' : ''}
        ${statusChipMini(order.status)}
      </div>
      <div class="stop-card__addr">
        ${icon('mapPin')}
        <div>${esc(order.address)}</div>
      </div>
      ${order.cep || order.reference ? `<div class="stop-card__ref">${[
        order.cep ? `CEP ${formatCep(order.cep)}` : '',
        order.reference ? `Referência: ${esc(order.reference)}` : ''
      ].filter(Boolean).join(' · ')}</div>` : ''}
      ${order.notes ? `<div class="stop-card__notes">${esc(order.notes)}</div>` : ''}
      ${isActive && order.enRouteAt ? `<div class="stop-card__done" style="color:#c2410c">${icon('navigation')} Em rota desde ${esc(formatTime(order.enRouteAt))}</div>` : ''}
      ${actions}
    </article>`;
}

function finishedCard(delivered, total) {
  const starts = delivered.map((o) => o.enRouteAt).filter(Boolean).map((v) => new Date(v).getTime()).filter(Number.isFinite);
  const ends = delivered.map((o) => o.deliveredAt).filter(Boolean).map((v) => new Date(v).getTime()).filter(Number.isFinite);
  let duration = null;
  if (starts.length && ends.length) {
    const diff = (Math.max(...ends) - Math.min(...starts)) / 1000;
    if (diff > 0) duration = diff;
  }
  return `
    <div class="rider-finished">
      <div class="rider-finished__icon">${icon('check')}</div>
      <h2>Rota concluída!</h2>
      <p>${total} parada${total === 1 ? '' : 's'} concluída${total === 1 ? '' : 's'} com sucesso${duration ? ` em ${formatDuration(duration)}` : ''}.</p>
      <button class="btn btn--outline" type="button" data-action="refresh">${icon('refresh')} Atualizar</button>
    </div>`;
}

function statusChipMini(status) {
  const meta = {
    pending: ['Pendente', 'amber'],
    en_route: ['Em rota', 'violet'],
    delivered: ['Entregue', 'green'],
    canceled: ['Cancelado', 'red']
  }[status] || [status, 'ink'];
  return `<span class="chip chip--${meta[1]}"><span class="chip__dot"></span>${esc(meta[0])}</span>`;
}

/* ------------------------------- ações ------------------------------ */

async function onClick(event) {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;

  if (state.busy && ['en-route', 'deliver', 'undo'].includes(action)) return;

  if (action === 'refresh') {
    if (state.loading) return;
    await load({ silent: false, force: true });
    toast('Rota atualizada.', 'info', 2000);
    return;
  }

  if (action === 'en-route') {
    await startDelivery(id);
    return;
  }

  if (action === 'deliver') {
    await deliverOrder(id);
    return;
  }

  if (action === 'undo') {
    await undoOrder(id);
  }
}

function findOrder(id) {
  return state.orders.find((o) => o.id === id) || null;
}

async function startDelivery(id) {
  const order = findOrder(id);
  if (!order) return;
  const current = state.orders.find((o) => o.status === 'en_route');
  if (current && current.id !== order.id) {
    toast(`Finalize a entrega de ${current.customer} antes de iniciar outra.`, 'error');
    return;
  }

  state.busy = true;
  try {
    await requestWakeLock();
    await api(`/api/rota/${state.token}/orders/${order.id}/en-route`, {
      method: 'POST',
      token: null
    });
    toast('Cliente avisado! O mapa ao vivo foi ativado.', 'success');
    state.renderKey = null;
    startGps();
    await load({ silent: true, force: true });
    sendPosition(true);
    const el = document.getElementById(`stop-${order.id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    toast(err.message || 'Não foi possível iniciar a entrega.', 'error');
    state.renderKey = null;
    await load({ silent: true, force: true });
  } finally {
    state.busy = false;
  }
}

/* --------------------------- foto da entrega ------------------------ */

const PHOTO_MAX_SIDE = 1440;
const PHOTO_QUALITY = 0.72;
const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
const PHOTO_TARGET_BYTES = 1.5 * 1024 * 1024;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a foto.'));
    reader.readAsDataURL(file);
  });
}

function loadPhotoImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Formato de imagem não suportado.'));
    img.src = src;
  });
}

function dataUrlBytes(dataUrl) {
  const base64 = String(dataUrl).split(',')[1] || '';
  return Math.floor((base64.length * 3) / 4);
}

async function prepareDeliveryPhoto(file) {
  if (!file) throw new Error('Escolha uma foto da entrega.');
  if (!/^image\//.test(file.type)) throw new Error('O arquivo precisa ser uma imagem.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Essa foto é grande demais. Tire outra.');

  const original = await fileToDataUrl(file);

  try {
    const img = await loadPhotoImage(original);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let quality = PHOTO_QUALITY;
    let result = canvas.toDataURL('image/jpeg', quality);
    while (dataUrlBytes(result) > PHOTO_TARGET_BYTES && quality > 0.4) {
      quality -= 0.1;
      result = canvas.toDataURL('image/jpeg', quality);
    }
    if (result && dataUrlBytes(result) <= PHOTO_MAX_BYTES) return result;
  } catch (err) {
    console.warn('Não foi possível comprimir a foto:', err);
  }

  if (/^data:image\/(jpeg|png|webp);base64,/.test(original) && dataUrlBytes(original) <= PHOTO_MAX_BYTES) {
    return original;
  }
  throw new Error('Não foi possível usar essa foto. Tire outra com a câmera.');
}

/* ------------------------------ entregas ----------------------------- */

async function concludeBranch(order) {
  if (order.status === 'delivered') return;
  const ok = await confirmDialog({
    title: 'Concluir parada',
    message: `Confirmar a passagem pela <strong>${esc(order.customer)}</strong>?<br><span style="color:var(--muted);font-size:12.5px">${esc(order.address)}</span>`,
    confirmLabel: 'Sim, concluir',
    cancelLabel: 'Ainda não',
    tone: 'success'
  });
  if (!ok) return;

  state.busy = true;
  try {
    await api(`/api/rota/${state.token}/orders/${order.id}/deliver`, {
      method: 'POST',
      token: null,
      body: {}
    });
    toast('Parada concluída!', 'success');
    state.renderKey = null;
    await load({ silent: true, force: true });
    document.getElementById(`stop-${order.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    toast(err.message || 'Não foi possível concluir a parada.', 'error');
    state.renderKey = null;
    await load({ silent: true, force: true });
  } finally {
    state.busy = false;
  }
}

async function deliverOrder(id) {
  const order = findOrder(id);
  if (!order) return;
  if (order.kind === 'branch') {
    await concludeBranch(order);
    return;
  }
  const active = state.orders.find((o) => o.status === 'en_route');
  if (active && active.id !== order.id) {
    toast(`Finalize a entrega de ${active.customer} antes de concluir outra.`, 'error');
    return;
  }
  if (order.status === 'delivered') return;

  showDialog({
    title: 'Foto da entrega',
    subtitle: `${order.customer} · ${order.code}`,
    closeOnBackdrop: false,
    body: `
      <div class="stack">
        <p style="font-size:13.5px;line-height:1.6;color:var(--text-2);margin:0">
          Fotografe o local onde a entrega foi realizada. A foto é obrigatória para confirmar.
        </p>
        <label class="photo-pick" data-photo-pick>
          <input type="file" accept="image/*" capture="environment" data-photo-input hidden>
          <span class="photo-pick__icon">${icon('camera')}</span>
          <span class="photo-pick__label" data-photo-label>Tirar foto</span>
          <span class="photo-pick__hint">A câmera do celular será aberta</span>
        </label>
        <div class="photo-preview" data-photo-preview hidden><img alt="Prévia da foto da entrega"></div>
        <p class="hint photo-status" data-photo-status>A foto é obrigatória para confirmar a entrega.</p>
      </div>`,
    actions: [
      { label: 'Ainda não', variant: 'outline' },
      {
        label: 'Confirmar entrega',
        variant: 'success',
        icon: 'check',
        onClick: async (dialog) => {
          const status = dialog.querySelector('[data-photo-status]');
          const confirmBtn = dialog.querySelector('.dialog__foot [data-action="1"]');
          if (!dialog.__photo) {
            status.textContent = 'Tire a foto do local antes de confirmar.';
            status.className = 'hint photo-status error';
            return false;
          }

          state.busy = true;
          confirmBtn.disabled = true;
          status.textContent = 'Enviando foto e confirmando a entrega…';
          status.className = 'hint photo-status';
          try {
            await requestWakeLock();
            await api(`/api/rota/${state.token}/orders/${order.id}/deliver`, {
              method: 'POST',
              token: null,
              body: { photo: dialog.__photo },
              timeout: 60000
            });
            toast('Entrega concluída com foto!', 'success');
            state.renderKey = null;
            try {
              await load({ silent: true, force: true });
            } catch {
              /* a entrega já foi confirmada no servidor */
            }
            const next = state.orders.find((o) => o.status === 'pending');
            if (next) {
              setTimeout(() => {
                document.getElementById(`stop-${next.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 250);
            }
            return true;
          } catch (err) {
            toast(err.message || 'Não foi possível concluir a entrega.', 'error');
            status.textContent = err.message || 'Falha ao enviar a foto. Tente novamente.';
            status.className = 'hint photo-status error';
            confirmBtn.disabled = false;
            return false;
          } finally {
            state.busy = false;
          }
        }
      }
    ],
    onMount: (dialog) => {
      const input = dialog.querySelector('[data-photo-input]');
      const preview = dialog.querySelector('[data-photo-preview]');
      const previewImg = preview.querySelector('img');
      const status = dialog.querySelector('[data-photo-status]');
      const label = dialog.querySelector('[data-photo-label]');
      const confirmBtn = dialog.querySelector('.dialog__foot [data-action="1"]');
      confirmBtn.disabled = true;

      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        dialog.__photo = '';
        confirmBtn.disabled = true;
        preview.hidden = true;
        status.textContent = 'Preparando a foto…';
        status.className = 'hint photo-status';
        try {
          const dataUrl = await prepareDeliveryPhoto(file);
          dialog.__photo = dataUrl;
          previewImg.src = dataUrl;
          preview.hidden = false;
          label.textContent = 'Trocar foto';
          status.textContent = `Foto pronta (${Math.max(1, Math.round(dataUrlBytes(dataUrl) / 1024))} KB). Toque em “Confirmar entrega”.`;
          status.className = 'hint photo-status ok';
          confirmBtn.disabled = false;
        } catch (err) {
          status.textContent = err.message || 'Não foi possível usar essa foto.';
          status.className = 'hint photo-status error';
        }
      });
    }
  });
}

async function undoOrder(id) {
  const order = findOrder(id);
  if (!order) return;
  const isBranch = order.kind === 'branch';
  const isDelivered = order.status === 'delivered';
  const ok = await confirmDialog({
    title: isBranch ? 'Desfazer parada' : isDelivered ? 'Desfazer entrega' : 'Voltar para pendente',
    message: isBranch
      ? `Reabrir a parada da <strong>${esc(order.customer)}</strong>? Ela volta para pendente.`
      : isDelivered
        ? `Desfazer a entrega de <strong>${esc(order.customer)}</strong>? O cliente verá a entrega como “em rota” novamente.`
        : `Voltar <strong>${esc(order.customer)}</strong> para pendente? O mapa do cliente será desligado.`,
    confirmLabel: 'Desfazer',
    cancelLabel: 'Cancelar',
    tone: 'danger'
  });
  if (!ok) return;

  state.busy = true;
  try {
    await api(`/api/rota/${state.token}/orders/${order.id}/undo`, {
      method: 'POST',
      token: null
    });
    toast(
      isBranch ? 'Parada reaberta.' : isDelivered ? 'Entrega reaberta.' : 'Pedido voltou para pendente.',
      'success'
    );
    state.renderKey = null;
    await load({ silent: true, force: true });
  } catch (err) {
    toast(err.message || 'Não foi possível desfazer.', 'error');
    state.renderKey = null;
    await load({ silent: true, force: true });
  } finally {
    state.busy = false;
  }
}

/* -------------------------------- GPS ------------------------------- */

function syncGps() {
  const hasActive = state.orders.some((o) => o.status === 'en_route');
  if (hasActive) startGps();
  else if (state.gps.watchId !== null) stopGps();
}

function startGps() {
  if (state.gps.watchId !== null) return;
  if (!('geolocation' in navigator)) {
    state.gps.error = 'Este navegador não oferece GPS.';
    updateGpsChip();
    return;
  }

  state.gps.watchId = navigator.geolocation.watchPosition(
    (position) => {
      const c = position.coords;
      state.gps.last = {
        lat: c.latitude,
        lng: c.longitude,
        accuracy: Number.isFinite(c.accuracy) ? c.accuracy : null,
        heading: Number.isFinite(c.heading) ? c.heading : null,
        speed: Number.isFinite(c.speed) ? c.speed : null
      };
      state.gps.lastAt = new Date().toISOString();
      state.gps.error = null;
      state.gps.errorToasted = false;
      updateGpsChip();
      if (Date.now() - state.gps.sentAt >= 8000) sendPosition();
    },
    (error) => {
      state.gps.error = error.code === 1
        ? 'Permissão de localização negada.'
        : 'Não foi possível obter sua localização.';
      updateGpsChip();
      if (!state.gps.errorToasted) {
        state.gps.errorToasted = true;
        toast(`${state.gps.error} Ative a localização para o cliente acompanhar.`, 'error', 6500);
      }
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );
  updateGpsChip();
}

function stopGps() {
  if (state.gps.watchId !== null) {
    try { navigator.geolocation.clearWatch(state.gps.watchId); } catch { /* ignore */ }
    state.gps.watchId = null;
  }
  updateGpsChip();
}

async function sendPosition(force = false) {
  const gps = state.gps;
  if (!gps.last || gps.sending) return;
  if (!force && Date.now() - gps.sentAt < 8000) return;
  gps.sending = true;
  try {
    const body = { lat: gps.last.lat, lng: gps.last.lng };
    if (Number.isFinite(gps.last.accuracy)) body.accuracy = gps.last.accuracy;
    if (Number.isFinite(gps.last.heading)) body.heading = gps.last.heading;
    if (Number.isFinite(gps.last.speed)) body.speed = gps.last.speed;
    await api(`/api/rota/${state.token}/position`, {
      method: 'POST',
      body,
      token: null,
      timeout: 10000
    });
    gps.sentAt = Date.now();
    gps.lastSentAt = new Date().toISOString();
    updateGpsChip();
  } catch {
    /* o envio será tentado novamente na próxima atualização */
  } finally {
    gps.sending = false;
  }
}

function gpsChipContent() {
  const gps = state.gps;
  if (gps.error) return `${icon('wifiOff')} GPS indisponível`;
  if (gps.watchId !== null && gps.last) {
    return `<span class="dot"></span> GPS ativo${gps.lastAt ? ` · ${esc(timeAgo(gps.lastAt))}` : ''}`;
  }
  if (gps.watchId !== null) return `${icon('target')} Ligando GPS…`;
  return `${icon('wifiOff')} GPS desligado`;
}

function updateGpsChip() {
  const el = $('#gps-chip');
  if (!el) return;
  el.innerHTML = gpsChipContent();
  el.classList.toggle('rider-tool--live', state.gps.watchId !== null && Boolean(state.gps.last) && !state.gps.error);
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (state.wakeLock) return;
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener('release', () => { state.wakeLock = null; });
  } catch {
    state.wakeLock = null;
  }
}

/* ------------------------------- helpers ---------------------------- */

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'cliente';
}

function routeStatusLabel(status) {
  return ({
    open: 'Aguardando cálculo',
    planned: 'Rota pronta',
    active: 'Em andamento',
    done: 'Concluída'
  })[status] || 'Rota';
}

function renderError(message) {
  clearTimeout(state.pollTimer);
  stopGps();
  document.body.className = 'rider-body';
  document.body.innerHTML = `
    <main class="error-screen">
      <div class="error-screen__card">
        <div class="error-screen__icon">${icon('alert')}</div>
        <h1>Não foi possível abrir a rota</h1>
        <p>${esc(message)}</p>
        <div class="stack" style="margin-top:18px">
          <a class="btn btn--primary btn--block" href="">Tentar novamente</a>
          <a class="btn btn--outline btn--block" href="/">Ir para o início</a>
        </div>
      </div>
    </main>`;
}
