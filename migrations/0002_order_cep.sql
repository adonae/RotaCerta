-- RotaCerta — CEP do pedido
-- Guardado apenas como dígitos (8 caracteres), quando informado.

ALTER TABLE orders ADD COLUMN cep TEXT;
