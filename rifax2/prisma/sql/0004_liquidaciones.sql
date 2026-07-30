-- #2 Liquidación de comisiones de vendedores. Aditivo.
SET search_path TO saas, public;

CREATE TABLE IF NOT EXISTS saas.liquidaciones (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id      BIGINT NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  vendedor_id    BIGINT NOT NULL REFERENCES saas.vendedores(id) ON DELETE CASCADE,
  monto          NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  base_recaudado NUMERIC(14,2) NOT NULL DEFAULT 0,
  pct_comision   NUMERIC(5,2) NOT NULL DEFAULT 0,
  notas          TEXT,
  liquidado_por  BIGINT REFERENCES saas.usuarios(id),
  liquidado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_liquidaciones_vendedor ON saas.liquidaciones(vendedor_id);
