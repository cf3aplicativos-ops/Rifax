-- 0012: Índices e integridad para columnas/FKs sin cubrir. 100% ADITIVO.
-- Postgres NO crea índices automáticos sobre columnas de clave foránea; estas
-- columnas aparecen en WHERE/JOIN frecuentes (pagos, cartera, portal vendedor,
-- consulta pública, dashboard) y hoy provocan seq scans. Todo idempotente.
SET search_path = saas, public;

-- ---------------------------------------------------------------------------
-- BOLETAS
-- ---------------------------------------------------------------------------
-- boletas.venta_id: usado en cada recálculo de pago/abono y en anular venta
--   (UPDATE saas.boletas ... WHERE venta_id = $1). Tabla grande (una fila por
--   número de rifa) -> el seq scan por venta es costoso.
CREATE INDEX IF NOT EXISTS idx_boletas_venta ON saas.boletas(venta_id)
  WHERE venta_id IS NOT NULL;

-- boletas.talonario_id: portal del vendedor (boletas WHERE talonario_id IN (...)),
--   cierre de talonario y asignación por sede.
CREATE INDEX IF NOT EXISTS idx_boletas_talonario ON saas.boletas(talonario_id)
  WHERE talonario_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- VENTAS
-- ---------------------------------------------------------------------------
-- ventas.vendedor_id: comisiones, top de vendedores (dashboard), cartera por
--   vendedor y portal del vendedor. Ninguno de los índices existentes lo cubre.
CREATE INDEX IF NOT EXISTS idx_ventas_vendedor ON saas.ventas(vendedor_id)
  WHERE vendedor_id IS NOT NULL;

-- ventas.cliente_id: consulta pública de estado de cuenta (ventas por cliente)
--   y JOIN de cartera. Es un FK sin índice.
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON saas.ventas(cliente_id);

-- ---------------------------------------------------------------------------
-- TALONARIOS
-- ---------------------------------------------------------------------------
-- talonarios.rifa_id: verificación de solapamiento de rangos al asignar y
--   listados por rifa. Solo existía índice por vendedor_id.
CREATE INDEX IF NOT EXISTS idx_talonarios_rifa ON saas.talonarios(rifa_id);

-- ---------------------------------------------------------------------------
-- GANADORES
-- ---------------------------------------------------------------------------
-- ganadores.boleta_id: consulta pública (ganadores WHERE boleta_id IN (...))
--   dentro del bucle por venta.
CREATE INDEX IF NOT EXISTS idx_ganadores_boleta ON saas.ganadores(boleta_id)
  WHERE boleta_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- CLIENTES (endpoint público)
-- ---------------------------------------------------------------------------
-- consultarEstadoCuenta busca por (documento, telefono) SIN filtro de tenant
--   (público, sin login). Sin índice es un seq scan sobre TODOS los clientes de
--   TODAS las empresas -> vector de DoS. Índice compuesto sobre las dos claves.
CREATE INDEX IF NOT EXISTS idx_clientes_doc_tel ON saas.clientes(documento, telefono)
  WHERE documento IS NOT NULL;

-- ---------------------------------------------------------------------------
-- VENDEDORES  (integridad 1:1 usuario<->vendedor)
-- ---------------------------------------------------------------------------
-- Un usuario de login (rol vendedor) debe estar vinculado a lo sumo a UN
--   vendedor. El código lo asume (crearAccesoVendedor / vendedorIdDeUsuario con
--   findFirst) pero la BD no lo garantizaba. Índice único parcial: hace cumplir
--   la unicidad y a la vez acelera la búsqueda por usuario_id en cada carga del
--   panel del vendedor. Verificado: 0 duplicados actuales.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendedores_usuario ON saas.vendedores(usuario_id)
  WHERE usuario_id IS NOT NULL;
