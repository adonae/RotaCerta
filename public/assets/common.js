/* ============================================================
   RotaCerta v2 — utilitários compartilhados do front-end
   ============================================================ */

export const TOKEN_KEY = 'rotacerta.painel.token.v2';
export const ROUTE_TOKEN_KEY = 'rotacerta.rota.token.v2';

/* ------------------------------- ícones ----------------------------- */

const PATHS = {
  route: '<path d="M5 19c6 0 8-14 14-14"/><circle cx="5" cy="19" r="2.2" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="2.2" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  whatsapp: '<path d="M20.5 3.5A11 11 0 0 0 4 17.5L3 21l3.6-1a11 11 0 1 0 13.9-16.5Z"/><path d="M8.2 7.6c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4-.1.6l-.6.7c-.1.2-.2.3 0 .6.5.9 1.2 1.6 2.1 2.1.3.2.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.3 0 .2 0 .9-.4 1.4-.4.6-1.2 1.1-2.1 1.1-.7 0-1.7-.2-3.3-1.1-2-1.2-3.3-3.3-3.4-3.5-.1-.2-1.1-1.5-1.1-2.9 0-1.4.7-2.1 1-2.4Z" fill="currentColor" stroke="none"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  navigation: '<path d="M3 11l19-9-9 19-2-8-8-2Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bike: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h3l2 5M5.5 17.5l4-8h5l3 8M9 9.5h6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9Z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M9 20v-6h6v6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  external: '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 9-9M17 5l3 3M14 8l3 3"/>',
  package: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
  home: '<path d="m3 10 9-8 9 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.8a2 2 0 1 1 3-2.6V4h2v4.2a2 2 0 1 1 3 2.6l-3 3.2h-2Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  camera: '<path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4Z"/><circle cx="12" cy="13" r="3.5"/>',
  wifiOff: '<path d="M2 2l20 20"/><path d="M8.5 8.5A10 10 0 0 1 21 9M5 12.5a10 10 0 0 1 3-1.9M10 16a5 5 0 0 1 4 0M12 20h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>'
};

export function icon(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || PATHS.info}</svg>`;
}

/* ------------------------------- helpers ---------------------------- */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

export function getRouteToken() {
  const url = new URL(location.href);
  const fromUrl = url.searchParams.get('t');
  if (fromUrl) {
    try { localStorage.setItem(ROUTE_TOKEN_KEY, fromUrl); } catch { /* ignore */ }
    return fromUrl;
  }
  try { return localStorage.getItem(ROUTE_TOKEN_KEY) || ''; } catch { return ''; }
}

/* --------------------------------- API ------------------------------ */

export class ApiError extends Error {
  constructor(status, message, code = null, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api(path, options = {}) {
  const {
    method = 'GET',
    body,
    token = getToken(),
    headers = {},
    timeout = 25000
  } = options;

  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (body !== undefined) h['content-type'] = 'application/json';

  let res;
  try {
    res = await fetch(path, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout)
    });
  } catch (err) {
    if (err?.name === 'TimeoutError') throw new ApiError(0, 'O servidor demorou demais para responder.');
    throw new ApiError(0, 'Sem conexão com o servidor. Verifique sua internet.');
  }

  let data = null;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error || 'Não foi possível concluir a operação.',
      data?.code || null,
      data?.details || null
    );
  }
  return data;
}

/* ------------------------------- toasts ----------------------------- */

export function toast(message, tone = 'info', ms = 4200) {
  let root = $('.toasts');
  if (!root) {
    root = document.createElement('div');
    root.className = 'toasts';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }
  const el = document.createElement('div');
  el.className = `toast toast--${tone}`;
  el.innerHTML = `${icon(tone === 'error' ? 'alert' : tone === 'success' ? 'check' : 'info')}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 240);
  }, ms);
}

/* ------------------------------- diálogo ---------------------------- */

export function showDialog(opts = {}) {
  const {
    title = '',
    subtitle = '',
    body = '',
    actions = [],
    wide = false,
    onMount = null,
    dismissible = true,
    closeOnBackdrop = true
  } = opts;

  const dialog = document.createElement('dialog');
  dialog.className = 'dialog' + (wide ? ' dialog--wide' : '');
  dialog.innerHTML = `
    <div class="dialog__form">
      <div class="dialog__head">
        <div>
          <h2>${esc(title)}</h2>
          ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
        </div>
        ${dismissible ? `<button type="button" class="btn btn--icon" data-close aria-label="Fechar">${icon('x')}</button>` : ''}
      </div>
      <div class="dialog__body">${body}</div>
      ${actions.length ? `<div class="dialog__foot">${actions.map((a, i) => `
        <button type="button" class="btn ${a.variant ? 'btn--' + a.variant : 'btn--outline'}" data-action="${i}">
          ${a.icon ? icon(a.icon) : ''}${esc(a.label)}
        </button>`).join('')}</div>` : ''}
    </div>`;

  document.body.appendChild(dialog);
  const close = () => { if (dialog.open) dialog.close(); };

  if (dismissible) {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog && closeOnBackdrop) close();
    });
    dialog.querySelectorAll('[data-close]').forEach((btn) => (btn.onclick = close));
  }

  actions.forEach((action, i) => {
    const btn = dialog.querySelector(`[data-action="${i}"]`);
    if (!btn) return;
    btn.onclick = async (event) => {
      if (action.onClick) {
        btn.disabled = true;
        try {
          const result = await action.onClick(dialog, event);
          if (result === false) { btn.disabled = false; return; }
        } catch (err) {
          btn.disabled = false;
          toast(err?.message || 'Não foi possível concluir.', 'error');
          return;
        }
      }
      close();
    };
  });

  dialog.addEventListener('close', () => {
    document.body.classList.remove('no-scroll');
    dialog.remove();
  });

  document.body.classList.add('no-scroll');
  dialog.showModal();
  onMount?.(dialog);
  return dialog;
}

export function confirmDialog(opts = {}) {
  const {
    title = 'Confirmar',
    message = '',
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    tone = 'primary'
  } = opts;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const dialog = showDialog({
      title,
      body: `<p style="font-size:14px;line-height:1.6;color:var(--text-2)">${message}</p>`,
      actions: [
        { label: cancelLabel, variant: 'outline', onClick: () => finish(false) },
        { label: confirmLabel, variant: tone, onClick: () => finish(true) }
      ]
    });
    dialog.addEventListener('close', () => finish(false));
  });
}

export function openProgress(title, subtitle = '') {
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog';
  dialog.innerHTML = `
    <div class="dialog__form">
      <div class="dialog__head"><div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div></div>
      <div class="dialog__body">
        <div class="progress" style="height:9px"><div class="progress__bar" style="width:2%"></div></div>
        <p class="progress-text" style="margin-top:12px;font-size:12.5px;color:var(--muted)">Preparando…</p>
      </div>
    </div>`;
  document.body.appendChild(dialog);
  document.body.classList.add('no-scroll');
  dialog.showModal();
  const bar = dialog.querySelector('.progress__bar');
  const text = dialog.querySelector('.progress-text');
  return {
    set(percent, message) {
      bar.style.width = `${Math.max(2, Math.min(100, percent))}%`;
      if (message) text.textContent = message;
    },
    close() {
      document.body.classList.remove('no-scroll');
      if (dialog.open) dialog.close();
      dialog.remove();
    }
  };
}

/* ------------------------------- formato ---------------------------- */

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fullFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
});
const longFmt = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long', day: 'numeric', month: 'long'
});
const shortFmt = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short', day: '2-digit', month: 'short'
});

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatTime(value) {
  const d = toDate(value);
  return d ? timeFmt.format(d) : '—';
}
export function formatDate(value) {
  const d = toDate(value);
  return d ? dateFmt.format(d) : '—';
}
export function formatDateTime(value) {
  const d = toDate(value);
  return d ? fullFmt.format(d) : '—';
}
export function formatLongDate(value) {
  const d = toDate(value);
  return d ? longFmt.format(d) : '—';
}
export function routeDateLabel(dateISO) {
  if (!dateISO) return '—';
  const d = toDate(dateISO + 'T12:00:00');
  if (!d) return '—';
  const label = shortFmt.format(d).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
}
export function timeAgo(value) {
  const d = toDate(value);
  if (!d) return '';
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 10) return 'agora';
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return formatDate(value);
}
export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function formatCep(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}
export function formatDistance(meters) {
  if (meters === null || meters === undefined || !Number.isFinite(Number(meters))) return '—';
  const m = Number(meters);
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  if (m < 10000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
  return `${Math.round(m / 1000)} km`;
}
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return '—';
  const s = Math.max(0, Number(seconds));
  const min = Math.round(s / 60);
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h}h ${rest}min` : `${h}h`;
}
export function remainingEta(meters) {
  if (meters === null || meters === undefined || meters === '' || !Number.isFinite(Number(meters))) return null;
  return Math.max(1, Math.round(Number(meters) / 350));
}

export function digits(value) {
  return String(value || '').replace(/\D/g, '');
}
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}
export function waLink(phoneNumber, message = '') {
  const d = digits(phoneNumber);
  const num = d ? (d.length <= 11 ? '55' + d : d) : '';
  return `https://wa.me/${num}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
export function telLink(phoneNumber) {
  const d = digits(phoneNumber);
  return d ? `tel:${d.length <= 11 ? '+55' + d : '+' + d}` : '';
}
export function validCoord(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}
export function mapsLink(order) {
  if (order && validCoord(order.lat) && validCoord(order.lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${order.lat},${order.lng}`;
  }
  const q = order?.address || order || '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export const STATUS_META = {
  pending: { label: 'Pendente', tone: 'amber', icon: 'clock' },
  en_route: { label: 'Em rota', tone: 'violet', icon: 'navigation' },
  delivered: { label: 'Entregue', tone: 'green', icon: 'check' },
  canceled: { label: 'Cancelado', tone: 'red', icon: 'x' }
};
export const ROUTE_STATUS_META = {
  open: { label: 'Não otimizada', tone: 'amber' },
  planned: { label: 'Rota pronta', tone: 'blue' },
  active: { label: 'Em andamento', tone: 'violet' },
  done: { label: 'Concluída', tone: 'green' }
};

export function statusChip(status) {
  const meta = STATUS_META[status] || { label: status || '—', tone: 'ink' };
  return `<span class="chip chip--${meta.tone}"><span class="chip__dot"></span>${esc(meta.label)}</span>`;
}
export function routeStatusChip(status) {
  const meta = ROUTE_STATUS_META[status] || { label: status || '—', tone: 'ink' };
  return `<span class="chip chip--${meta.tone}"><span class="chip__dot"></span>${esc(meta.label)}</span>`;
}

/* ------------------------------- clipboard -------------------------- */

export async function copyText(value) {
  const text = String(value ?? '');
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/* -------------------------------- Leaflet --------------------------- */

export function ensureLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (window.L) {
        clearInterval(timer);
        resolve(window.L);
      } else if (Date.now() - started > 12000) {
        clearInterval(timer);
        reject(new Error('O mapa não carregou. Verifique sua internet.'));
      }
    }, 80);
  });
}

export function createMap(el, center = [-7.122, -34.877], zoom = 13) {
  const map = window.L.map(el, { zoomControl: true }).setView(center, zoom);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(map);
  return map;
}

export function divIcon(html, size = 30, anchor = [15, 30], className = '') {
  return window.L.divIcon({
    className,
    html,
    iconSize: [size, size],
    iconAnchor: anchor,
    popupAnchor: [0, -anchor[1] + 4]
  });
}

export function stopIcon(number, kind = '') {
  return divIcon(
    `<div class="map-pin ${kind ? 'map-pin--' + kind : ''}"><span>${esc(number)}</span></div>`,
    30,
    [15, 30]
  );
}
export function pickupIcon() {
  return divIcon(`<div class="map-pin map-pin--pickup"><span>${icon('store')}</span></div>`, 32, [16, 16]);
}
export function riderIcon() {
  return divIcon(`<div class="map-pin map-pin--rider"><span>${icon('bike')}</span></div>`, 34, [17, 17]);
}

export function fitMap(map, points, opts = {}) {
  const list = (points || []).filter((p) => p && validCoord(p.lat) && validCoord(p.lng));
  if (!list.length) return;
  if (list.length === 1) {
    map.setView([Number(list[0].lat), Number(list[0].lng)], opts.zoom || 15);
    return;
  }
  const bounds = window.L.latLngBounds(list.map((p) => [Number(p.lat), Number(p.lng)]));
  map.fitBounds(bounds, { padding: opts.padding || [34, 34], maxZoom: opts.maxZoom || 16 });
}

export function geometryLatLngs(geometry) {
  if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return [];
  return geometry.coordinates
    .filter((c) => Array.isArray(c) && c.length >= 2)
    .map((c) => [Number(c[1]), Number(c[0])]);
}

export function safeJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function debounce(fn, ms = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
