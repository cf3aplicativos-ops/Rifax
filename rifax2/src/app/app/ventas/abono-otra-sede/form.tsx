"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { money, estadoVentaClase } from "@/lib/format";
import { buscarVentaOtraSedeAction, registrarAbonoOtraSedeAction, type BusquedaState, type AbonoOtraSedeState } from "./actions";
import type { VentaBusquedaAbono } from "@/lib/ventas";

const inp = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const estadoInicialBusqueda: BusquedaState = {};

export default function FormAbonoOtraSede() {
  const [busqueda, buscarAction, buscando] = useActionState(buscarVentaOtraSedeAction, estadoInicialBusqueda);
  const [seleccionada, setSeleccionada] = useState<VentaBusquedaAbono | null>(null);

  return (
    <div className="mt-6 space-y-6">
      <form action={buscarAction} className="flex flex-wrap gap-2 rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <input
          name="criterio"
          autoFocus
          required
          placeholder="Código de venta, número de boleta o documento del cliente"
          defaultValue={busqueda.criterio ?? ""}
          className={`${inp} flex-1`}
        />
        <button type="submit" disabled={buscando} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
          {buscando ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {busqueda.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{busqueda.error}</p> : null}

      {busqueda.resultados && !seleccionada ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{busqueda.resultados.length} resultado{busqueda.resultados.length === 1 ? "" : "s"}:</p>
          {busqueda.resultados.map((v) => (
            <button
              key={v.ventaId}
              type="button"
              onClick={() => setSeleccionada(v)}
              className="block w-full rounded-xl border border-slate-300 bg-white p-4 text-left transition hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-indigo-950/20"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{v.codigo}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoVentaClase[v.estado] ?? estadoVentaClase.pendiente_pago}`}>{v.estado.replace("_", " ")}</span>
              </div>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">{v.cliente} {v.documento ? <span className="font-normal text-slate-500">· doc. {v.documento}</span> : null}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{v.rifa} · sede {v.sede}</p>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">Total {money(v.total)}</span>
                <span className="font-medium text-amber-700 dark:text-amber-400">Saldo {money(v.saldo)}</span>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {seleccionada ? <PanelAbono venta={seleccionada} onCerrar={() => setSeleccionada(null)} /> : null}
    </div>
  );
}

const estadoInicialAbono: AbonoOtraSedeState = {};

function PanelAbono({ venta, onCerrar }: { venta: VentaBusquedaAbono; onCerrar: () => void }) {
  const [state, action, pending] = useActionState(registrarAbonoOtraSedeAction, estadoInicialAbono);

  if (state.ok) {
    return (
      <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        <p className="font-semibold">Pago registrado.</p>
        <p className="mt-1">Venta {venta.codigo} · {venta.cliente} · sede {venta.sede}.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/app/ventas/${state.ventaId}/recibo`} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700">
            🖨️ Ver / imprimir recibo
          </Link>
          <button type="button" onClick={onCerrar} className="rounded-lg border border-emerald-300 px-4 py-2 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300">
            Buscar otra venta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{venta.codigo}</p>
          <p className="font-semibold text-slate-900 dark:text-white">{venta.cliente}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{venta.rifa} · sede {venta.sede}</p>
        </div>
        <button type="button" onClick={onCerrar} className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
          Cambiar venta
        </button>
      </div>
      <div className="mt-3 flex justify-between text-sm">
        <span className="text-slate-500 dark:text-slate-400">Total {money(venta.total)}</span>
        <span className="font-medium text-amber-700 dark:text-amber-400">Saldo {money(venta.saldo)}</span>
      </div>

      <form action={action} className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <input type="hidden" name="venta_id" value={venta.ventaId} />
        <div className="grid grid-cols-2 gap-3">
          <input name="monto" type="number" min="1" step="0.01" required placeholder="Monto" className={inp} />
          <select name="origen" defaultValue="efectivo" className={inp}>
            <option value="efectivo">Efectivo</option>
            <option value="pasarela">Pasarela</option>
            <option value="comprobante">Comprobante</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </div>
        {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
        <button type="submit" disabled={pending} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Registrando…" : "Registrar pago"}
        </button>
      </form>
    </div>
  );
}
