'use strict';

const { verifyAccessToken, getPermisos } = require('../lib/auth');
const { query } = require('../lib/db');
const { Errors } = require('../lib/errors');

/** Verifica el JWT y carga el usuario + permisos en req.usuario. */
async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw Errors.unauthorized('Falta el token Bearer');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (_) {
      throw Errors.unauthorized('Token inválido o expirado');
    }

    const { rows } = await query(
      `SELECT u.id, u.nombre, u.correo, u.estado, r.nombre AS rol_nombre
         FROM usuarios u JOIN roles r ON r.id = u.rol_id
        WHERE u.id=$1`,
      [payload.sub]
    );
    const usuario = rows[0];
    if (!usuario) throw Errors.unauthorized('Usuario no existe');
    if (usuario.estado !== 'activo') throw Errors.forbidden('Usuario inactivo o bloqueado');

    usuario.permisos = await getPermisos(usuario.id);
    req.usuario = usuario;
    next();
  } catch (err) {
    next(err);
  }
}

/** Exige que el usuario tenga TODOS los permisos indicados. */
function requirePermiso(...codigos) {
  return (req, _res, next) => {
    if (!req.usuario) return next(Errors.unauthorized());
    const falta = codigos.filter((c) => !req.usuario.permisos.has(c));
    if (falta.length) return next(Errors.forbidden(`Falta(n) permiso(s): ${falta.join(', ')}`));
    next();
  };
}

module.exports = { requireAuth, requirePermiso };
