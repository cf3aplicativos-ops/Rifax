'use strict';

/** Error de dominio con código HTTP y payload estándar { error: {...} }. */
class AppError extends Error {
  constructor(status, codigo, mensaje, detalles = undefined) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
  toJSON() {
    return { error: { codigo: this.codigo, mensaje: this.message, detalles: this.detalles } };
  }
}

const Errors = {
  badRequest: (msg, det) => new AppError(400, 'BAD_REQUEST', msg, det),
  unauthorized: (msg = 'No autenticado') => new AppError(401, 'UNAUTHORIZED', msg),
  forbidden: (msg = 'Permiso insuficiente') => new AppError(403, 'FORBIDDEN', msg),
  notFound: (msg = 'Recurso no encontrado') => new AppError(404, 'NOT_FOUND', msg),
  conflict: (msg, det) => new AppError(409, 'CONFLICT', msg, det),
  unprocessable: (msg, det) => new AppError(422, 'UNPROCESSABLE', msg, det),
  tooMany: (msg = 'Límite excedido') => new AppError(429, 'RATE_LIMIT', msg),
  internal: (msg = 'Error interno') => new AppError(500, 'INTERNAL', msg),
};

module.exports = { AppError, Errors };
