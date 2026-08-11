SET search_path = saas, public;

-- Nuevo permiso: usar la conciliación de pagos asistida por IA (plan Corporativo).
-- Solo admin/gerente: implica registrar abonos a partir de coincidencias sugeridas.
INSERT INTO saas.permisos(codigo) VALUES ('conciliacion.usar') ON CONFLICT (codigo) DO NOTHING;
INSERT INTO saas.roles_permisos(rol_id, permiso_id)
SELECT r.id, p.id FROM saas.roles r, saas.permisos p
WHERE p.codigo = 'conciliacion.usar' AND r.nombre IN ('admin', 'gerente')
ON CONFLICT DO NOTHING;
