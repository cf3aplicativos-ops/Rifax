// Crea (o actualiza) el usuario administrador inicial.
// Uso: node scripts/seed-admin.js
// Config por entorno: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NOMBRE.
// Usa `pg` + `bcryptjs` directamente (sin Prisma) para ser un script simple e
// independiente del cliente generado.
require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

(async () => {
  const email = process.env.ADMIN_EMAIL || "admin@rifax.co";
  const password = process.env.ADMIN_PASSWORD || "Admin12345!";
  const nombre = process.env.ADMIN_NOMBRE || "Administrador";

  if (!process.env.DATABASE_URL) {
    throw new Error("Falta DATABASE_URL (corre `vercel env pull .env`).");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const rol = await pool.query("SELECT id FROM roles WHERE nombre = 'admin'");
    if (rol.rowCount === 0) {
      throw new Error("No existe el rol 'admin'. Aplica el esquema 0001_init.sql primero.");
    }
    const rolId = rol.rows[0].id;
    const hash = await bcrypt.hash(password, 12);

    const res = await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol_id, estado)
       VALUES ($1, $2, $3, $4, 'activo')
       ON CONFLICT (correo) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             nombre        = EXCLUDED.nombre,
             rol_id        = EXCLUDED.rol_id,
             estado        = 'activo'
       RETURNING correo`,
      [nombre, email, hash, rolId],
    );
    console.log(`Admin listo: ${res.rows[0].correo}`);
  } finally {
    await pool.end();
  }
})().catch((e) => {
  console.error("Error en seed admin:", e.message);
  process.exit(1);
});
