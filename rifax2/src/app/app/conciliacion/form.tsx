"use client";

import { useActionState, useEffect, useState } from "react";
import { money } from "@/lib/format";
import {
  analizarExtractoAction,
  analizarReporteAction,
  analizarComprobantesAction,
  confirmarConciliacionAction,
  type AnalisisState,
  type ConfirmarState,
} from "./actions";
import type { Sugerencia } from "@/lib/conciliacion";

type Modo = "extracto" | "reporte" | "comprobante";
const estadoAnalisisInicial: AnalisisState = {};
const estadoConfirmarInicial: ConfirmarState = {};

const TABS: { id: Modo; label: string; recomendado?: boolean }[] = [
  { id: "extracto", label: "Extracto bancario", recomendado: true },
  { id: "reporte", label: "Reporte de vendedor" },
  { id: "comprobante", label: "Comprobantes (imagen)" },
];

export default function ConciliacionForm({ vendedores }: { vendedores: { id: string; nombre: string }[] }) {
  const [tab, setTab] = useState<Modo>("extracto");

  return (
    <div>
      <div className="flex gap-1 rounded-xl border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-[var(--rifax-accent,#f5c518)] text-slate-900"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {t.label}
            {t.recomendado ? <span className="ml-1.5 text-[10px] font-semibold opacity-70">recomendado</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "extracto" ? <PanelExtracto /> : null}
        {tab === "reporte" ? <PanelReporte vendedores={vendedores} /> : null}
        {tab === "comprobante" ? <PanelComprobante /> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PanelExtracto() {
  const [state, action, pending] = useActionState(analizarExtractoAction, estadoAnalisisInicial);
  const [origen, setOrigen] = useState<"texto" | "csv">("texto");
  const [nombreCsv, setNombreCsv] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Movimientos del extracto</h3>

        <div className="mt-2 flex gap-1 rounded-lg bg-slate-100 p-1 text-xs dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setOrigen("texto")}
            className={`flex-1 rounded-md px-2 py-1.5 font-medium transition ${origen === "texto" ? "bg-white shadow-sm dark:bg-slate-900" : "text-slate-500 dark:text-slate-400"}`}
          >
            Pegar texto
          </button>
          <button
            type="button"
            onClick={() => setOrigen("csv")}
            className={`flex-1 rounded-md px-2 py-1.5 font-medium transition ${origen === "csv" ? "bg-white shadow-sm dark:bg-slate-900" : "text-slate-500 dark:text-slate-400"}`}
          >
            Subir Excel/CSV
          </button>
        </div>

        <form action={action} className="mt-3 space-y-3">
          {origen === "texto" ? (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Una línea por movimiento: fecha, descripción y monto, separados por coma. Ejemplo:{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">2026-08-01, Transferencia Juan Perez, 50000</code>
              </p>
              <textarea
                name="texto"
                rows={8}
                placeholder={"2026-08-01, Transferencia Juan Perez, 50000\n2026-08-01, Nequi Maria Gomez, 30000"}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sube el extracto en CSV (máximo 5MB), con una fila por movimiento: fecha, descripción y monto. Si
                lo tienes en Excel, guárdalo primero como CSV (Archivo → Guardar como → CSV).
              </p>
              <input
                type="file"
                name="csv"
                accept=".csv,.txt,text/csv"
                onChange={(e) => setNombreCsv(e.target.files?.[0]?.name ?? null)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm dark:border-slate-700 dark:bg-slate-950 dark:file:bg-slate-800"
              />
              {nombreCsv ? <p className="text-xs text-slate-500 dark:text-slate-400">Archivo: {nombreCsv}</p> : null}
            </>
          )}
          {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
          <button type="submit" disabled={pending} className="rounded-lg bg-[var(--rifax-accent,#f5c518)] px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-60">
            {pending ? (origen === "csv" ? "Leyendo archivo…" : "Analizando…") : "Analizar con IA"}
          </button>
        </form>
      </div>
      {state.sugerencias ? <RevisionSugerencias modo="extracto" sugerencias={state.sugerencias} /> : null}
    </div>
  );
}

function PanelReporte({ vendedores }: { vendedores: { id: string; nombre: string }[] }) {
  const [state, action, pending] = useActionState(analizarReporteAction, estadoAnalisisInicial);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Reporte de un vendedor (texto libre)</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Pega el texto tal como te lo envió el vendedor (por ejemplo por WhatsApp). La IA identifica los pagos
          mencionados y los compara contra la cartera pendiente de ese vendedor.
        </p>
        <form action={action} className="mt-3 space-y-3">
          <select name="vendedorId" required defaultValue="" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
            <option value="" disabled>Selecciona el vendedor…</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>{v.nombre}</option>
            ))}
          </select>
          <textarea
            name="texto"
            rows={8}
            required
            placeholder={"Hola, hoy recaudé: Juan Pérez 50.000, María Gómez 30.000 boleta 245…"}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
          <button type="submit" disabled={pending} className="rounded-lg bg-[var(--rifax-accent,#f5c518)] px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-60">
            {pending ? "Analizando…" : "Analizar con IA"}
          </button>
        </form>
      </div>
      {state.sugerencias ? <RevisionSugerencias modo="reporte" sugerencias={state.sugerencias} /> : null}
    </div>
  );
}

function PanelComprobante() {
  const [state, action, pending] = useActionState(analizarComprobantesAction, estadoAnalisisInicial);
  const [nombres, setNombres] = useState<string[]>([]);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Comprobantes de pago (imagen)</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Sube una o varias capturas/fotos de comprobantes de transferencia. La IA lee el monto y el nombre del
          remitente de cada imagen (máximo 5MB por imagen).
        </p>
        <form action={action} className="mt-3 space-y-3">
          <input
            type="file"
            name="imagenes"
            accept="image/*"
            multiple
            required
            onChange={(e) => setNombres(Array.from(e.target.files ?? []).map((f) => f.name))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm dark:border-slate-700 dark:bg-slate-950 dark:file:bg-slate-800"
          />
          {nombres.length > 0 ? (
            <ul className="text-xs text-slate-500 dark:text-slate-400">{nombres.map((n) => <li key={n}>• {n}</li>)}</ul>
          ) : null}
          {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
          <button type="submit" disabled={pending} className="rounded-lg bg-[var(--rifax-accent,#f5c518)] px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-60">
            {pending ? "Leyendo comprobantes…" : "Analizar con IA"}
          </button>
        </form>
      </div>
      {state.sugerencias ? <RevisionSugerencias modo="comprobante" sugerencias={state.sugerencias} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paso de revisión y confirmación: siempre separado del análisis. Nada se
// registra en el sistema hasta que el usuario marca qué aplicar y confirma.

function RevisionSugerencias({ modo, sugerencias }: { modo: Modo; sugerencias: Sugerencia[] }) {
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>({});
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmarConciliacionAction, estadoConfirmarInicial);

  useEffect(() => {
    const inicial: Record<string, boolean> = {};
    for (const s of sugerencias) {
      inicial[s.entradaId] = s.ventaId != null && s.confianza >= 70;
    }
    // Reinicia la selección cada vez que llegan nuevas sugerencias del
    // análisis (no en cada render): es exactamente el caso "sincronizar con
    // una prop que cambia" documentado por React, sin equivalente sin efecto
    // que no implique remontar el componente (perdiendo el resto de su
    // estado local) vía `key`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeleccion(inicial);
  }, [sugerencias]);

  if (confirmState.ok) {
    return (
      <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        Se registraron {confirmState.aplicadas} abono(s) por un total de {money(confirmState.total ?? 0)}.
        {confirmState.fallidas ? (
          <span className="mt-1 block text-amber-700 dark:text-amber-400">
            {confirmState.fallidas} coincidencia(s) no se pudieron aplicar (por ejemplo, la venta ya se había
            pagado). Revísalas en la cartera.
          </span>
        ) : null}
      </div>
    );
  }

  const aprobadas = sugerencias.filter((s) => seleccion[s.entradaId] && s.ventaId != null);
  const totalAprobado = aprobadas.reduce((a, s) => a + s.montoOriginal, 0);

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        Revisión — nada se ha registrado todavía
      </h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Marca qué coincidencias son correctas. Solo se registrarán los abonos de las filas seleccionadas cuando
        confirmes al final.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
              <th className="py-1.5 pr-2"></th>
              <th className="py-1.5 pr-2">Movimiento</th>
              <th className="py-1.5 pr-2">Monto</th>
              <th className="py-1.5 pr-2">Venta sugerida</th>
              <th className="py-1.5 pr-2">Confianza</th>
              <th className="py-1.5 pr-2">Motivo de la IA</th>
            </tr>
          </thead>
          <tbody>
            {sugerencias.map((s) => (
              <tr key={s.entradaId} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    disabled={s.ventaId == null}
                    checked={!!seleccion[s.entradaId] && s.ventaId != null}
                    onChange={(e) => setSeleccion((prev) => ({ ...prev, [s.entradaId]: e.target.checked }))}
                  />
                </td>
                <td className="py-2 pr-2 text-slate-700 dark:text-slate-300">
                  {s.descripcionOriginal}
                  {s.fechaOriginal ? <span className="block text-[11px] text-slate-400">{s.fechaOriginal}</span> : null}
                </td>
                <td className="py-2 pr-2 font-medium text-slate-900 dark:text-slate-100">{money(s.montoOriginal)}</td>
                <td className="py-2 pr-2">
                  {s.ventaId ? (
                    <>
                      <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{s.ventaCodigo}</span>
                      <span className="block text-slate-700 dark:text-slate-300">{s.clienteSugerido}</span>
                      <span className="block text-[11px] text-slate-400">saldo: {money(s.saldoVenta ?? 0)}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">Sin coincidencia</span>
                  )}
                </td>
                <td className="py-2 pr-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${confianzaClase(s.confianza)}`}>{s.confianza}%</span>
                </td>
                <td className="py-2 pr-2 max-w-[220px] text-xs text-slate-500 dark:text-slate-400">{s.motivo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={confirmAction} className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
        <input type="hidden" name="modo" value={modo} />
        <input type="hidden" name="aprobadas" value={JSON.stringify(aprobadas.map((s) => ({ ventaId: s.ventaId, monto: s.montoOriginal })))} />
        {confirmState.error ? <p role="alert" className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{confirmState.error}</p> : null}
        <button
          type="submit"
          disabled={confirmPending || aprobadas.length === 0}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {confirmPending ? "Registrando…" : `Confirmar y registrar ${aprobadas.length} abono(s) — ${money(totalAprobado)}`}
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {aprobadas.length} de {sugerencias.length} seleccionadas
        </span>
      </form>
    </div>
  );
}

function confianzaClase(c: number): string {
  if (c >= 70) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (c >= 40) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
}
