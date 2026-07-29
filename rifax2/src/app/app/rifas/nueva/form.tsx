"use client";

import { useActionState, useState } from "react";
import { crearRifaAction, type RifaFormState } from "../actions";

const initialState: RifaFormState = {};
const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const etiqueta = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

export default function FormRifa({ sedes, loterias }: { sedes: { id: string; nombre: string }[]; loterias: { valor: string; etiqueta: string }[] }) {
  const [state, action, pending] = useActionState(crearRifaAction, initialState);
  const [digitos, setDigitos] = useState(3);
  const total = Math.pow(10, digitos);

  return (
    <form action={action} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <label htmlFor="sede_id" className={etiqueta}>Sede</label>
        <select id="sede_id" name="sede_id" className={campo}>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nombre" className={etiqueta}>Nombre</label>
          <input id="nombre" name="nombre" required minLength={3} className={campo} />
        </div>
        <div>
          <label htmlFor="loteria" className={etiqueta}>Lotería (premio mayor)</label>
          <select id="loteria" name="loteria" defaultValue="" className={campo}>
            <option value="">— Sin definir —</option>
            {loterias.map((l) => <option key={l.valor} value={l.valor}>{l.etiqueta}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="descripcion" className={etiqueta}>Descripción <span className="text-slate-400">(opcional)</span></label>
        <textarea id="descripcion" name="descripcion" rows={2} className={campo} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="numero_digitos" className={etiqueta}>Dígitos por boleta</label>
          <select id="numero_digitos" name="numero_digitos" value={digitos} onChange={(e) => setDigitos(Number(e.target.value))} className={campo}>
            {[2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{d} dígitos</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{total.toLocaleString("es-CO")} boletas (0 a {(total - 1).toLocaleString("es-CO")})</p>
        </div>
        <div>
          <label htmlFor="precio_boleta" className={etiqueta}>Precio por boleta (COP)</label>
          <input id="precio_boleta" name="precio_boleta" type="number" min="1" step="1" required className={campo} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="fecha_apertura" className={etiqueta}>Apertura</label>
          <input id="fecha_apertura" name="fecha_apertura" type="datetime-local" required className={campo} />
        </div>
        <div>
          <label htmlFor="fecha_cierre_ventas" className={etiqueta}>Cierre ventas</label>
          <input id="fecha_cierre_ventas" name="fecha_cierre_ventas" type="datetime-local" required className={campo} />
        </div>
        <div>
          <label htmlFor="fecha_sorteo" className={etiqueta}>Sorteo</label>
          <input id="fecha_sorteo" name="fecha_sorteo" type="datetime-local" required className={campo} />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p>
      ) : null}

      <button type="submit" disabled={pending} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
        {pending ? "Creando…" : "Crear rifa"}
      </button>
    </form>
  );
}
