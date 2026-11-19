/* ============================================================
   RotaCerta — utilitários compartilhados (app + acompanhamento)
   ============================================================ */

export const APP_NAME = 'RotaCerta';

export const DB_KEY = 'rotacerta.entregas.v1';
export const PROFILE_KEY = 'rotacerta.perfil.v1';
export const POS_KEY = 'rotacerta.posicao.v1';
export const SEQ_KEY = 'rotacerta.seq.v1';

export const STATUS = {
  pendente:  { label: 'Pendente',  tone: 'amber',  next: 'aceita',   action: 'Aceitar entrega' },
  aceita:    { label: 'Aceita',    tone: 'blue',   next: 'coletada', action: 'Confirmar coleta' },
  coletada:  { label: 'Coletada',  tone: 'indigo', next: 'em_rota',  action: 'Iniciar rota' },
  em_rota:   { label: 'Em rota',   tone: 'violet', next: 'entregue', action: 'Confirmar entrega' },
  entregue:  { label: 'Entregue',  tone: 'green' },
  cancelada: { label: 'Cancelada', tone: 'red' }
};

export const STEP_STATUSES = ['pendente', 'aceita', 'coletada', 'em_rota', 'entregue'];
export const ACTIVE_STATUSES = ['pendente', 'aceita', 'coletada', 'em_rota'];
export const FINISHED_STATUSES = ['entregue', 'cancelada'];

export const TONE_COLOR = {
  amber: '#f59e0b',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  green: '#22c55e',
  red: '#ef4444'
};

export function isActive(status) {
  return ACTIVE_STATUSES.includes(status);
}

export function statusChip(status) {
  const meta = STATUS[status] || { label: String(status || '—'), tone: 'red' };
  return `<span class="chip chip--${meta.tone}"><span class="chip__dot"></span>${esc(meta.label)}</span>`;
}

/* ---------------------------- dados ---------------------------- */

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function isOrderShaped(o) {
  return o && typeof o === 'object' && typeof o.id === 'string' && typeof o.status === 'string';
}

export function loadOrders() {
  const data = readJSON(DB_KEY, []);
  return Array.isArray(data) ? data.filter(isOrderShaped) : [];
}

export function saveOrders(orders) {
  localStorage.setItem(DB_KEY, JSON.stringify(orders));
}

export function loadProfile() {
  const base = { nome: 'Motoboy', telefone: '', veiculo: '' };
  const saved = readJSON(PROFILE_KEY, {});
  return { ...base, ...(saved && typeof saved === 'object' ? saved : {}) };
}

export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadPos() {
  const pos = readJSON(POS_KEY, null);
  return pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng) ? pos : null;
}

export function savePos(pos) {
  localStorage.setItem(POS_KEY, JSON.stringify(pos));
}

export function nextCode(orders = []) {
  let n = Number(localStorage.getItem(SEQ_KEY) || 0) || 0;
  const used = new Set(orders.map((o) => o.codigo));
  let code;
  do {
    n += 1;
    code = 'RC-' + String(n).padStart(4, '0');
  } while (used.has(code));
  localStorage.setItem(SEQ_KEY, String(n));
  return code;
}

function clean(v) {
  return String(v ?? '').trim();
}

export function createOrder(data) {
  const now = new Date().toISOString();
  const orders = loadOrders();
  return {
    id: 'ord_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
    codigo: nextCode(orders),
    cliente: clean(data.cliente),
    telefone: clean(data.telefone),
    coleta: clean(data.coleta),
    destino: clean(data.destino),
    referencia: clean(data.referencia),
    observacao: clean(data.observacao),
    status: 'pendente',
    criadoEm: now,
    atualizadoEm: now,
    timeline: [{ status: 'pendente', em: now }],
    posicao: null,
    destinoCoords: null
  };
}

export function setStatus(order, status, pos = null) {
  const now = new Date().toISOString();
  order.status = status;
  order.atualizadoEm = now;
  if (!Array.isArray(order.timeline)) order.timeline = [];
  order.timeline.push({ status, em: now });
  if (pos) order.posicao = pos;
  return order;
}

/* ------------------- link de acompanhamento -------------------- */

export function buildTrackingPayload(order, profile, fallbackPos = null) {
  return {
    v: 1,
    codigo: order.codigo,
    cliente: order.cliente,
    coleta: order.coleta,
    destino: order.destino,
    referencia: order.referencia,
    status: order.status,
    criadoEm: order.criadoEm,
    atualizadoEm: new Date().toISOString(),
    timeline: Array.isArray(order.timeline) ? order.timeline : [],
    posicao: order.posicao || fallbackPos || null,
    entregador: {
      nome: (profile && profile.nome) || 'Motoboy',
      telefone: (profile && profile.telefone) || '',
      veiculo: (profile && profile.veiculo) || ''
    }
  };
}

function toBase64Url(bin) {
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  return atob(s.padEnd(Math.ceil(s.length / 4) * 4, '='));
}

export function encodePayload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return toBase64Url(bin);
}

export function decodePayload(str) {
  try {
    const bin = fromBase64Url(str);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/* --------------------------- formato --------------------------- */

const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fullFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
});

function toDate(iso) {
  const d = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatTime(iso) {
  const d = toDate(iso);
  return d ? timeFmt.format(d) : '—';
}

export function formatDate(iso) {
  const d = toDate(iso);
  return d ? dateFmt.format(d) : '—';
}

export function formatDateTime(iso) {
  const d = toDate(iso);
  return d ? fullFmt.format(d) : '—';
}

export function timeAgo(iso) {
  const d = toDate(iso);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 15) return 'agora';
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return formatDate(iso);
}

export function isToday(iso) {
  const d = toDate(iso);
  if (!d) return false;
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function todayLabel() {
  const s = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* --------------------------- contato --------------------------- */

export function digits(v) {
  return String(v || '').replace(/\D/g, '');
}

export function waLink(phone, text) {
  const d = digits(phone);
  const num = d ? (d.length <= 11 ? '55' + d : d) : '';
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

export function mapsLink(address) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address || '');
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}
