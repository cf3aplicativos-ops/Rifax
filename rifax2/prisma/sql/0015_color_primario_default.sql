-- 0015: corrige el valor por defecto de tenant_config.color_primario.
-- Quedó en rojo (#dc2626, un color de una iteración de diseño anterior) desde
-- la migración inicial; toda empresa nueva heredaba ese rojo hasta que un
-- administrador entraba a Configuración y lo cambiaba manualmente. La marca
-- de RIFAX es amarilla (#f5c518) en toda la plataforma (login, landing,
-- botones), así que el valor por defecto debe coincidir.
SET search_path = saas, public;

ALTER TABLE saas.tenant_config ALTER COLUMN color_primario SET DEFAULT '#f5c518';
