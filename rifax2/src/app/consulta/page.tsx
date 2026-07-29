"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { consultarAction, type ConsultaState } from "./actions";

const initial: ConsultaState = {};
const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const money = (v: string) => cop.format(Number(v));

const estadoClase: Record<string, string> = {
  pendiente_pago: "bg-amber-100 text-amber-800",
  parcial: "bg-blue-100 text-blue-800",
  pagada: "bg-emerald-100 text-emerald-800",
  anulada: "bg-slate-200 text-slate-600",
};

export default function ConsultaPage() {
  const [state, action, pending] = useActionState(consultarAction, initial);
  const [menu, setMenu] = useState(false);
  const cuenta = state.cuenta;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <style>{"@media print{.no-print{display:none!important}}"}</style>

      {/* Header con menú hamburguesa */}
      <header className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">R</div>
            <span className="font-bold text-slate-900 dark:text-white">RIFAX</span>
          </Link>
          <button aria-label="Menú" onClick={() => setMenu((m) => !m)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
          </button>
        </div>
        {menu ? (
          <nav className="border-t border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
            <Link href="/" className="block py-2 text-slate-700 dark:text-slate-300">Inicio</Link>
            <a href="/consulta" className="block py-2 text-slate-700 dark:text-slate-300">Nueva consulta</a>
            <Link href="/login" className="block py-2 text-slate-700 dark:text-slate-300">Ingresar (empresa)</Link>
          </nav>
        ) : null}
      </header>

      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="no-print rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Estado de cuenta</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Consulta tus compras con tu documento y teléfono. Solo verás tu información.</p>
          <form action={action} className="mt-4 space-y-3">
            <input name="documento" defaultValue={cuenta?.documento ?? ""} required placeholder="Número de documento" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <input name="telefono" required placeholder="Teléfono" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            {state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
            <button type="submit" disabled={pending} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
              {pending ? "Consultando…" : "Consultar"}
            </button>
          </form>
        </div>

        {cuenta ? (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{cuenta.cliente}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Documento {cuenta.documento} · {cuenta.compras.length} compra{cuenta.compras.length === 1 ? "" : "s"}</p>
              </div>
              <button onClick={() => window.print()} className="no-print rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">🖨️ Descargar / Imprimir</button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-lg font-bold text-slate-900 dark:text-white">{money(cuenta.totalComprado)}</p><p className="text-xs text-slate-500 dark:text-slate-400">Total comprado</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-lg font-bold text-amber-600 dark:text-amber-400">{money(cuenta.totalSaldo)}</p><p className="text-xs text-slate-500 dark:text-slate-400">Saldo pendiente</p></div>
            </div>

            <div className="space-y-3">
              {cuenta.compras.map((c) => (
                <div key={c.codigo} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{c.codigo}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoClase[c.estado] ?? estadoClase.pendiente_pago}`}>{c.estado.replace("_", " ")}</span>
                  </div>
                  <p className="mt-2 font-semibold text-slate-900 dark:text-white">{c.rifa}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{c.empresa} · sorteo {c.fechaSorteo}</p>
                  <div className="mt-3 flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Total {money(c.total)}</span>
                    <span className="text-slate-500 dark:text-slate-400">Saldo {money(c.saldo)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.numeros.map((n) => <span key={n} className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-xs text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">{n}</span>)}
                  </div>
                  {c.ganados.length > 0 ? (
                    <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                      🎉 ¡Ganaste! {c.ganados.map((g) => `Boleta ${g.numero} — ${g.premio} (${g.entrega})`).join("; ")}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-slate-400">RIFAX · Estado de cuenta generado el {new Date().toLocaleDateString("es-CO")}</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
