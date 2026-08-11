-- 0022: Credenciales de integraciones por empresa (punto 7 de la solicitud
-- del usuario): pasarela de pagos Wompi, API de WhatsApp y SMS. Va en una
-- tabla separada de tenant_config (branding) porque son secretos, no datos
-- de presentación: se aislan para poder endurecer permisos/lectura sobre
-- ellos por separado en el futuro sin tocar el branding.
-- 100% ADITIVO e idempotente.
SET search_path = saas, public;

CREATE TABLE IF NOT EXISTS saas.tenant_integraciones (
  tenant_id                 BIGINT PRIMARY KEY REFERENCES saas.tenants(id) ON DELETE CASCADE,
  wompi_sandbox              BOOLEAN NOT NULL DEFAULT true,
  wompi_public_key           TEXT,
  wompi_private_key          TEXT,
  wompi_events_secret        TEXT,
  whatsapp_token              TEXT,
  whatsapp_phone_number_id    TEXT,
  sms_api_key                 TEXT,
  sms_remitente                TEXT,
  actualizado_en              TIMESTAMPTZ NOT NULL DEFAULT now()
);
