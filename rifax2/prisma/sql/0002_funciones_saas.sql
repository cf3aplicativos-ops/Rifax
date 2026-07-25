-- Recrea las funciones con `SET search_path = saas, public` fijo, para que sus
-- referencias internas sin cualificar (auditoria, tenants) resuelvan al schema
-- saas independientemente del search_path del cliente (el pooler de Neon no
-- permite fijarlo por conexión).
SET search_path TO saas, public;

CREATE OR REPLACE FUNCTION saas.registrar_auditoria(
  p_actor_id BIGINT, p_actor_tipo TEXT, p_accion TEXT, p_entidad_tipo TEXT,
  p_entidad_id BIGINT, p_antes JSONB, p_despues JSONB, p_ip INET DEFAULT NULL,
  p_tenant_id BIGINT DEFAULT NULL
) RETURNS BIGINT
SET search_path = saas, public
AS $$
DECLARE v_prev TEXT; v_hash TEXT; v_id BIGINT; v_ts TIMESTAMPTZ := now();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('auditoria_chain'));
  SELECT hash_encadenado INTO v_prev FROM auditoria ORDER BY id DESC LIMIT 1;
  v_hash := encode(digest(
    coalesce(v_prev,'GENESIS')||'|'||coalesce(p_actor_id::text,'')||'|'||coalesce(p_actor_tipo,'')||'|'||
    p_accion||'|'||p_entidad_tipo||'|'||coalesce(p_entidad_id::text,'')||'|'||
    coalesce(p_antes::text,'')||'|'||coalesce(p_despues::text,'')||'|'||v_ts::text, 'sha256'), 'hex');
  INSERT INTO auditoria(tenant_id, actor_id, actor_tipo, accion, entidad_tipo, entidad_id,
                        valores_antes, valores_despues, ip, hash_encadenado, creado_en)
  VALUES (p_tenant_id, p_actor_id, coalesce(p_actor_tipo,'usuario'), p_accion, p_entidad_tipo,
          p_entidad_id, p_antes, p_despues, p_ip, v_hash, v_ts)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION saas.verificar_cadena_auditoria() RETURNS BIGINT
SET search_path = saas, public
AS $$
DECLARE r RECORD; v_prev TEXT := NULL; v_calc TEXT;
BEGIN
  FOR r IN SELECT * FROM auditoria ORDER BY id ASC LOOP
    v_calc := encode(digest(
      coalesce(v_prev,'GENESIS')||'|'||coalesce(r.actor_id::text,'')||'|'||coalesce(r.actor_tipo,'')||'|'||
      r.accion||'|'||r.entidad_tipo||'|'||coalesce(r.entidad_id::text,'')||'|'||
      coalesce(r.valores_antes::text,'')||'|'||coalesce(r.valores_despues::text,'')||'|'||r.creado_en::text, 'sha256'), 'hex');
    IF v_calc <> r.hash_encadenado THEN RETURN r.id; END IF;
    v_prev := r.hash_encadenado;
  END LOOP;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION saas.purgar_tenant(p_tenant_id BIGINT) RETURNS VOID
SET search_path = saas, public
AS $$
BEGIN
  DELETE FROM tenants WHERE id = p_tenant_id;
END; $$ LANGUAGE plpgsql;
