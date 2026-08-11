"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { VencimientoCritico } from "@/lib/vencimientos";

// Aviso emergente para el super-admin cuando una o más empresas tienen su
// próximo vencimiento a 5 días o menos (o ya vencido). Mismo criterio y
// estilo que el aviso del lado de la empresa (vencimiento-aviso.tsx).
export default function VencimientoAvisoSuper({ items }: { items: VencimientoCritico[] }) {
  const [abierto, setAbierto] = useState(true);
  const botonRef = useRef<HTMLButtonElement>(null);
  const mostrar = items.length > 0 && abierto;

  // Foco inicial en el diálogo y cierre con Escape (accesibilidad de teclado:
  // un modal que bloquea la pantalla debe poder cerrarse sin usar el ratón).
  useEffect(() => {
    if (!mostrar) return;
    botonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mostrar]);

  if (!mostrar) return null;

  const critico = items.some((i) => i.dias < 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => setAbierto(false)} />
      <div role="dialog" aria-modal="true" aria-labelledby="vencimiento-aviso-super-titulo" className="relative w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span aria-hidden className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl ${critico ? "bg-red-100 dark:bg-red-950/60" : "bg-amber-100 dark:bg-amber-950/60"}`}>
            {critico ? "⛔" : "⏰"}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="vencimiento-aviso-super-titulo" className="text-lg font-bold text-slate-900 dark:text-white">
              {items.length === 1 ? "Una empresa está por vencer" : `${items.length} empresas están por vencer`}
            </h2>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-slate-600 dark:text-slate-400">
              {items.map((i) => (
                <li key={i.tenantId}>
                  <strong className="text-slate-900 dark:text-white">{i.nombre}</strong> —{" "}
                  {i.dias < 0 ? `vencido (${i.fecha})` : i.dias === 0 ? "vence hoy" : `vence en ${i.dias} día${i.dias === 1 ? "" : "s"} (${i.fecha})`}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Link href="/panel" onClick={() => setAbierto(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            Ver empresas
          </Link>
          <button ref={botonRef} onClick={() => setAbierto(false)} className="rounded-lg bg-[#f5c518] px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-[#eab308]">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
