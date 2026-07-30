"use client";

import { useEffect, useState } from "react";

type Ganador = { numero: string; rifa: string; premio: string | null; empresa: string; ganador: string; fecha: string };

const fmt = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function GanadoresVivo() {
  const [lista, setLista] = useState<Ganador[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizado, setActualizado] = useState<Date | null>(null);

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      try {
        const r = await fetch("/api/ganadores", { cache: "no-store" });
        const j = await r.json();
        if (vivo && j.ok) {
          setLista(j.ganadores);
          setActualizado(new Date());
        }
      } catch {
        /* reintenta en el siguiente ciclo */
      } finally {
        if (vivo) setCargando(false);
      }
    };
    cargar();
    const id = setInterval(cargar, 15000); // refresco en tiempo real
    return () => { vivo = false; clearInterval(id); };
  }, []);

  return (
    <section className="border-t border-slate-100 bg-slate-50 py-20 dark:border-slate-900 dark:bg-slate-900/40">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            EN VIVO
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight">Resultados de sorteos</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Números ganadores y ganadores, actualizados automáticamente.
            {actualizado ? <span className="block text-xs text-slate-400">Última actualización {fmt.format(actualizado)}</span> : null}
          </p>
        </div>

        <div className="mt-10">
          {cargando ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />)}
            </div>
          ) : lista.length === 0 ? (
            <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              Aún no hay sorteos ejecutados. Aquí verás los números y nombres ganadores en cuanto se realicen.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((g, i) => (
                <div key={i} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-amber-300 dark:border-slate-800 dark:bg-slate-900">
                  <div className="grid shrink-0 place-items-center rounded-xl bg-[#1e293b] px-3 py-2 text-center">
                    <span className="font-mono text-2xl font-black leading-none tracking-widest text-[#f5c518]">{g.numero}</span>
                    <span className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">ganador</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">🏆 {g.ganador}</p>
                    <p className="truncate text-xs text-slate-600 dark:text-slate-400">{g.rifa}{g.premio ? ` · ${g.premio}` : ""}</p>
                    <p className="truncate text-[11px] text-slate-400">{g.empresa} · {fmt.format(new Date(g.fecha))}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
