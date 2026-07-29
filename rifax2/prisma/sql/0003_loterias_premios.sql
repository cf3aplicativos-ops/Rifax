-- #3 Lotería del premio mayor + premios anticipados. Aditivo (no destructivo).
SET search_path TO saas, public;

-- Lotería con la que se juega el PREMIO MAYOR de la rifa.
ALTER TABLE saas.rifas ADD COLUMN IF NOT EXISTS loteria TEXT;

-- Premios anticipados: se juegan en fechas previas al sorteo mayor, con su
-- propia lotería y un número de pagos/abonos requeridos para participar.
CREATE TABLE IF NOT EXISTS saas.premios_anticipados (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id        BIGINT NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  rifa_id          BIGINT NOT NULL REFERENCES saas.rifas(id) ON DELETE CASCADE,
  nombre           TEXT NOT NULL,
  loteria          TEXT,
  fecha_juego      DATE NOT NULL,
  pagos_requeridos SMALLINT NOT NULL DEFAULT 1 CHECK (pagos_requeridos >= 1),
  valor_estimado   NUMERIC(14,2),
  numero_ganador   INTEGER,
  estado           TEXT NOT NULL DEFAULT 'programado'
                     CHECK (estado IN ('programado','jugado','entregado','cancelado')),
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_premios_ant_rifa ON saas.premios_anticipados(rifa_id);

-- #6 Tipo de asignación de talonario: consecutiva (rango) o aleatoria (boletas
-- no contiguas). Los existentes quedan como 'consecutiva'.
ALTER TABLE saas.talonarios ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'consecutiva'
  CHECK (tipo IN ('consecutiva','aleatoria'));
