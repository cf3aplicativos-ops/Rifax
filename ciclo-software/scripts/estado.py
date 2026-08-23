#!/usr/bin/env python3
"""Lee .ciclo/estado.md y reporta en qué va el proyecto.

Uso:
    python scripts/estado.py [ruta/a/estado.md]

Sin argumento busca .ciclo/estado.md desde el directorio actual hacia arriba.
Sale con código 1 si la etapa actual tiene compuertas pendientes, para poder
usarlo en una canalización si se quiere.
"""

import os
import re
import sys

CHECK = re.compile(r"^\s*-\s*\[( |x|X)\]\s*(.+?)\s*$")
ETAPA = re.compile(r"^###\s*Etapa\s*(\d+)\s*[—\-–:]?\s*(.*)$")
ACTUAL = re.compile(r"^\s*-\s*\*\*Etapa actual\*\*\s*:\s*(\d+)", re.IGNORECASE)
SECCION = re.compile(r"^##\s+(.*)$")


def localizar(arg):
    if arg:
        return arg
    d = os.path.abspath(os.curdir)
    while True:
        c = os.path.join(d, ".ciclo", "estado.md")
        if os.path.exists(c):
            return c
        padre = os.path.dirname(d)
        if padre == d:
            return None
        d = padre


def filas_tabla(lineas):
    """Filas de una tabla markdown que tengan contenido real."""
    out = []
    for ln in lineas:
        s = ln.strip()
        if not s.startswith("|"):
            continue
        celdas = [c.strip() for c in s.strip("|").split("|")]
        if not celdas or set("".join(celdas)) <= set("-: "):
            continue
        if all(not c for c in celdas):
            continue
        cabecera = {"fecha", "supuesto", "decisión", "decision", "qué se saltó", "#"}
        if celdas[0].lower() in cabecera:
            continue
        out.append(celdas)
    return out


def main():
    ruta = localizar(sys.argv[1] if len(sys.argv) > 1 else None)
    if not ruta or not os.path.exists(ruta):
        print("No encuentro el archivo de estado (.ciclo/estado.md).")
        print("Créalo desde assets/estado.plantilla.md antes de empezar.")
        return 2

    with open(ruta, encoding="utf-8") as f:
        lineas = f.read().splitlines()

    etapa_actual = None
    etapas = {}          # num -> {"nombre":..., "items": [(hecho, texto)]}
    secciones = {}       # nombre de sección -> líneas
    seccion = None
    num = None

    for ln in lineas:
        m = ACTUAL.match(ln)
        if m:
            etapa_actual = int(m.group(1))
            continue
        m = SECCION.match(ln)
        if m:
            seccion = m.group(1).strip().lower()
            secciones.setdefault(seccion, [])
            num = None
            continue
        m = ETAPA.match(ln)
        if m:
            num = int(m.group(1))
            etapas[num] = {"nombre": m.group(2).strip(), "items": []}
            continue
        if seccion:
            secciones[seccion].append(ln)
        m = CHECK.match(ln)
        if m and num is not None:
            etapas[num]["items"].append((m.group(1).lower() == "x", m.group(2)))

    print(f"Estado: {ruta}\n")

    for n in sorted(etapas):
        e = etapas[n]
        hechos = sum(1 for h, _ in e["items"] if h)
        total = len(e["items"])
        marca = "»" if n == etapa_actual else " "
        estado = "completa" if total and hechos == total else f"{hechos}/{total}"
        print(f" {marca} Etapa {n} — {e['nombre']}: {estado}")

    if etapa_actual in etapas:
        pend = [t for h, t in etapas[etapa_actual]["items"] if not h]
        print()
        if pend:
            print(f"Compuerta {etapa_actual} pendiente ({len(pend)}):")
            for t in pend:
                print(f"  - {t}")
            print("\nNo avances de etapa hasta cerrar esto o registrar el desvío.")
        else:
            print(f"Compuerta {etapa_actual} cerrada. Puedes avanzar.")

    for titulo, etiqueta in (
        ("supuestos abiertos", "Supuestos sin confirmar"),
        ("desvíos aceptados", "Desvíos vigentes"),
    ):
        filas = filas_tabla(secciones.get(titulo, []))
        if filas:
            print(f"\n{etiqueta} ({len(filas)}):")
            for f in filas:
                print("  - " + " | ".join(c for c in f if c))

    if etapa_actual in etapas:
        return 1 if any(not h for h, _ in etapas[etapa_actual]["items"]) else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
