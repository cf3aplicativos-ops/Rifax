'use strict';

const { AppError, Errors } = require('../lib/errors');

/** Traduce violaciones de restricción de Postgres a errores de dominio. */
function mapPgError(err) {
  if (err && err.code === '23505') {
    // unique_violation
    const c = err.constraint || '';
    if (c.includes('boleta_id')) return Errors.conflict('Una o más boletas ya fueron vendidas', { constraint: c });
    if (c.includes('idem')) return Errors.conflict('Operación duplicada (idempotency-key)', { constraint: c });
    if (c.includes('rifa_id_numero')) return Errors.conflict('Número de boleta duplicado', { constraint: c });
    if (c.includes('telefono')) return Errors.conflict('Cliente con ese teléfono ya existe', { constraint: c });
    if (c.includes('codigo')) return Errors.conflict('Código duplicado', { constraint: c });
    return Errors.conflict('Violación de unicidad', { constraint: c });
  }
  if (err && err.code === '23503') return Errors.unprocessable('Referencia inexistente (FK)', { detail: err.detail });
  if (err && err.code === '23514') return Errors.unprocessable('Violación de restricción CHECK', { detail: err.constraint });
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let appErr = err instanceof AppError ? err : mapPgError(err);
  if (!appErr) {
    // Error no controlado
    console.error('[ERROR]', err);
    appErr = Errors.internal();
  }
  res.status(appErr.status).json(appErr.toJSON());
}

module.exports = { errorHandler };
