-- 0011: imagen de la boleta por rifa y obligación de cambiar contraseña temporal.
SET search_path = saas, public;

ALTER TABLE saas.rifas ADD COLUMN IF NOT EXISTS boleta_url TEXT;

ALTER TABLE saas.usuarios
  ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE saas.plataforma_admins
  ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT false;
