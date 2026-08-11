-- 0021: Permiso para registrar el abono/pago de una venta de OTRA sede desde
-- la oficina (punto 14 de la solicitud del usuario). Antes, `ventaEnAlcance`
-- bloqueaba por completo (404) el acceso a cualquier venta fuera de la sede
-- del usuario, sin excepción — no había forma de cobrar un abono de una
-- venta de otra sede aunque el cliente estuviera físicamente en esta oficina.
-- Se agrega un permiso NUEVO y explícito (no se reutiliza `pago.registrar`)
-- para que esta capacidad cruce sedes solo donde el tenant lo autorice
-- explícitamente por rol/usuario, vía el mecanismo de permisos ya existente
-- (roles_permisos / usuario_permisos). NO se otorga a 'vendedor': la
-- restricción de negocio pedida es "solo en la oficina". 100% ADITIVO e
-- idempotente.
SET search_path = saas, public;

INSERT INTO permisos(codigo) VALUES
  ('pago.registrar_otra_sede')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO roles_permisos(rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON TRUE
WHERE r.nombre IN ('admin', 'gerente', 'cajero')
  AND p.codigo = 'pago.registrar_otra_sede'
ON CONFLICT DO NOTHING;
