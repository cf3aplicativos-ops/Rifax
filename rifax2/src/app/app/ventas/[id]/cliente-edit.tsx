"use client";

import { useState } from "react";
import { editarClienteAction, cambiarEstadoClienteAction } from "../actions";

export interface ClienteUI { id: string; nombre: string; telefono: string; correo: string | null; documento: string | null; estado: string }

const inp = "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export default function ClienteEdit({ ventaId, cliente, editable }: { ventaId: string; cliente: ClienteUI; editable: boolean }) {
  const [editando, setEditando] = useState(false);
  const inactivo = cliente.estado === "inactivo";

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">Cliente {inactivo ? <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">anulado</span> : null}</p>
        {editable && !editando ? (
          <button onClick={() => setEditando(true)} className="rounded-md border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Editar</button>
        ) : null}
      </div>

      {editando ? (
        <form action={editarClienteAction} className="mt-2 space-y-2">
          <input type="hidden" name="venta_id" value={ventaId} />
          <input type="hidden" name="cliente_id" value={cliente.id} />
          <input name="nombre" required minLength={2} defaultValue={cliente.nombre} placeholder="Nombre" className={inp} />
          <input name="telefono" required minLength={7} defaultValue={cliente.telefono} placeholder="Teléfono" className={inp} />
          <input name="correo" type="email" defaultValue={cliente.correo ?? ""} placeholder="Correo (opcional)" className={inp} />
          <input name="documento" defaultValue={cliente.documento ?? ""} placeholder="Documento (opcional)" className={inp} />
          <div className="flex items-center gap-2 pt-1">
            <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700">Guardar</button>
            <button type="button" onClick={() => setEditando(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancelar</button>
          </div>
        </form>
      ) : (
        <div className="mt-1">
          <p className="text-slate-900 dark:text-slate-100">{cliente.nombre}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{cliente.telefono}</p>
          {cliente.correo ? <p className="text-sm text-slate-500 dark:text-slate-400">{cliente.correo}</p> : null}
          {cliente.documento ? <p className="text-sm text-slate-500 dark:text-slate-400">Doc: {cliente.documento}</p> : null}
          {editable ? (
            <form action={cambiarEstadoClienteAction} className="mt-2">
              <input type="hidden" name="venta_id" value={ventaId} />
              <input type="hidden" name="cliente_id" value={cliente.id} />
              <input type="hidden" name="estado" value={inactivo ? "activo" : "inactivo"} />
              <button type="submit" className={`rounded-md border px-2 py-0.5 text-xs font-medium ${inactivo ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300" : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300"}`}>
                {inactivo ? "Reactivar cliente" : "Anular cliente"}
              </button>
            </form>
          ) : null}
        </div>
      )}
    </div>
  );
}
