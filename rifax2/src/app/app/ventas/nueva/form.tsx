"use client";

import { useActionState, useMemo, useState } from "react";
import { crearVentaAction, type VentaFormState } from "../actions";

interface Rifa {
  id: string;
  codigo: string;
  nombre: string;
  precio: string;
  numeroMin: number;
  numeroMax: number;
  sugeridos?: number[];
  disponibles?: number[];
}

interface EstadoBusqueda {
  numero: number;
  resultado: "tuya" | "vendida" | "punto_de_venta" | "asignada_vendedor" | "no_disponible" | "no_existe";
  mensaje: string;
  puedeVenderDirecto: boolean;
  puedeSolicitar: boolean;
  solicitudPendienteId: string | null;
}

const initialState: VentaFormState = {};
const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const etiqueta = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";
const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default function FormVenta({
  rifas, canales, modo = "general", vendedorNombre,
}: {
  rifas: Rifa[];
  canales: { valor: string; etiqueta: string }[];
  modo?: "general" | "vendedor";
  vendedorNombre?: string;
}) {
  const esVendedor = modo === "vendedor";
  const [state, action, pending] = useActionState(crearVentaAction, initialState);
  const [rifaId, setRifaId] = useState(rifas[0]?.id ?? "");
  const [numeros, setNumeros] = useState("");
  const [idem] = useState(() => globalThis.crypto.randomUUID());

  // Búsqueda de boleta por número (única forma de agregarla a la venta).
  const [numeroBusq, setNumeroBusq] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<EstadoBusqueda | null>(null);
  const [solicitando, setSolicitando] = useState(false);
  const [mensajeSolicitud, setMensajeSolicitud] = useState<string | null>(null);

  const rifa = useMemo(() => rifas.find((r) => r.id === rifaId), [rifas, rifaId]);
  const unicos = useMemo(
    () => [...new Set(numeros.split(/[\s,]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0))],
    [numeros],
  );
  const total = rifa ? Number(rifa.precio) * unicos.length : 0;

  function quitar(n: number) {
    setNumeros((prev) => prev.split(/[\s,]+/).filter(Boolean).filter((x) => x !== String(n)).join(", "));
  }
  // Al cambiar de rifa se limpia la selección y la búsqueda (números de otra rifa).
  function cambiarRifa(id: string) {
    setRifaId(id);
    setNumeros("");
    setResultado(null);
    setMensajeSolicitud(null);
  }

  async function buscar() {
    const n = Number(numeroBusq);
    if (!rifaId || !Number.isInteger(n) || n < 0) return;
    setBuscando(true);
    setMensajeSolicitud(null);
    try {
      const r = await fetch(`/api/boletas/buscar?rifaId=${rifaId}&numero=${n}`, { cache: "no-store" });
      const j = await r.json();
      setResultado(j.ok ? j.estado : { numero: n, resultado: "no_existe", mensaje: j.error ?? "Error al buscar.", puedeVenderDirecto: false, puedeSolicitar: false, solicitudPendienteId: null });
    } catch {
      setResultado({ numero: n, resultado: "no_existe", mensaje: "Error de conexión al buscar.", puedeVenderDirecto: false, puedeSolicitar: false, solicitudPendienteId: null });
    } finally {
      setBuscando(false);
    }
  }

  function agregarResultado() {
    if (!resultado || !resultado.puedeVenderDirecto) return;
    setNumeros((prev) => {
      const a = prev.split(/[\s,]+/).filter(Boolean);
      return a.includes(String(resultado.numero)) ? prev : [...a, String(resultado.numero)].join(", ");
    });
    setResultado(null);
    setNumeroBusq("");
  }

  async function solicitar() {
    if (!resultado || !resultado.puedeSolicitar) return;
    setSolicitando(true);
    try {
      const r = await fetch("/api/boletas/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rifaId, numero: resultado.numero }),
      });
      const j = await r.json();
      if (j.ok) {
        setMensajeSolicitud("Solicitud enviada. Queda pendiente de autorización de quien tiene la boleta.");
        setResultado((prev) => (prev ? { ...prev, puedeSolicitar: false, solicitudPendienteId: j.solicitudId } : prev));
      } else {
        setMensajeSolicitud(j.error ?? "No se pudo enviar la solicitud.");
      }
    } catch {
      setMensajeSolicitud("Error de conexión al solicitar.");
    } finally {
      setSolicitando(false);
    }
  }

  return (
    <form action={action} className="mt-6 space-y-5 rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <input type="hidden" name="idem" value={idem} />
      {/* Los números solo se agregan mediante la búsqueda de más abajo (no se
          digitan libremente): garantiza que cada uno pasó por la verificación
          de estado (tuya / vendida / punto de venta / asignada a vendedor). */}
      <input type="hidden" name="numeros" value={unicos.join(",")} />

      {esVendedor && vendedorNombre ? (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/40">
          <span className="text-amber-700 dark:text-amber-400">Vendedor:</span>
          <span className="font-semibold text-slate-900 dark:text-white">{vendedorNombre}</span>
        </div>
      ) : null}

      <div>
        <label htmlFor="rifa_id" className={etiqueta}>Rifa</label>
        <select id="rifa_id" name="rifa_id" value={rifaId} onChange={(e) => cambiarRifa(e.target.value)} className={campo}>
          {rifas.map((r) => <option key={r.id} value={r.id}>{r.codigo} — {r.nombre} ({cop.format(Number(r.precio))} c/u)</option>)}
        </select>
      </div>

      {/* Lista informativa: solo para consultar, no selecciona. Para vender un
          número hay que buscarlo abajo. */}
      {esVendedor ? (
        (rifa?.disponibles?.length ?? 0) > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Tus boletas disponibles (informativo, {rifa!.disponibles!.length}):</p>
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950/40">
              {rifa!.disponibles!.map((n) => (
                <span key={n} className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">{n}</span>
              ))}
            </div>
          </div>
        ) : null
      ) : (
        rifa && (rifa.sugeridos?.length ?? 0) > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Algunas boletas disponibles (informativo):</p>
            <div className="flex flex-wrap gap-1">
              {rifa.sugeridos!.map((n) => (
                <span key={n} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">{n}</span>
              ))}
            </div>
          </div>
        ) : null
      )}

      {/* Buscar boleta por número: única forma de agregarla / solicitarla. */}
      <div className="rounded-xl border border-slate-300 p-4 dark:border-slate-700">
        <label htmlFor="numero_busq" className={etiqueta}>Buscar boleta por número</label>
        <div className="flex gap-2">
          <input
            id="numero_busq"
            type="number"
            min={0}
            value={numeroBusq}
            onChange={(e) => setNumeroBusq(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }}
            placeholder="Ej: 42"
            className={campo}
          />
          <button type="button" onClick={buscar} disabled={buscando || !numeroBusq} className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600">
            {buscando ? "Buscando…" : "Buscar"}
          </button>
        </div>

        {resultado ? (
          <div
            role="status"
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              resultado.resultado === "tuya"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                : resultado.resultado === "vendida"
                  ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  : resultado.resultado === "no_existe" || resultado.resultado === "no_disponible"
                    ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
            }`}
          >
            <p><span className="font-mono font-semibold">#{resultado.numero}</span> — {resultado.mensaje}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {resultado.puedeVenderDirecto ? (
                <button type="button" onClick={agregarResultado} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700">Agregar a la venta</button>
              ) : null}
              {resultado.puedeSolicitar ? (
                <button type="button" onClick={solicitar} disabled={solicitando} className="rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950">
                  {solicitando ? "Enviando…" : "Solicitar esta boleta"}
                </button>
              ) : resultado.solicitudPendienteId ? (
                <span className="text-xs text-amber-700 dark:text-amber-400">Ya la solicitaste; pendiente de autorización.</span>
              ) : null}
            </div>
          </div>
        ) : null}
        {mensajeSolicitud ? <p role="status" className="mt-2 text-xs text-slate-600 dark:text-slate-400">{mensajeSolicitud}</p> : null}
      </div>

      {unicos.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">Boletas de esta venta:</p>
          <div className="flex flex-wrap gap-1.5">
            {unicos.map((n) => (
              <span key={n} className="inline-flex items-center gap-1 rounded-md bg-[#1e293b] px-2 py-1 font-mono text-xs font-semibold text-[#f5c518]">
                {n}
                <button type="button" onClick={() => quitar(n)} aria-label={`Quitar ${n}`} className="text-slate-400 hover:text-white">×</button>
              </span>
            ))}
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            {unicos.length} boleta{unicos.length === 1 ? "" : "s"} · Total <span className="text-indigo-600">{cop.format(total)}</span>
          </p>
        </div>
      ) : null}

      <fieldset className="space-y-4 rounded-xl border border-slate-300 p-4 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-300">Cliente</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nombre" className={etiqueta}>Nombre</label>
            <input id="nombre" name="nombre" required minLength={2} className={campo} />
          </div>
          <div>
            <label htmlFor="telefono" className={etiqueta}>Teléfono</label>
            <input id="telefono" name="telefono" required minLength={7} placeholder="3001234567" className={campo} />
          </div>
          <div>
            <label htmlFor="correo" className={etiqueta}>Correo <span className="text-slate-400">(opcional)</span></label>
            <input id="correo" name="correo" type="email" className={campo} />
          </div>
          <div>
            <label htmlFor="documento" className={etiqueta}>Documento <span className="text-slate-400">(opcional)</span></label>
            <input id="documento" name="documento" className={campo} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" name="consentimiento" className="rounded" />
          Autoriza el tratamiento de sus datos (Ley 1581/2012)
        </label>
      </fieldset>

      <div>
        <label htmlFor="canal" className={etiqueta}>Canal</label>
        <select id="canal" name="canal" defaultValue={canales[0]?.valor ?? "web"} className={campo}>
          {canales.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
        </select>
      </div>

      {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}

      <button type="submit" disabled={pending || unicos.length === 0} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
        {pending ? "Registrando…" : "Registrar venta"}
      </button>
    </form>
  );
}
