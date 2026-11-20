-- RotaCerta — paradas fixas das filiais
-- Toda rota recebe duas paradas fixas (Loja Bancários e Loja Manaíra).
-- Elas usam a mesma tabela de pedidos para entrar na otimização e na sequência.

ALTER TABLE orders ADD COLUMN kind TEXT NOT NULL DEFAULT 'delivery';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_branch_code
  ON orders(route_id, code)
  WHERE kind = 'branch';

-- Rotas criadas antes desta versão também recebem as duas filiais.
INSERT OR IGNORE INTO orders
  (id, route_id, token, code, customer, phone, address, cep, reference, notes,
   lat, lng, geocode_source, status, kind, created_at, updated_at)
SELECT
  'or_' || lower(hex(randomblob(8))),
  r.id,
  lower(hex(randomblob(16))),
  'F-BAN',
  'Loja Bancários',
  '',
  'Rua João Rodrigues Alves, Praça da Paz, 253 - Sl 03 - Jardim São Paulo, João Pessoa - PB, 58051-022',
  '58051022',
  '',
  '',
  -7.1466257,
  -34.8484656,
  'branch',
  'pending',
  'branch',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM routes r
WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.route_id = r.id AND o.code = 'F-BAN'
);

INSERT OR IGNORE INTO orders
  (id, route_id, token, code, customer, phone, address, cep, reference, notes,
   lat, lng, geocode_source, status, kind, created_at, updated_at)
SELECT
  'or_' || lower(hex(randomblob(8))),
  r.id,
  lower(hex(randomblob(16))),
  'F-MAN',
  'Loja Manaíra',
  '',
  'Ed. Business Center - Av. Gov. Flávio Ribeiro Coutinho, 205 - Sl 105 - Manaíra, João Pessoa - PB, 58037-000',
  '58037000',
  '',
  '',
  -7.0975186,
  -34.8353504,
  'branch',
  'pending',
  'branch',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM routes r
WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.route_id = r.id AND o.code = 'F-MAN'
);
