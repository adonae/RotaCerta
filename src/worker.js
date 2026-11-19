/* ============================================================
   RotaCerta v2 — API do Cloudflare Worker
   ============================================================ */

import {
  HttpError,
  all,
  batch,
  cep as cleanCep,
  coord,
  ensurePassword,
  fail,
  first,
  haversineM,
  hashPassword,
  hasCoords,
  isoDate,
  isId,
  json,
  newToken,
  nowIso,
  optimizeTrip,
  parseGeometry,
  phone as cleanPhone,
  readJson,
  recalcRouteStatus,
  run,
  setSetting,
  sha256Hex,
  text,
  todayDate,
  verifyPassword,
  getSettings
} from './lib.js';

const SESSION_DAYS = 30;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      if (!env.ASSETS) return new Response('Não encontrado', { status: 404 });
      return env.ASSETS.fetch(request);
    }
    try {
      return await handleApi(request, env, url);
    } catch (err) {
      if (err instanceof HttpError) {
        return fail(err.status, err.message, err.code, err.details);
      }
      console.error('Erro inesperado:', err);
      return fail(500, 'Erro interno. Tente novamente em instantes.');
    }
  }
};

/* ------------------------------- roteador ---------------------------- */

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/\/+$/, '') || '/api';
  const method = request.method;

  if (path === '/api/health' && method === 'GET') {
    return json({ ok: true, app: 'RotaCerta', version: 2, time: nowIso() });
  }

  if (path === '/api/login' && method === 'POST') return login(request, env);
  if (path === '/api/logout' && method === 'POST') return logout(request, env);

  // Rotas públicas (token do motoboy / token do pedido)
  let m = path.match(/^\/api\/rota\/([A-Za-z0-9_-]+)$/);
  if (m && method === 'GET') return riderRoute(env, m[1]);

  m = path.match(/^\/api\/rota\/([A-Za-z0-9_-]+)\/position$/);
  if (m && method === 'POST') return riderPosition(request, env, m[1]);

  m = path.match(/^\/api\/rota\/([A-Za-z0-9_-]+)\/orders\/([A-Za-z0-9_-]+)\/(en-route|deliver|undo)$/);
  if (m && method === 'POST') return riderOrderAction(request, env, m[1], m[2], m[3]);

  m = path.match(/^\/api\/acompanhar\/([A-Za-z0-9_-]+)$/);
  if (m && method === 'GET') return customerTracking(env, m[1]);

  // A partir daqui, tudo exige sessão do painel.
  const session = await requireAuth(request, env);

  if (path === '/api/me' && method === 'GET') return me(env);
  if (path === '/api/settings' && method === 'PUT') return updateSettings(request, env);
  if (path === '/api/password' && method === 'POST') return changePassword(request, env, session);

  if (path === '/api/routes' && method === 'GET') return listRoutes(env);
  if (path === '/api/routes' && method === 'POST') return createRoute(request, env);

  m = path.match(/^\/api\/routes\/([A-Za-z0-9_-]+)$/);
  if (m) {
    if (method === 'GET') return routeDetail(env, m[1]);
    if (method === 'PATCH') return updateRoute(request, env, m[1]);
    if (method === 'DELETE') return deleteRoute(env, m[1]);
  }

  m = path.match(/^\/api\/routes\/([A-Za-z0-9_-]+)\/orders$/);
  if (m && method === 'POST') return addOrders(request, env, m[1]);

  m = path.match(/^\/api\/routes\/([A-Za-z0-9_-]+)\/optimize$/);
  if (m && method === 'POST') return optimizeRoute(request, env, m[1]);

  m = path.match(/^\/api\/orders\/([A-Za-z0-9_-]+)$/);
  if (m) {
    if (method === 'PATCH') return updateOrder(request, env, m[1]);
    if (method === 'DELETE') return deleteOrder(env, m[1]);
  }

  m = path.match(/^\/api\/orders\/([A-Za-z0-9_-]+)\/photo$/);
  if (m && method === 'GET') return orderPhoto(env, m[1]);

  throw new HttpError(404, 'Recurso não encontrado.');
}

/* ------------------------------- sessão ------------------------------ */

async function requireAuth(request, env) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token || token.length < 24) throw new HttpError(401, 'Faça login para continuar.', 'unauthorized');
  const tokenHash = await sha256Hex(token);
  const session = await first(
    env,
    'SELECT token_hash, expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?',
    tokenHash,
    nowIso()
  );
  if (!session) throw new HttpError(401, 'Sessão expirada. Entre novamente.', 'unauthorized');
  return { tokenHash, token };
}

async function login(request, env) {
  const body = await readJson(request);
  const password = String(body.password || '');
  if (!password || password.length > 200) throw new HttpError(400, 'Informe a senha.');

  const ip =
    request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'local';
  const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const attempts = await first(
    env,
    'SELECT COUNT(*) AS n FROM auth_attempts WHERE ip = ? AND ok = 0 AND created_at > ?',
    ip,
    windowStart
  );
  if (Number(attempts?.n || 0) >= 10) {
    throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');
  }

  const { hash, isDefault } = await ensurePassword(env);
  const ok = await verifyPassword(password, hash);
  await run(
    env,
    'INSERT INTO auth_attempts (ip, ok, created_at) VALUES (?, ?, ?)',
    ip,
    ok ? 1 : 0,
    nowIso()
  );

  if (!ok) throw new HttpError(401, 'Senha incorreta.', 'bad_password');

  const token = 'rc_' + newToken(24);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await run(
    env,
    'INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)',
    tokenHash,
    nowIso(),
    expiresAt
  );
  await run(env, 'DELETE FROM sessions WHERE expires_at < ?', nowIso());
  await run(
    env,
    'DELETE FROM auth_attempts WHERE created_at < ?',
    new Date(Date.now() - 7 * 86400000).toISOString()
  );

  const settings = await getSettings(env);
  return json({
    token,
    expiresAt,
    isDefaultPassword: isDefault,
    settings: publicSettings(settings)
  });
}

async function logout(request, env) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (token) {
    const hash = await sha256Hex(token);
    await run(env, 'DELETE FROM sessions WHERE token_hash = ?', hash);
  }
  return json({ ok: true });
}

async function me(env) {
  const settings = await getSettings(env);
  return json({
    ok: true,
    settings: publicSettings(settings),
    isDefaultPassword: settings.password_is_default === '1'
  });
}

/* ----------------------------- configurações ------------------------- */

function publicSettings(s) {
  return {
    storeName: s.store_name || 'Minha Loja',
    driverName: s.driver_name || 'Entregador',
    driverPhone: s.driver_phone || '',
    pickupAddress: s.pickup_address || '',
    pickupLat: Number(s.pickup_lat) || null,
    pickupLng: Number(s.pickup_lng) || null,
    city: s.city || 'João Pessoa, PB'
  };
}

async function updateSettings(request, env) {
  const body = await readJson(request);
  const current = publicSettings(await getSettings(env));

  const storeName = 'storeName' in body ? text(body.storeName, 80) : current.storeName;
  const driverName = 'driverName' in body ? text(body.driverName, 80) : current.driverName;
  const driverPhone = 'driverPhone' in body ? cleanPhone(body.driverPhone) : current.driverPhone;
  const pickupAddress =
    'pickupAddress' in body ? text(body.pickupAddress, 240) : current.pickupAddress;
  const city = 'city' in body ? text(body.city, 80) : current.city;

  let pickupLat = current.pickupLat;
  let pickupLng = current.pickupLng;
  if ('pickupLat' in body || 'pickupLng' in body) {
    pickupLat = coord(body.pickupLat, -90, 90);
    pickupLng = coord(body.pickupLng, -180, 180);
    if (pickupLat === null || pickupLng === null) {
      throw new HttpError(400, 'Coordenadas da retirada inválidas.');
    }
  }

  if (!storeName) throw new HttpError(400, 'Informe o nome da loja.');
  if (!pickupAddress) throw new HttpError(400, 'Informe o endereço de retirada.');

  await setSetting(env, 'store_name', storeName);
  await setSetting(env, 'driver_name', driverName || 'Entregador');
  await setSetting(env, 'driver_phone', driverPhone);
  await setSetting(env, 'pickup_address', pickupAddress);
  await setSetting(env, 'pickup_lat', pickupLat ?? '');
  await setSetting(env, 'pickup_lng', pickupLng ?? '');
  await setSetting(env, 'city', city || 'João Pessoa, PB');

  const settings = await getSettings(env);
  return json({ ok: true, settings: publicSettings(settings) });
}

async function changePassword(request, env, session) {
  const body = await readJson(request);
  const current = String(body.currentPassword || '');
  const next = String(body.newPassword || '');
  if (next.length < 6) throw new HttpError(400, 'A nova senha precisa ter pelo menos 6 caracteres.');
  if (next.length > 200) throw new HttpError(400, 'Senha muito longa.');
  const settings = await getSettings(env);
  const ok = await verifyPassword(current, settings.password_hash);
  if (!ok) throw new HttpError(400, 'Senha atual incorreta.');

  const hash = await hashPassword(next);
  await setSetting(env, 'password_hash', hash);
  await setSetting(env, 'password_is_default', '0');
  await run(env, 'DELETE FROM sessions WHERE token_hash <> ?', session.tokenHash);
  return json({ ok: true });
}

/* -------------------------------- rotas ------------------------------ */

function mapRoute(r) {
  return {
    id: r.id,
    token: r.token,
    name: r.name,
    date: r.route_date,
    status: r.status,
    pickupAddress: r.pickup_address,
    pickupLat: Number(r.pickup_lat) || null,
    pickupLng: Number(r.pickup_lng) || null,
    distanceM: r.distance_m === null || r.distance_m === undefined ? null : Number(r.distance_m),
    durationS: r.duration_s === null || r.duration_s === undefined ? null : Number(r.duration_s),
    geometry: parseGeometry(r.geometry),
    geometrySource: r.geometry_source || null,
    optimizedAt: r.optimized_at || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    total: Number(r.total || 0) || 0,
    pending: Number(r.pending || 0) || 0,
    enRoute: Number(r.en_route || 0) || 0,
    delivered: Number(r.delivered || 0) || 0
  };
}

function mapOrder(o, includeToken = true) {
  const base = {
    id: o.id,
    code: o.code,
    customer: o.customer,
    phone: o.phone || '',
    address: o.address,
    cep: o.cep || '',
    reference: o.reference || '',
    notes: o.notes || '',
    lat: o.lat === null || o.lat === undefined ? null : Number(o.lat),
    lng: o.lng === null || o.lng === undefined ? null : Number(o.lng),
    geocodeSource: o.geocode_source || null,
    status: o.status,
    seq: o.seq === null || o.seq === undefined ? null : Number(o.seq),
    enRouteAt: o.en_route_at || null,
    deliveredAt: o.delivered_at || null,
    hasPhoto: hasFreshPhoto(o),
    photoAt: o.photo_at || null,
    createdAt: o.created_at,
    updatedAt: o.updated_at
  };
  if (includeToken) base.token = o.token;
  return base;
}

/* --------------------------- foto da entrega ------------------------- */

const PHOTO_TTL_SECONDS = 3 * 24 * 60 * 60;
const PHOTO_TTL_MS = PHOTO_TTL_SECONDS * 1000;
const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
const PHOTO_JSON_LIMIT = 6 * 1024 * 1024;

function hasFreshPhoto(order) {
  if (!order?.photo_key || !order?.photo_at) return false;
  const at = Date.parse(order.photo_at);
  return Number.isFinite(at) && Date.now() - at < PHOTO_TTL_MS;
}

function photoKeyFor(routeId, orderId) {
  return `delivery-photo/${routeId}/${orderId}`;
}

function decodePhoto(body) {
  const raw = String(body?.photo || '');
  const match = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw new HttpError(400, 'Tire uma foto do local da entrega para concluir.', 'photo_required');
  }
  const mime = match[1];
  const base64 = match[2].replace(/\s+/g, '');
  let binary;
  try {
    binary = atob(base64);
  } catch {
    throw new HttpError(400, 'A foto enviada é inválida.', 'invalid_photo');
  }
  const bytes = binary.length;
  if (!bytes) throw new HttpError(400, 'A foto enviada está vazia.', 'invalid_photo');
  if (bytes > PHOTO_MAX_BYTES) {
    throw new HttpError(413, 'A foto é muito grande. Tente novamente.', 'photo_too_large');
  }
  const data = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i += 1) data[i] = binary.charCodeAt(i);
  return { mime, bytes, data };
}

async function readJsonPhoto(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > PHOTO_JSON_LIMIT) {
    throw new HttpError(413, 'A foto é muito grande. Tente novamente.', 'photo_too_large');
  }
  let raw;
  try {
    raw = await request.text();
  } catch {
    throw new HttpError(400, 'Dados inválidos.');
  }
  if (raw.length > PHOTO_JSON_LIMIT) {
    throw new HttpError(413, 'A foto é muito grande. Tente novamente.', 'photo_too_large');
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Dados inválidos.');
  }
  if (!data || typeof data !== 'object') throw new HttpError(400, 'Dados inválidos.');
  return data;
}

async function orderPhoto(env, id) {
  if (!isId(id)) throw new HttpError(404, 'Pedido não encontrado.');
  const order = await first(
    env,
    'SELECT id, photo_key, photo_mime, photo_at FROM orders WHERE id = ?',
    id
  );
  if (!order) throw new HttpError(404, 'Pedido não encontrado.');
  if (!order.photo_key) {
    throw new HttpError(404, 'Este pedido não tem foto de entrega.', 'photo_not_found');
  }
  const image = await env.PHOTOS.get(order.photo_key, { type: 'arrayBuffer' });
  if (!image) {
    throw new HttpError(
      404,
      'A foto desta entrega expirou. As fotos ficam guardadas por 3 dias.',
      'photo_expired'
    );
  }
  return new Response(image, {
    headers: {
      'content-type': order.photo_mime || 'image/jpeg',
      'cache-control': 'private, max-age=300',
      'content-disposition': 'inline; filename="entrega.jpg"',
      'x-content-type-options': 'nosniff'
    }
  });
}

async function routeStats(env, routeId) {
  const row = await first(
    env,
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN status = 'en_route' THEN 1 ELSE 0 END) AS en_route,
       SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered
     FROM orders WHERE route_id = ? AND status <> 'canceled'`,
    routeId
  );
  return {
    total: Number(row?.total || 0),
    pending: Number(row?.pending || 0),
    enRoute: Number(row?.en_route || 0),
    delivered: Number(row?.delivered || 0)
  };
}

async function listRoutes(env) {
  const rows = await all(
    env,
    `SELECT r.*,
       (SELECT COUNT(*) FROM orders o WHERE o.route_id = r.id AND o.status <> 'canceled') AS total,
       (SELECT COUNT(*) FROM orders o WHERE o.route_id = r.id AND o.status = 'pending') AS pending,
       (SELECT COUNT(*) FROM orders o WHERE o.route_id = r.id AND o.status = 'en_route') AS en_route,
       (SELECT COUNT(*) FROM orders o WHERE o.route_id = r.id AND o.status = 'delivered') AS delivered
     FROM routes r
     ORDER BY r.route_date DESC, r.created_at DESC
     LIMIT 60`
  );
  return json({ routes: rows.map(mapRoute) });
}

async function createRoute(request, env) {
  const body = await readJson(request);
  const settings = publicSettings(await getSettings(env));
  const date = isoDate(body.date) || todayDate();
  const name = text(body.name, 80) || `Rota de ${date}`;
  if (!settings.pickupAddress) throw new HttpError(400, 'Configure o endereço de retirada.');

  const id = 'rt_' + newToken(8);
  const token = newToken(16);
  const now = nowIso();
  await run(
    env,
    `INSERT INTO routes
      (id, token, name, route_date, status, pickup_address, pickup_lat, pickup_lng, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
    id,
    token,
    name,
    date,
    settings.pickupAddress,
    settings.pickupLat,
    settings.pickupLng,
    now,
    now
  );
  const route = await first(env, 'SELECT * FROM routes WHERE id = ?', id);
  return json({ ok: true, route: mapRoute(route) }, { status: 201 });
}

async function routeDetail(env, id) {
  if (!isId(id)) throw new HttpError(404, 'Rota não encontrada.');
  const route = await first(env, 'SELECT * FROM routes WHERE id = ?', id);
  if (!route) throw new HttpError(404, 'Rota não encontrada.');
  const orders = await all(
    env,
    `SELECT * FROM orders WHERE route_id = ?
     ORDER BY CASE WHEN seq IS NULL THEN 1 ELSE 0 END, seq, created_at`,
    id
  );
  const position = await first(env, 'SELECT * FROM positions WHERE route_id = ?', id);
  const settings = await getSettings(env);
  const stats = await routeStats(env, id);
  return json({
    route: { ...mapRoute(route), ...stats },
    orders: orders.map((o) => mapOrder(o, true)),
    position: position
      ? {
          lat: Number(position.lat),
          lng: Number(position.lng),
          accuracy: position.accuracy === null ? null : Number(position.accuracy),
          updatedAt: position.updated_at
        }
      : null,
    settings: publicSettings(settings)
  });
}

async function updateRoute(request, env, id) {
  if (!isId(id)) throw new HttpError(404, 'Rota não encontrada.');
  const route = await first(env, 'SELECT * FROM routes WHERE id = ?', id);
  if (!route) throw new HttpError(404, 'Rota não encontrada.');
  const body = await readJson(request);
  const name = 'name' in body ? text(body.name, 80) : route.name;
  const date = 'date' in body ? isoDate(body.date) : route.route_date;
  if (!name) throw new HttpError(400, 'Informe um nome para a rota.');
  if (!date) throw new HttpError(400, 'Data inválida.');
  await run(
    env,
    'UPDATE routes SET name = ?, route_date = ?, updated_at = ? WHERE id = ?',
    name,
    date,
    nowIso(),
    id
  );
  return json({ ok: true });
}

async function deleteRoute(env, id) {
  if (!isId(id)) throw new HttpError(404, 'Rota não encontrada.');
  const route = await first(env, 'SELECT id FROM routes WHERE id = ?', id);
  if (!route) throw new HttpError(404, 'Rota não encontrada.');
  const photos = await all(
    env,
    'SELECT photo_key FROM orders WHERE route_id = ? AND photo_key IS NOT NULL',
    id
  );
  await Promise.allSettled(photos.map((p) => env.PHOTOS.delete(p.photo_key)));
  await run(env, 'DELETE FROM routes WHERE id = ?', id);
  return json({ ok: true });
}

/* ------------------------------- pedidos ----------------------------- */

async function addOrders(request, env, routeId) {
  if (!isId(routeId)) throw new HttpError(404, 'Rota não encontrada.');
  const route = await first(env, 'SELECT id FROM routes WHERE id = ?', routeId);
  if (!route) throw new HttpError(404, 'Rota não encontrada.');

  const body = await readJson(request);
  const list = Array.isArray(body.orders) ? body.orders : [body];
  if (!list.length) throw new HttpError(400, 'Nenhum pedido para adicionar.');
  if (list.length > 60) throw new HttpError(400, 'Adicione no máximo 60 pedidos por vez.');

  const prepared = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const customer = text(raw.customer, 100);
    const address = text(raw.address, 240);
    if (!customer) throw new HttpError(400, 'Todo pedido precisa do nome do cliente.');
    if (!address) throw new HttpError(400, `Informe o endereço de ${customer}.`);
    prepared.push({
      customer,
      address,
      cep: cleanCep(raw.cep),
      phone: cleanPhone(raw.phone),
      reference: text(raw.reference, 160),
      notes: text(raw.notes, 200)
    });
  }
  if (!prepared.length) throw new HttpError(400, 'Nenhum pedido válido foi enviado.');

  const maxRow = await first(
    env,
    'SELECT MAX(CAST(substr(code, 3) AS INTEGER)) AS max FROM orders WHERE route_id = ?',
    routeId
  );
  let n = Number(maxRow?.max || 0);
  const now = nowIso();
  const statements = [];
  for (const item of prepared) {
    n += 1;
    statements.push(
      env.DB.prepare(
        `INSERT INTO orders
          (id, route_id, token, code, customer, phone, address, cep, reference, notes, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
      ).bind(
        'or_' + newToken(8),
        routeId,
        newToken(16),
        'P-' + String(n).padStart(3, '0'),
        item.customer,
        item.phone,
        item.address,
        item.cep,
        item.reference,
        item.notes,
        now,
        now
      )
    );
  }
  await batch(env, statements);
  await run(env, 'UPDATE routes SET updated_at = ? WHERE id = ?', now, routeId);
  return json({ ok: true, created: prepared.length }, { status: 201 });
}

async function updateOrder(request, env, id) {
  if (!isId(id)) throw new HttpError(404, 'Pedido não encontrado.');
  const order = await first(env, 'SELECT * FROM orders WHERE id = ?', id);
  if (!order) throw new HttpError(404, 'Pedido não encontrado.');
  const body = await readJson(request);

  const sets = [];
  const params = [];
  let addressChanged = false;

  if ('customer' in body) {
    const customer = text(body.customer, 100);
    if (!customer) throw new HttpError(400, 'Informe o nome do cliente.');
    sets.push('customer = ?');
    params.push(customer);
  }
  if ('phone' in body) {
    sets.push('phone = ?');
    params.push(cleanPhone(body.phone));
  }
  if ('address' in body) {
    const address = text(body.address, 240);
    if (!address) throw new HttpError(400, 'Informe o endereço.');
    addressChanged = address !== order.address;
    sets.push('address = ?');
    params.push(address);
  }
  if ('reference' in body) {
    sets.push('reference = ?');
    params.push(text(body.reference, 160));
  }
  if ('cep' in body) {
    sets.push('cep = ?');
    params.push(cleanCep(body.cep));
  }
  if ('notes' in body) {
    sets.push('notes = ?');
    params.push(text(body.notes, 200));
  }

  if ('lat' in body || 'lng' in body) {
    const lat = coord(body.lat, -90, 90);
    const lng = coord(body.lng, -180, 180);
    if (lat === null || lng === null) throw new HttpError(400, 'Localização inválida.');
    sets.push('lat = ?', 'lng = ?', 'geocode_source = ?');
    params.push(lat, lng, text(body.geocodeSource, 20) || 'manual');
  } else if (addressChanged) {
    sets.push('lat = NULL', 'lng = NULL', 'geocode_source = NULL');
  }

  if (!sets.length) return json({ ok: true, order: mapOrder(order, true) });

  sets.push('updated_at = ?');
  params.push(nowIso());
  params.push(id);
  await run(env, `UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, ...params);

  const updated = await first(env, 'SELECT * FROM orders WHERE id = ?', id);
  return json({ ok: true, order: mapOrder(updated, true) });
}

async function deleteOrder(env, id) {
  if (!isId(id)) throw new HttpError(404, 'Pedido não encontrado.');
  const order = await first(env, 'SELECT * FROM orders WHERE id = ?', id);
  if (!order) throw new HttpError(404, 'Pedido não encontrado.');
  if (order.photo_key) {
    try {
      await env.PHOTOS.delete(order.photo_key);
    } catch (err) {
      console.warn('Não foi possível apagar a foto do pedido:', err);
    }
  }
  await run(env, 'DELETE FROM orders WHERE id = ?', id);
  await recalcRouteStatus(env, order.route_id);
  await run(env, 'UPDATE routes SET updated_at = ? WHERE id = ?', nowIso(), order.route_id);
  return json({ ok: true });
}

/* ------------------------------ otimização --------------------------- */

async function optimizeRoute(request, env, routeId) {
  if (!isId(routeId)) throw new HttpError(404, 'Rota não encontrada.');
  const route = await first(env, 'SELECT * FROM routes WHERE id = ?', routeId);
  if (!route) throw new HttpError(404, 'Rota não encontrada.');

  let body = {};
  try {
    body = await readJson(request);
  } catch {
    body = {};
  }

  const orders = await all(
    env,
    `SELECT * FROM orders WHERE route_id = ? AND status <> 'canceled'
     ORDER BY CASE WHEN seq IS NULL THEN 1 ELSE 0 END, seq, created_at`,
    routeId
  );

  if (orders.some((o) => o.status === 'en_route')) {
    throw new HttpError(
      409,
      'Finalize a entrega em andamento antes de recalcular a rota.',
      'active_delivery'
    );
  }

  const delivered = orders.filter((o) => o.status === 'delivered');
  const pending = orders.filter((o) => o.status === 'pending');

  if (!pending.length) {
    throw new HttpError(400, 'Não há entregas pendentes para otimizar.');
  }

  const withCoords = pending.filter(hasCoords);
  const missing = pending.filter((o) => !hasCoords(o));
  if (!withCoords.length) {
    throw new HttpError(
      400,
      'Nenhum pedido tem localização. Busque os endereços ou ajuste os pinos no mapa.',
      'missing_coords'
    );
  }

  const pickup = {
    lat: Number(route.pickup_lat),
    lng: Number(route.pickup_lng)
  };
  if (!hasCoords(pickup)) {
    throw new HttpError(400, 'O endereço de retirada está sem localização. Configure nas opções.');
  }

  let start = pickup;
  if (delivered.length) {
    const last = [...delivered].sort((a, b) => (a.seq || 0) - (b.seq || 0)).pop();
    if (hasCoords(last)) start = { lat: Number(last.lat), lng: Number(last.lng) };
  }

  if (missing.length && !body.allowMissing) {
    // O painel confirma antes; a API também protege contra esquecimento.
    throw new HttpError(
      409,
      `${missing.length} pedido(s) sem localização. Ajuste no mapa ou confirme para deixá-los no fim da rota.`,
      'missing_coords',
      { missing: missing.map((o) => ({ id: o.id, code: o.code, customer: o.customer, address: o.address })) }
    );
  }

  const points = withCoords.map((o) => ({ lat: Number(o.lat), lng: Number(o.lng) }));
  const trip = await optimizeTrip(start, points);
  const orderedPending = trip.order.map((i) => withCoords[i]);
  const finalPending = [...orderedPending, ...missing];

  const statements = [];
  let seq = 0;
  for (const o of [...delivered].sort((a, b) => (a.seq || 0) - (b.seq || 0))) {
    seq += 1;
    if (o.seq !== seq) {
      statements.push(env.DB.prepare('UPDATE orders SET seq = ? WHERE id = ?').bind(seq, o.id));
    }
  }
  for (const o of finalPending) {
    seq += 1;
    statements.push(
      env.DB.prepare('UPDATE orders SET seq = ?, updated_at = ? WHERE id = ?').bind(seq, nowIso(), o.id)
    );
  }

  const now = nowIso();
  statements.push(
    env.DB.prepare(
      `UPDATE routes SET
         distance_m = ?, duration_s = ?, geometry = ?, geometry_source = ?,
         optimized_at = ?, status = CASE WHEN status IN ('open','planned') THEN 'planned' ELSE status END,
         updated_at = ?
       WHERE id = ?`
    ).bind(
      trip.distance,
      trip.duration,
      trip.geometry ? JSON.stringify(trip.geometry) : null,
      trip.source,
      now,
      now,
      routeId
    )
  );

  await batch(env, statements);

  return json({
    ok: true,
    optimized: {
      count: finalPending.length,
      missing: missing.length,
      distanceM: trip.distance,
      durationS: trip.duration,
      source: trip.source
    }
  });
}

/* ----------------------------- motoboy (token) ----------------------- */

async function routeByToken(env, token) {
  if (!token || token.length < 16) return null;
  return await first(env, 'SELECT * FROM routes WHERE token = ?', token);
}

async function riderRoute(env, token) {
  const route = await routeByToken(env, token);
  if (!route) throw new HttpError(404, 'Link da rota inválido ou expirado.', 'invalid_token');

  const orders = await all(
    env,
    `SELECT * FROM orders WHERE route_id = ? AND status <> 'canceled'
     ORDER BY CASE WHEN seq IS NULL THEN 1 ELSE 0 END, seq, created_at`,
    route.id
  );
  const stats = await routeStats(env, route.id);
  const position = await first(env, 'SELECT * FROM positions WHERE route_id = ?', route.id);
  const settings = publicSettings(await getSettings(env));

  const map = { ...mapRoute(route), ...stats };
  return json({
    route: map,
    orders: orders.map((o) => mapOrder(o, false)),
    position: position
      ? {
          lat: Number(position.lat),
          lng: Number(position.lng),
          accuracy: position.accuracy === null ? null : Number(position.accuracy),
          updatedAt: position.updated_at
        }
      : null,
    settings: {
      storeName: settings.storeName,
      driverName: settings.driverName,
      driverPhone: settings.driverPhone,
      pickupAddress: route.pickup_address,
      pickupLat: Number(route.pickup_lat) || null,
      pickupLng: Number(route.pickup_lng) || null
    }
  });
}

async function riderPosition(request, env, token) {
  const route = await routeByToken(env, token);
  if (!route) throw new HttpError(404, 'Link da rota inválido.', 'invalid_token');
  const body = await readJson(request);
  const lat = coord(body.lat, -90, 90);
  const lng = coord(body.lng, -180, 180);
  if (lat === null || lng === null) throw new HttpError(400, 'Posição inválida.');
  const accuracy = coord(body.accuracy, 0, 100000);
  const heading = coord(body.heading, 0, 360);
  const speed = coord(body.speed, 0, 200);
  const now = nowIso();
  await run(
    env,
    `INSERT INTO positions (route_id, lat, lng, accuracy, heading, speed, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(route_id) DO UPDATE SET
       lat = excluded.lat, lng = excluded.lng, accuracy = excluded.accuracy,
       heading = excluded.heading, speed = excluded.speed, updated_at = excluded.updated_at`,
    route.id,
    lat,
    lng,
    accuracy,
    heading,
    speed,
    now
  );
  return json({ ok: true, updatedAt: now });
}

async function riderOrderAction(request, env, token, orderId, action) {
  const route = await routeByToken(env, token);
  if (!route) throw new HttpError(404, 'Link da rota inválido.', 'invalid_token');
  if (!isId(orderId)) throw new HttpError(404, 'Pedido não encontrado.');
  const order = await first(
    env,
    'SELECT * FROM orders WHERE id = ? AND route_id = ?',
    orderId,
    route.id
  );
  if (!order) throw new HttpError(404, 'Pedido não encontrado.');

  const now = nowIso();
  const active = await first(
    env,
    `SELECT id, customer FROM orders
     WHERE route_id = ? AND status = 'en_route' AND id <> ?`,
    route.id,
    order.id
  );

  if (action === 'en-route') {
    if (order.status !== 'pending') {
      throw new HttpError(409, 'Este pedido não está mais pendente.', 'invalid_status');
    }
    if (active) {
      throw new HttpError(
        409,
        `Finalize a entrega de ${active.customer} antes de iniciar outra.`,
        'active_delivery',
        { orderId: active.id }
      );
    }
    await run(
      env,
      `UPDATE orders SET status = 'en_route', en_route_at = ?, updated_at = ? WHERE id = ?`,
      now,
      now,
      order.id
    );
    await run(env, `UPDATE routes SET status = 'active', updated_at = ? WHERE id = ?`, now, route.id);
    await run(
      env,
      `INSERT INTO events (route_id, order_id, type, payload, created_at) VALUES (?, ?, 'en_route', ?, ?)`,
      route.id,
      order.id,
      JSON.stringify({ seq: order.seq }),
      now
    );
  } else if (action === 'deliver') {
    if (order.status === 'delivered') {
      throw new HttpError(409, 'Este pedido já foi entregue.', 'invalid_status');
    }
    if (active) {
      throw new HttpError(
        409,
        `Finalize a entrega de ${active.customer} antes de concluir outra.`,
        'active_delivery',
        { orderId: active.id }
      );
    }

    const photo = decodePhoto(await readJsonPhoto(request));
    const photoKey = photoKeyFor(route.id, order.id);
    try {
      await env.PHOTOS.put(photoKey, photo.data, {
        expirationTtl: PHOTO_TTL_SECONDS,
        metadata: {
          mime: photo.mime,
          bytes: photo.bytes,
          routeId: route.id,
          orderId: order.id,
          createdAt: now
        }
      });
    } catch (err) {
      console.error('Falha ao guardar a foto da entrega:', err);
      throw new HttpError(503, 'Não foi possível guardar a foto. Tente novamente.', 'photo_storage');
    }

    await run(
      env,
      `UPDATE orders
       SET status = 'delivered', delivered_at = ?, updated_at = ?,
           photo_key = ?, photo_mime = ?, photo_at = ?
       WHERE id = ?`,
      now,
      now,
      photoKey,
      photo.mime,
      now,
      order.id
    );
    await run(
      env,
      `INSERT INTO events (route_id, order_id, type, payload, created_at) VALUES (?, ?, 'delivered', ?, ?)`,
      route.id,
      order.id,
      JSON.stringify({ seq: order.seq, photo: true }),
      now
    );
    await recalcRouteStatus(env, route.id);
    await run(env, 'UPDATE routes SET updated_at = ? WHERE id = ?', now, route.id);
  } else if (action === 'undo') {
    if (order.status === 'delivered') {
      if (active) {
        throw new HttpError(
          409,
          `Já existe outra entrega em andamento (${active.customer}).`,
          'active_delivery'
        );
      }
      if (order.photo_key) {
        try {
          await env.PHOTOS.delete(order.photo_key);
        } catch (err) {
          console.warn('Não foi possível apagar a foto da entrega:', err);
        }
      }
      await run(
        env,
        `UPDATE orders
         SET status = 'en_route', delivered_at = NULL, en_route_at = ?,
             photo_key = NULL, photo_mime = NULL, photo_at = NULL,
             updated_at = ?
         WHERE id = ?`,
        now,
        now,
        order.id
      );
      await run(env, `UPDATE routes SET status = 'active', updated_at = ? WHERE id = ?`, now, route.id);
    } else if (order.status === 'en_route') {
      await run(
        env,
        `UPDATE orders SET status = 'pending', en_route_at = NULL, updated_at = ? WHERE id = ?`,
        now,
        order.id
      );
      await recalcRouteStatus(env, route.id);
    } else {
      throw new HttpError(409, 'Este pedido não pode ser revertido.', 'invalid_status');
    }
    await run(
      env,
      `INSERT INTO events (route_id, order_id, type, payload, created_at) VALUES (?, ?, 'undo', NULL, ?)`,
      route.id,
      order.id,
      now
    );
  } else {
    throw new HttpError(404, 'Ação não encontrada.');
  }

  const updated = await first(env, 'SELECT * FROM orders WHERE id = ?', order.id);
  const stats = await routeStats(env, route.id);
  const statusRow = await first(env, 'SELECT status FROM routes WHERE id = ?', route.id);
  return json({
    ok: true,
    order: mapOrder(updated, false),
    stats,
    routeStatus: statusRow?.status || null
  });
}

/* ------------------------------ cliente ------------------------------ */

async function customerTracking(env, token) {
  if (!token || token.length < 16) throw new HttpError(404, 'Link inválido.', 'invalid_token');
  const order = await first(
    env,
    `SELECT o.*, r.name AS route_name, r.status AS route_status,
            r.pickup_address, r.pickup_lat, r.pickup_lng, r.geometry
     FROM orders o JOIN routes r ON r.id = o.route_id
     WHERE o.token = ?`,
    token
  );
  if (!order) throw new HttpError(404, 'Link inválido ou expirado.', 'invalid_token');

  const settings = publicSettings(await getSettings(env));
  const stats = await routeStats(env, order.route_id);

  let queuePosition = null;
  if (order.seq !== null && order.seq !== undefined) {
    const row = await first(
      env,
      `SELECT COUNT(*) AS n FROM orders
       WHERE route_id = ? AND status <> 'canceled' AND seq IS NOT NULL AND seq <= ?`,
      order.route_id,
      order.seq
    );
    queuePosition = Number(row?.n || 0);
  }

  const active = order.status === 'en_route';
  let position = null;
  if (active) {
    const pos = await first(env, 'SELECT * FROM positions WHERE route_id = ?', order.route_id);
    if (pos && Number.isFinite(Number(pos.lat))) {
      position = {
        lat: Number(pos.lat),
        lng: Number(pos.lng),
        accuracy: pos.accuracy === null ? null : Number(pos.accuracy),
        updatedAt: pos.updated_at
      };
    }
  }

  let remainingM = null;
  if (active && position && hasCoords(order)) {
    remainingM = haversineM(position, { lat: Number(order.lat), lng: Number(order.lng) });
  }

  return json({
    order: {
      code: order.code,
      customer: order.customer,
      address: order.address,
      reference: order.reference || '',
      lat: order.lat === null || order.lat === undefined ? null : Number(order.lat),
      lng: order.lng === null || order.lng === undefined ? null : Number(order.lng),
      status: order.status,
      seq: order.seq === null ? null : Number(order.seq),
      enRouteAt: order.en_route_at || null,
      deliveredAt: order.delivered_at || null,
      createdAt: order.created_at,
      queuePosition,
      remainingM
    },
    route: {
      status: order.route_status,
      geometry: active ? parseGeometry(order.geometry) : null,
      pickupAddress: order.pickup_address,
      total: stats.total,
      delivered: stats.delivered
    },
    driver:
      active || order.status === 'delivered'
        ? { name: settings.driverName, phone: settings.driverPhone }
        : null,
    store: { name: settings.storeName },
    position,
    serverTime: nowIso()
  });
}
