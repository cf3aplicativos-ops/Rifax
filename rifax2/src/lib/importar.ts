// Carga masiva para arrancar en el aplicativo una rifa YA EN CURSO.
// Reutiliza las validaciones de negocio (anti-doble-venta, aritmética exacta).
//
// Qué se importa para continuar una rifa iniciada:
//   1) La rifa se crea y publica en el aplicativo (nombre, dígitos, precio,
//      fechas, lotería, sede/compartida) y se agregan los premios.
//   2) Vendedores        -> plantilla_vendedores.csv
//   3) Ventas realizadas -> plantilla_ventas.csv  (crea clientes, reserva las
//      boletas vendidas, atribuye la venta al vendedor y registra lo abonado).
import "server-only";
import { prisma } from "@/lib/prisma";
import { crearVendedor } from "@/lib/vendedores";
import { crearVenta, registrarAbono } from "@/lib/ventas";

export interface ResultadoImport {
  total: number;
  ok: number;
  omitidos: number;
  errores: { fila: number; detalle: string }[];
}

// --- Parser CSV mínimo (soporta comillas y comas dentro de campos entre comillas) ---
export function parseCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;
  const s = texto.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (enComillas) {
      if (c === '"') {
        if (s[i + 1] === '"') { campo += '"'; i++; } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((x) => x.trim() !== ""));
}

function indices(header: string[], columnas: string[]): Record<string, number> {
  const norm = header.map((h) => h.trim().toLowerCase());
  const map: Record<string, number> = {};
  for (const col of columnas) map[col] = norm.indexOf(col);
  return map;
}

function expandirNumeros(texto: string): number[] {
  const out = new Set<number>();
  for (const parte of texto.split(/[\s,;]+/).filter(Boolean)) {
    const m = /^(\d+)-(\d+)$/.exec(parte);
    if (m) { const a = Number(m[1]), b = Number(m[2]); for (let n = Math.min(a, b); n <= Math.max(a, b); n++) out.add(n); }
    else if (/^\d+$/.test(parte)) out.add(Number(parte));
  }
  return [...out];
}

// -------- Vendedores --------
export async function importarVendedores(tenantId: bigint, csv: string, actorId: bigint): Promise<ResultadoImport> {
  const filas = parseCsv(csv);
  const res: ResultadoImport = { total: 0, ok: 0, omitidos: 0, errores: [] };
  if (filas.length < 2) { res.errores.push({ fila: 0, detalle: "El archivo no tiene datos." }); return res; }
  const ix = indices(filas[0], ["documento", "nombre", "telefono", "correo", "pct_comision", "cupo_max"]);
  if (ix.documento < 0 || ix.nombre < 0 || ix.telefono < 0) {
    res.errores.push({ fila: 0, detalle: "Faltan columnas obligatorias: documento, nombre, telefono." });
    return res;
  }

  for (let r = 1; r < filas.length; r++) {
    res.total++;
    const f = filas[r];
    const documento = (f[ix.documento] ?? "").trim();
    if (!documento) { res.errores.push({ fila: r + 1, detalle: "Documento vacío." }); continue; }
    const existe = await prisma.vendedores.findFirst({ where: { tenant_id: tenantId, documento }, select: { id: true } });
    if (existe) { res.omitidos++; continue; }
    const correo = (f[ix.correo] ?? "").trim();
    const pct = (f[ix.pct_comision] ?? "").trim();
    const cupo = (f[ix.cupo_max] ?? "").trim();
    const out = await crearVendedor(
      {
        nombre: (f[ix.nombre] ?? "").trim(),
        documento,
        telefono: (f[ix.telefono] ?? "").trim(),
        ...(correo ? { correo } : {}),
        ...(pct ? { pct_comision: pct } : {}),
        ...(cupo ? { cupo_max: cupo } : {}),
      },
      tenantId,
      actorId,
    );
    if (out.ok) res.ok++; else res.errores.push({ fila: r + 1, detalle: out.error });
  }
  return res;
}

// -------- Ventas ya realizadas --------
export async function importarVentas(tenantId: bigint, rifaId: bigint, csv: string, actorId: bigint): Promise<ResultadoImport> {
  const filas = parseCsv(csv);
  const res: ResultadoImport = { total: 0, ok: 0, omitidos: 0, errores: [] };
  if (filas.length < 2) { res.errores.push({ fila: 0, detalle: "El archivo no tiene datos." }); return res; }
  const ix = indices(filas[0], ["numeros", "cliente_documento", "cliente_nombre", "cliente_telefono", "cliente_correo", "vendedor_documento", "abonado", "canal"]);
  if (ix.numeros < 0 || ix.cliente_nombre < 0 || ix.cliente_telefono < 0) {
    res.errores.push({ fila: 0, detalle: "Faltan columnas obligatorias: numeros, cliente_nombre, cliente_telefono." });
    return res;
  }

  // Mapa documento -> vendedor_id.
  const vend = await prisma.vendedores.findMany({ where: { tenant_id: tenantId }, select: { id: true, documento: true } });
  const vmap = new Map(vend.map((v) => [v.documento, v.id]));

  for (let r = 1; r < filas.length; r++) {
    res.total++;
    const f = filas[r];
    const numeros = expandirNumeros(f[ix.numeros] ?? "");
    if (numeros.length === 0) { res.errores.push({ fila: r + 1, detalle: "Sin números de boleta válidos." }); continue; }
    const correo = (f[ix.cliente_correo] ?? "").trim();
    const documento = (f[ix.cliente_documento] ?? "").trim();
    const vendedorDoc = (f[ix.vendedor_documento] ?? "").trim();
    const vendedorId = vendedorDoc ? vmap.get(vendedorDoc) : undefined;
    if (vendedorDoc && !vendedorId) { res.errores.push({ fila: r + 1, detalle: `Vendedor con documento ${vendedorDoc} no existe (impórtalo primero).` }); continue; }

    const venta = await crearVenta(
      {
        rifa_id: String(rifaId),
        numeros,
        cliente: {
          nombre: (f[ix.cliente_nombre] ?? "").trim(),
          telefono: (f[ix.cliente_telefono] ?? "").trim(),
          ...(correo ? { correo } : {}),
          ...(documento ? { documento } : {}),
          consentimiento_datos: true,
        },
        ...(vendedorId ? { vendedor_id: String(vendedorId) } : {}),
        canal: (f[ix.canal] ?? "").trim() || "web",
      },
      tenantId,
      actorId,
      null,
    );
    if (!venta.ok) { res.errores.push({ fila: r + 1, detalle: venta.error }); continue; }

    // Registra lo ya abonado (si aplica).
    const abonado = Number((f[ix.abonado] ?? "0").replace(/[^\d.]/g, ""));
    if (abonado > 0) {
      const ab = await registrarAbono(tenantId, venta.data.ventaId, { monto: abonado, origen: "ajuste" }, actorId);
      if (!ab.ok) { res.errores.push({ fila: r + 1, detalle: `Venta creada pero el abono falló: ${ab.error}` }); }
    }
    res.ok++;
  }
  return res;
}
