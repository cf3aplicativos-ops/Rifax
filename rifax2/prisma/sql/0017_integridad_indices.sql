-- 0017: Integridad multi-tenant, índices de rutas calientes y CHECKs faltantes.
-- 100% ADITIVO e idempotente (no borra ni modifica datos existentes).
--
-- Tres bloques:
--   A) Índices sobre FKs y columnas de WHERE/JOIN que hoy provocan seq scans.
--   B) Claves foráneas COMPUESTAS (id, tenant_id): la BD pasa a garantizar por sí
--      misma que una venta no pueda apuntar a un vendedor/sede/cliente/rifa de
--      OTRA empresa. Hasta ahora eso dependía solo de comprobaciones en el código.
--   C) CHECKs de dominio que faltaban (cupos, precios, montos).
SET search_path = saas, public;

-- ===========================================================================
-- A) ÍNDICES
-- ===========================================================================

-- sesiones.familia: getSession() la consulta en CADA navegación (el JWT lleva
--   `sid` = familia) y destroySession() al cerrar sesión. Sin índice era un
--   seq scan por request sobre una tabla que crece con cada inicio de sesión.
--   Verificado con EXPLAIN: "Seq Scan on sesiones".
CREATE INDEX IF NOT EXISTS idx_sesiones_familia ON saas.sesiones(familia);

-- boletas.tenant_id: resumenSedesCompartidas y boletasPorEstado filtran por
--   tenant_id sin acotar por rifa. Es la tabla más grande del modelo (una fila
--   por número: hasta 10^6 en una rifa de 6 dígitos).
CREATE INDEX IF NOT EXISTS idx_boletas_tenant ON saas.boletas(tenant_id);
-- boletas.sede_id: distribución por sede y liberación de boletas de una sede.
CREATE INDEX IF NOT EXISTS idx_boletas_sede ON saas.boletas(sede_id) WHERE sede_id IS NOT NULL;

-- abonos.tenant_id: recaudos del resumen de reportes y de la conciliación.
CREATE INDEX IF NOT EXISTS idx_abonos_tenant ON saas.abonos(tenant_id);

-- talonarios.tenant_id: portal del vendedor y listados por empresa.
CREATE INDEX IF NOT EXISTS idx_talonarios_tenant ON saas.talonarios(tenant_id);

-- usuarios.sede_id / vendedores.sede_id: FKs sin índice; se usan al listar el
--   personal de una sede y al validar el alcance del usuario en sesión.
CREATE INDEX IF NOT EXISTS idx_usuarios_sede ON saas.usuarios(sede_id) WHERE sede_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendedores_sede ON saas.vendedores(sede_id) WHERE sede_id IS NOT NULL;

-- ganadores: el detalle de un sorteo y la consulta pública recorren estas FKs.
CREATE INDEX IF NOT EXISTS idx_ganadores_sorteo ON saas.ganadores(sorteo_id);
CREATE INDEX IF NOT EXISTS idx_ganadores_rifa ON saas.ganadores(rifa_id);

-- sorteos.rifa_id: premiosPendientes/listarSorteos filtran por rifa. El único
--   índice existente es UNIQUE(rifa_id, premio_id), que sirve de prefijo, pero
--   sorteos.tenant_id (usado junto a rifa_id) no tenía ninguno.
CREATE INDEX IF NOT EXISTS idx_sorteos_tenant ON saas.sorteos(tenant_id);

-- usuario_permisos.permiso_id / roles_permisos.permiso_id: lado inverso de la
--   relación (borrar un permiso, y el JOIN de permisos efectivos en la sesión).
CREATE INDEX IF NOT EXISTS idx_usuario_permisos_permiso ON saas.usuario_permisos(permiso_id);
CREATE INDEX IF NOT EXISTS idx_roles_permisos_permiso ON saas.roles_permisos(permiso_id);

-- solicitudes_boleta.rifa_id: JOIN con rifas en los tres listados de traspasos.
CREATE INDEX IF NOT EXISTS idx_solicitudes_rifa ON saas.solicitudes_boleta(rifa_id);

-- liquidaciones.tenant_id: estado de comisiones por empresa.
CREATE INDEX IF NOT EXISTS idx_liquidaciones_tenant ON saas.liquidaciones(tenant_id);

-- ventas.creado_en: cartera y tramos de mora ordenan/filtran por antigüedad.
CREATE INDEX IF NOT EXISTS idx_ventas_tenant_creado ON saas.ventas(tenant_id, creado_en DESC);

-- ===========================================================================
-- B) INTEGRIDAD MULTI-TENANT (FKs compuestas)
--    Requieren un UNIQUE (id, tenant_id) en la tabla referenciada. Como `id` ya
--    es PK, ese UNIQUE es redundante para unicidad pero es lo que permite
--    referenciarlo desde una FK compuesta. Con MATCH SIMPLE (el de por defecto),
--    si la columna opcional es NULL la restricción no se evalúa: sede_id y
--    vendedor_id nulos siguen siendo válidos.
-- ===========================================================================
--    Se dejan con la acción de borrado POR DEFECTO (NO ACTION): las FKs simples
--    existentes ya definen la semántica de borrado (CASCADE desde rifas/ventas,
--    restricción desde sedes/vendedores) y NO ACTION se verifica al final de la
--    sentencia, así que no interfiere con esas cascadas ni con purgar_tenant().
CREATE UNIQUE INDEX IF NOT EXISTS uq_sedes_id_tenant      ON saas.sedes(id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendedores_id_tenant ON saas.vendedores(id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_id_tenant   ON saas.clientes(id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rifas_id_tenant      ON saas.rifas(id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ventas_id_tenant     ON saas.ventas(id, tenant_id);

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('usuarios',   'fk_usuarios_sede_tenant',       'sede_id, tenant_id',     'sedes'),
      ('vendedores', 'fk_vendedores_sede_tenant',     'sede_id, tenant_id',     'sedes'),
      ('rifas',      'fk_rifas_sede_tenant',          'sede_id, tenant_id',     'sedes'),
      ('boletas',    'fk_boletas_sede_tenant',        'sede_id, tenant_id',     'sedes'),
      ('boletas',    'fk_boletas_rifa_tenant',        'rifa_id, tenant_id',     'rifas'),
      ('ventas',     'fk_ventas_sede_tenant',         'sede_id, tenant_id',     'sedes'),
      ('ventas',     'fk_ventas_rifa_tenant',         'rifa_id, tenant_id',     'rifas'),
      ('ventas',     'fk_ventas_cliente_tenant',      'cliente_id, tenant_id',  'clientes'),
      ('ventas',     'fk_ventas_vendedor_tenant',     'vendedor_id, tenant_id', 'vendedores'),
      ('talonarios', 'fk_talonarios_rifa_tenant',     'rifa_id, tenant_id',     'rifas'),
      ('talonarios', 'fk_talonarios_vendedor_tenant', 'vendedor_id, tenant_id', 'vendedores'),
      ('abonos',     'fk_abonos_venta_tenant',        'venta_id, tenant_id',    'ventas'),
      ('solicitudes_boleta', 'fk_solicitudes_rifa_tenant', 'rifa_id, tenant_id', 'rifas')
    ) AS v(tabla, nombre, cols, ref)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = r.nombre AND connamespace = 'saas'::regnamespace
    ) THEN
      EXECUTE format(
        'ALTER TABLE saas.%I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES saas.%I(id, tenant_id)',
        r.tabla, r.nombre, r.cols, r.ref);
    END IF;
  END LOOP;
END $$;

-- ===========================================================================
-- C) CHECKs de dominio
-- ===========================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- Cupo de usuarios: NULL = sin cap explícito; 0 o negativo no tiene sentido.
      ('tenants',           'tenants_max_usuarios_chk',      'max_usuarios IS NULL OR max_usuarios >= 1'),
      -- Precios del plan y cupos de sede configurables por el super-admin.
      ('plataforma_config', 'plataforma_precios_chk',
        'precio_basico_mensual >= 0 AND precio_basico_semestral >= 0 AND precio_basico_anual >= 0'),
      ('plataforma_config', 'plataforma_sedes_chk',          'sedes_basico >= 1 AND sedes_corporativo >= 1'),
      -- Facturación: el monto puede ser 0 (corporativo "a medida") pero nunca negativo.
      ('facturas',          'facturas_monto_chk',            'monto >= 0'),
      -- El saldo de una venta nunca es negativo ni supera lo facturado.
      ('ventas',            'ventas_saldo_chk',              'saldo >= 0 AND saldo <= total'),
      -- Base de liquidación de comisiones.
      ('liquidaciones',     'liquidaciones_base_chk',        'base_recaudado >= 0 AND pct_comision BETWEEN 0 AND 100'),
      -- Cuotas del calendario de vencimientos.
      ('vencimientos',      'vencimientos_numero_chk',       'numero >= 1'),
      -- Una rifa siempre tiene al menos una boleta.
      ('rifas',             'rifas_total_boletas_chk',       'total_boletas > 0'),
      -- Cupo del vendedor: NULL = sin cupo.
      ('vendedores',        'vendedores_cupo_chk',           'cupo_max IS NULL OR cupo_max >= 1'),
      -- Coherencia tipo <-> columna en las solicitudes de traspaso: sin esto la
      -- fila podía declararse 'vendedor' y traer solo solicitante_sede_id.
      ('solicitudes_boleta','solicitudes_solicitante_chk',
        '(solicitante_tipo = ''vendedor'' AND solicitante_vendedor_id IS NOT NULL AND solicitante_sede_id IS NULL)
       OR (solicitante_tipo = ''sede''     AND solicitante_sede_id IS NOT NULL AND solicitante_vendedor_id IS NULL)'),
      ('solicitudes_boleta','solicitudes_propietario_chk',
        '(propietario_tipo = ''vendedor'' AND propietario_vendedor_id IS NOT NULL AND propietario_sede_id IS NULL)
       OR (propietario_tipo = ''sede''     AND propietario_sede_id IS NOT NULL AND propietario_vendedor_id IS NULL)')
    ) AS v(tabla, nombre, expr)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname = r.nombre AND connamespace = 'saas'::regnamespace
    ) THEN
      EXECUTE format('ALTER TABLE saas.%I ADD CONSTRAINT %I CHECK (%s)', r.tabla, r.nombre, r.expr);
    END IF;
  END LOOP;
END $$;
