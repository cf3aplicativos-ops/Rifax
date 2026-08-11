-- 0018: Purga de auditoría por antigüedad, con reinicio de cadena documentado.
--
-- La tabla `auditoria` es una cadena de hashes (cada fila incluye el hash de
-- la anterior): borrar filas sin más rompería `verificar_cadena_auditoria()`
-- para siempre, en TODOS los tenants (la cadena es global, no por empresa).
-- En vez de eso: purgar_auditoria() borra lo anterior a una fecha, registra el
-- evento en `auditoria_purgas` (qué se borró, cuántas filas, cuál quedó de
-- primera) y dicho evento vuelve a la propia cadena (encadenado con lo que
-- sobrevivió). verificar_cadena_auditoria() reconoce esos puntos de reinicio:
-- no intenta recalcular el hash de una fila cuyo predecesor real ya no existe
-- (es imposible), pero sigue verificando todo lo demás con normalidad.
SET search_path = saas, public;

CREATE TABLE IF NOT EXISTS saas.auditoria_purgas (
  id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  purgado_hasta            TIMESTAMPTZ NOT NULL,
  filas_borradas           BIGINT NOT NULL,
  primer_id_sobreviviente  BIGINT,
  actor_id                 BIGINT,
  creado_en                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION saas.purgar_auditoria(p_hasta TIMESTAMPTZ, p_actor_id BIGINT)
RETURNS BIGINT
SET search_path = saas, public
AS $$
DECLARE v_borradas BIGINT; v_primer_id BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('auditoria_chain'));

  DELETE FROM auditoria WHERE creado_en < p_hasta;
  GET DIAGNOSTICS v_borradas = ROW_COUNT;

  SELECT id INTO v_primer_id FROM auditoria ORDER BY id ASC LIMIT 1;

  INSERT INTO auditoria_purgas (purgado_hasta, filas_borradas, primer_id_sobreviviente, actor_id)
  VALUES (p_hasta, v_borradas, v_primer_id, p_actor_id);

  -- Deja constancia de la purga en la propia cadena (encadenada con lo que
  -- sobrevivió, o GENESIS si se vació del todo), visible en "recientes".
  PERFORM saas.registrar_auditoria(
    p_actor_id, 'superadmin', 'auditoria.purgar', 'auditoria', NULL,
    NULL, jsonb_build_object('hasta', p_hasta, 'filas_borradas', v_borradas), NULL, NULL
  );

  RETURN v_borradas;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION saas.verificar_cadena_auditoria() RETURNS BIGINT
SET search_path = saas, public
AS $$
DECLARE r RECORD; v_prev TEXT := NULL; v_calc TEXT; v_reinicios BIGINT[];
BEGIN
  -- IDs que son el "primer sobreviviente" de alguna purga: su hash no se
  -- puede recalcular (la fila anterior real ya no existe) — se acepta tal
  -- cual como punto de partida y la verificación continúa desde ahí.
  SELECT array_agg(primer_id_sobreviviente) INTO v_reinicios
    FROM auditoria_purgas WHERE primer_id_sobreviviente IS NOT NULL;

  FOR r IN SELECT * FROM auditoria ORDER BY id ASC LOOP
    IF v_reinicios IS NOT NULL AND r.id = ANY(v_reinicios) THEN
      v_prev := r.hash_encadenado;
      CONTINUE;
    END IF;
    v_calc := encode(digest(
      coalesce(v_prev,'GENESIS')||'|'||coalesce(r.actor_id::text,'')||'|'||coalesce(r.actor_tipo,'')||'|'||
      r.accion||'|'||r.entidad_tipo||'|'||coalesce(r.entidad_id::text,'')||'|'||
      coalesce(r.valores_antes::text,'')||'|'||coalesce(r.valores_despues::text,'')||'|'||r.creado_en::text, 'sha256'), 'hex');
    IF v_calc <> r.hash_encadenado THEN RETURN r.id; END IF;
    v_prev := r.hash_encadenado;
  END LOOP;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
