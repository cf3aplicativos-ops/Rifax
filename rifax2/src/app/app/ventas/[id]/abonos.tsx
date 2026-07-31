"use client";

import { useState } from "react";
import { editarAbonoAction, eliminarAbonoAction } from "../actions";

export interface AbonoUI { id: string; fecha: string; origen: string; monto: string; montoTexto: string }

const inp = "rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export default function Abonos({ ventaId, lista, editable }: { ventaId: string; lista: AbonoUI[]; editable: boolean }) {
  const [editId, setEditId] = useState<string | null>(null);
  if (lista.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Abonos ({lista.length})</h2>
      <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-300 dark:divide-slate-800 dark:border-slate-700">
        {lista.map((a) =>
          editId === a.id ? (
            <li key={a.id} className="px-4 py-3">
              <form action={editarAbonoAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="venta_id" value={ventaId} />
                <input type="hidden" name="abono_id" value={a.id} />
                <input name="monto" type="number" min="1" step="0.01" defaultValue={a.monto} className={`${inp} w-32`} />
                <select name="origen" defaultValue={a.origen} className={inp}>
                  <option value="efectivo">Efectivo</option>
                  <option value="pasarela">Pasarela</option>
                  <option value="comprobante">Comprobante</option>
                  <option value="ajuste">Ajuste</option>
                </select>
                <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700">Guardar</button>
                <button type="button" onClick={() => setEditId(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancelar</button>
              </form>
            </li>
          ) : (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="text-slate-600 dark:text-slate-400">{a.fecha} · {a.origen}</span>
              <span className="flex items-center gap-3">
                <span className="font-medium text-slate-900 dark:text-slate-100">{a.montoTexto}</span>
                {editable ? (
                  <span className="flex items-center gap-1.5">
                    <button onClick={() => setEditId(a.id)} className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Editar</button>
                    <form action={eliminarAbonoAction}>
                      <input type="hidden" name="venta_id" value={ventaId} />
                      <input type="hidden" name="abono_id" value={a.id} />
                      <button type="submit" className="rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">Eliminar</button>
                    </form>
                  </span>
                ) : null}
              </span>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
