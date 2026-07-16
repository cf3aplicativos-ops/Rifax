'use strict';

const { z } = require('zod');
const { query, withTransaction } = require('../lib/db');
const { auditar } = require('../lib/audit');
const { Errors } = require('../lib/errors');

const crearVentaSchema = z.object({
  rifa_id: z.number().int().positive(),
  numeros: z.array(z.number().int().nonnegative()).min(1),
  cliente: z.object({
    nombre: z.string().min(2),
    telefono: z.string().min(7),
    correo: z.string().email().optional(),
    documento: z.string().optional(),
    consentimiento_datos: z.boolean().optional(),
  }),
  vendedor_id: z.number().int().positive().optional(),
  canal: z.enum(['web', 'whatsapp', 'vendedor', 'pos']).default('web'),
});

function generarCodigoVenta(id) {
  const anio = new Date().getFullYear();
  return `VTA-${anio}-${String(id).padStart(6, '0')}`;
}

/** Upsert de cliente por teléfono (respeta consentimiento). */
async function upsertCliente(client, c) {
  const { rows } = await client.query(
    `INSERT INTO clientes (nombre, telefono, correo, documento, consentimiento_datos)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (telefono) DO UPDATE
       SET nombre = EXCLUDED.nombre,
           correo = COALESCE(EXCLUDED.correo, clientes.correo)
     RETURNING *`,
    [c.nombre, c.telefono, c.correo ?? null, c.documento ?? null, c.consentimiento_datos ?? false]
  );
  return rows[0];
}

/**
 * Crea una venta de N boletas de forma atómica, segura ante concurrencia
 * (SELECT ... FOR UPDATE) e idempotente (Idempotency-Key). Es imposible
 * vender dos veces la misma boleta gracias a:
 *  - el bloqueo pesimista sobre las filas de boletas,
 *  - la validación de estado 'disponible',
 *  - las restricciones UNIQUE(boleta_id) y UNIQUE(idempotency_key) en BD.
 */
async function crearVenta(datos, actor, idempotencyKey) {
  const parsed = crearVentaSchema.safeParse(datos);
  if (!parsed.success) throw Errors.unprocessable('Datos de venta inválidos', parsed.error.issues);
  const d = parsed.data;

  // 1) Idempotencia: si la clave ya existe, devuelve la venta existente
  if (idempotencyKey) {
    const prev = await query(
      `SELECT * FROM ventas WHERE idempotency_key=$1`, [idempotencyKey]
    );
    if (prev.rows[0]) {
      return { venta: prev.rows[0], idempotente: true };
    }
  }

  return withTransaction(async (client) => {
    // 2) Verificar rifa activa
    const rifaRes = await client.query(
      `SELECT * FROM rifas WHERE id=$1`, [d.rifa_id]
    );
    const rifa = rifaRes.rows[0];
    if (!rifa) throw Errors.notFound('Rifa no encontrada');
    if (rifa.estado !== 'activa') {
      throw Errors.conflict(`La rifa no está activa (estado: ${rifa.estado})`);
    }

    // 3) Bloqueo pesimista de las boletas objetivo
    const bo = await client.query(
      `SELECT id, numero, estado FROM boletas
        WHERE rifa_id=$1 AND numero = ANY($2::int[])
        ORDER BY numero
        FOR UPDATE`,
      [d.rifa_id, d.numeros]
    );

    // 3a) ¿Todos los números existen?
    if (bo.rows.length !== d.numeros.length) {
      const encontrados = new Set(bo.rows.map((r) => r.numero));
      const inexistentes = d.numeros.filter((n) => !encontrados.has(n));
      throw Errors.unprocessable('Números fuera de rango o inexistentes', { inexistentes });
    }

    // 3b) ¿Todos disponibles?
    const noDisponibles = bo.rows.filter((r) => r.estado !== 'disponible').map((r) => r.numero);
    if (noDisponibles.length) {
      throw Errors.conflict('Boletas no disponibles', { numeros: noDisponibles });
    }

    // 4) Cliente
    const cliente = await upsertCliente(client, d.cliente);

    // 5) Crear venta
    const total = Number(rifa.precio_boleta) * d.numeros.length;
    const insVenta = await client.query(
      `INSERT INTO ventas
        (codigo, rifa_id, cliente_id, vendedor_id, cantidad, total, saldo,
         estado, canal, idempotency_key, expira_en)
       VALUES ('TMP', $1,$2,$3,$4,$5,$5,'pendiente_pago',$6,$7, now() + interval '30 minutes')
       RETURNING *`,
      [d.rifa_id, cliente.id, d.vendedor_id ?? null, d.numeros.length, total, d.canal, idempotencyKey ?? null]
    );
    let venta = insVenta.rows[0];
    const codigo = generarCodigoVenta(venta.id);
    venta = (await client.query(
      `UPDATE ventas SET codigo=$1 WHERE id=$2 RETURNING *`, [codigo, venta.id]
    )).rows[0];

    // 6) Detalle venta<->boleta (UNIQUE(boleta_id) es la última barrera anti-doble-venta)
    for (const b of bo.rows) {
      await client.query(
        `INSERT INTO ventas_boletas (venta_id, boleta_id, precio)
         VALUES ($1,$2,$3)`,
        [venta.id, b.id, rifa.precio_boleta]
      );
    }

    // 7) Reservar boletas (bloqueo optimista con version)
    await client.query(
      `UPDATE boletas
          SET estado='reservada', venta_id=$1, version=version+1, actualizado_en=now()
        WHERE rifa_id=$2 AND numero = ANY($3::int[])`,
      [venta.id, d.rifa_id, d.numeros]
    );

    // 8) Outbox de notificación (misma transacción → patrón outbox)
    await client.query(
      `INSERT INTO outbox_notificaciones (evento, payload, canal)
       VALUES ('venta.creada', $1, 'whatsapp')`,
      [JSON.stringify({ venta_id: venta.id, codigo: venta.codigo })]
    );

    // 9) Auditoría
    await auditar(client, {
      actorId: actor?.id ?? null, accion: 'venta.crear',
      entidadTipo: 'venta', entidadId: venta.id, antes: null, despues: venta,
    });

    return {
      venta,
      cliente,
      instrucciones_pago: {
        codigo: venta.codigo,
        total: venta.total,
        expira_en: venta.expira_en,
      },
      idempotente: false,
    };
  });
}

/** Registra un abono y recalcula el saldo; si queda en 0, marca 'pagada'. */
async function registrarAbono(ventaId, { monto, origen = 'efectivo' }, actor) {
  if (!(monto > 0)) throw Errors.unprocessable('El monto debe ser positivo');
  return withTransaction(async (client) => {
    const vRes = await client.query(`SELECT * FROM ventas WHERE id=$1 FOR UPDATE`, [ventaId]);
    const venta = vRes.rows[0];
    if (!venta) throw Errors.notFound('Venta no encontrada');
    if (['anulada', 'pagada'].includes(venta.estado)) {
      throw Errors.conflict(`La venta está '${venta.estado}'`);
    }

    await client.query(
      `INSERT INTO abonos (venta_id, origen, monto, registrado_por)
       VALUES ($1,$2,$3,$4)`,
      [ventaId, origen, monto, actor?.id ?? null]
    );

    const nuevoSaldo = Number(venta.saldo) - Number(monto);
    const nuevoEstado = nuevoSaldo <= 0 ? 'pagada' : 'parcial';

    const upd = await client.query(
      `UPDATE ventas SET saldo=GREATEST($1,0), estado=$2 WHERE id=$3 RETURNING *`,
      [nuevoSaldo, nuevoEstado, ventaId]
    );

    // Si quedó pagada, las boletas pasan a 'pagada'
    if (nuevoEstado === 'pagada') {
      await client.query(
        `UPDATE boletas SET estado='pagada', actualizado_en=now()
          WHERE venta_id=$1`, [ventaId]
      );
      await client.query(
        `INSERT INTO outbox_notificaciones (evento, payload, canal)
         VALUES ('venta.pagada', $1, 'whatsapp')`,
        [JSON.stringify({ venta_id: ventaId })]
      );
    }

    await auditar(client, {
      actorId: actor?.id ?? null, accion: 'pago.abono',
      entidadTipo: 'venta', entidadId: ventaId,
      antes: { saldo: venta.saldo, estado: venta.estado },
      despues: { saldo: upd.rows[0].saldo, estado: upd.rows[0].estado },
    });

    return upd.rows[0];
  });
}

/** Anula una venta con motivo, liberando sus boletas. */
async function anularVenta(ventaId, motivo, actor) {
  if (!motivo) throw Errors.unprocessable('El motivo de anulación es obligatorio');
  return withTransaction(async (client) => {
    const vRes = await client.query(`SELECT * FROM ventas WHERE id=$1 FOR UPDATE`, [ventaId]);
    const venta = vRes.rows[0];
    if (!venta) throw Errors.notFound('Venta no encontrada');
    if (venta.estado === 'anulada') throw Errors.conflict('La venta ya está anulada');

    await client.query(
      `UPDATE boletas SET estado='disponible', venta_id=NULL, version=version+1, actualizado_en=now()
        WHERE venta_id=$1`, [ventaId]
    );
    await client.query(`DELETE FROM ventas_boletas WHERE venta_id=$1`, [ventaId]);
    const upd = await client.query(
      `UPDATE ventas SET estado='anulada' WHERE id=$1 RETURNING *`, [ventaId]
    );

    await auditar(client, {
      actorId: actor?.id ?? null, accion: 'venta.anular',
      entidadTipo: 'venta', entidadId: ventaId,
      antes: { estado: venta.estado }, despues: { estado: 'anulada', motivo },
    });

    return upd.rows[0];
  });
}

async function obtenerVenta(ventaId) {
  const { rows } = await query(`SELECT * FROM ventas WHERE id=$1`, [ventaId]);
  if (!rows[0]) throw Errors.notFound('Venta no encontrada');
  const boletas = await query(
    `SELECT b.numero, b.estado FROM ventas_boletas vb
       JOIN boletas b ON b.id = vb.boleta_id
      WHERE vb.venta_id=$1 ORDER BY b.numero`, [ventaId]
  );
  const abonos = await query(
    `SELECT monto, origen, registrado_en FROM abonos WHERE venta_id=$1 ORDER BY id`, [ventaId]
  );
  return { ...rows[0], boletas: boletas.rows, abonos: abonos.rows };
}

module.exports = {
  crearVenta, registrarAbono, anularVenta, obtenerVenta,
};
