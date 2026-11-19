/* ============================================================
   RotaCerta — utilitários do Worker
   ============================================================ */

export class HttpError extends Error {
  constructor(status, message, code = null, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...(init.headers || {})
    }
  });
}

export function fail(status, message, code = null, details = null) {
  return json({ error: message, code, details }, { status });
}

export async function readJson(request) {
  const size = Number(request.headers.get('content-length') || 0);
  if (size > 96 * 1024) throw new HttpError(413, 'Conteúdo muito grande.');
  try {
    const data = await request.json();
    if (!data || typeof data !== 'object') throw new Error('invalid');
    return data;
  } catch {
    throw new HttpError(400, 'Dados inválidos.');
  }
}

/* ------------------------------- banco ------------------------------- */

export async function all(env, sql, ...params) {
  const stmt = env.DB.prepare(sql);
  const res = await (params.length ? stmt.bind(...params) : stmt).all();
  return res.results || [];
}

export async function first(env, sql, ...params) {
  const stmt = env.DB.prepare(sql);
  return await (params.length ? stmt.bind(...params) : stmt).first();
}

export async function run(env, sql, ...params) {
  const stmt = env.DB.prepare(sql);
  return await (params.length ? stmt.bind(...params) : stmt).run();
}

export async function batch(env, statements) {
  if (!statements.length) return [];
  return await env.DB.batch(statements);
}

export async function getSettings(env) {
  const rows = await all(env, 'SELECT key, value FROM settings');
  const out = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export async function setSetting(env, key, value) {
  await run(
    env,
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    String(value)
  );
}

/* ------------------------------ segurança ---------------------------- */

const HEX = '0123456789abcdef';

export function randomHex(bytes = 12) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  let out = '';
  for (const b of buf) out += HEX[b >> 4] + HEX[b & 15];
  return out;
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const clean = String(hex || '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function safeEqual(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations, hash: 'SHA-256' },
    key,
    256
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password) {
  // O Cloudflare Workers não aceita PBKDF2 com mais de 100.000 iterações.
  const iterations = 100000;
  const salt = randomHex(16);
  const hash = await pbkdf2(password, salt, iterations);
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 10000) return false;
  const calc = await pbkdf2(String(password || ''), parts[2], iterations);
  return safeEqual(calc, parts[3]);
}

export async function ensurePassword(env) {
  const settings = await getSettings(env);
  if (settings.password_hash) {
    return {
      hash: settings.password_hash,
      isDefault: settings.password_is_default === '1'
    };
  }
  const initial = String(env.ADMIN_PASSWORD || 'rotacerta');
  const hash = await hashPassword(initial);
  await setSetting(env, 'password_hash', hash);
  await setSetting(env, 'password_is_default', '1');
  return { hash, isDefault: true };
}

/* ------------------------------- tokens ------------------------------ */

export function newToken(bytes = 12) {
  return randomHex(bytes);
}

export function isId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{6,64}$/.test(value);
}

/* ------------------------------ validação ---------------------------- */

export function text(value, max = 240) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function phone(value) {
  return String(value ?? '').replace(/[^\d+()\-\s]/g, '').trim().slice(0, 40);
}

export function cep(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 8);
  return digits.length === 8 ? digits : '';
}

export function coord(value, min, max) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export function isoDate(value) {
  const s = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function todayDate() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Fortaleza',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function nowIso() {
  return new Date().toISOString();
}

/* ------------------------------ geografia ---------------------------- */

export function haversineM(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function hasCoords(point) {
  if (!point) return false;
  const { lat, lng } = point;
  if (lat === null || lat === undefined || lat === '' || lng === null || lng === undefined || lng === '') {
    return false;
  }
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

function nearestOrder(start, points) {
  const remaining = points.map((p, i) => ({ ...p, _index: i }));
  const out = [];
  let cur = start;
  while (remaining.length) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineM(cur, remaining[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const next = remaining.splice(best, 1)[0];
    out.push(next);
    cur = next;
  }
  return out;
}

function twoOpt(start, points) {
  const path = [start, ...points];
  let improved = true;
  let guard = 0;
  while (improved && guard < 80) {
    improved = false;
    guard += 1;
    for (let i = 1; i < path.length - 1; i++) {
      for (let j = i + 1; j < path.length; j++) {
        const before =
          haversineM(path[i - 1], path[i]) +
          (j + 1 < path.length ? haversineM(path[j], path[j + 1]) : 0);
        const after =
          haversineM(path[i - 1], path[j]) +
          (j + 1 < path.length ? haversineM(path[i], path[j + 1]) : 0);
        if (after < before - 1) {
          const slice = path.slice(i, j + 1).reverse();
          path.splice(i, j - i + 1, ...slice);
          improved = true;
        }
      }
    }
  }
  return path.slice(1);
}

export function estimateTrip(start, points) {
  const ordered = twoOpt(start, points);
  const coordinates = [[start.lng, start.lat], ...ordered.map((p) => [p.lng, p.lat])];
  let distance = 0;
  let cur = start;
  for (const p of ordered) {
    distance += haversineM(cur, p);
    cur = p;
  }
  distance = distance * 1.28; // aproximação conservadora para ruas
  const duration = distance / (24 / 3.6);
  return {
    order: ordered.map((p) => p._index),
    distance,
    duration,
    geometry: { type: 'LineString', coordinates },
    source: 'estimate'
  };
}

export async function osrmTrip(start, points) {
  const allPoints = [start, ...points];
  const coords = allPoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const url =
    `https://router.project-osrm.org/trip/v1/driving/${coords}` +
    '?roundtrip=false&source=first&destination=any&geometries=geojson&overview=full&steps=false';
  const res = await fetch(url, {
    headers: { 'user-agent': 'RotaCerta/2.0 (route optimization)' },
    signal: AbortSignal.timeout(9000)
  });
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !Array.isArray(data.trips) || !data.trips.length) {
    throw new Error(`OSRM ${data.code || 'sem rota'}`);
  }
  const waypoints = Array.isArray(data.waypoints) ? data.waypoints : [];
  if (waypoints.length !== allPoints.length) throw new Error('OSRM waypoints incompletos');
  const order = waypoints
    .map((w, i) => ({ i, pos: Number(w.waypoint_index) }))
    .sort((a, b) => a.pos - b.pos)
    .map((w) => w.i)
    .filter((i) => i > 0)
    .map((i) => i - 1);
  if (order.length !== points.length) throw new Error('OSRM ordem inválida');
  return {
    order,
    distance: Number(data.trips[0].distance) || 0,
    duration: Number(data.trips[0].duration) || 0,
    geometry: data.trips[0].geometry || null,
    source: 'osrm'
  };
}

export async function optimizeTrip(start, points) {
  if (!points.length) throw new HttpError(400, 'Nenhuma entrega com localização para otimizar.');
  if (points.length === 1) {
    return {
      order: [0],
      distance: haversineM(start, points[0]) * 1.28,
      duration: (haversineM(start, points[0]) * 1.28) / (24 / 3.6),
      geometry: {
        type: 'LineString',
        coordinates: [[start.lng, start.lat], [points[0].lng, points[0].lat]]
      },
      source: 'estimate'
    };
  }
  try {
    return await osrmTrip(start, points);
  } catch (err) {
    console.warn('OSRM indisponível, usando estimativa:', err.message);
    return estimateTrip(start, points);
  }
}

/* -------------------------------- rotas ------------------------------ */

export async function recalcRouteStatus(env, routeId) {
  const row = await first(
    env,
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
       SUM(CASE WHEN status = 'en_route' THEN 1 ELSE 0 END) AS active
     FROM orders WHERE route_id = ? AND status <> 'canceled'`,
    routeId
  );
  const route = await first(env, 'SELECT status, optimized_at FROM routes WHERE id = ?', routeId);
  if (!route) return;
  const total = Number(row?.total || 0);
  const delivered = Number(row?.delivered || 0);
  const active = Number(row?.active || 0);
  let status = 'open';
  if (total > 0 && delivered === total) status = 'done';
  else if (active > 0 || delivered > 0) status = 'active';
  else if (route.optimized_at) status = 'planned';
  if (status !== route.status) {
    await run(env, 'UPDATE routes SET status = ?, updated_at = ? WHERE id = ?', status, nowIso(), routeId);
  }
}

export function parseGeometry(raw) {
  if (!raw) return null;
  try {
    const geo = JSON.parse(raw);
    return geo && geo.type === 'LineString' ? geo : null;
  } catch {
    return null;
  }
}
