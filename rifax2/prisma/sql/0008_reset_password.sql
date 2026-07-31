-- 0008: Solicitudes de restablecimiento de contraseña.
-- Sin envío de correo: el usuario registra la solicitud y un administrador
-- (super-admin o admin del tenant) restablece la contraseña y le entrega una
-- temporal. La contraseña temporal se muestra UNA sola vez a quien restablece.
SET search_path = saas, public;

CREATE TABLE IF NOT EXISTS saas.reset_solicitudes (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  correo     CITEXT NOT NULL,
  atendida   BOOLEAN NOT NULL DEFAULT false,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reset_pend ON saas.reset_solicitudes(atendida, creado_en);
