-- 0025: Token de un solo uso para "olvidé mi contraseña" (cierra el hallazgo
-- de seguridad pendiente desde el 2026-08-04 en docs/bitacora.md: hasta ahora
-- una sola petición de reset ya cambiaba la contraseña del titular en el
-- acto, mitigado solo por rate-limit. Con esta tabla, la petición solo genera
-- un token que expira y se consume una vez; el cambio real de contraseña
-- ocurre al confirmarlo, no al solicitarlo.
SET search_path = saas, public;

CREATE TABLE IF NOT EXISTS saas.reset_tokens (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  correo     CITEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expira_en  TIMESTAMPTZ NOT NULL,
  usado      BOOLEAN NOT NULL DEFAULT false,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solo se consulta por hash al confirmar; el índice parcial evita indexar
-- filas ya usadas/expiradas, que no se vuelven a buscar.
CREATE INDEX IF NOT EXISTS idx_reset_tokens_vigentes
  ON saas.reset_tokens(token_hash) WHERE usado = false;
