-- RotaCerta v2 — estrutura inicial
-- Banco: Cloudflare D1 (SQLite)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT NOT NULL,
  ok         INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip ON auth_attempts(ip, created_at);

CREATE TABLE IF NOT EXISTS routes (
  id              TEXT PRIMARY KEY,
  token           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  route_date      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open',
  pickup_address  TEXT NOT NULL,
  pickup_lat      REAL,
  pickup_lng      REAL,
  distance_m      REAL,
  duration_s      REAL,
  geometry        TEXT,
  geometry_source TEXT,
  optimized_at    TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_routes_date ON routes(route_date DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,
  route_id       TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  token          TEXT NOT NULL UNIQUE,
  code           TEXT NOT NULL,
  customer       TEXT NOT NULL,
  phone          TEXT,
  address        TEXT NOT NULL,
  reference      TEXT,
  notes          TEXT,
  lat            REAL,
  lng            REAL,
  geocode_source TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  seq            INTEGER,
  en_route_at    TEXT,
  delivered_at   TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_route ON orders(route_id, seq);
CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(token);

CREATE TABLE IF NOT EXISTS positions (
  route_id   TEXT PRIMARY KEY REFERENCES routes(id) ON DELETE CASCADE,
  lat        REAL NOT NULL,
  lng        REAL NOT NULL,
  accuracy   REAL,
  heading    REAL,
  speed      REAL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id   TEXT NOT NULL,
  order_id   TEXT,
  type       TEXT NOT NULL,
  payload    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_route ON events(route_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_events_order ON events(order_id, id DESC);

-- Configurações iniciais -------------------------------------------------

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('store_name',     'Minha Loja'),
  ('driver_name',    'Entregador'),
  ('driver_phone',   ''),
  ('pickup_address', 'Avenida Tabajaras, 848 - Centro, João Pessoa - PB, 58013-270'),
  ('pickup_lat',     '-7.1220077'),
  ('pickup_lng',     '-34.8771620'),
  ('city',           'João Pessoa, PB'),
  ('password_hash',  ''),
  ('password_is_default', '1');
