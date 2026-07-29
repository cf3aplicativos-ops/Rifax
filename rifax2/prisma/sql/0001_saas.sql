-- =====================================================================
--  RIFAX SaaS — Esquema multi-tenant (v2.0.0)
--  Motor: PostgreSQL 15+ (Neon)
--  Aislamiento: row-level (tenant_id / sede_id en cada tabla de negocio).
--  Jerarquía: plataforma_admins (super-admin global)
--                -> tenants -> sedes -> datos de negocio
-- =====================================================================

BEGIN;

-- Todo el modelo multi-tenant vive en el schema `saas`, para no tocar el
-- esquema `public` de la demo single-tenant mientras se reconstruye la app.
CREATE SCHEMA IF NOT EXISTS saas;
SET search_path TO saas, public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- =====================================================================
--  0. PLATAFORMA (super-admin global, fuera de cualquier tenant)
-- =====================================================================
CREATE TABLE IF NOT EXISTS plataforma_admins (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid          UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  nombre        TEXT NOT NULL,
  correo        CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  estado        TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  ultimo_login  TIMESTAMPTZ,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  nombre         TEXT NOT NULL,
  slug           CITEXT NOT NULL UNIQUE,
  estado         TEXT NOT NULL DEFAULT 'activo'
                   CHECK (estado IN ('activo','suspendido','inactivo')),
  max_sedes      SMALLINT NOT NULL DEFAULT 1 CHECK (max_sedes >= 1),
  creado_por     BIGINT REFERENCES plataforma_admins(id),
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sedes (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid       UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  tenant_id  BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  direccion  TEXT,
  telefono   TEXT,
  estado     TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','inactiva')),
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_sedes_tenant ON sedes(tenant_id);

-- Branding y configuración por tenant
CREATE TABLE IF NOT EXISTS tenant_config (
  tenant_id      BIGINT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  logo_url       TEXT,
  fondo_url      TEXT,
  color_primario TEXT NOT NULL DEFAULT '#dc2626',
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catálogos configurables: alimentan las listas desplegables del aplicativo
CREATE TABLE IF NOT EXISTS catalogos (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo      TEXT NOT NULL,   -- p.ej. 'canal_venta','origen_abono','canal_mensaje','modalidad_sorteo'
  valor     TEXT NOT NULL,   -- valor interno
  etiqueta  TEXT NOT NULL,   -- texto visible
  orden     SMALLINT NOT NULL DEFAULT 0,
  activo    BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (tenant_id, tipo, valor)
);
CREATE INDEX IF NOT EXISTS idx_catalogos_tipo ON catalogos(tenant_id, tipo) WHERE activo;

-- =====================================================================
--  1. SEGURIDAD del tenant: roles, permisos, usuarios, sesiones
-- =====================================================================
CREATE TABLE IF NOT EXISTS roles (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      TEXT NOT NULL UNIQUE,
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS permisos (
  id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS roles_permisos (
  rol_id     BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permiso_id BIGINT NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  tenant_id      BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sede_id        BIGINT REFERENCES sedes(id),   -- NULL = acceso a todo el tenant
  nombre         TEXT NOT NULL,
  correo         CITEXT NOT NULL,
  telefono       TEXT,
  password_hash  TEXT NOT NULL,
  rol_id         BIGINT NOT NULL REFERENCES roles(id),
  estado         TEXT NOT NULL DEFAULT 'activo'
                   CHECK (estado IN ('activo','inactivo','bloqueado')),
  mfa_secret     TEXT,
  ultimo_login   TIMESTAMPTZ,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, correo)      -- correo único DENTRO del tenant
);
CREATE INDEX IF NOT EXISTS idx_usuarios_tenant ON usuarios(tenant_id);

CREATE TABLE IF NOT EXISTS sesiones (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id         BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  familia            UUID NOT NULL,
  ip                 INET,
  user_agent         TEXT,
  expira_en          TIMESTAMPTZ NOT NULL,
  revocada           BOOLEAN NOT NULL DEFAULT false,
  creada_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id) WHERE revocada = false;

-- =====================================================================
--  2. RIFAS y PREMIOS  (por sede)
-- =====================================================================
CREATE TABLE IF NOT EXISTS rifas (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid                UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  tenant_id           BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sede_id             BIGINT NOT NULL REFERENCES sedes(id),
  codigo              TEXT NOT NULL,
  nombre              TEXT NOT NULL,
  descripcion         TEXT,
  numero_digitos      SMALLINT NOT NULL CHECK (numero_digitos BETWEEN 2 AND 6),
  numero_min          INTEGER NOT NULL DEFAULT 0,
  numero_max          INTEGER NOT NULL,
  precio_boleta       NUMERIC(14,2) NOT NULL CHECK (precio_boleta > 0),
  moneda              CHAR(3) NOT NULL DEFAULT 'COP',
  fecha_apertura      TIMESTAMPTZ NOT NULL,
  fecha_cierre_ventas TIMESTAMPTZ NOT NULL,
  fecha_sorteo        TIMESTAMPTZ NOT NULL,
  estado              TEXT NOT NULL DEFAULT 'borrador'
                        CHECK (estado IN ('borrador','activa','pausada','cerrada',
                                          'sorteada','liquidada','archivada')),
  tasa_derechos       NUMERIC(6,4) NOT NULL DEFAULT 0.1400,
  total_boletas       INTEGER NOT NULL,
  creado_por          BIGINT REFERENCES usuarios(id),
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (numero_max >= numero_min),
  CHECK (fecha_cierre_ventas <= fecha_sorteo),
  UNIQUE (tenant_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_rifas_sede ON rifas(sede_id);

CREATE TABLE IF NOT EXISTS premios (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rifa_id        BIGINT NOT NULL REFERENCES rifas(id) ON DELETE CASCADE,
  orden          SMALLINT NOT NULL,
  nombre         TEXT NOT NULL,
  valor_estimado NUMERIC(14,2),
  UNIQUE (rifa_id, orden)
);

-- =====================================================================
--  3. VENDEDORES, CLIENTES, TALONARIOS
-- =====================================================================
CREATE TABLE IF NOT EXISTS vendedores (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid         UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  tenant_id    BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sede_id      BIGINT REFERENCES sedes(id),
  usuario_id   BIGINT REFERENCES usuarios(id),
  nombre       TEXT NOT NULL,
  documento    TEXT NOT NULL,
  telefono     TEXT NOT NULL,
  correo       CITEXT,
  pct_comision NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pct_comision BETWEEN 0 AND 100),
  cupo_max     INTEGER,
  estado       TEXT NOT NULL DEFAULT 'activo'
                 CHECK (estado IN ('activo','suspendido','inactivo')),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendedores_tenant ON vendedores(tenant_id);

CREATE TABLE IF NOT EXISTS clientes (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  tenant_id            BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre               TEXT NOT NULL,
  documento            TEXT,
  telefono             TEXT NOT NULL,
  correo               CITEXT,
  consentimiento_datos BOOLEAN NOT NULL DEFAULT false,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, telefono)
);

CREATE TABLE IF NOT EXISTS talonarios (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id     BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rifa_id       BIGINT NOT NULL REFERENCES rifas(id) ON DELETE CASCADE,
  vendedor_id   BIGINT NOT NULL REFERENCES vendedores(id),
  numero_inicio INTEGER NOT NULL,
  numero_fin    INTEGER NOT NULL,
  estado        TEXT NOT NULL DEFAULT 'asignado'
                  CHECK (estado IN ('asignado','en_venta','rendido','cerrado')),
  asignado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (numero_fin >= numero_inicio)
);
CREATE INDEX IF NOT EXISTS idx_talonarios_vendedor ON talonarios(vendedor_id);

CREATE TABLE IF NOT EXISTS rendiciones (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id       BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendedor_id     BIGINT NOT NULL REFERENCES vendedores(id),
  rifa_id         BIGINT NOT NULL REFERENCES rifas(id),
  monto_entregado NUMERIC(14,2) NOT NULL,
  monto_esperado  NUMERIC(14,2) NOT NULL,
  diferencia      NUMERIC(14,2) GENERATED ALWAYS AS (monto_entregado - monto_esperado) STORED,
  registrado_por  BIGINT REFERENCES usuarios(id),
  registrado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
--  4. VENTAS
-- =====================================================================
CREATE TABLE IF NOT EXISTS ventas (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  tenant_id      BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sede_id        BIGINT NOT NULL REFERENCES sedes(id),
  codigo         TEXT NOT NULL,
  rifa_id        BIGINT NOT NULL REFERENCES rifas(id),
  cliente_id     BIGINT NOT NULL REFERENCES clientes(id),
  vendedor_id    BIGINT REFERENCES vendedores(id),
  cantidad       INTEGER NOT NULL CHECK (cantidad > 0),
  total          NUMERIC(14,2) NOT NULL CHECK (total >= 0),
  saldo          NUMERIC(14,2) NOT NULL,
  estado         TEXT NOT NULL DEFAULT 'pendiente_pago'
                   CHECK (estado IN ('pendiente_pago','parcial','pagada','anulada','vencida')),
  canal          TEXT NOT NULL DEFAULT 'web',
  idempotency_key TEXT,
  expira_en      TIMESTAMPTZ,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_ventas_rifa_estado ON ventas(rifa_id, estado);
CREATE INDEX IF NOT EXISTS idx_ventas_sede ON ventas(sede_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ventas_idem ON ventas(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS boletas (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id      BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rifa_id        BIGINT NOT NULL REFERENCES rifas(id) ON DELETE CASCADE,
  numero         INTEGER NOT NULL,
  estado         TEXT NOT NULL DEFAULT 'disponible'
                   CHECK (estado IN ('disponible','reservada','pagada','anulada','bloqueada')),
  talonario_id   BIGINT REFERENCES talonarios(id),
  venta_id       BIGINT REFERENCES ventas(id),
  version        INTEGER NOT NULL DEFAULT 0,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rifa_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_boletas_rifa_estado ON boletas(rifa_id, estado);

CREATE TABLE IF NOT EXISTS ventas_boletas (
  venta_id  BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  boleta_id BIGINT NOT NULL REFERENCES boletas(id),
  precio    NUMERIC(14,2) NOT NULL,
  PRIMARY KEY (venta_id, boleta_id),
  UNIQUE (boleta_id)
);

-- =====================================================================
--  5. PAGOS
-- =====================================================================
CREATE TABLE IF NOT EXISTS pagos_pasarela (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id          BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  venta_id           BIGINT NOT NULL REFERENCES ventas(id),
  proveedor          TEXT NOT NULL,
  transaccion_ext_id TEXT NOT NULL,
  metodo             TEXT,
  monto              NUMERIC(14,2) NOT NULL,
  moneda             CHAR(3) NOT NULL DEFAULT 'COP',
  estado             TEXT NOT NULL
                       CHECK (estado IN ('PENDING','APPROVED','DECLINED','VOIDED','ERROR')),
  payload_firma_ok   BOOLEAN NOT NULL,
  raw_payload        JSONB,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proveedor, transaccion_ext_id)
);

CREATE TABLE IF NOT EXISTS comprobantes (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id           BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  venta_id            BIGINT REFERENCES ventas(id),
  url_archivo         TEXT NOT NULL,
  estado_ia           TEXT NOT NULL DEFAULT 'pendiente'
                        CHECK (estado_ia IN ('pendiente','conciliado','discrepancia','ilegible','revision')),
  monto_extraido      NUMERIC(14,2),
  referencia_extraida TEXT,
  banco_extraido      TEXT,
  fecha_extraida      DATE,
  confianza_ia        NUMERIC(4,3),
  subido_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS abonos (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id        BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  venta_id         BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  origen           TEXT NOT NULL CHECK (origen IN ('pasarela','comprobante','efectivo','ajuste')),
  monto            NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  pago_pasarela_id BIGINT REFERENCES pagos_pasarela(id),
  comprobante_id   BIGINT REFERENCES comprobantes(id),
  registrado_por   BIGINT REFERENCES usuarios(id),
  registrado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_abonos_venta ON abonos(venta_id);

-- =====================================================================
--  6. MENSAJERÍA
-- =====================================================================
CREATE TABLE IF NOT EXISTS plantillas_mensaje (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id             BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  codigo                TEXT NOT NULL,
  canal                 TEXT NOT NULL CHECK (canal IN ('whatsapp','sms','correo')),
  idioma                TEXT NOT NULL DEFAULT 'es',
  cuerpo                TEXT NOT NULL,
  proveedor_template_id TEXT,
  estado                TEXT NOT NULL DEFAULT 'activa',
  UNIQUE (tenant_id, codigo)
);

CREATE TABLE IF NOT EXISTS mensajes (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id        BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  direccion        TEXT NOT NULL CHECK (direccion IN ('saliente','entrante')),
  canal            TEXT NOT NULL CHECK (canal IN ('whatsapp','sms','correo')),
  cliente_id       BIGINT REFERENCES clientes(id),
  venta_id         BIGINT REFERENCES ventas(id),
  plantilla_id     BIGINT REFERENCES plantillas_mensaje(id),
  proveedor_msg_id TEXT,
  contenido        TEXT,
  adjunto_url      TEXT,
  estado           TEXT CHECK (estado IN ('encolado','enviado','entregado','leido','fallido','recibido')),
  intencion_ia     TEXT,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbox_notificaciones (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id       BIGINT REFERENCES tenants(id) ON DELETE CASCADE,
  evento          TEXT NOT NULL,
  payload         JSONB NOT NULL,
  canal           TEXT NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','procesando','enviado','fallido')),
  intentos        SMALLINT NOT NULL DEFAULT 0,
  proximo_intento TIMESTAMPTZ,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_pendiente ON outbox_notificaciones(estado, proximo_intento);

CREATE TABLE IF NOT EXISTS preferencias_notificacion (
  cliente_id       BIGINT PRIMARY KEY REFERENCES clientes(id) ON DELETE CASCADE,
  canal_preferido  TEXT NOT NULL DEFAULT 'whatsapp'
                     CHECK (canal_preferido IN ('whatsapp','sms','correo')),
  opt_in_marketing BOOLEAN NOT NULL DEFAULT false,
  opt_out_total    BOOLEAN NOT NULL DEFAULT false,
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gestiones_cobranza (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id     BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  venta_id      BIGINT NOT NULL REFERENCES ventas(id),
  canal         TEXT NOT NULL CHECK (canal IN ('whatsapp','sms','correo','llamada')),
  mensaje_id    BIGINT REFERENCES mensajes(id),
  resultado     TEXT CHECK (resultado IN ('enviado','leido','respondio','promesa_pago','sin_respuesta')),
  promesa_fecha DATE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
--  7. SORTEO y GANADORES
-- =====================================================================
CREATE TABLE IF NOT EXISTS sorteos (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id      BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rifa_id        BIGINT NOT NULL REFERENCES rifas(id) ON DELETE CASCADE,
  modalidad      TEXT NOT NULL CHECK (modalidad IN ('externo','commit_reveal')),
  numero_ganador INTEGER NOT NULL,
  premio_id      BIGINT REFERENCES premios(id),
  commit_hash    TEXT,
  semilla        TEXT,
  evidencia_url  TEXT,
  ejecutado_por  BIGINT REFERENCES usuarios(id),
  ejecutado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rifa_id, premio_id)
);

CREATE TABLE IF NOT EXISTS ganadores (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id      BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sorteo_id      BIGINT NOT NULL REFERENCES sorteos(id) ON DELETE CASCADE,
  rifa_id        BIGINT NOT NULL REFERENCES rifas(id),
  boleta_id      BIGINT REFERENCES boletas(id),
  cliente_id     BIGINT REFERENCES clientes(id),
  premio_id      BIGINT REFERENCES premios(id),
  estado_entrega TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado_entrega IN ('pendiente','contactado','entregado','no_reclamado')),
  registrado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
--  8. IA y AUDITORÍA
-- =====================================================================
CREATE TABLE IF NOT EXISTS ia_interacciones (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id    BIGINT REFERENCES tenants(id) ON DELETE CASCADE,
  tarea        TEXT NOT NULL,
  modelo       TEXT NOT NULL,
  entidad_tipo TEXT,
  entidad_id   BIGINT,
  tokens_in    INTEGER,
  tokens_out   INTEGER,
  latencia_ms  INTEGER,
  costo_usd    NUMERIC(10,6),
  resultado    JSONB,
  exito        BOOLEAN NOT NULL DEFAULT true,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auditoria (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id       BIGINT REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id        BIGINT,
  actor_tipo      TEXT NOT NULL DEFAULT 'usuario' CHECK (actor_tipo IN ('usuario','sistema','ia','superadmin')),
  accion          TEXT NOT NULL,
  entidad_tipo    TEXT NOT NULL,
  entidad_id      BIGINT,
  valores_antes   JSONB,
  valores_despues JSONB,
  ip              INET,
  hash_encadenado TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_tenant ON auditoria(tenant_id, creado_en);

-- =====================================================================
--  9. FUNCIONES
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.actualizado_en := now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_updated ON usuarios;
CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
DROP TRIGGER IF EXISTS trg_rifas_updated ON rifas;
CREATE TRIGGER trg_rifas_updated BEFORE UPDATE ON rifas
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
DROP TRIGGER IF EXISTS trg_ventas_updated ON ventas;
CREATE TRIGGER trg_ventas_updated BEFORE UPDATE ON ventas
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- Auditoría con hash encadenado (cadena global verificable)
CREATE OR REPLACE FUNCTION registrar_auditoria(
  p_actor_id BIGINT, p_actor_tipo TEXT, p_accion TEXT, p_entidad_tipo TEXT,
  p_entidad_id BIGINT, p_antes JSONB, p_despues JSONB, p_ip INET DEFAULT NULL,
  p_tenant_id BIGINT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE v_prev TEXT; v_hash TEXT; v_id BIGINT; v_ts TIMESTAMPTZ := now();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('auditoria_chain'));
  SELECT hash_encadenado INTO v_prev FROM auditoria ORDER BY id DESC LIMIT 1;
  v_hash := encode(digest(
    coalesce(v_prev,'GENESIS')||'|'||coalesce(p_actor_id::text,'')||'|'||coalesce(p_actor_tipo,'')||'|'||
    p_accion||'|'||p_entidad_tipo||'|'||coalesce(p_entidad_id::text,'')||'|'||
    coalesce(p_antes::text,'')||'|'||coalesce(p_despues::text,'')||'|'||v_ts::text, 'sha256'), 'hex');
  INSERT INTO auditoria(tenant_id, actor_id, actor_tipo, accion, entidad_tipo, entidad_id,
                        valores_antes, valores_despues, ip, hash_encadenado, creado_en)
  VALUES (p_tenant_id, p_actor_id, coalesce(p_actor_tipo,'usuario'), p_accion, p_entidad_tipo,
          p_entidad_id, p_antes, p_despues, p_ip, v_hash, v_ts)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION verificar_cadena_auditoria() RETURNS BIGINT AS $$
DECLARE r RECORD; v_prev TEXT := NULL; v_calc TEXT;
BEGIN
  FOR r IN SELECT * FROM auditoria ORDER BY id ASC LOOP
    v_calc := encode(digest(
      coalesce(v_prev,'GENESIS')||'|'||coalesce(r.actor_id::text,'')||'|'||coalesce(r.actor_tipo,'')||'|'||
      r.accion||'|'||r.entidad_tipo||'|'||coalesce(r.entidad_id::text,'')||'|'||
      coalesce(r.valores_antes::text,'')||'|'||coalesce(r.valores_despues::text,'')||'|'||r.creado_en::text, 'sha256'), 'hex');
    IF v_calc <> r.hash_encadenado THEN RETURN r.id; END IF;
    v_prev := r.hash_encadenado;
  END LOOP;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;

-- Purga de todos los datos de un tenant (usada por el super-admin).
-- El ON DELETE CASCADE desde tenants(id) elimina todo el grafo del tenant.
CREATE OR REPLACE FUNCTION purgar_tenant(p_tenant_id BIGINT) RETURNS VOID AS $$
BEGIN
  DELETE FROM tenants WHERE id = p_tenant_id;
END; $$ LANGUAGE plpgsql;

-- =====================================================================
--  10. SEMILLA: roles y permisos globales
-- =====================================================================
INSERT INTO roles(nombre, descripcion) VALUES
  ('admin',    'Administrador del tenant: acceso total dentro de su empresa'),
  ('gerente',  'Gestión de rifas, ventas, cartera y reportes'),
  ('vendedor', 'Venta de boletas de sus talonarios'),
  ('cajero',   'Registro de pagos en punto'),
  ('auditor',  'Consulta y reportes de solo lectura')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO permisos(codigo) VALUES
  ('rifa.crear'),('rifa.editar'),('rifa.publicar'),('rifa.pausar'),('rifa.cerrar'),('rifa.ver'),
  ('boleta.ver'),
  ('vendedor.crear'),('vendedor.editar'),('vendedor.ver'),('vendedor.ver_pii'),
  ('talonario.asignar'),('talonario.devolver'),
  ('venta.crear'),('venta.ver'),('venta.anular'),
  ('pago.registrar'),('pago.conciliar'),
  ('cartera.ver'),('cobranza.gestionar'),
  ('mensaje.enviar'),
  ('sorteo.ejecutar'),
  ('reporte.ver'),('reporte.auditoria'),
  ('usuario.crear'),('usuario.editar'),('usuario.ver'),('rol.gestionar'),
  ('sede.crear'),('sede.editar'),('sede.ver'),
  ('config.gestionar')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO roles_permisos(rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p WHERE r.nombre = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO roles_permisos(rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON TRUE
WHERE r.nombre = 'gerente'
  AND p.codigo NOT IN ('usuario.crear','usuario.editar','rol.gestionar','sede.crear','config.gestionar')
ON CONFLICT DO NOTHING;

INSERT INTO roles_permisos(rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON TRUE
WHERE r.nombre = 'vendedor'
  AND p.codigo IN ('rifa.ver','boleta.ver','venta.crear','venta.ver','cartera.ver','mensaje.enviar','pago.registrar')
ON CONFLICT DO NOTHING;

INSERT INTO roles_permisos(rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON TRUE
WHERE r.nombre = 'cajero'
  AND p.codigo IN ('venta.ver','pago.registrar','cartera.ver')
ON CONFLICT DO NOTHING;

INSERT INTO roles_permisos(rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON TRUE
WHERE r.nombre = 'auditor'
  AND p.codigo IN ('rifa.ver','boleta.ver','vendedor.ver','venta.ver','cartera.ver',
                   'reporte.ver','reporte.auditoria','sede.ver')
ON CONFLICT DO NOTHING;

COMMIT;
