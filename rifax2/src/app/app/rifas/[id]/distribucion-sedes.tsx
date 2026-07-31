"use client";

import { useState } from "react";
import { asignarBoletasSedeAction, liberarBoletasSedeAction } from "./actions";

export interface FilaSede { sedeId: string; nombre: string; asignadas: number; disponibles: number; vendidas: number; numeros: number[] }

const inp = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export default function DistribucionSedes({
  rifaId, sedes, sinAsignar, filas, editable,
}: {
  rifaId: string;
  sedes: { id: string; nombre: string }[];
  sinAsignar: number;
  filas: FilaSede[];
  editable: boolean;
}) {
  const [sedeId, setSedeId] = useState(sedes[0]?.id ?? "");
  const [tipo, setTipo] = useState<"consecutiva" | "aleatoria" | "especificas">("consecutiva");

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Distribución por sede</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Reparte los números entre las sedes. Sin asignar: <span className="font-semibold text-slate-700 dark:text-slate-300">{sinAsignar.toLocaleString("es-CO")}</span> boletas.
      </p>

      {/* Formulario de asignación */}
      {editable && sinAsignar > 0 ? (
        <form action={asignarBoletasSedeAction} className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-slate-300 bg-white p-4 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-900">
          <input type="hidden" name="rifa_id" value={rifaId} />
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Sede</label>
            <select name="sede_id" value={sedeId} onChange={(e) => setSedeId(e.target.value)} className={`${inp} w-full`}>
              {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Modo de asignación</label>
            <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={`${inp} w-full`}>
              <option value="consecutiva">Rango consecutivo</option>
              <option value="aleatoria">Rango aleatorio</option>
              <option value="especificas">Asignación (números específicos)</option>
            </select>
          </div>
          {tipo === "consecutiva" ? (
            <>
              <input name="inicio" type="number" min="0" required placeholder="Número inicial" className={inp} />
              <input name="fin" type="number" min="0" required placeholder="Número final" className={inp} />
            </>
          ) : tipo === "aleatoria" ? (
            <input name="cantidad" type="number" min="1" required placeholder="Cantidad al azar" className={`${inp} sm:col-span-2`} />
          ) : (
            <input name="numeros" required placeholder="Números o rangos, ej: 7, 15, 100-150" className={`${inp} sm:col-span-2`} />
          )}
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 sm:col-span-2">Asignar a la sede</button>
        </form>
      ) : null}

      {/* Lista por sede — los números vendidos ya no aparecen (#6) */}
      <div className="mt-4 space-y-3">
        {filas.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Aún no has asignado boletas a ninguna sede.</p>
        ) : filas.map((f) => (
          <div key={f.sedeId} className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{f.nombre}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{f.asignadas.toLocaleString("es-CO")} asignadas · {f.disponibles.toLocaleString("es-CO")} disponibles · {f.vendidas.toLocaleString("es-CO")} vendidas</p>
              </div>
              {editable && f.disponibles > 0 ? (
                <form action={liberarBoletasSedeAction}>
                  <input type="hidden" name="rifa_id" value={rifaId} />
                  <input type="hidden" name="sede_id" value={f.sedeId} />
                  <button type="submit" className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Liberar disponibles</button>
                </form>
              ) : null}
            </div>
            {f.numeros.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {f.numeros.map((n) => (
                  <span key={n} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">{n}</span>
                ))}
                {f.disponibles > f.numeros.length ? <span className="text-xs text-slate-400">+{(f.disponibles - f.numeros.length).toLocaleString("es-CO")} más…</span> : null}
              </div>
            ) : <p className="mt-2 text-xs text-slate-400">Sin boletas disponibles (todas vendidas o ninguna asignada).</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
