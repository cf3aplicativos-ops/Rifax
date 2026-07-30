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
    const id = setInterval(cargar, 6000); // refresco en tiempo real (cada 6s)
    return () => { vivo = false; clearInterval(id); };
  }, []);

  return (
    <section className="border-t border-slate-100 bg-slate-50 py-24 dark:border-slate-900 dark:bg-slate-900/40">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            EN VIVO
          </span>
          <h2 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">Resultados de sorteos</h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            Números ganadores y nombre del ganador, actualizados automáticamente.
          </p>
          {actualizado ? <p className="mt-1 text-sm text-slate-400">Última actualización {fmt.format(actualizado)}</p> : null}
        </div>

        <div className="mt-12">
          {cargando ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />)}
            </div>
          ) : lista.length === 0 ? (
            <div className="mx-auto max-w-md rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-base text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              Aún no hay sorteos ejecutados. Aquí verás los números y nombres ganadores en cuanto se realicen.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((g, i) => (
                <div key={i} className="flex flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <div className="grid w-full place-items-center rounded-2xl bg-[#1e293b] py-5">
                    <span className="font-mono text-5xl font-black leading-none tracking-widest text-[#f5c518] sm:text-6xl">{g.numero}</span>
                    <span className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Número ganador</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-slate-900 dark:text-white">🏆 {g.ganador}</p>
                    <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-400">{g.rifa}{g.premio ? ` · ${g.premio}` : ""}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{g.empresa} · {fmt.format(new Date(g.fecha))}</p>
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
