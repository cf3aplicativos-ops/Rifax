-- 0007: Calendario de fechas de vencimiento por empresa.
-- El número de fechas depende de la periodicidad: mensual=12, semestral=2, anual=1.
SET search_path = saas, public;

CREATE TABLE IF NOT EXISTS saas.vencimientos (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id  BIGINT NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  numero     SMALLINT NOT NULL,                 -- 1..N dentro del ciclo
  fecha      DATE NOT NULL,
  estado     TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagada')),
  pagada_en  TIMESTAMPTZ,
  UNIQUE (tenant_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_vencimientos_tenant ON saas.vencimientos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vencimientos_pend ON saas.vencimientos(tenant_id, estado, fecha);
