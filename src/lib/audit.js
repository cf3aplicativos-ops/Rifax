'use strict';

/**
 * Registra un evento en la auditoría con hash encadenado.
 * Acepta un cliente de transacción (para escribir en la MISMA transacción
 * que el evento de negocio) o cae al pool si no se pasa cliente.
 */
const { query } = require('./db');

async function auditar(client, {
  actorId = null,
  actorTipo = 'usuario',
  accion,
  entidadTipo,
  entidadId = null,
  antes = null,
  despues = null,
  ip = null,
}) {
  const exec = client ? client.query.bind(client) : query;
  const { rows } = await exec(
    `SELECT registrar_auditoria($1,$2,$3,$4,$5,$6,$7,$8) AS id`,
    [
      actorId,
      actorTipo,
      accion,
      entidadTipo,
      entidadId,
      antes ? JSON.stringify(antes) : null,
      despues ? JSON.stringify(despues) : null,
      ip,
    ]
  );
  return rows[0].id;
}

module.exports = { auditar };
