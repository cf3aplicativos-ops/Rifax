"use client";

import { useState } from "react";

// Aviso emergente que aparece al abrir la aplicación cuando faltan 3 días o
// menos para el vencimiento del plan (o si ya venció). Al registrar el pago, la
// vigencia se extiende y este aviso deja de mostrarse.
export default function VencimientoAviso({ dias, fecha }: { dias: number; fecha: string }) {
  const [abierto, setAbierto] = useState(true);
  if (dias > 3) return null; // solo dentro de la ventana de 3 días (o vencido)
  if (!abierto) return null;

  const vencido = dias < 0;
  const hoy = dias === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => setAbierto(false)} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl ${vencido ? "bg-red-100 dark:bg-red-950/60" : "bg-amber-100 dark:bg-amber-950/60"}`}>
            {vencido ? "⛔" : "⏰"}
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {vencido ? "Tu plan está vencido" : hoy ? "Tu plan vence hoy" : `Tu plan vence en ${dias} día${dias === 1 ? "" : "s"}`}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {vencido
                ? `El plan venció el ${fecha}. Realiza el pago para evitar la suspensión del servicio.`
                : `El plan vence el ${fecha}. Realiza el pago a tiempo para no interrumpir el servicio.`}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={() => setAbierto(false)} className="rounded-lg bg-[#f5c518] px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-[#eab308]">
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
