-- 0016: Planes configurables — sedes asignadas y precio del plan Básico por
-- periodicidad (mensual/semestral/anual), en vez de un único precio fijo.
SET search_path = saas, public;

ALTER TABLE saas.plataforma_config
  ADD COLUMN IF NOT EXISTS sedes_basico SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sedes_corporativo SMALLINT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS precio_basico_mensual NUMERIC(12,2) NOT NULL DEFAULT 180000,
  ADD COLUMN IF NOT EXISTS precio_basico_semestral NUMERIC(12,2) NOT NULL DEFAULT 140000,
  ADD COLUMN IF NOT EXISTS precio_basico_anual NUMERIC(12,2) NOT NULL DEFAULT 120000;

-- Reemplazado por los tres precios de arriba (según periodicidad de pago).
ALTER TABLE saas.plataforma_config DROP COLUMN IF EXISTS precio_basico;
