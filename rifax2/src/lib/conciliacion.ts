// Conciliación de pagos asistida por IA (plan Corporativo). Tres modos de
// entrada (extracto bancario, reporte de vendedor en texto libre, comprobantes
// de pago en imagen) que convergen en el mismo paso: la IA solo SUGIERE a qué
// venta con saldo pendiente corresponde cada pago; nada se registra en el
// sistema hasta que un administrador revisa y confirma explícitamente
// (ver `aplicarConciliacion`, siempre una acción separada de `analizar*`).
import "server-only";
import { getDocumentProxy, extractText } from "unpdf";
import { prisma } from "@/lib/prisma";
import { capacidades } from "@/lib/planes";
import { preguntarJSON, iaDisponible } from "@/lib/ia";
import { registrarAbono } from "@/lib/ventas";
import { auditar } from "@/lib/audit";

const MAX_TEXTO_PDF = 20_000; // caracteres; suficiente para varios cientos de movimientos

type Resultado<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
type ResultadoConDatos<T> = { ok: true; data: T } | { ok: false; error: string };

export interface CandidatoCartera { ventaId: string; codigo: string; cliente: string; telefono: string; saldo: number }

export interface Sugerencia {
  entradaId: string;
  descripcionOriginal: string;
  montoOriginal: number;
  fechaOriginal: string | null;
  ventaId: string | null;
  ventaCodigo: string | null;
  clienteSugerido: string | null;
  saldoVenta: number | null;
  confianza: number; // 0 a 100
  motivo: string;
}

interface EntradaCruda { id: string; descripcion: string; monto: number; fecha: string | null }

async function verificarDisponible(tenantId: bigint): Promise<Resultado> {
  const filas = await prisma.$queryRawUnsafe<{ plan: string }[]>(`SELECT plan FROM saas.tenants WHERE id=$1::bigint`, tenantId);
  if (!capacidades(filas[0]?.plan).conciliacionIA) {
    return { ok: false, error: "La conciliación con IA está disponible en el plan Corporativo." };
  }
  if (!iaDisponible()) {
    return { ok: false, error: "La conciliación con IA no está configurada en la plataforma. Contacta al administrador." };
  }
  return { ok: true };
}

async function candidatosCartera(tenantId: bigint, vendedorId: bigint | null): Promise<CandidatoCartera[]> {
  const filas = await prisma.$queryRawUnsafe<{ venta_id: bigint; codigo: string; cliente: string; telefono: string; saldo: string }[]>(
    `SELECT v.id AS venta_id, v.codigo, cl.nombre AS cliente, cl.telefono, v.saldo::text AS saldo
       FROM saas.ventas v JOIN saas.clientes cl ON cl.id = v.cliente_id
      WHERE v.tenant_id=$1::bigint AND v.estado IN ('pendiente_pago','parcial') AND v.saldo > 0
        AND ($2::bigint IS NULL OR v.vendedor_id = $2::bigint)
      ORDER BY v.creado_en DESC
      LIMIT 300`,
    tenantId, vendedorId,
  );
  return filas.map((f) => ({ ventaId: String(f.venta_id), codigo: f.codigo, cliente: f.cliente, telefono: f.telefono, saldo: Number(f.saldo) }));
}

async function emparejar(entradas: EntradaCruda[], candidatos: CandidatoCartera[]): Promise<Resultado<Sugerencia[]>> {
  if (entradas.length === 0) return { ok: false, error: "No se detectaron movimientos para analizar." };
  if (candidatos.length === 0) return { ok: false, error: "No hay cartera pendiente para conciliar." };

  const prompt =
    "Eres un asistente de conciliación de pagos para un sistema de venta de rifas.\n" +
    "Te doy una lista de MOVIMIENTOS (pagos recibidos) y una lista de CUENTAS PENDIENTES (ventas con saldo).\n" +
    "Para cada movimiento, identifica la cuenta pendiente que más probablemente le corresponde, comparando el " +
    "monto y el nombre/descripción contra el nombre del cliente. Los nombres pueden venir incompletos, mal " +
    "escritos, en otro orden, o solo con parte del nombre. Si el monto no coincide razonablemente con ninguna " +
    "cuenta, o no hay ningún nombre parecido, deja ventaId en null.\n" +
    'Responde EXCLUSIVAMENTE un JSON con esta forma: {"sugerencias": [{"entradaId": string, "ventaId": string|null, "confianza": number (0 a 100), "motivo": string corto en español}]}\n\n' +
    `MOVIMIENTOS:\n${JSON.stringify(entradas)}\n\nCUENTAS PENDIENTES:\n${JSON.stringify(candidatos)}`;

  const r = await preguntarJSON<{ sugerencias: { entradaId: string; ventaId: string | null; confianza: number; motivo: string }[] }>([
    { role: "system", content: "Respondes únicamente JSON válido, sin texto adicional ni explicaciones fuera del JSON." },
    { role: "user", content: prompt },
  ]);
  if (!r.ok) return r;

  const porId = new Map(candidatos.map((c) => [c.ventaId, c]));
  const entradaPorId = new Map(entradas.map((e) => [e.id, e]));
  const sugerencias: Sugerencia[] = (r.data.sugerencias ?? []).map((s) => {
    const cand = s.ventaId ? (porId.get(String(s.ventaId)) ?? null) : null;
    const ent = entradaPorId.get(s.entradaId);
    return {
      entradaId: s.entradaId,
      descripcionOriginal: ent?.descripcion ?? "",
      montoOriginal: ent?.monto ?? 0,
      fechaOriginal: ent?.fecha ?? null,
      ventaId: cand?.ventaId ?? null,
      ventaCodigo: cand?.codigo ?? null,
      clienteSugerido: cand?.cliente ?? null,
      saldoVenta: cand?.saldo ?? null,
      confianza: Math.max(0, Math.min(100, Number(s.confianza) || 0)),
      motivo: s.motivo ?? "",
    };
  });
  return { ok: true, data: sugerencias };
}

// Extrae movimientos de pago desde un texto libre (informal o extraído de un
// PDF) usando IA, cuando el formato no es lo bastante regular para un parseo
// determinístico simple.
async function extraerEntradasConIA(texto: string, instruccion: string, prefijoId: string): Promise<ResultadoConDatos<EntradaCruda[]>> {
  const r = await preguntarJSON<{ entradas: { descripcion: string; monto: number; fecha: string | null }[] }>([
    { role: "system", content: "Extraes movimientos de pago desde un texto y respondes solo JSON." },
    {
      role: "user",
      content:
        `${instruccion} ` +
        'Responde EXCLUSIVAMENTE: {"entradas":[{"descripcion":string,"monto":number,"fecha":string|null}]}\n\n' +
        `TEXTO:\n${texto}`,
    },
  ]);
  if (!r.ok) return r;
  const entradas: EntradaCruda[] = (r.data.entradas ?? []).map((e, i) => ({
    id: `${prefijoId}-${i}`, descripcion: e.descripcion, monto: Number(e.monto) || 0, fecha: e.fecha,
  }));
  return { ok: true, data: entradas };
}

async function extraerTextoPdf(buffer: Buffer): Promise<ResultadoConDatos<string>> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const limpio = text.replace(/[ \t]+/g, " ").trim();
    if (!limpio) return { ok: false, error: "El PDF no tiene texto legible (parece ser una imagen escaneada). Pega los movimientos como texto en su lugar." };
    return { ok: true, data: limpio.slice(0, MAX_TEXTO_PDF) };
  } catch {
    return { ok: false, error: "No se pudo leer el archivo PDF. Verifica que no esté dañado ni protegido con contraseña." };
  }
}

// Reconoce un campo por vez sobre la línea COMPLETA (no columnas ya
// separadas por coma): las fechas van primero porque son más específicas que
// los patrones numéricos genéricos, así "2026-01-05" o "05/01/2026" se
// reconocen como un solo campo en vez de fragmentarse en varios números
// sueltos; luego los montos, con soporte para separador de miles Y decimal
// en cualquier orden ("50.000,00" formato colombiano, o "50,000.00"); el
// resto del texto entre separadores es descripción.
const TOKEN_EXTRACTO = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|-?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|-?\d+(?:[.,]\d{1,2})?|[^,;\t]+/g;

// El ÚLTIMO separador (. o ,) seguido de 1 o 2 dígitos hasta el final del
// token se interpreta como el decimal (cubre "50.000,00" y "50,000.00" por
// igual); cualquier separador anterior es de miles y se descarta.
function normalizarMonto(raw: string): number {
  const negativo = raw.startsWith("-");
  const s = negativo ? raw.slice(1) : raw;
  const m = s.match(/[.,](\d{1,2})$/);
  const entero = (m ? s.slice(0, s.length - m[0].length) : s).replace(/[.,]/g, "");
  const decimales = m ? m[1] : "";
  const num = Number(entero + (decimales ? "." + decimales : ""));
  return negativo ? -num : num;
}

// ---- Modo 1 (recomendado): extracto bancario -------------------------------
// Exportada (además de usarse internamente) para poder probar de forma
// determinista, sin IA ni base de datos, los casos borde del parseo: montos
// con separador de miles y/o decimal, fechas en distintos formatos y líneas
// sin monto reconocible.
export function parsearExtracto(texto: string): EntradaCruda[] {
  const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const entradas: EntradaCruda[] = [];
  const esFecha = (t: string) => /^\d{4}-\d{2}-\d{2}$/.test(t) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(t);
  const esNumero = (t: string) => /^-?\d[\d.,]*$/.test(t);

  lineas.forEach((linea, i) => {
    const tokens = linea.match(TOKEN_EXTRACTO) ?? [];
    const fecha = tokens.find(esFecha) ?? null;
    const candidatosMonto = tokens.filter((t) => t !== fecha && esNumero(t));
    const montoStr = candidatosMonto[candidatosMonto.length - 1];
    if (!montoStr) return;
    const monto = Math.abs(normalizarMonto(montoStr));
    if (!monto || Number.isNaN(monto)) return;
    const descripcion = tokens.filter((t) => t !== fecha && t !== montoStr).join(" ").trim() || linea;
    entradas.push({ id: `ext-${i}`, descripcion, monto, fecha });
  });
  return entradas;
}

export async function analizarExtracto(tenantId: bigint, texto: string): Promise<Resultado<Sugerencia[]>> {
  const v = await verificarDisponible(tenantId);
  if (!v.ok) return v;
  const entradas = parsearExtracto(texto);
  if (entradas.length === 0) {
    return { ok: false, error: "No se reconoció ningún movimiento válido. Pega una línea por movimiento, con fecha, descripción y monto separados por coma." };
  }
  const candidatos = await candidatosCartera(tenantId, null);
  return emparejar(entradas, candidatos);
}

// Extracto bancario subido como PDF: se extrae el texto y, como el diseño de
// cada banco varía mucho (columnas, saltos de línea), se usa IA para
// reconocer los movimientos en vez del parseo determinístico de líneas.
export async function analizarExtractoPdf(tenantId: bigint, buffer: Buffer): Promise<Resultado<Sugerencia[]>> {
  const v = await verificarDisponible(tenantId);
  if (!v.ok) return v;

  const texto = await extraerTextoPdf(buffer);
  if (!texto.ok) return texto;

  const entradas = await extraerEntradasConIA(
    texto.data,
    "Este texto fue extraído de un extracto bancario en PDF (el diseño de columnas puede haberse desordenado " +
    "al extraer el texto). Identifica cada movimiento de pago recibido, con su descripción/remitente y monto.",
    "pdf",
  );
  if (!entradas.ok) return entradas;
  if (entradas.data.length === 0) return { ok: false, error: "No se identificaron movimientos en el PDF." };

  const candidatos = await candidatosCartera(tenantId, null);
  return emparejar(entradas.data, candidatos);
}

// ---- Modo 2: reporte de vendedor (texto libre) -----------------------------
export async function analizarReporteVendedor(tenantId: bigint, vendedorId: bigint, texto: string): Promise<Resultado<Sugerencia[]>> {
  const v = await verificarDisponible(tenantId);
  if (!v.ok) return v;
  if (!texto.trim()) return { ok: false, error: "Pega el reporte del vendedor." };

  const entradas = await extraerEntradasConIA(
    texto,
    "Lee este reporte de un vendedor de rifas (por ejemplo copiado de WhatsApp) y extrae cada pago mencionado " +
    "(a quién corresponde y el monto).",
    "rep",
  );
  if (!entradas.ok) return entradas;
  if (entradas.data.length === 0) return { ok: false, error: "No se identificaron pagos en el texto." };
  const candidatos = await candidatosCartera(tenantId, vendedorId);
  return emparejar(entradas.data, candidatos);
}

// ---- Modo 3: comprobantes de pago (imagen) ---------------------------------
export async function analizarComprobantes(tenantId: bigint, imagenesDataUrl: string[]): Promise<Resultado<Sugerencia[]>> {
  const v = await verificarDisponible(tenantId);
  if (!v.ok) return v;
  if (imagenesDataUrl.length === 0) return { ok: false, error: "Sube al menos un comprobante." };

  const contenido = [
    {
      type: "text" as const,
      text:
        "Observa estas imágenes de comprobantes de pago (transferencias, consignaciones). Para cada una, en el " +
        "mismo orden en que aparecen, extrae el monto pagado y, si aparece, el nombre del remitente/pagador y la " +
        'fecha. Responde EXCLUSIVAMENTE: {"entradas":[{"descripcion":string (nombre o referencia visible),"monto":number,"fecha":string|null}]}',
    },
    ...imagenesDataUrl.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];

  const r = await preguntarJSON<{ entradas: { descripcion: string; monto: number; fecha: string | null }[] }>(
    [
      { role: "system", content: "Extraes datos de comprobantes de pago a partir de imágenes y respondes solo JSON." },
      { role: "user", content: contenido },
    ],
    { vision: true },
  );
  if (!r.ok) return r;
  const entradas: EntradaCruda[] = (r.data.entradas ?? []).map((e, i) => ({ id: `cmp-${i}`, descripcion: e.descripcion, monto: Number(e.monto) || 0, fecha: e.fecha }));
  if (entradas.length === 0) return { ok: false, error: "No se pudo leer información de los comprobantes." };
  const candidatos = await candidatosCartera(tenantId, null);
  return emparejar(entradas, candidatos);
}

// ---- Confirmación (paso separado y explícito, nunca automático) -----------
export async function aplicarConciliacion(
  tenantId: bigint,
  modo: "extracto" | "reporte" | "comprobante",
  aprobadas: { ventaId: string; monto: number }[],
  actorId: bigint,
): Promise<Resultado<{ aplicadas: number; total: number; fallidas: number }>> {
  const v = await verificarDisponible(tenantId);
  if (!v.ok) return v;
  if (aprobadas.length === 0) return { ok: false, error: "No seleccionaste ninguna coincidencia para aplicar." };

  let aplicadas = 0;
  let total = 0;
  const errores: string[] = [];
  for (const a of aprobadas) {
    if (!(Number(a.monto) > 0)) continue;
    const r = await registrarAbono(tenantId, BigInt(a.ventaId), { monto: a.monto, origen: "comprobante" }, actorId);
    if (r.ok) {
      aplicadas++;
      total += Number(a.monto);
    } else {
      errores.push(`Venta ${a.ventaId}: ${r.error}`);
    }
  }

  if (aplicadas === 0) {
    return { ok: false, error: errores[0] ?? "No se pudo registrar ningún abono." };
  }

  await auditar(prisma, {
    tenantId, actorId, accion: "pago.conciliacion_ia",
    entidadTipo: "cartera", entidadId: null,
    despues: { modo, aplicadas, total, errores: errores.length || undefined },
  });

  return { ok: true, data: { aplicadas, total, fallidas: errores.length } };
}
