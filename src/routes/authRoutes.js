'use strict';

const express = require('express');
const { z } = require('zod');
const { query } = require('../lib/db');
const { verifyPassword, signAccessToken, ACCESS_TTL } = require('../lib/auth');
const { Errors } = require('../lib/errors');

const router = express.Router();
const loginSchema = z.object({ correo: z.string().email(), password: z.string().min(1) });

router.post('/login', async (req, res, next) => {
  try {
    const p = loginSchema.safeParse(req.body);
    if (!p.success) throw Errors.unprocessable('Credenciales inválidas', p.error.issues);
    const { correo, password } = p.data;

    const { rows } = await query(
      `SELECT u.id, u.nombre, u.correo, u.password_hash, u.estado, r.nombre AS rol_nombre
         FROM usuarios u JOIN roles r ON r.id = u.rol_id
        WHERE u.correo=$1`, [correo]
    );
    const u = rows[0];
    if (!u || !(await verifyPassword(password, u.password_hash))) {
      throw Errors.unauthorized('Correo o contraseña incorrectos');
    }
    if (u.estado !== 'activo') throw Errors.forbidden('Usuario inactivo o bloqueado');

    await query(`UPDATE usuarios SET ultimo_login=now() WHERE id=$1`, [u.id]);
    const access_token = signAccessToken(u);
    res.json({
      access_token, token_type: 'Bearer', expires_in: ACCESS_TTL,
      usuario: { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol_nombre },
    });
  } catch (err) { next(err); }
});

module.exports = router;
