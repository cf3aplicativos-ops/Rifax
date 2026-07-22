-- =====================================================================
--  RIFAX — Migración inicial del esquema (v1.0.0)
--  Motor objetivo: PostgreSQL 15+ (Neon serverless)
--  Ejecución:  psql "$DATABASE_URL" -f migracion_rifax_v1.sql
--  Idempotente a nivel de objeto (usa IF NOT EXISTS / CREATE OR REPLACE).
-- =====================================================================

BEGIN;

-- =====================================================================
--  0. EXTENSIONES
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS citext;      -- correos case-insensitive

-- =====================================================================
--  1. SEGURIDAD: roles, permisos, usuarios, sesiones
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
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid            UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  nombre          TEXT NOT NULL,
  correo          CITEXT NOT NULL UNIQUE,
  telefono        TEXT,
  password_hash   TEXT NOT NULL,
  rol_id          BIGINT NOT NULL REFERENCES roles(id),
  estado          TEXT NOT NULL DEFAULT 'activo'
                    CHECK (estado IN ('activo','inactivo','bloqueado')),
  mfa_secret      TEXT,                       -- cifrado AES-GCM a nivel de app
  ultimo_login    TIMESTAMPTZ,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
--  2. RIFAS y PREMIOS
-- =====================================================================
CREATE TABLE IF NOT EXISTS rifas (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid                UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  codigo              TEXT NOT NULL UNIQUE,
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
  CHECK (fecha_cierre_ventas <= fecha_sorteo)
);

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
  usuario_id   BIGINT REFERENCES usuarios(id),
  nombre       TEXT NOT NULL,
  documento    TEXT NOT NULL,                 -- tokenizado si es sensible
  telefono     TEXT NOT NULL,
  correo       CITEXT,
  pct_comision NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pct_comision BETWEEN 0 AND 100),
  cupo_max     INTEGER,
  estado       TEXT NOT NULL DEFAULT 'activo'
                 CHECK (estado IN ('activo','suspendido','inactivo')),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid                 UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  nombre               TEXT NOT NULL,
  documento            TEXT,                  -- tokenizado
  telefono             TEXT NOT NULL,
  correo               CITEXT,
  consentimiento_datos BOOLEAN NOT NULL DEFAULT false,   -- Ley 1581/2012
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (telefono)
);

CREATE TABLE IF NOT EXISTS talonarios (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
  vendedor_id     BIGINT NOT NULL REFERENCES vendedores(id),
  rifa_id         BIGINT NOT NULL REFERENCES rifas(id),
  monto_entregado NUMERIC(14,2) NOT NULL,
  monto_esperado  NUMERIC(14,2) NOT NULL,
  diferencia      NUMERIC(14,2) GENERATED ALWAYS AS (monto_entregado - monto_esperado) STORED,
  registrado_por  BIGINT REFERENCES usuarios(id),
  registrado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
--  4. VENTAS  (antes que boletas, por la FK boletas.venta_id)
-- =====================================================================
CREATE TABLE IF NOT EXISTS ventas (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  codigo         TEXT NOT NULL UNIQUE,
  rifa_id        BIGINT NOT NULL REFERENCES rifas(id),
  cliente_id     BIGINT NOT NULL REFERENCES clientes(id),
  vendedor_id    BIGINT REFERENCES vendedores(id),
  cantidad       INTEGER NOT NULL CHECK (cantidad > 0),
  total          NUMERIC(14,2) NOT NULL CHECK (total >= 0),
  saldo          NUMERIC(14,2) NOT NULL,
  estado         TEXT NOT NULL DEFAULT 'pendiente_pago'
                   CHECK (estado IN ('pendiente_pago','parcial','pagada','anulada','vencida')),
  canal          TEXT NOT NULL DEFAULT 'web'
                   CHECK (canal IN ('web','whatsapp','vendedor','pos')),
  idempotency_key TEXT,
  expira_en      TIMESTAMPTZ,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ventas_rifa_estado ON ventas(rifa_id, estado);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente     ON ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_vendedor    ON ventas(vendedor_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ventas_idem  ON ventas(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- =====================================================================
--  5. BOLETAS  (depende de rifas, talonarios y ventas)
-- =====================================================================
CREATE TABLE IF NOT EXISTS boletas (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_boletas_talonario   ON boletas(talonario_id)
  WHERE talonario_id IS NOT NULL;

-- Detalle venta<->boleta (una boleta sólo en una venta activa)
CREATE TABLE IF NOT EXISTS ventas_boletas (
  venta_id  BIGINT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  boleta_id BIGINT NOT NULL REFERENCES boletas(id),
  precio    NUMERIC(14,2) NOT NULL,
  PRIMARY KEY (venta_id, boleta_id),
  UNIQUE (boleta_id)
);

-- =====================================================================
--  6. PAGOS: pasarela, comprobantes, abonos
-- =====================================================================
CREATE TABLE IF NOT EXISTS pagos_pasarela (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
--  7. MENSAJERÍA y NOTIFICACIONES
-- =====================================================================
CREATE TABLE IF NOT EXISTS plantillas_mensaje (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo                TEXT NOT NULL UNIQUE,
  canal                 TEXT NOT NULL CHECK (canal IN ('whatsapp','sms','correo')),
  idioma                TEXT NOT NULL DEFAULT 'es',
  cuerpo                TEXT NOT NULL,
  proveedor_template_id TEXT,
  estado                TEXT NOT NULL DEFAULT 'activa'
);

CREATE TABLE IF NOT EXISTS mensajes (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_mensajes_cliente ON mensajes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_estado  ON mensajes(estado);

CREATE TABLE IF NOT EXISTS outbox_notificaciones (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
  venta_id      BIGINT NOT NULL REFERENCES ventas(id),
  canal         TEXT NOT NULL CHECK (canal IN ('whatsapp','sms','correo','llamada')),
  mensaje_id    BIGINT REFERENCES mensajes(id),
  resultado     TEXT CHECK (resultado IN ('enviado','leido','respondio','promesa_pago','sin_respuesta')),
  promesa_fecha DATE,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gestiones_venta ON gestiones_cobranza(venta_id);

-- =====================================================================
--  8. SORTEO y GANADORES
-- =====================================================================
CREATE TABLE IF NOT EXISTS sorteos (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
--  9. IA y AUDITORÍA
-- =====================================================================
CREATE TABLE IF NOT EXISTS ia_interacciones (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
CREATE INDEX IF NOT EXISTS idx_ia_tarea_fecha ON ia_interacciones(tarea, creado_en);

CREATE TABLE IF NOT EXISTS auditoria (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id        BIGINT REFERENCES usuarios(id),
  actor_tipo      TEXT NOT NULL DEFAULT 'usuario' CHECK (actor_tipo IN ('usuario','sistema','ia')),
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
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha   ON auditoria(creado_en);

-- =====================================================================
--  10. FUNCIONES Y TRIGGERS
-- =====================================================================

-- 10.1  updated_at automático
CREATE OR REPLACE FUNCTION fn_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_updated ON usuarios;
CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_rifas_updated ON rifas;
CREATE TRIGGER trg_rifas_updated BEFORE UPDATE ON rifas
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_ventas_updated ON ventas;
CREATE TRIGGER trg_ventas_updated BEFORE UPDATE ON ventas
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

DROP TRIGGER IF EXISTS trg_boletas_updated ON boletas;
CREATE TRIGGER trg_boletas_updated BEFORE UPDATE ON boletas
  FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- 10.2  Registro de auditoría con hash encadenado (append-only verificable)
--       Uso desde la app:  SELECT registrar_auditoria(actor_id, actor_tipo,
--                                 accion, entidad_tipo, entidad_id, antes, despues, ip);
CREATE OR REPLACE FUNCTION registrar_auditoria(
  p_actor_id      BIGINT,
  p_actor_tipo    TEXT,
  p_accion        TEXT,
  p_entidad_tipo  TEXT,
  p_entidad_id    BIGINT,
  p_antes         JSONB,
  p_despues       JSONB,
  p_ip            INET DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  v_prev_hash TEXT;
  v_hash      TEXT;
  v_id        BIGINT;
  v_ts        TIMESTAMPTZ := now();
BEGIN
  -- Serializa la cadena de hash para evitar condiciones de carrera
  PERFORM pg_advisory_xact_lock(hashtext('auditoria_chain'));

  SELECT hash_encadenado INTO v_prev_hash
    FROM auditoria ORDER BY id DESC LIMIT 1;

  v_hash := encode(
    digest(
      coalesce(v_prev_hash,'GENESIS') || '|' ||
      coalesce(p_actor_id::text,'') || '|' || coalesce(p_actor_tipo,'') || '|' ||
      p_accion || '|' || p_entidad_tipo || '|' ||
      coalesce(p_entidad_id::text,'') || '|' ||
      coalesce(p_antes::text,'') || '|' || coalesce(p_despues::text,'') || '|' ||
      v_ts::text,
      'sha256'
    ), 'hex');

  INSERT INTO auditoria(actor_id, actor_tipo, accion, entidad_tipo, entidad_id,
                        valores_antes, valores_despues, ip, hash_encadenado, creado_en)
  VALUES (p_actor_id, coalesce(p_actor_tipo,'usuario'), p_accion, p_entidad_tipo,
          p_entidad_id, p_antes, p_despues, p_ip, v_hash, v_ts)
  RETURNING id INTO v_id;

  RETURN v_id;
END; $$ LANGUAGE plpgsql;

-- 10.3  Verificación de integridad de la cadena de auditoría
--       Devuelve el primer id donde la cadena se rompe, o NULL si es íntegra.
CREATE OR REPLACE FUNCTION verificar_cadena_auditoria() RETURNS BIGINT AS $$
DECLARE
  r          RECORD;
  v_prev     TEXT := NULL;
  v_calc     TEXT;
BEGIN
  FOR r IN SELECT * FROM auditoria ORDER BY id ASC LOOP
    v_calc := encode(
      digest(
        coalesce(v_prev,'GENESIS') || '|' ||
        coalesce(r.actor_id::text,'') || '|' || coalesce(r.actor_tipo,'') || '|' ||
        r.accion || '|' || r.entidad_tipo || '|' ||
        coalesce(r.entidad_id::text,'') || '|' ||
        coalesce(r.valores_antes::text,'') || '|' || coalesce(r.valores_despues::text,'') || '|' ||
        r.creado_en::text,
        'sha256'
      ), 'hex');
    IF v_calc <> r.hash_encadenado THEN
      RETURN r.id;   -- eslabón alterado
    END IF;
    v_prev := r.hash_encadenado;
  END LOOP;
  RETURN NULL;       -- cadena íntegra
END; $$ LANGUAGE plpgsql;

-- =====================================================================
--  11. VISTAS
-- =====================================================================
CREATE OR REPLACE VIEW v_cartera AS
SELECT v.id AS venta_id, v.rifa_id, v.cliente_id, v.vendedor_id,
       v.total, v.saldo,
       EXTRACT(DAY FROM now() - v.creado_en)::INT AS dias_antiguedad,
       CASE
         WHEN v.saldo <= 0 THEN 'al_dia'
         WHEN now() - v.creado_en <= INTERVAL '7 days'  THEN 'corriente'
         WHEN now() - v.creado_en <= INTERVAL '15 days' THEN 'mora_1'
         WHEN now() - v.creado_en <= INTERVAL '30 days' THEN 'mora_2'
         ELSE 'mora_3'
       END AS tramo
FROM ventas v
WHERE v.estado IN ('pendiente_pago','parcial') AND v.saldo > 0;

DROP MATERIALIZED VIEW IF EXISTS mv_avance_rifa;
CREATE MATERIALIZED VIEW mv_avance_rifa AS
SELECT r.id AS rifa_id, r.codigo, r.total_boletas,
       COUNT(*) FILTER (WHERE b.estado='pagada')     AS vendidas_pagadas,
       COUNT(*) FILTER (WHERE b.estado='reservada')  AS reservadas,
       COUNT(*) FILTER (WHERE b.estado='disponible') AS disponibles,
       COALESCE(SUM(v.total) FILTER (WHERE v.estado='pagada'),0) AS recaudo
FROM rifas r
LEFT JOIN boletas b ON b.rifa_id = r.id
LEFT JOIN ventas  v ON v.rifa_id = r.id
GROUP BY r.id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_avance_rifa ON mv_avance_rifa(rifa_id);

-- =====================================================================
--  12. DATOS SEMILLA: roles y permisos
-- =====================================================================
INSERT INTO roles(nombre, descripcion) VALUES
  ('admin',    'Acceso total al sistema'),
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
  ('usuario.crear'),('usuario.editar'),('usuario.ver'),('rol.gestionar')
ON CONFLICT (codigo) DO NOTHING;

-- admin: todos los permisos
INSERT INTO roles_permisos(rol_id, permiso_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permisos p
WHERE r.nombre = 'admin'
ON CONFLICT DO NOTHING;

-- gerente: todo salvo administración de usuarios/roles
INSERT INTO roles_permisos(rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON TRUE
WHERE r.nombre = 'gerente'
  AND p.codigo NOT IN ('usuario.crear','usuario.editar','rol.gestionar')
ON CONFLICT DO NOTHING;

-- vendedor
INSERT INTO roles_permisos(rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON TRUE
WHERE r.nombre = 'vendedor'
  AND p.codigo IN ('rifa.ver','boleta.ver','venta.crear','venta.ver','cartera.ver','mensaje.enviar')
ON CONFLICT DO NOTHING;

-- cajero
INSERT INTO roles_permisos(rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON TRUE
WHERE r.nombre = 'cajero'
  AND p.codigo IN ('venta.ver','pago.registrar','cartera.ver')
ON CONFLICT DO NOTHING;

-- auditor (solo lectura)
INSERT INTO roles_permisos(rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON TRUE
WHERE r.nombre = 'auditor'
  AND p.codigo IN ('rifa.ver','boleta.ver','vendedor.ver','venta.ver','cartera.ver',
                   'reporte.ver','reporte.auditoria')
ON CONFLICT DO NOTHING;

-- Plantillas base de mensajería (ejemplos)
INSERT INTO plantillas_mensaje(codigo, canal, cuerpo) VALUES
  ('confirmacion_pago',     'whatsapp', 'Hola {{1}}, confirmamos el pago de tu(s) boleta(s) {{2}} de la rifa {{3}}. ¡Mucha suerte!'),
  ('recordatorio_cartera',  'whatsapp', 'Hola {{1}}, tienes un saldo pendiente de {{2}} en la rifa {{3}}. Puedes pagar aquí: {{4}}'),
  ('resultado_sorteo',      'whatsapp', 'Rifa {{1}}: el número ganador fue {{2}}. Revisa si tu boleta resultó premiada.')
ON CONFLICT (codigo) DO NOTHING;

COMMIT;

-- =====================================================================
--  FIN — Esquema RIFAX v1.0.0 creado.
--  Verificación rápida:
--    SELECT count(*) FROM roles;      -- 5
--    SELECT count(*) FROM permisos;   -- 28
--    SELECT verificar_cadena_auditoria();  -- NULL = íntegra
-- =====================================================================
