-- RotaCerta — foto comprobatória da entrega
-- A imagem em si fica no KV (PHOTOS) com expiração de 3 dias.
-- Aqui guardamos apenas a referência e o tipo da imagem.

ALTER TABLE orders ADD COLUMN photo_key TEXT;
ALTER TABLE orders ADD COLUMN photo_mime TEXT;
ALTER TABLE orders ADD COLUMN photo_at TEXT;
