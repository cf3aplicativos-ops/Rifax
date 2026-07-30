-- 0006: Vigencia de planes, límites configurables, fondo de login y permisos por usuario.
SET search_path = saas, public;

ALTER TABLE saas.tenants
  ADD COLUMN IF NOT EXISTS sedes_ilimitadas   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usuarios_ilimitados BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_usuarios       INTEGER,   -- cap explícito (si no ilimitado)
  ADD COLUMN IF NOT EXISTS periodicidad       TEXT NOT NULL DEFAULT 'mensual'
    CHECK (periodicidad IN ('mensual','semestral','anual')),
  ADD COLUMN IF NOT EXISTS periodicidad_pago  TEXT NOT NULL DEFAULT 'mensual'
    CHECK (periodicidad_pago IN ('mensual','semestral','anual')),
  ADD COLUMN IF NOT EXISTS fecha_inicio       DATE,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento  DATE;

-- Imagen de fondo (data URI) para la pantalla de inicio de sesión.
ALTER TABLE saas.plataforma_config ADD COLUMN IF NOT EXISTS login_fondo_url TEXT;

-- Permisos efectivos por usuario (override del rol). Si un usuario tiene filas
-- aquí, ese es su conjunto de permisos; si no, hereda los del rol.
CREATE TABLE IF NOT EXISTS saas.usuario_permisos (
  usuario_id BIGINT NOT NULL REFERENCES saas.usuarios(id) ON DELETE CASCADE,
  permiso_id BIGINT NOT NULL REFERENCES saas.permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, permiso_id)
);
