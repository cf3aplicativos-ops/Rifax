"use client";

import { useState } from "react";
import { asignarTalonarioAction } from "../actions";

interface Rifa { id: string; codigo: string; nombre: string; min: number; max: number }
const inp = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export default function FormAsignarTalonario({ vendedorId, rifas, sedeVendedor }: { vendedorId: string; rifas: Rifa[]; sedeVendedor: string | null }) {
  const [tipo, setTipo] = useState<"consecutiva" | "aleatoria" | "especificas">("consecutiva");

  return (
    <form action={asignarTalonarioAction} className="mt-8 space-y-3 rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Asignar talonario</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {sedeVendedor
          ? <>Solo se le podrán asignar boletas de la sede <strong>{sedeVendedor}</strong>.</>
          : <>Este vendedor está asignado a <strong>todas las sedes</strong>: se le pueden asignar boletas de cualquier sede.</>}
      </p>
      <input type="hidden" name="vendedor_id" value={vendedorId} />

      <select name="rifa_id" className={inp}>
        {rifas.map((r) => <option key={r.id} value={r.id}>{r.codigo} — {r.nombre} ({r.min}–{r.max})</option>)}
      </select>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="tipo" value="consecutiva" checked={tipo === "consecutiva"} onChange={() => setTipo("consecutiva")} />
          Serie consecutiva
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="tipo" value="aleatoria" checked={tipo === "aleatoria"} onChange={() => setTipo("aleatoria")} />
          Aleatoria
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="tipo" value="especificas" checked={tipo === "especificas"} onChange={() => setTipo("especificas")} />
          Las que solicite
        </label>
      </div>

      {tipo === "consecutiva" ? (
        <div className="grid grid-cols-2 gap-4">
          <input name="inicio" type="number" min="0" step="1" required placeholder="Número inicial" className={inp} />
          <input name="fin" type="number" min="0" step="1" required placeholder="Número final" className={inp} />
        </div>
      ) : tipo === "aleatoria" ? (
        <div>
          <input name="cantidad" type="number" min="1" step="1" required placeholder="Cantidad de boletas al azar" className={inp} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Se asignarán N boletas disponibles elegidas al azar (no consecutivas).</p>
        </div>
      ) : (
        <div>
          <input name="numeros" required placeholder="Números solicitados, ej: 7, 15, 42, 100-110" className={inp} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Escribe los números exactos que pidió el vendedor. Admite rangos con guion (100-110).</p>
        </div>
      )}

      <button type="submit" className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Asignar</button>
    </form>
  );
}
