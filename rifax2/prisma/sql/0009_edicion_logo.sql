-- 0009: estado de cliente (para anular) y logo por rifa (para el recibo).
SET search_path = saas, public;

ALTER TABLE saas.clientes
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'activo'
  CHECK (estado IN ('activo','inactivo'));

ALTER TABLE saas.rifas ADD COLUMN IF NOT EXISTS logo_url TEXT;
