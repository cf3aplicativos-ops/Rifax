// Tests de integración contra Neon de la lógica crítica de ventas.
// Se prueba lo que NO se puede verificar a ojo: concurrencia, aritmética
// monetaria y la integridad de la cadena de auditoría.
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { crearRifa, publicarRifa } from "@/lib/rifas";
import { crearVenta, registrarAbono, anularVenta } from "@/lib/ventas";

const TEL_A = "3990000001";
const TEL_B = "3990000002";

let rifaId: bigint;

function clienteDe(telefono: string, nombre: string) {
  return { nombre, telefono, consentimiento_datos: true };
}

beforeAll(async () => {
  // Arrastra restos de corridas anteriores antes de empezar.
  await limpiarDatosDePrueba();

  const iso = (dias: number) => new Date(Date.now() + dias * 86400_000).toISOString();

  const creada = await crearRifa(
    {
      nombre: `TEST rifa ${Date.now()}`,
      numero_digitos: 2, // 100 boletas: rápido de materializar
      precio_boleta: 1000,
      fecha_apertura: new Date().toISOString(),
      fecha_cierre_ventas: iso(5),
      fecha_sorteo: iso(7),
    },
    null,
  );
  if (!creada.ok) throw new Error(`No se pudo crear la rifa de prueba: ${creada.error}`);
  rifaId = creada.rifa.id;

  const publicada = await publicarRifa(rifaId, null);
  if (!publicada.ok) throw new Error(`No se pudo publicar: ${publicada.error}`);
});

afterAll(async () => {
  await limpiarDatosDePrueba();
  await prisma.$disconnect();
});

/**
 * Borra todo el grafo de datos de prueba (rifas 'TEST rifa%' y los clientes de
 * prueba), en orden de dependencias. Es idempotente: también arrastra restos de
 * corridas anteriores que hayan fallado a mitad de camino.
 *
 * La tabla `auditoria` NO se toca: es append-only y su cadena de hashes debe
 * permanecer intacta.
 */
async function limpiarDatosDePrueba() {
  const tels = [TEL_A, TEL_B];
  // Ventas alcanzadas: las de las rifas de prueba y las de los clientes de prueba.
  const alcance = `
    SELECT id FROM ventas
     WHERE rifa_id IN (SELECT id FROM rifas WHERE nombre LIKE 'TEST rifa%')
        OR cliente_id IN (SELECT id FROM clientes WHERE telefono = ANY($1::text[]))`;

  await prisma.$executeRawUnsafe(
    `DELETE FROM ventas_boletas WHERE venta_id IN (${alcance})`,
    tels,
  );
  await prisma.$executeRawUnsafe(`DELETE FROM abonos WHERE venta_id IN (${alcance})`, tels);
  // Soltar la FK boletas.venta_id antes de borrar las ventas.
  await prisma.$executeRawUnsafe(
    `UPDATE boletas SET venta_id = NULL WHERE venta_id IN (${alcance})`,
    tels,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM outbox_notificaciones
      WHERE (payload->>'venta_id')::bigint IN (${alcance})`,
    tels,
  );
  await prisma.$executeRawUnsafe(`DELETE FROM ventas WHERE id IN (${alcance})`, tels);

  await prisma.$executeRawUnsafe(
    `DELETE FROM boletas WHERE rifa_id IN (SELECT id FROM rifas WHERE nombre LIKE 'TEST rifa%')`,
  );
  await prisma.$executeRawUnsafe(
    `DELETE FROM premios WHERE rifa_id IN (SELECT id FROM rifas WHERE nombre LIKE 'TEST rifa%')`,
  );
  await prisma.$executeRawUnsafe(`DELETE FROM rifas WHERE nombre LIKE 'TEST rifa%'`);
  await prisma.$executeRawUnsafe(`DELETE FROM clientes WHERE telefono = ANY($1::text[])`, tels);
}

describe("anti-doble-venta", () => {
  test("dos ventas simultáneas de la misma boleta: solo una gana", async () => {
    const numero = 7;

    const [a, b] = await Promise.all([
      crearVenta(
        { rifa_id: String(rifaId), numeros: [numero], cliente: clienteDe(TEL_A, "Cliente A") },
        null,
      ),
      crearVenta(
        { rifa_id: String(rifaId), numeros: [numero], cliente: clienteDe(TEL_B, "Cliente B") },
        null,
      ),
    ]);

    const exitosas = [a, b].filter((r) => r.ok);
    expect(exitosas).toHaveLength(1);

    // La boleta quedó ligada a exactamente una venta.
    const filas = await prisma.ventas_boletas.findMany({
      where: { boletas: { rifa_id: rifaId, numero } },
    });
    expect(filas).toHaveLength(1);

    const boleta = await prisma.boletas.findFirst({ where: { rifa_id: rifaId, numero } });
    expect(boleta?.estado).toBe("reservada");
  });

  test("no se puede vender una boleta ya reservada", async () => {
    const numero = 11;
    const primera = await crearVenta(
      { rifa_id: String(rifaId), numeros: [numero], cliente: clienteDe(TEL_A, "Cliente A") },
      null,
    );
    expect(primera.ok).toBe(true);

    const segunda = await crearVenta(
      { rifa_id: String(rifaId), numeros: [numero], cliente: clienteDe(TEL_B, "Cliente B") },
      null,
    );
    expect(segunda.ok).toBe(false);
    if (!segunda.ok) expect(segunda.error).toContain("no disponibles");
  });

  test("rechaza números fuera del rango de la rifa", async () => {
    const res = await crearVenta(
      { rifa_id: String(rifaId), numeros: [5000], cliente: clienteDe(TEL_A, "Cliente A") },
      null,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("fuera de rango");
  });
});

describe("idempotencia", () => {
  test("la misma clave no crea una segunda venta", async () => {
    const clave = `test-idem-${Date.now()}`;
    const primera = await crearVenta(
      { rifa_id: String(rifaId), numeros: [21], cliente: clienteDe(TEL_A, "Cliente A") },
      null,
      clave,
    );
    const repetida = await crearVenta(
      { rifa_id: String(rifaId), numeros: [22], cliente: clienteDe(TEL_A, "Cliente A") },
      null,
      clave,
    );

    expect(primera.ok).toBe(true);
    expect(repetida.ok).toBe(true);
    if (primera.ok && repetida.ok) {
      expect(repetida.data.idempotente).toBe(true);
      expect(repetida.data.ventaId).toBe(primera.data.ventaId);
    }

    // La boleta 22 nunca se reservó: la segunda llamada fue idempotente.
    const b22 = await prisma.boletas.findFirst({ where: { rifa_id: rifaId, numero: 22 } });
    expect(b22?.estado).toBe("disponible");
  });
});

describe("aritmética monetaria", () => {
  test("los abonos con centavos no acumulan error de redondeo", async () => {
    // 3 boletas x $1000 = $3000. Se abona en montos con centavos que en
    // aritmética de punto flotante producirían residuos (0.1 + 0.2 != 0.3).
    const venta = await crearVenta(
      { rifa_id: String(rifaId), numeros: [31, 32, 33], cliente: clienteDe(TEL_A, "Cliente A") },
      null,
    );
    expect(venta.ok).toBe(true);
    if (!venta.ok) return;

    const id = venta.data.ventaId;
    expect(venta.data.total).toBe("3000");

    const a1 = await registrarAbono(id, { monto: "1000.10" }, null);
    expect(a1.ok).toBe(true);
    if (a1.ok) expect(a1.data.saldo).toBe("1999.90");

    const a2 = await registrarAbono(id, { monto: "1000.20" }, null);
    expect(a2.ok).toBe(true);
    if (a2.ok) {
      expect(a2.data.saldo).toBe("999.70"); // exacto, sin residuo binario
      expect(a2.data.estado).toBe("parcial");
    }

    const a3 = await registrarAbono(id, { monto: "999.70" }, null);
    expect(a3.ok).toBe(true);
    if (a3.ok) {
      expect(a3.data.saldo).toBe("0.00");
      expect(a3.data.estado).toBe("pagada");
    }

    // Al saldarse, las boletas pasan a 'pagada'.
    const boletas = await prisma.boletas.findMany({ where: { venta_id: id } });
    expect(boletas).toHaveLength(3);
    expect(boletas.every((b) => b.estado === "pagada")).toBe(true);

    // Y se encoló la notificación (patrón outbox).
    const outbox = await prisma.outbox_notificaciones.findMany({
      where: { evento: "venta.pagada" },
    });
    expect(outbox.length).toBeGreaterThan(0);
  });

  test("no acepta abonos de monto cero o negativo", async () => {
    const venta = await crearVenta(
      { rifa_id: String(rifaId), numeros: [41], cliente: clienteDe(TEL_A, "Cliente A") },
      null,
    );
    if (!venta.ok) throw new Error(venta.error);

    expect((await registrarAbono(venta.data.ventaId, { monto: 0 }, null)).ok).toBe(false);
    expect((await registrarAbono(venta.data.ventaId, { monto: -50 }, null)).ok).toBe(false);
  });
});

describe("anulación", () => {
  test("libera las boletas y las deja disponibles de nuevo", async () => {
    const numeros = [51, 52];
    const venta = await crearVenta(
      { rifa_id: String(rifaId), numeros, cliente: clienteDe(TEL_B, "Cliente B") },
      null,
    );
    if (!venta.ok) throw new Error(venta.error);

    const res = await anularVenta(venta.data.ventaId, "prueba automatizada", null);
    expect(res.ok).toBe(true);

    const boletas = await prisma.boletas.findMany({
      where: { rifa_id: rifaId, numero: { in: numeros } },
    });
    expect(boletas.every((b) => b.estado === "disponible")).toBe(true);
    expect(boletas.every((b) => b.venta_id === null)).toBe(true);

    // El detalle se borró, así que las boletas pueden revenderse.
    const detalle = await prisma.ventas_boletas.findMany({
      where: { venta_id: venta.data.ventaId },
    });
    expect(detalle).toHaveLength(0);

    const revendida = await crearVenta(
      { rifa_id: String(rifaId), numeros, cliente: clienteDe(TEL_A, "Cliente A") },
      null,
    );
    expect(revendida.ok).toBe(true);
  });

  test("exige un motivo", async () => {
    const venta = await crearVenta(
      { rifa_id: String(rifaId), numeros: [61], cliente: clienteDe(TEL_A, "Cliente A") },
      null,
    );
    if (!venta.ok) throw new Error(venta.error);

    const res = await anularVenta(venta.data.ventaId, "   ", null);
    expect(res.ok).toBe(false);
  });
});

describe("auditoría", () => {
  test("la cadena de hashes sigue íntegra tras todas las operaciones", async () => {
    const filas = await prisma.$queryRawUnsafe<{ rota: bigint | null }[]>(
      "SELECT verificar_cadena_auditoria() AS rota",
    );
    // null = ningún eslabón alterado.
    expect(filas[0].rota).toBeNull();
  });
});
