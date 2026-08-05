-- 0013: Solicitudes de traspaso de boleta entre vendedores y puntos de venta.
-- Cuando una boleta disponible pertenece a otro vendedor o a otro punto de venta
-- (sede), el solicitante pide autorización a quien la tiene asignada. Si se
-- aprueba, la boleta se reasigna (y con ella, la comisión de futuras ventas);
-- si se rechaza, queda registrada la negativa para el solicitante.
SET search_path = saas, public;

CREATE TABLE IF NOT EXISTS saas.solicitudes_boleta (
  id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id                BIGINT NOT NULL REFERENCES saas.tenants(id) ON DELETE CASCADE,
  rifa_id                  BIGINT NOT NULL REFERENCES saas.rifas(id) ON DELETE CASCADE,
  boleta_id                BIGINT NOT NULL REFERENCES saas.boletas(id) ON DELETE CASCADE,
  numero                   INTEGER NOT NULL,
  solicitante_tipo         TEXT NOT NULL CHECK (solicitante_tipo IN ('vendedor','sede')),
  solicitante_vendedor_id  BIGINT REFERENCES saas.vendedores(id),
  solicitante_sede_id      BIGINT REFERENCES saas.sedes(id),
  propietario_tipo         TEXT NOT NULL CHECK (propietario_tipo IN ('vendedor','sede')),
  propietario_vendedor_id  BIGINT REFERENCES saas.vendedores(id),
  propietario_sede_id      BIGINT REFERENCES saas.sedes(id),
  estado                   TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','rechazada')),
  motivo_rechazo           TEXT,
  solicitado_por           BIGINT REFERENCES saas.usuarios(id),
  resuelto_por             BIGINT REFERENCES saas.usuarios(id),
  creado_en                TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelto_en              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_tenant_estado ON saas.solicitudes_boleta(tenant_id, estado);
-- Solo una solicitud pendiente a la vez por boleta (evita dobles/competidoras).
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitud_pendiente_boleta ON saas.solicitudes_boleta(boleta_id) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_solicitudes_prop_vendedor ON saas.solicitudes_boleta(propietario_vendedor_id) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_solicitudes_prop_sede ON saas.solicitudes_boleta(propietario_sede_id) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_solicitudes_sol_vendedor ON saas.solicitudes_boleta(solicitante_vendedor_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_sol_sede ON saas.solicitudes_boleta(solicitante_sede_id);

-- Nuevo permiso: solicitar y autorizar traspasos de boletas.
INSERT INTO saas.permisos(codigo) VALUES ('boleta.traspasar') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO saas.roles_permisos(rol_id, permiso_id)
SELECT r.id, p.id FROM saas.roles r, saas.permisos p
WHERE p.codigo = 'boleta.traspasar' AND r.nombre IN ('admin','gerente','vendedor','cajero')
ON CONFLICT DO NOTHING;
