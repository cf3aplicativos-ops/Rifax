-- 0023: Permiso para trasladar vendedores (con sus números abonados) de una
-- rifa finalizada a una rifa nueva (punto 13). "Previa autorización del
-- administrador de la empresa" en la solicitud del usuario se traduce en un
-- permiso propio, otorgado SOLO al rol 'admin' (ni gerente ni cajero ni
-- vendedor) — más estricto que 'rifa.editar', que sí tienen gerente/cajero.
-- 100% ADITIVO e idempotente.
SET search_path = saas, public;

INSERT INTO permisos(codigo) VALUES
  ('rifa.trasladar')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO roles_permisos(rol_id, permiso_id)
SELECT r.id, p.id FROM roles r JOIN permisos p ON TRUE
WHERE r.nombre = 'admin' AND p.codigo = 'rifa.trasladar'
ON CONFLICT DO NOTHING;
