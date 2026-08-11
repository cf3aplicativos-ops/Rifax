"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const INTERVALO_MS = 15_000;

interface SolicitudPendiente {
  id: string;
  numero: string;
  rifa: string;
  solicitante: string;
  creadoEn: string;
}

interface SolicitudEnviada {
  id: string;
  numero: string;
  rifa: string;
  rifaId: string;
  propietario: string;
  estado: string;
  motivoRechazo: string | null;
}

type Aviso =
  | { tipo: "nueva"; id: string; numero: string; rifa: string; solicitante: string }
  | { tipo: "aprobada"; id: string; numero: string; rifa: string; propietario: string }
  | { tipo: "rechazada"; id: string; numero: string; rifa: string; propietario: string; motivo: string | null };

// Evento global: se dispara cuando una solicitud enviada por el usuario en
// sesión es aprobada, para que la pantalla de "Nueva venta" (si está abierta
// con esa misma rifa) agregue la boleta sola a su lista de seleccionadas.
export const EVENTO_TRASPASO_APROBADO = "rifax:traspaso-aprobado";
export interface DetalleTraspasoAprobado { rifaId: string; numero: number }

// Aviso sonoro + emergente del ciclo de vida de una solicitud de traspaso:
// al dueño de la boleta cuando le llega una solicitud nueva, y al solicitante
// cuando la suya es aprobada o rechazada (con motivo). Sondea cada 15s; no
// requiere infraestructura de tiempo real, suficiente para este volumen de uso.
export default function NotificadorTraspasos({ hrefTraspasos }: { hrefTraspasos: string }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const vistosRef = useRef<Set<string> | null>(null);
  const estadoEnviadasRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    let activo = true;

    async function sondear() {
      try {
        const res = await fetch("/api/traspasos/pendientes", { cache: "no-store" });
        if (!res.ok) return;
        const json: { pendientes?: SolicitudPendiente[]; enviadas?: SolicitudEnviada[] } = await res.json();
        const pendientes = json.pendientes ?? [];
        const enviadas = json.enviadas ?? [];
        if (!activo) return;

        if (vistosRef.current === null || estadoEnviadasRef.current === null) {
          // Primera carga: registra el estado actual sin sonar (evita alarmar
          // con solicitudes/resoluciones antiguas de antes de abrir la app).
          vistosRef.current = new Set(pendientes.map((p) => p.id));
          estadoEnviadasRef.current = new Map(enviadas.map((e) => [e.id, e.estado]));
          return;
        }

        const nuevosAvisos: Aviso[] = [];

        const recientes = pendientes.filter((p) => !vistosRef.current!.has(p.id));
        recientes.forEach((p) => {
          vistosRef.current!.add(p.id);
          nuevosAvisos.push({ tipo: "nueva", id: p.id, numero: p.numero, rifa: p.rifa, solicitante: p.solicitante });
        });

        enviadas.forEach((e) => {
          const antes = estadoEnviadasRef.current!.get(e.id);
          if (antes === "pendiente" || antes === undefined) {
            if (e.estado === "aprobada") {
              nuevosAvisos.push({ tipo: "aprobada", id: e.id, numero: e.numero, rifa: e.rifa, propietario: e.propietario });
              window.dispatchEvent(new CustomEvent<DetalleTraspasoAprobado>(EVENTO_TRASPASO_APROBADO, { detail: { rifaId: e.rifaId, numero: Number(e.numero) } }));
            } else if (e.estado === "rechazada") {
              nuevosAvisos.push({ tipo: "rechazada", id: e.id, numero: e.numero, rifa: e.rifa, propietario: e.propietario, motivo: e.motivoRechazo });
            }
          }
          estadoEnviadasRef.current!.set(e.id, e.estado);
        });

        if (nuevosAvisos.length > 0) {
          setAvisos((prev) => [...nuevosAvisos, ...prev].slice(0, 5));
          sonarAviso();
        }
      } catch {
        // Sin conexión momentánea: se reintenta en el siguiente ciclo.
      }
    }

    sondear();
    const id = setInterval(sondear, INTERVALO_MS);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, []);

  if (avisos.length === 0) return null;

  const cerrar = (id: string) => setAvisos((prev) => prev.filter((a) => a.id !== id));

  return (
    <div className="fixed right-3 top-3 z-[200] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2">
      {avisos.map((a) => (
        <div
          key={a.id}
          role="alert"
          className={`animate-[slide-in_0.2s_ease-out] rounded-xl border bg-white p-3 shadow-xl dark:bg-slate-900 ${
            a.tipo === "aprobada" ? "border-emerald-300 dark:border-emerald-800" : a.tipo === "rechazada" ? "border-red-300 dark:border-red-800" : "border-amber-300 dark:border-amber-800"
          }`}
        >
          <div className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                a.tipo === "aprobada"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : a.tipo === "rechazada"
                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {a.tipo === "aprobada" ? "✅" : a.tipo === "rechazada" ? "⛔" : "🔔"}
            </span>
            <div className="min-w-0 flex-1">
              {a.tipo === "nueva" ? (
                <>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Nueva solicitud de traspaso</p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    <strong>{a.solicitante}</strong> pidió la boleta <strong>#{a.numero}</strong> de {a.rifa}.
                  </p>
                </>
              ) : a.tipo === "aprobada" ? (
                <>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Traspaso aprobado</p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    <strong>{a.propietario}</strong> aprobó tu solicitud de la boleta <strong>#{a.numero}</strong> de {a.rifa}. Ya es tuya.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Traspaso rechazado</p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    <strong>{a.propietario}</strong> rechazó tu solicitud de la boleta <strong>#{a.numero}</strong> de {a.rifa}.
                    {a.motivo ? <span className="block italic">Motivo: {a.motivo}</span> : null}
                  </p>
                </>
              )}
              <div className="mt-2 flex gap-2">
                <Link href={hrefTraspasos} onClick={() => cerrar(a.id)} className="rounded-lg bg-[var(--rifax-accent,#f5c518)] px-2.5 py-1 text-xs font-bold text-slate-900">
                  {a.tipo === "nueva" ? "Revisar ahora" : "Ver detalle"}
                </Link>
                <button type="button" onClick={() => cerrar(a.id)} className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function sonarAviso() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notas = [880, 1175]; // dos tonos ascendentes, aviso corto y no invasivo
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const inicio = ctx.currentTime + i * 0.14;
      gain.gain.setValueAtTime(0, inicio);
      gain.gain.linearRampToValueAtTime(0.2, inicio + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, inicio + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.24);
    });
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // Si el navegador bloquea audio automático, el aviso visual sigue funcionando.
  }
}
