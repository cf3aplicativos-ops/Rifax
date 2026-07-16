'use strict';
require('dotenv').config();
const { query, close } = require('../src/lib/db');
const { hashPassword } = require('../src/lib/auth');

(async () => {
  const correo = process.env.ADMIN_EMAIL || 'admin@rifax.co';
  const pass = process.env.ADMIN_PASSWORD || 'Admin12345!';
  const hash = await hashPassword(pass);
  const { rows: rol } = await query(`SELECT id FROM roles WHERE nombre='admin'`);
  if (!rol[0]) throw new Error('Rol admin no existe; corre la migración primero.');
  await query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol_id, estado)
     VALUES ('Administrador', $1, $2, $3, 'activo')
     ON CONFLICT (correo) DO UPDATE SET password_hash=EXCLUDED.password_hash`,
    [correo, hash, rol[0].id]
  );
  console.log(`Admin listo -> ${correo} / ${pass}`);
  await close();
})().catch((e) => { console.error(e.message); process.exit(1); });
