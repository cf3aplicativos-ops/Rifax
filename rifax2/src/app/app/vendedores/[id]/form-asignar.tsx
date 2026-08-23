"use client";

import { useEffect, useState } from "react";
import { asignarTalonarioAction } from "../actions";

interface Rifa { id: string; codigo: string; nombre: string; min: number; max: number }
const inp = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export default function FormAsignarTalonario({ vendedorId, rifas, sedeVendedor }: { vendedorId: string; rifas: Rifa[]; sedeVendedor: string | null }) {
  const [tipo, setTipo] = useState<"consecutiva" | "aleatoria" | "especificas">("consecutiva");
  const [rifaId, setRifaId] = useState(rifas[0]?.id ?? "");
  const [disponibles, setDisponibles] = useState<number[]>([]);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  // "loadedKey" identifica de qué combinación tipo+rifa son los `disponibles`
  // ya cargados; mientras no coincida con la combinación actual, se está
  // cargando. Evita un estado `cargando` aparte que solo duplicaría lo que ya
  // se puede derivar, y evita también resetear `seleccionados` con un
  // `setState` síncrono dentro del efecto (ver "Adjusting state when a prop
  // changes" en react.dev): se resetea durante el render, no en el efecto.
  const key = tipo === "especificas" && rifaId ? `${rifaId}:${vendedorId}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const cargando = key !== null && key !== loadedKey;

  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setSeleccionados([]);
  }

  useEffect(() => {
    if (!key) return;
    let cancelado = false;
    fetch(`/api/boletas/disponibles?rifaId=${rifaId}&vendedorId=${vendedorId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelado) return;
        setDisponibles(data.numeros ?? []);
        setLoadedKey(key);
      });
    return () => { cancelado = true; };
  }, [key, rifaId, vendedorId]);

  return (
    <form action={asignarTalonarioAction} className="mt-8 space-y-3 rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Asignar talonario</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {sedeVendedor
          ? <>Solo se le podrán asignar boletas de la sede <strong>{sedeVendedor}</strong>.</>
          : <>Este vendedor está asignado a <strong>todas las sedes</strong>: se le pueden asignar boletas de cualquier sede.</>}
      </p>
      <input type="hidden" name="vendedor_id" value={vendedorId} />

      <select name="rifa_id" value={rifaId} onChange={(e) => setRifaId(e.target.value)} className={inp}>
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
          Abonados
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
          <p className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">
            Elige los números que el vendedor ya tiene abonados por sus clientes. {seleccionados.length > 0 ? <strong>{seleccionados.length} seleccionadas.</strong> : null}
          </p>
          {cargando ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Cargando boletas disponibles…</p>
          ) : disponibles.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No hay boletas disponibles en esta rifa para este vendedor.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-300 p-2 dark:border-slate-700">
              <div className="flex flex-wrap gap-1.5">
                {disponibles.map((n) => {
                  const elegido = seleccionados.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSeleccionados((prev) => (elegido ? prev.filter((x) => x !== n) : [...prev, n]))}
                      className={`rounded-md px-2 py-1 font-mono text-xs transition ${elegido ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"}`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {seleccionados.map((n) => <input key={n} type="hidden" name="numeros" value={n} />)}
        </div>
      )}

      <button
        type="submit"
        disabled={tipo === "especificas" && seleccionados.length === 0}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Asignar
      </button>
    </form>
  );
}
