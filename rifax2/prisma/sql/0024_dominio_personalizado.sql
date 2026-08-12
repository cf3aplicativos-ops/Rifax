-- 0024: Dominio propio por empresa (punto 4b). Se guarda en tenant_config
-- (junto al resto del branding) porque es un dato de presentación, no un
-- secreto. La conexión real del dominio en Vercel NO se automatiza (decisión
-- del usuario, 2026-08-11): esta columna solo registra qué dominio quiere la
-- empresa y alimenta la pantalla de instrucciones DNS.
-- 100% ADITIVO e idempotente.
SET search_path = saas, public;

ALTER TABLE saas.tenant_config ADD COLUMN IF NOT EXISTS dominio_personalizado TEXT;
