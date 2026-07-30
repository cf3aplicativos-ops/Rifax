-- 0005: Plataforma — configuración global, planes, carrusel y facturación.
SET search_path = saas, public;

-- Configuración global de la plataforma (fila única id = 1).
CREATE TABLE IF NOT EXISTS saas.plataforma_config (
  id                       SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  precio_basico            NUMERIC(12,2) NOT NULL DEFAULT 99000,
  precio_corporativo_texto TEXT NOT NULL DEFAULT 'A medida',
  actualizado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO saas.plataforma_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Plan comercial del tenant.
ALTER TABLE saas.tenants
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'basico'
  CHECK (plan IN ('basico','corporativo'));

-- Carrusel de la landing (global, gestionado por el super-admin).
CREATE TABLE IF NOT EXISTS saas.landing_slides (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  imagen_url TEXT,                 -- data URI (imagen subida) o URL
  titulo     TEXT,
  subtitulo  TEXT,
  orden      SMALLINT NOT NULL DEFAULT 0,
  activo     BOOLEAN NOT NULL DEFAULT true,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Facturación por empresa (registros internos, sin pasarela de pago).
CREATE TABLE IF NOT EXISTS saas.facturas (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id  BIGINT NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  periodo    TEXT NOT NULL,                       -- 'YYYY-MM'
  concepto   TEXT NOT NULL DEFAULT 'Suscripción',
  plan       TEXT NOT NULL DEFAULT 'basico',
  monto      NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado     TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagada','anulada')),
  emitida_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  vence_en   DATE,
  pagada_en  TIMESTAMPTZ,
  UNIQUE (tenant_id, periodo)
);
CREATE INDEX IF NOT EXISTS idx_facturas_tenant ON saas.facturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado ON saas.facturas(estado);
