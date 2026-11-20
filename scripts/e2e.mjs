import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8787';
const PASSWORD = process.env.E2E_PASSWORD || 'rotacerta';
const TEMP_PASSWORD = `${PASSWORD}-e2e`;
const OUT = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'rotacerta-e2e');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

const CHROME = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
if (!CHROME) {
  console.error('Chrome não encontrado. Defina CHROME_PATH com o caminho do executável.');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
const PHOTO_FILE = path.join(OUT, 'delivery-photo.png');
fs.writeFileSync(
  PHOTO_FILE,
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
);

const errors = [];
const failed = [];
let authToken = '';

function log(msg) { console.log(msg); }
function shot(name) { return path.join(OUT, name); }

async function api(pathname, { method = 'GET', body, auth = true } = {}) {
  const res = await fetch(BASE + pathname, {
    method,
    headers: {
      ...(auth && authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(`${method} ${pathname} -> ${res.status} ${JSON.stringify(data)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function expectApiError(promiseFactory, status, label) {
  try {
    await promiseFactory();
    log(`   FAIL ${label}: esperava erro ${status}, veio sucesso`);
  } catch (err) {
    log(`   ${err.status === status ? 'ok  ' : 'FAIL'} ${label}: ${err.status} ${err.data?.code || ''}`);
  }
}

function attach(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[${label}] console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[${label}] pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (url.includes('tile.openstreetmap.org')) return;
    failed.push(`[${label}] ${req.method()} ${url} :: ${req.failure()?.errorText}`);
  });
}

async function waitToast(page, text, timeout = 30000) {
  const toast = page.locator('.toast', { hasText: text }).first();
  await toast.waitFor({ state: 'visible', timeout });
  return (await toast.textContent()).trim();
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu']
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  geolocation: { latitude: -7.1215, longitude: -34.8655, accuracy: 12 },
  permissions: ['geolocation'],
  locale: 'pt-BR'
});

const page = await context.newPage();
attach(page, 'painel');

try {
  const health = await api('/api/health', { auth: false });
  log(`0. Health ok=${health.ok} v=${health.version}`);

  log('1. Landing');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  log('   title: ' + await page.title());
  await page.screenshot({ path: shot('01-landing.png'), fullPage: true });

  log('2. Login');
  await page.goto(BASE + '/painel', { waitUntil: 'networkidle' });
  await page.waitForSelector('#login-view:not(.hidden)');
  await page.screenshot({ path: shot('02-login.png'), fullPage: true });

  const badLogin = await fetch(BASE + '/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'senha-errada-xyz' })
  });
  log(`   login inválido: ${badLogin.status} (esperado 401)`);

  await page.fill('#login-password', PASSWORD);
  await page.click('#login-btn');
  await page.waitForSelector('#app-view:not(.hidden)');
  await page.waitForSelector('.page-head .page-title');
  log('   logged in: ' + await page.locator('.page-title').textContent());
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot('03-routes.png'), fullPage: true });

  authToken = await page.evaluate(() => localStorage.getItem('rotacerta.painel.token.v2'));
  log('   token: ' + authToken.slice(0, 12) + '...');

  log('3. Create route via UI');
  await page.click('.page-head__actions [data-action="new-route"]');
  await page.waitForSelector('dialog[open]');
  await page.fill('dialog [name="name"]', 'Rota Teste UI');
  await page.screenshot({ path: shot('04-new-route-dialog.png') });
  await page.click('dialog .dialog__foot button:has-text("Criar rota")');
  await page.waitForURL(/#\/rota\/rt_/);
  const routeId = page.url().split('#/rota/')[1];
  await page.waitForSelector('#route-map');
  await page.waitForTimeout(800);
  log('   route: ' + routeId);

  const branchCheck = await api(`/api/routes/${routeId}`);
  const branchStops = (branchCheck.orders || []).filter((o) => o.kind === 'branch');
  log('   filiais: ' + branchStops.map((o) => `${o.code}=${o.customer}`).join(' | '));
  if (branchStops.length !== 2) throw new Error('Rota criada sem as duas filiais');

  log('4. Add 3 orders via UI');
  await page.click('.detail-head__actions [data-action="add-orders"]');
  await page.waitForSelector('dialog[open]');
  await page.click('dialog summary');
  await page.fill('dialog [name="bulk"]', [
    'Ana Souza; (83) 99999-1111; Avenida Epitácio Pessoa, 1200, Miramar, João Pessoa - PB; Portão azul',
    'Carlos Lima; (83) 98888-2222; Rua das Trincheiras, 300, Centro, João Pessoa - PB',
    'Beatriz Alves; (83) 97777-3333; Avenida Tabajaras, 848, Centro, João Pessoa - PB; Em frente à praça; ; 58013-270'
  ].join('\n'));
  await page.click('dialog .dialog__foot button:has-text("Adicionar")');
  await page.waitForFunction(() => document.querySelectorAll('.stop-row').length === 5, null, { timeout: 15000 });
  log('   stops: ' + await page.locator('.stop-row').count());

  const detail = await api(`/api/routes/${routeId}`);
  log('   CEP em lote: ' + (detail.orders.find((o) => o.customer === 'Beatriz Alves')?.cep || 'vazio'));
  const coords = [
    { lat: -7.1196801, lng: -34.8600441 },
    { lat: -7.1350000, lng: -34.8700000 },
    { lat: -7.1220077, lng: -34.8771620 }
  ];
  const deliveryStops = detail.orders.filter((o) => o.kind !== 'branch');
  for (let i = 0; i < deliveryStops.length; i++) {
    await api(`/api/orders/${deliveryStops[i].id}`, {
      method: 'PATCH',
      body: { ...coords[i], geocodeSource: 'manual' }
    });
  }
  log('   coords set via API for ' + deliveryStops.length + ' deliveries (branches keep fixed coords)');

  log('4b. CEP + rascunho no formulário');
  await page.click('.detail-head__actions [data-action="add-orders"]');
  await page.waitForSelector('dialog[open]');
  await page.route('https://viacep.com.br/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      cep: '58013-270',
      logradouro: 'Avenida Tabajaras',
      bairro: 'Centro',
      localidade: 'João Pessoa',
      uf: 'PB'
    })
  }));
  await page.fill('dialog [name="customer"]', 'Rascunho Teste');
  await page.fill('dialog [name="cep"]', '58013270');
  await page.fill('dialog [name="number"]', '848');
  await page.waitForFunction(
    () => document.querySelector('dialog[open] [name="address"]')?.value.includes('Avenida Tabajaras'),
    null,
    { timeout: 15000 }
  );
  log('   endereço: ' + await page.inputValue('dialog[open] [name="address"]'));

  await page.mouse.click(5, 5);
  await page.waitForTimeout(300);
  if ((await page.locator('dialog[open]').count()) !== 1) {
    throw new Error('Diálogo fechou ao clicar fora da janela');
  }
  log('   clique fora mantém a janela aberta');

  await page.click('dialog[open] [data-close]');
  await page.waitForTimeout(300);
  await page.click('.detail-head__actions [data-action="add-orders"]');
  await page.waitForSelector('dialog[open]');
  const restoredCustomer = await page.inputValue('dialog[open] [name="customer"]');
  const restoredAddress = await page.inputValue('dialog[open] [name="address"]');
  log('   rascunho restaurado: ' + restoredCustomer + ' | ' + restoredAddress);
  if (restoredCustomer !== 'Rascunho Teste') throw new Error('Rascunho não restaurado');

  await page.click('dialog[open] .dialog__foot button:has-text("Cancelar")');
  await page.waitForTimeout(300);
  await page.click('.detail-head__actions [data-action="add-orders"]');
  await page.waitForSelector('dialog[open]');
  const clearedCustomer = await page.inputValue('dialog[open] [name="customer"]');
  log('   após Cancelar: "' + clearedCustomer + '"');
  if (clearedCustomer) throw new Error('Cancelar não limpou o rascunho');
  await page.unroute('https://viacep.com.br/**');
  await page.click('dialog[open] [data-close]');
  await page.waitForTimeout(300);

  log('4c. Pin dialog (ajustar localização)');
  const pinOrder = deliveryStops[0];
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(`#stop-${pinOrder.id}`);
  await page.click(`#stop-${pinOrder.id} [data-action="pin-order"]`);
  await page.waitForSelector('dialog[open] #pin-map.leaflet-container', { timeout: 20000 });
  const mapBox = await page.locator('dialog[open] #pin-map').boundingBox();
  await page.mouse.click(mapBox.x + mapBox.width / 2 + 70, mapBox.y + mapBox.height / 2 + 45);
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot('05b-pin-dialog.png') });
  await page.click('dialog .dialog__foot button:has-text("Salvar localização")');
  log('   ' + await waitToast(page, 'Localização salva'));
  const afterPin = await api(`/api/routes/${routeId}`);
  const pinned = afterPin.orders.find((o) => o.id === pinOrder.id);
  log(`   salvo: ${pinned.lat.toFixed(5)},${pinned.lng.toFixed(5)} fonte=${pinned.geocodeSource}`);

  log('5. Optimize via UI');
  await page.waitForSelector('#optimize-btn');
  await page.click('#optimize-btn');
  const optToast = await waitToast(page, 'Rota otimizada', 60000);
  log('   toast: ' + optToast);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: shot('06-route-optimized.png'), fullPage: true });

  const optimized = await api(`/api/routes/${routeId}`);
  const ordered = [...optimized.orders].sort((a, b) => (a.seq ?? 999) - (b.seq ?? 999));
  log('   sequence: ' + ordered.map((o) => `${o.seq}=${o.customer}`).join(' | '));
  log(`   distance=${optimized.route.distanceM} source=${optimized.route.geometrySource} points=${optimized.route.geometry?.coordinates?.length || 0}`);
  if (ordered.some((o) => !o.seq)) throw new Error('Otimização não aplicou sequência');
  const orderedBranches = ordered.filter((o) => o.kind === 'branch');
  const deliveryOrdered = ordered.filter((o) => o.kind !== 'branch');
  log('   filiais na sequência: ' + orderedBranches.map((o) => `${o.seq}=${o.customer}`).join(' | '));
  if (orderedBranches.length !== 2) throw new Error('Otimização não manteve as duas filiais');
  if (deliveryOrdered.length !== 3) throw new Error('Quantidade de entregas inesperada');

  log('6. Share dialogs');
  await page.click('.detail-head__actions [data-action="share-route"]');
  await page.waitForSelector('dialog[open]');
  await page.screenshot({ path: shot('07-share-route.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.click('[data-action="share-customers"]');
  await page.waitForSelector('dialog[open]');
  const shareRows = await page.locator('dialog[open] .share-order').count();
  const shareText = await page.locator('dialog[open] .share-list').textContent();
  log(`   links de clientes: ${shareRows} (filiais fora da lista)`);
  if (shareRows !== 3) throw new Error('Links dos clientes não excluíram as filiais');
  if (/Loja (Bancários|Manaíra)/.test(shareText)) throw new Error('Filial apareceu nos links dos clientes');
  await page.screenshot({ path: shot('08-share-customers.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  log('7. Rider page');
  const riderPage = await context.newPage();
  attach(riderPage, 'rota');
  await riderPage.goto(`${BASE}/rota?t=${optimized.route.token}`, { waitUntil: 'networkidle' });
  await riderPage.waitForSelector('.stop-card', { timeout: 15000 });
  log('   h1: ' + await riderPage.locator('.rider-hero h1').textContent());
  log('   ordem: ' + (await riderPage.locator('.stop-card__title').allTextContents()).join(' | '));
  if ((await riderPage.locator('.stop-card').count()) !== 5) throw new Error('Rota do motoboy sem as duas filiais');
  await riderPage.screenshot({ path: shot('09-rider.png'), fullPage: true });

  log('7b. Filial concluída sem foto e reaberta');
  const branchToTest = orderedBranches[0];
  await riderPage.click(`#stop-${branchToTest.id} [data-action="deliver"]`);
  await riderPage.waitForSelector('dialog[open]');
  log('   diálogo: ' + (await riderPage.locator('dialog[open] h2').textContent()).trim());
  await riderPage.click('dialog .dialog__foot button:has-text("Sim, concluir")');
  await riderPage.waitForFunction(
    (id) => document.querySelector(`#stop-${id}`)?.classList.contains('stop-card--delivered'),
    branchToTest.id,
    { timeout: 20000 }
  );
  log('   ' + await waitToast(riderPage, 'Parada concluída'));
  const branchDone = (await api(`/api/rota/${optimized.route.token}`, { auth: false }))
    .orders.find((o) => o.id === branchToTest.id);
  if (branchDone.status !== 'delivered' || branchDone.hasPhoto) {
    throw new Error('Filial concluída com foto ou status inesperado');
  }
  await riderPage.click(`#stop-${branchToTest.id} [data-action="undo"]`);
  await riderPage.waitForSelector('dialog[open]');
  await riderPage.click('dialog .dialog__foot button:has-text("Desfazer")');
  await riderPage.waitForFunction(
    (id) => !document.querySelector(`#stop-${id}`)?.classList.contains('stop-card--delivered'),
    branchToTest.id,
    { timeout: 20000 }
  );
  log('   ' + await waitToast(riderPage, 'Parada reaberta'));
  const branchUndone = (await api(`/api/rota/${optimized.route.token}`, { auth: false }))
    .orders.find((o) => o.id === branchToTest.id);
  if (branchUndone.status !== 'pending') throw new Error('Desfazer parada não voltou para pendente');

  log('8. Customer waiting page (1ª entrega)');
  const firstOrder = deliveryOrdered[0];
  const customerPage = await context.newPage();
  attach(customerPage, 'cliente');
  await customerPage.goto(`${BASE}/acompanhar?t=${firstOrder.token}`, { waitUntil: 'networkidle' });
  await customerPage.waitForSelector('.track-hero h1');
  log('   waiting: ' + await customerPage.locator('.track-hero h1').textContent());
  await customerPage.screenshot({ path: shot('10-customer-waiting.png'), fullPage: true });

  log('9. Rider starts delivery (1ª parada)');
  await riderPage.click(`#stop-${firstOrder.id} [data-action="en-route"]`);
  await riderPage.waitForSelector(`#stop-${firstOrder.id}.stop-card--enroute`, { timeout: 15000 });
  log('   ' + await waitToast(riderPage, 'Cliente avisado'));
  await riderPage.waitForTimeout(3500);
  await riderPage.screenshot({ path: shot('11-rider-enroute.png'), fullPage: true });

  const riderApi = await api(`/api/rota/${optimized.route.token}`, { auth: false });
  log(`   rider API: ativo=${riderApi.route.enRoute} pos=${riderApi.position ? `${riderApi.position.lat.toFixed(4)},${riderApi.position.lng.toFixed(4)}` : 'sem GPS ainda'}`);

  log('10. Customer live map');
  await customerPage.waitForFunction(
    () => document.querySelector('.track-hero h1')?.textContent.includes('saiu para entrega'),
    null,
    { timeout: 25000 }
  );
  await customerPage.waitForSelector('.leaflet-container', { timeout: 20000 });
  await customerPage.waitForSelector('.map-pin--rider', { timeout: 25000 });
  await customerPage.waitForTimeout(2500);
  log('   live: ' + await customerPage.locator('.track-hero h1').textContent());
  await customerPage.screenshot({ path: shot('12-customer-live.png'), fullPage: true });

  const liveApi = await api(`/api/acompanhar/${firstOrder.token}`, { auth: false });
  log(`   customer API: status=${liveApi.order.status} pos=${liveApi.position?.lat?.toFixed(4)} restante=${Math.round(liveApi.order.remainingM)}m`);

  log('11. Rider delivers (com foto)');
  await riderPage.click(`#stop-${firstOrder.id} [data-action="deliver"]`);
  await riderPage.waitForSelector('dialog[open]');
  log('   diálogo: ' + (await riderPage.locator('dialog[open] h2').textContent()).trim());
  await riderPage.screenshot({ path: shot('13-confirm-delivery.png') });
  await riderPage.setInputFiles('dialog[open] [data-photo-input]', PHOTO_FILE);
  await riderPage.waitForFunction(
    () => {
      const btn = document.querySelector('dialog[open] .dialog__foot [data-action="1"]');
      return btn && !btn.disabled;
    },
    null,
    { timeout: 20000 }
  );
  await riderPage.screenshot({ path: shot('13b-delivery-photo.png') });
  await riderPage.click('dialog .dialog__foot button:has-text("Confirmar entrega")');
  await riderPage.waitForFunction(
    (id) => document.querySelector(`#stop-${id}`)?.classList.contains('stop-card--delivered'),
    firstOrder.id,
    { timeout: 20000 }
  );
  await riderPage.waitForTimeout(1200);
  await riderPage.screenshot({ path: shot('14-rider-delivered.png'), fullPage: true });

  log('11b. Foto guardada e visível no painel');
  const photoRes = await fetch(`${BASE}/api/orders/${firstOrder.id}/photo`, {
    headers: { authorization: `Bearer ${authToken}` }
  });
  const photoBytes = (await photoRes.arrayBuffer()).byteLength;
  log(`   foto: ${photoRes.status} ${photoRes.headers.get('content-type')} ${photoBytes} bytes`);
  if (photoRes.status !== 200 || !photoRes.headers.get('content-type')?.startsWith('image/')) {
    throw new Error('Foto da entrega não foi guardada');
  }
  const afterDeliver = await api(`/api/routes/${routeId}`);
  if (!afterDeliver.orders.find((o) => o.id === firstOrder.id)?.hasPhoto) {
    throw new Error('Pedido entregue sem hasPhoto');
  }

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(`#stop-${firstOrder.id} [data-action="view-photo"]`, { timeout: 20000 });
  await page.click(`#stop-${firstOrder.id} [data-action="view-photo"]`);
  await page.waitForSelector('dialog[open] .photo-viewer img', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot('13c-delivery-photo-panel.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  log('11c. Entrega sem foto é recusada');
  const noPhotoRoute = await api('/api/routes', { method: 'POST', body: { name: 'Teste foto obrigatória' } });
  await api(`/api/routes/${noPhotoRoute.route.id}/orders`, {
    method: 'POST',
    body: { customer: 'Sem Foto', address: 'Rua das Trincheiras, 10, Centro, João Pessoa - PB' }
  });
  const noPhotoDetail = await api(`/api/routes/${noPhotoRoute.route.id}`);
  const noPhotoOrder = noPhotoDetail.orders.find((o) => o.kind !== 'branch');
  const noPhotoRes = await fetch(
    `${BASE}/api/rota/${noPhotoRoute.route.token}/orders/${noPhotoOrder.id}/deliver`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }
  );
  const noPhotoData = await noPhotoRes.json().catch(() => ({}));
  log(`   ${noPhotoRes.status} ${noPhotoData.code || ''}`);
  if (noPhotoRes.status !== 400 || noPhotoData.code !== 'photo_required') {
    throw new Error('Servidor aceitou entrega sem foto');
  }

  const tinyPhoto = 'data:image/png;base64,' + fs.readFileSync(PHOTO_FILE).toString('base64');
  const apiPhotoRes = await fetch(
    `${BASE}/api/rota/${noPhotoRoute.route.token}/orders/${noPhotoOrder.id}/deliver`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photo: tinyPhoto })
    }
  );
  log('   entrega via API com foto: ' + apiPhotoRes.status);
  if (apiPhotoRes.status !== 200) throw new Error('Entrega com foto falhou');

  const storedRes = await fetch(`${BASE}/api/orders/${noPhotoOrder.id}/photo`, {
    headers: { authorization: `Bearer ${authToken}` }
  });
  log('   foto via API: ' + storedRes.status + ' ' + storedRes.headers.get('content-type'));
  if (storedRes.status !== 200) throw new Error('Foto via API não encontrada');

  await fetch(
    `${BASE}/api/rota/${noPhotoRoute.route.token}/orders/${noPhotoOrder.id}/undo`,
    { method: 'POST' }
  );
  const undoneRes = await fetch(`${BASE}/api/orders/${noPhotoOrder.id}/photo`, {
    headers: { authorization: `Bearer ${authToken}` }
  });
  const undoneData = await undoneRes.json().catch(() => ({}));
  log(`   após desfazer: ${undoneRes.status} ${undoneData.code || ''}`);
  if (undoneRes.status !== 404) throw new Error('Desfazer entrega não apagou a foto');

  await api(`/api/routes/${noPhotoRoute.route.id}`, { method: 'DELETE' });

  log('12. Customer delivered');
  await customerPage.waitForFunction(
    () => document.querySelector('.track-hero h1')?.textContent.includes('Entrega concluída'),
    null,
    { timeout: 25000 }
  );
  log('   done: ' + await customerPage.locator('.track-hero h1').textContent());
  await customerPage.screenshot({ path: shot('15-customer-delivered.png'), fullPage: true });

  log('13. Segunda cliente aguardando');
  const waiting2 = await context.newPage();
  attach(waiting2, 'cliente2');
  await waiting2.goto(`${BASE}/acompanhar?t=${deliveryOrdered[1].token}`, { waitUntil: 'networkidle' });
  await waiting2.waitForSelector('.track-hero h1');
  log('   waiting2: ' + await waiting2.locator('.track-hero h1').textContent());
  await waiting2.screenshot({ path: shot('16-customer-waiting2.png'), fullPage: true });

  log('13b. Links inválidos');
  await expectApiError(() => api('/api/rota/tokeninvalido123456', { auth: false }), 404, 'rota inválida');
  await expectApiError(() => api('/api/acompanhar/tokeninvalido123456', { auth: false }), 404, 'cliente inválido');

  log('14. Mobile screenshots');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/painel#/rota/${routeId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.stop-row');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shot('17-mobile-panel.png'), fullPage: true });

  await page.goto(`${BASE}/painel#/rotas`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.route-card');
  await page.screenshot({ path: shot('17b-mobile-routes.png'), fullPage: true });

  await riderPage.setViewportSize({ width: 390, height: 844 });
  await riderPage.waitForTimeout(900);
  await riderPage.screenshot({ path: shot('18-mobile-rider.png'), fullPage: true });

  await waiting2.setViewportSize({ width: 390, height: 844 });
  await waiting2.waitForTimeout(600);
  await waiting2.screenshot({ path: shot('19-mobile-customer.png'), fullPage: true });

  await customerPage.setViewportSize({ width: 390, height: 844 });
  await customerPage.waitForTimeout(600);
  await customerPage.screenshot({ path: shot('19b-mobile-customer-delivered.png'), fullPage: true });

  log('15. Geocode fallback pelo CEP');
  const fallbackCreated = await api('/api/routes', { method: 'POST', body: { name: 'Rota fallback CEP' } });
  const fallbackRouteId = fallbackCreated.route.id;
  await api(`/api/routes/${fallbackRouteId}/orders`, {
    method: 'POST',
    body: {
      customer: 'Teste Fallback',
      address: 'Rua Inexistente No Mapa, 100, Centro, João Pessoa - PB',
      cep: '58013270'
    }
  });

  const fallbackPage = await context.newPage();
  attach(fallbackPage, 'fallback');
  await fallbackPage.route('https://nominatim.openstreetmap.org/search**', (route) => {
    const q = new URL(route.request().url()).searchParams.get('q') || '';
    const list = q.includes('58013-270')
      ? [{ lat: '-7.1104596', lon: '-34.8462925', display_name: 'CEP 58013-270, João Pessoa - PB, Brasil' }]
      : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(list) });
  });

  await fallbackPage.goto(`${BASE}/painel#/rota/${fallbackRouteId}`, { waitUntil: 'networkidle' });
  await fallbackPage.waitForSelector('#optimize-btn');
  await fallbackPage.click('#optimize-btn');
  await fallbackPage.waitForSelector('dialog[open]');
  await fallbackPage.click('dialog[open] .dialog__foot button:has-text("Buscar endereços")');
  log('   ' + await waitToast(fallbackPage, 'pelo CEP', 40000));
  await fallbackPage.waitForSelector('.stop-row .chip:has-text("Aproximada (CEP)")', { timeout: 20000 });
  log('   ' + await waitToast(fallbackPage, 'Rota otimizada', 60000));
  await fallbackPage.waitForTimeout(1000);
  await fallbackPage.screenshot({ path: shot('20-geocode-cep-fallback.png'), fullPage: true });

  const fallbackDetail = await api(`/api/routes/${fallbackRouteId}`);
  const fallbackOrder = fallbackDetail.orders.find((o) => o.kind !== 'branch');
  log(`   fonte=${fallbackOrder.geocodeSource} coords=${fallbackOrder.lat.toFixed(5)},${fallbackOrder.lng.toFixed(5)}`);
  if (fallbackOrder.geocodeSource !== 'cep') throw new Error('Fallback pelo CEP não aplicado');
  await fallbackPage.unroute('https://nominatim.openstreetmap.org/search**');
  await api(`/api/routes/${fallbackRouteId}`, { method: 'DELETE' });
  await fallbackPage.close();

  log('16. Troca de senha (API)');
  await api('/api/password', { method: 'POST', body: { currentPassword: PASSWORD, newPassword: TEMP_PASSWORD } });
  const relogin = await api('/api/login', { method: 'POST', body: { password: TEMP_PASSWORD }, auth: false });
  log('   login com senha nova ok: ' + Boolean(relogin.token));
  authToken = relogin.token;
  await api('/api/password', { method: 'POST', body: { currentPassword: TEMP_PASSWORD, newPassword: PASSWORD } });
  const relogin2 = await api('/api/login', { method: 'POST', body: { password: PASSWORD }, auth: false });
  log('   senha restaurada: ' + Boolean(relogin2.token));
  authToken = relogin2.token;

  log('17. Cleanup test route');
  await api(`/api/routes/${routeId}`, { method: 'DELETE' });
  log('   deleted');

  log('\nCONSOLE ERRORS (' + errors.length + ')');
  for (const e of errors) log('  ' + e);
  log('\nFAILED REQUESTS (' + failed.length + ')');
  for (const f of failed) log('  ' + f);
  log('\nOUT: ' + OUT);
} catch (err) {
  console.error('E2E FAILED:', err);
  try { await page.screenshot({ path: shot('99-failure.png'), fullPage: true }); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
}
