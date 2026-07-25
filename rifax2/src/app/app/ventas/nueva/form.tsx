"use client";

import { useActionState, useMemo, useState } from "react";
import { crearVentaAction, type VentaFormState } from "../actions";

interface Rifa {
  id: string;
  codigo: string;
  nombre: string;
  precio: string;
  numeroMin: number;
  numeroMax: number;
  sugeridos: number[];
}

const initialState: VentaFormState = {};
const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const etiqueta = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";
const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default function FormVenta({ rifas }: { rifas: Rifa[] }) {
  const [state, action, pending] = useActionState(crearVentaAction, initialState);
  const [rifaId, setRifaId] = useState(rifas[0]?.id ?? "");
  const [numeros, setNumeros] = useState("");
  const [idem] = useState(() => globalThis.crypto.randomUUID());

  const rifa = useMemo(() => rifas.find((r) => r.id === rifaId), [rifas, rifaId]);
  const unicos = useMemo(
    () => [...new Set(numeros.split(/[\s,]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0))],
    [numeros],
  );
  const total = rifa ? Number(rifa.precio) * unicos.length : 0;

  function agregar(n: number) {
    setNumeros((prev) => {
      const a = prev.split(/[\s,]+/).filter(Boolean);
      return a.includes(String(n)) ? prev : [...a, String(n)].join(", ");
    });
  }

  return (
    <form action={action} className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <input type="hidden" name="idem" value={idem} />
      <div>
        <label htmlFor="rifa_id" className={etiqueta}>Rifa</label>
        <select id="rifa_id" name="rifa_id" value={rifaId} onChange={(e) => setRifaId(e.target.value)} className={campo}>
          {rifas.map((r) => <option key={r.id} value={r.id}>{r.codigo} — {r.nombre} ({cop.format(Number(r.precio))} c/u)</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="numeros" className={etiqueta}>Números de boleta</label>
        <input id="numeros" name="numeros" value={numeros} onChange={(e) => setNumeros(e.target.value)} placeholder="Ej: 7, 15, 42" required className={campo} />
        {rifa && rifa.sugeridos.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400">Disponibles:</span>
            {rifa.sugeridos.map((n) => (
              <button key={n} type="button" onClick={() => agregar(n)} className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 transition hover:bg-indigo-100 hover:text-indigo-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-indigo-950 dark:hover:text-indigo-300">
                {n}
              </button>
            ))}
          </div>
        ) : null}
        {unicos.length > 0 ? (
          <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            {unicos.length} boleta{unicos.length === 1 ? "" : "s"} · Total <span className="text-indigo-600">{cop.format(total)}</span>
          </p>
        ) : null}
      </div>

      <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-300">Cliente</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nombre" className={etiqueta}>Nombre</label>
            <input id="nombre" name="nombre" required minLength={2} className={campo} />
          </div>
          <div>
            <label htmlFor="telefono" className={etiqueta}>Teléfono</label>
            <input id="telefono" name="telefono" required minLength={7} placeholder="3001234567" className={campo} />
          </div>
          <div>
            <label htmlFor="correo" className={etiqueta}>Correo <span className="text-slate-400">(opcional)</span></label>
            <input id="correo" name="correo" type="email" className={campo} />
          </div>
          <div>
            <label htmlFor="documento" className={etiqueta}>Documento <span className="text-slate-400">(opcional)</span></label>
            <input id="documento" name="documento" className={campo} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" name="consentimiento" className="rounded" />
          Autoriza el tratamiento de sus datos (Ley 1581/2012)
        </label>
      </fieldset>

      <div>
        <label htmlFor="canal" className={etiqueta}>Canal</label>
        <select id="canal" name="canal" defaultValue="web" className={campo}>
          <option value="web">Web</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="vendedor">Vendedor</option>
          <option value="pos">Punto de venta</option>
        </select>
      </div>

      {state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}

      <button type="submit" disabled={pending || unicos.length === 0} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
        {pending ? "Registrando…" : "Registrar venta"}
      </button>
    </form>
  );
}
