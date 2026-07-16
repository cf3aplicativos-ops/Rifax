'use strict';

/**
 * Capa de acceso a datos.
 * Usa node-postgres (pg) con pool. Compatible con Neon sobre TCP
 * (usa la cadena "pooled" de Neon en DATABASE_URL).
 *
 * En funciones serverless de Vercel se puede sustituir por
 * @neondatabase/serverless sin tocar los servicios: solo cambia
 * la implementación de query()/withTransaction() de este módulo.
 */

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Falta la variable de entorno DATABASE_URL');
}

const pool = new Pool({
  connectionString,
  // Neon requiere SSL en producción. En local (sslmode ausente) se desactiva.
  ssl: /sslmode=require/.test(connectionString) ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

/** Ejecuta una consulta simple contra el pool. */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Ejecuta `fn` dentro de una transacción. `fn` recibe un cliente con
 * método .query(). Hace COMMIT si todo va bien, ROLLBACK ante error.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* noop */ }
    throw err;
  } finally {
    client.release();
  }
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, withTransaction, close };
