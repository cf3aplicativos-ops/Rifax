-- 0020: purgar_tenant() con reinicio de cadena documentado (mismo criterio
-- que 0018_purga_auditoria.sql, generalizado para cualquier motivo de hueco).
--
-- Antes: purgar_tenant() borra el tenant, y el ON DELETE CASCADE de
-- auditoria.tenant_id se lleva TODAS sus filas de auditoría — que están
-- entreveradas cronológicamente con las de todos los demás tenants (la
-- cadena de hashes es una sola, global). Cada fila borrada deja un hueco: la
-- fila siguiente (de OTRO tenant) queda con un predecesor que ya no existe,
-- y verificar_cadena_auditoria() la reporta como "alterada" sin serlo. Esto
-- ya pasó silenciosamente cada vez que se purgó un tenant desde que existe
-- el arnés de pruebas funcionales (ver docs/bitacora.md, entrada del
-- 2026-08-08 #11) — sin dejar ningún registro de qué causó el hueco.
--
-- Ahora: purgar_tenant() calcula, ANTES de borrar, qué filas sobrevivientes
-- quedarán con un predecesor inexistente, y las registra en
-- auditoria_reinicios. verificar_cadena_auditoria() las reconoce igual que
-- ya reconoce los puntos de reinicio de auditoria_purgas: no intenta
-- recalcular su hash (es imposible, el predecesor real ya no existe), pero
-- sigue verificando todo lo demás con normalidad.
--
-- Al final de esta migración se hace además una reparación histórica ÚNICA:
-- se recorre la cadena completa y cualquier hueco YA EXISTENTE (causado por
-- una purga de tenant anterior a este fix) se documenta en
-- auditoria_reinicios con motivo 'reparacion_historica_20260808', en vez de
-- quedar como una alteración sin explicar para siempre.
SET search_path = saas, public;

CREATE TABLE IF NOT EXISTS saas.auditoria_reinicios (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auditoria_id BIGINT NOT NULL,
  motivo       TEXT NOT NULL,
  detalle      JSONB,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_reinicios_auditoria_id ON saas.auditoria_reinicios(auditoria_id);

CREATE OR REPLACE FUNCTION saas.purgar_tenant(p_tenant_id BIGINT) RETURNS VOID
SET search_path = saas, public
AS $$
DECLARE v_nombre TEXT; v_slug TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('auditoria_chain'));

  SELECT nombre, slug INTO v_nombre, v_slug FROM tenants WHERE id = p_tenant_id;

  -- Filas SOBREVIVIENTES cuyo predecesor real (por id, en el orden actual)
  -- pertenece al tenant que se va a borrar: quedarán con un hueco detrás.
  INSERT INTO auditoria_reinicios (auditoria_id, motivo, detalle)
  SELECT o.id, 'tenant_eliminado',
         jsonb_build_object('tenant_id', p_tenant_id, 'tenant_nombre', v_nombre, 'tenant_slug', v_slug)
    FROM (SELECT id, tenant_id, LAG(id) OVER (ORDER BY id) AS prev_id FROM auditoria) o
    JOIN auditoria prev ON prev.id = o.prev_id
   WHERE o.tenant_id IS DISTINCT FROM p_tenant_id
     AND prev.tenant_id = p_tenant_id;

  DELETE FROM tenants WHERE id = p_tenant_id;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION saas.verificar_cadena_auditoria() RETURNS BIGINT
SET search_path = saas, public
AS $$
DECLARE r RECORD; v_prev TEXT := NULL; v_calc TEXT; v_reinicios BIGINT[];
BEGIN
  SELECT array_agg(DISTINCT x) INTO v_reinicios FROM (
    SELECT primer_id_sobreviviente AS x FROM auditoria_purgas WHERE primer_id_sobreviviente IS NOT NULL
    UNION
    SELECT auditoria_id AS x FROM auditoria_reinicios
  ) t;

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

-- Reparación histórica única: documenta cualquier hueco ya existente (de
-- purgas de tenant anteriores a este fix) en vez de dejarlo como alteración.
DO $$
DECLARE r RECORD; v_prev TEXT := NULL; v_calc TEXT; v_reinicios BIGINT[];
BEGIN
  SELECT array_agg(DISTINCT x) INTO v_reinicios FROM (
    SELECT primer_id_sobreviviente AS x FROM saas.auditoria_purgas WHERE primer_id_sobreviviente IS NOT NULL
    UNION
    SELECT auditoria_id AS x FROM saas.auditoria_reinicios
  ) t;

  FOR r IN SELECT * FROM saas.auditoria ORDER BY id ASC LOOP
    IF v_reinicios IS NOT NULL AND r.id = ANY(v_reinicios) THEN
      v_prev := r.hash_encadenado;
      CONTINUE;
    END IF;
    v_calc := encode(digest(
      coalesce(v_prev,'GENESIS')||'|'||coalesce(r.actor_id::text,'')||'|'||coalesce(r.actor_tipo,'')||'|'||
      r.accion||'|'||r.entidad_tipo||'|'||coalesce(r.entidad_id::text,'')||'|'||
      coalesce(r.valores_antes::text,'')||'|'||coalesce(r.valores_despues::text,'')||'|'||r.creado_en::text, 'sha256'), 'hex');
    IF v_calc <> r.hash_encadenado THEN
      INSERT INTO saas.auditoria_reinicios (auditoria_id, motivo, detalle)
      VALUES (r.id, 'reparacion_historica_20260808',
              jsonb_build_object('nota', 'Hueco causado por purgar_tenant() antes de que registrara reinicios documentados (ver migracion 0020)'));
      v_reinicios := array_append(v_reinicios, r.id);
    END IF;
    v_prev := r.hash_encadenado;
  END LOOP;
END $$;
