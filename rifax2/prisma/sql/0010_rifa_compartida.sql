-- 0010: Rifa compartida entre sedes.
-- Una rifa "compartida" se digita una sola vez (premio mayor + anticipados) y sus
-- boletas se reparten entre las sedes marcando cada boleta con su sede_id.
SET search_path = saas, public;

ALTER TABLE saas.rifas ADD COLUMN IF NOT EXISTS compartida BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE saas.boletas ADD COLUMN IF NOT EXISTS sede_id BIGINT REFERENCES saas.sedes(id);
CREATE INDEX IF NOT EXISTS idx_boletas_rifa_sede ON saas.boletas(rifa_id, sede_id);
