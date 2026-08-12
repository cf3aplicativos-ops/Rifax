"use client";

import { useActionState, useMemo, useState } from "react";
import { iniciarCompraAction, type CompraState } from "./actions";

const inp = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const etiqueta = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";
const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const estadoInicial: CompraState = {};

export default function FormCompra({
  slug, rifaId, precioBoleta, boletaImagenUrl, disponibles,
}: {
  slug: string;
  rifaId: string;
  precioBoleta: string;
  boletaImagenUrl: string | null;
  disponibles: number[];
}) {
  const [state, action, pending] = useActionState(iniciarCompraAction, estadoInicial);
  const [numeros, setNumeros] = useState("");
  const [numeroBusq, setNumeroBusq] = useState("");

  const unicos = useMemo(
    () => [...new Set(numeros.split(/[\s,]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0))],
    [numeros],
  );
  const total = Number(precioBoleta) * unicos.length;

  function alternar(n: number) {
    const set = new Set(unicos);
    if (set.has(n)) set.delete(n); else set.add(n);
    setNumeros([...set].join(", "));
  }

  function agregarBusqueda() {
    const n = Number(numeroBusq);
    if (!Number.isInteger(n) || n < 0) return;
    const set = new Set(unicos);
    set.add(n);
    setNumeros([...set].join(", "));
    setNumeroBusq("");
  }

  return (
    <form action={action} className="mt-6 space-y-6">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rifa_id" value={rifaId} />
      <input type="hidden" name="numeros" value={unicos.join(",")} />

      <div className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <label className={etiqueta}>¿Ya sabes qué número quieres? Escríbelo aquí</label>
        <div className="flex gap-2">
          <input
            type="number" min={0} value={numeroBusq}
            onChange={(e) => setNumeroBusq(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarBusqueda(); } }}
            placeholder="Ej: 42" className={inp}
          />
          <button type="button" onClick={agregarBusqueda} className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600">
            Agregar
          </button>
        </div>

        {disponibles.length > 0 ? (
          <>
            <p className="mt-4 mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">O elige entre los disponibles:</p>
            <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/40">
              {disponibles.map((n) => {
                const elegido = unicos.includes(n);
                return (
                  <button
                    key={n} type="button" onClick={() => alternar(n)}
                    className={`rounded-md px-2 py-1 font-mono text-xs transition ${elegido ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-indigo-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-indigo-950"}`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      {unicos.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">Tus boletas:</p>
          <div className="flex flex-wrap gap-1.5">
            {unicos.map((n) => (
              <span
                key={n}
                className="relative inline-flex h-11 min-w-[68px] items-center justify-center overflow-hidden rounded-md bg-[#1e293b] bg-cover bg-center px-2 shadow-sm"
                style={boletaImagenUrl ? { backgroundImage: `url(${boletaImagenUrl})` } : undefined}
              >
                {boletaImagenUrl ? <span className="absolute inset-0 bg-black/45" /> : null}
                <span className="relative font-mono text-sm font-bold tracking-wide text-[#f5c518]">{n}</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            {unicos.length} boleta{unicos.length === 1 ? "" : "s"} · Total <span className="text-indigo-600">{cop.format(total)}</span>
          </p>
        </div>
      ) : null}

      <fieldset className="space-y-4 rounded-xl border border-slate-300 p-4 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-300">Tus datos</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nombre" className={etiqueta}>Nombre completo</label>
            <input id="nombre" name="nombre" required minLength={2} className={inp} />
          </div>
          <div>
            <label htmlFor="telefono" className={etiqueta}>Teléfono (WhatsApp)</label>
            <input id="telefono" name="telefono" required minLength={7} placeholder="3001234567" className={inp} />
          </div>
          <div>
            <label htmlFor="correo" className={etiqueta}>Correo <span className="text-slate-400">(opcional)</span></label>
            <input id="correo" name="correo" type="email" className={inp} />
          </div>
          <div>
            <label htmlFor="documento" className={etiqueta}>Documento <span className="text-slate-400">(opcional)</span></label>
            <input id="documento" name="documento" className={inp} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" name="consentimiento" required className="rounded" />
          Autorizo el tratamiento de mis datos (Ley 1581/2012)
        </label>
      </fieldset>

      {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending || unicos.length === 0}
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Redirigiendo al pago…" : `Pagar ${unicos.length > 0 ? cop.format(total) : ""} con Wompi`}
      </button>
    </form>
  );
}
