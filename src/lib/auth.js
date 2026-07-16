'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion';
const ACCESS_TTL = Number(process.env.ACCESS_TOKEN_TTL || 900); // 15 min

const BCRYPT_COST = 12;

async function hashPassword(plano) {
  return bcrypt.hash(plano, BCRYPT_COST);
}

async function verifyPassword(plano, hash) {
  return bcrypt.compare(plano, hash);
}

/** Emite un access token JWT con el id de usuario y su rol. */
function signAccessToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, rol: usuario.rol_nombre },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL, algorithm: 'HS256' }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/** Devuelve el set de códigos de permiso de un usuario (para RBAC). */
async function getPermisos(usuarioId) {
  const { rows } = await query(
    `SELECT p.codigo
       FROM usuarios u
       JOIN roles_permisos rp ON rp.rol_id = u.rol_id
       JOIN permisos p ON p.id = rp.permiso_id
      WHERE u.id = $1`,
    [usuarioId]
  );
  return new Set(rows.map((r) => r.codigo));
}

module.exports = {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  getPermisos,
  ACCESS_TTL,
};
