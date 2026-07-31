import { NextResponse } from "next/server";

// Descarga de plantillas para la carga masiva de una rifa en curso.
// /api/plantillas?t=vendedores|ventas|guia

const VENDEDORES = `documento,nombre,telefono,correo,pct_comision,cupo_max
12345678,Juan Pérez,3001234567,juan@correo.com,10,500
50111222,María Gómez,3009998888,,8,
`;

const VENTAS = `numeros,cliente_documento,cliente_nombre,cliente_telefono,cliente_correo,vendedor_documento,abonado,canal,fecha_venta
100 101 102,80111222,Carlos Ruiz,3007776666,carlos@correo.com,12345678,30000,web,2026-07-01
200-205,,Ana López,3005554444,,50111222,0,web,2026-07-02
`;

const GUIA = `GUÍA DE CARGA MASIVA — RIFA YA EN CURSO
========================================

Objetivo: continuar en el aplicativo una rifa que ya arrancó por fuera,
importando su estado actual (vendedores y ventas ya realizadas).

PASO 0 — Prepara la rifa en el aplicativo
-----------------------------------------
1. Crea la rifa (Rifas > Nueva rifa): nombre, dígitos por boleta (define el rango
   de números), precio por boleta, fechas (apertura, cierre, sorteo), lotería del
   premio mayor y sede (o "para todas las sedes" si es compartida).
2. Publica la rifa (materializa las boletas).
3. Agrega los premios (mayor y anticipados) en el detalle de la rifa.
4. Si la rifa es compartida, reparte los números por sede antes de importar ventas.

PASO 1 — plantilla_vendedores.csv
---------------------------------
Columnas:
  documento       (obligatorio) documento único del vendedor
  nombre          (obligatorio)
  telefono        (obligatorio)
  correo          (opcional)
  pct_comision    (opcional) porcentaje de comisión, ej: 10
  cupo_max        (opcional) máximo de boletas que puede manejar

PASO 2 — plantilla_ventas.csv (ventas ya realizadas)
----------------------------------------------------
Columnas:
  numeros            (obligatorio) números de boleta vendidos en esa venta.
                     Separados por espacios y/o rangos con guion. Ej: 100 101 102
                     o 200-205. Deben existir y estar disponibles en la rifa.
  cliente_documento  (opcional)
  cliente_nombre     (obligatorio)
  cliente_telefono   (obligatorio) identifica al cliente (único por empresa)
  cliente_correo     (opcional)
  vendedor_documento (opcional) debe coincidir con un vendedor ya importado
  abonado            (opcional) monto ya pagado de esa venta. El sistema calcula
                     el total (precio × cantidad); si abonado >= total la marca pagada.
  canal              (opcional) ej: web, sede, whatsapp
  fecha_venta        (opcional, informativa)

IMPORTAR
--------
En el detalle de la rifa > "Importar (carga masiva)":
  1) Sube primero plantilla_vendedores.csv.
  2) Luego sube plantilla_ventas.csv.
El sistema crea los clientes, reserva las boletas vendidas, atribuye cada venta a
su vendedor y registra lo abonado. Cada archivo muestra un resumen con los errores
por fila (si los hubiera), para que corrijas y reimportes solo lo pendiente.
`;

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t");
  const archivos: Record<string, { nombre: string; tipo: string; contenido: string }> = {
    vendedores: { nombre: "plantilla_vendedores.csv", tipo: "text/csv; charset=utf-8", contenido: VENDEDORES },
    ventas: { nombre: "plantilla_ventas.csv", tipo: "text/csv; charset=utf-8", contenido: VENTAS },
    guia: { nombre: "guia_carga_masiva.txt", tipo: "text/plain; charset=utf-8", contenido: GUIA },
  };
  const a = t ? archivos[t] : undefined;
  if (!a) return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
  return new NextResponse("﻿" + a.contenido, {
    headers: {
      "Content-Type": a.tipo,
      "Content-Disposition": `attachment; filename="${a.nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
