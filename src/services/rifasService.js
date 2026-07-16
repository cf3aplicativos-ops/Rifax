'use strict';

const { z } = require('zod');
const { query, withTransaction } = require('../lib/db');
const { auditar } = require('../lib/audit');
const { Errors } = require('../lib/errors');

const crearRifaSchema = z.object({
  nombre: z.string().min(3),
  descripcion: z.string().optional(),
  numero_digitos: z.number().int().min(2).max(6),
  precio_boleta: z.number().positive(),
  fecha_apertura: z.string(),        // ISO
  fecha_cierre_ventas: z.string(),   // ISO
  fecha_sorteo: z.string(),          // ISO
  tasa_derechos: z.number().min(0).max(1).optional(),
  premios: z.array(z.object({
    orden: z.number().int().positive(),
    nombre: z.string(),
    valor_estimado: z.number().optional(),
  })).optional(),
});

function generarCodigoRifa(id) {
  const anio = new Date().getFullYear();
  return `RFX-${anio}-${String(id).padStart(4, '0')}`;
}

/** Crea una rifa en estado 'borrador' junto con su plan de premios. */
async function crearRifa(datos, actor) {
  const p = crearRifaSchema.safeParse(datos);
  if (!p.success) throw Errors.unprocessable('Datos de rifa inválidos', p.error.issues);
  const d = p.data;

  const numeroMax = Math.pow(10, d.numero_digitos) - 1;
  const totalBoletas = numeroMax + 1;

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO rifas
        (codigo, nombre, descripcion, numero_digitos, numero_min, numero_max,
         precio_boleta, fecha_apertura, fecha_cierre_ventas, fecha_sorteo,
         tasa_derechos, total_boletas, creado_por)
       VALUES ('TMP', $1,$2,$3,0,$4,$5,$6,$7,$8, COALESCE($9,0.1400), $10, $11)
       RETURNING *`,
      [d.nombre, d.descripcion || null, d.numero_digitos, numeroMax, d.precio_boleta,
       d.fecha_apertura, d.fecha_cierre_ventas, d.fecha_sorteo,
       d.tasa_derechos ?? null, totalBoletas, actor?.id ?? null]
    );
    let rifa = rows[0];

    // Asignar código definitivo basado en el id
    const codigo = generarCodigoRifa(rifa.id);
    const upd = await client.query(
      `UPDATE rifas SET codigo=$1 WHERE id=$2 RETURNING *`, [codigo, rifa.id]
    );
    rifa = upd.rows[0];

    if (d.premios?.length) {
      for (const pr of d.premios) {
        await client.query(
          `INSERT INTO premios (rifa_id, orden, nombre, valor_estimado)
           VALUES ($1,$2,$3,$4)`,
          [rifa.id, pr.orden, pr.nombre, pr.valor_estimado ?? null]
        );
      }
    }

    await auditar(client, {
      actorId: actor?.id ?? null, accion: 'rifa.crear',
      entidadTipo: 'rifa', entidadId: rifa.id, antes: null, despues: rifa,
    });

    return rifa;
  });
}

/**
 * Publica una rifa: materializa todas las boletas del rango en estado
 * 'disponible' de forma transaccional e idempotente, y activa la rifa.
 */
async function publicarRifa(rifaId, actor) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM rifas WHERE id=$1 FOR UPDATE`, [rifaId]
    );
    const rifa = rows[0];
    if (!rifa) throw Errors.notFound('Rifa no encontrada');
    if (rifa.estado !== 'borrador') {
      throw Errors.conflict(`No se puede publicar una rifa en estado '${rifa.estado}'`);
    }

    // Materialización en lote (idempotente: ON CONFLICT no duplica)
    await client.query(
      `INSERT INTO boletas (rifa_id, numero)
       SELECT $1::bigint, g FROM generate_series($2::int, $3::int) AS g
       ON CONFLICT (rifa_id, numero) DO NOTHING`,
      [rifa.id, rifa.numero_min, rifa.numero_max]
    );

    const upd = await client.query(
      `UPDATE rifas SET estado='activa' WHERE id=$1 RETURNING *`, [rifa.id]
    );

    const { rows: cnt } = await client.query(
      `SELECT count(*)::int AS n FROM boletas WHERE rifa_id=$1`, [rifa.id]
    );

    await auditar(client, {
      actorId: actor?.id ?? null, accion: 'rifa.publicar',
      entidadTipo: 'rifa', entidadId: rifa.id,
      antes: { estado: 'borrador' }, despues: { estado: 'activa', boletas: cnt[0].n },
    });

    return { rifa: upd.rows[0], boletas_materializadas: cnt[0].n };
  });
}

async function obtenerRifa(rifaId) {
  const { rows } = await query(`SELECT * FROM rifas WHERE id=$1`, [rifaId]);
  if (!rows[0]) throw Errors.notFound('Rifa no encontrada');
  const premios = await query(
    `SELECT * FROM premios WHERE rifa_id=$1 ORDER BY orden`, [rifaId]
  );
  return { ...rows[0], premios: premios.rows };
}

async function listarRifas() {
  const { rows } = await query(`SELECT * FROM rifas ORDER BY id DESC`);
  return rows;
}

async function boletasDisponibles(rifaId, cantidad = 10) {
  const { rows } = await query(
    `SELECT numero FROM boletas
      WHERE rifa_id=$1 AND estado='disponible'
      ORDER BY numero LIMIT $2`,
    [rifaId, cantidad]
  );
  return rows.map((r) => r.numero);
}

module.exports = {
  crearRifa, publicarRifa, obtenerRifa, listarRifas, boletasDisponibles,
};
