-- 0019: Índice para el patrón de consulta "traspaso aprobado de una boleta",
-- introducido esta iteración en dos rutas nuevas:
--   - traspasos.ts / buscarBoleta(): boleta_id = $1 AND estado = 'aprobada'
--     ORDER BY resuelto_en DESC LIMIT 1 (mensaje "Fue un traspaso al vendedor...").
--   - ventas.ts / listarVentas(): boleta_id = ANY($1) AND estado = 'aprobada'
--     DISTINCT ON (boleta_id) ORDER BY boleta_id, resuelto_en DESC (observaciones
--     de traspaso en el listado de ventas, hasta 100 ventas por página).
-- Verificado con EXPLAIN ANALYZE contra la base real: sin índice, ambas rutas
-- hacen Seq Scan sobre saas.solicitudes_boleta (barato hoy con pocas filas,
-- pero crece con cada traspaso resuelto en TODOS los tenants: los índices
-- existentes solo cubren estado='pendiente' o (tenant_id, estado), ninguno
-- sirve para boleta_id + estado='aprobada'). 100% ADITIVO e idempotente.
SET search_path = saas, public;

CREATE INDEX IF NOT EXISTS idx_solicitudes_boleta_aprobada
  ON saas.solicitudes_boleta(boleta_id, resuelto_en DESC)
  WHERE estado = 'aprobada';
