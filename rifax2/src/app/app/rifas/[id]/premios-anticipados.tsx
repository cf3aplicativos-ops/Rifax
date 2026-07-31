"use client";

import { useState } from "react";
import { editarPremioAnticipadoAction, eliminarPremioAnticipadoAction } from "./actions";

export interface PA {
  id: string;
  nombre: string;
  loteria: string | null;
  fechaISO: string; // yyyy-mm-dd para el input date
  fechaTexto: string;
  pagos: number;
  valor: string | null;
  estado: string;
}

const inp = "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export default function PremiosAnticipados({
  rifaId, lista, loterias, editable,
}: {
  rifaId: string;
  lista: PA[];
  loterias: { valor: string; etiqueta: string }[];
  editable: boolean;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const loteriaLabel = (v: string | null) => loterias.find((l) => l.valor === v)?.etiqueta ?? v ?? "—";

  if (lista.length === 0) {
    return <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sin premios anticipados programados.</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {lista.map((pa) =>
        editId === pa.id ? (
          <form key={pa.id} action={editarPremioAnticipadoAction} className="grid grid-cols-1 gap-2 rounded-xl border border-indigo-300 bg-white p-4 sm:grid-cols-2 dark:border-indigo-800 dark:bg-slate-900">
            <input type="hidden" name="rifa_id" value={rifaId} />
            <input type="hidden" name="premio_id" value={pa.id} />
            <input name="nombre" required defaultValue={pa.nombre} placeholder="Nombre del premio" className={inp} />
            <select name="loteria" defaultValue={pa.loteria ?? ""} className={inp}>
              <option value="">Lotería…</option>
              {loterias.map((l) => <option key={l.valor} value={l.valor}>{l.etiqueta}</option>)}
            </select>
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Fecha de juego</label>
              <input name="fecha_juego" type="date" required defaultValue={pa.fechaISO} className={inp} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Pagos requeridos</label>
              <input name="pagos_requeridos" type="number" min="1" defaultValue={pa.pagos} className={inp} />
            </div>
            <input name="valor_estimado" type="number" min="0" defaultValue={pa.valor ?? ""} placeholder="Valor estimado (opcional)" className={inp} />
            <div className="flex items-center gap-2">
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Guardar</button>
              <button type="button" onClick={() => setEditId(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancelar</button>
            </div>
          </form>
        ) : (
          <div key={pa.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{pa.nombre} {pa.valor ? <span className="text-xs text-slate-400">({pa.valor})</span> : null}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{pa.fechaTexto} · {loteriaLabel(pa.loteria)} · {pa.pagos} pago(s) · <span className="capitalize">{pa.estado}</span></p>
            </div>
            {editable && pa.estado !== "jugado" ? (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditId(pa.id)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Editar</button>
                <form action={eliminarPremioAnticipadoAction}>
                  <input type="hidden" name="rifa_id" value={rifaId} />
                  <input type="hidden" name="premio_id" value={pa.id} />
                  <button type="submit" className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">Eliminar</button>
                </form>
              </div>
            ) : null}
          </div>
        ),
      )}
    </div>
  );
}
