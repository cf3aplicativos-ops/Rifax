"use client";

import { useActionState, useState } from "react";
import SideNav, { type NavItem } from "@/components/side-nav";
import { Icon } from "@/components/icons";
import { consultarAction, type ConsultaState } from "./actions";

const initial: ConsultaState = {};
const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const money = (v: string) => cop.format(Number(v));

const nav: NavItem[] = [
  { href: "/", label: "Inicio", icon: "inicio", exact: true },
  { href: "/consulta", label: "Estado de cuenta", icon: "cuenta" },
  { href: "/login", label: "Ingresar (empresa)", icon: "perfil" },
];

const estadoClase: Record<string, string> = {
  pendiente_pago: "bg-amber-100 text-amber-800",
  parcial: "bg-blue-100 text-blue-800",
  pagada: "bg-emerald-100 text-emerald-800",
  anulada: "bg-slate-200 text-slate-600",
};

export default function ConsultaPage() {
  const [state, action, pending] = useActionState(consultarAction, initial);
  const cuenta = state.cuenta;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <style>{"@media print{.no-print{display:none!important}aside{display:none!important}}"}</style>
      <SideNav nav={nav} brand="RIFAX" subtitle="Consulta pública" logoUrl={null} homeHref="/">
        <div className="mx-auto max-w-lg">
          <div className="no-print rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><Icon name="cuenta" /></span>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Estado de cuenta</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Consulta tus compras con tu documento y teléfono.</p>
              </div>
            </div>
            <form action={action} className="mt-4 space-y-3">
              <input name="documento" defaultValue={cuenta?.documento ?? ""} required placeholder="Número de documento" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              <input name="telefono" required placeholder="Teléfono" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              {state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
              <button type="submit" disabled={pending} className="w-full rounded-lg bg-[#f5c518] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-500/30 transition hover:bg-[#eab308] disabled:opacity-60">
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
                <button onClick={() => window.print()} className="no-print flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  <Icon name="reportes" className="h-4 w-4" /> Descargar / Imprimir
                </button>
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
                      {c.numeros.map((n) => <span key={n} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{n}</span>)}
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
      </SideNav>
    </div>
  );
}
