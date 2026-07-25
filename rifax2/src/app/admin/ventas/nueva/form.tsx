"use client";

import { useActionState, useMemo, useState } from "react";
import { crearVentaAction, type VentaFormState } from "../actions";

export interface RifaOpcion {
  id: string;
  codigo: string;
  nombre: string;
  precio: string;
  numeroMin: number;
  numeroMax: number;
  disponibles: number;
  sugeridos: number[];
}

const initialState: VentaFormState = {};

const campo =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
const etiqueta = "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export interface VendedorOpcion {
  id: string;
  nombre: string;
}

export default function FormVenta({
  rifas,
  vendedores,
}: {
  rifas: RifaOpcion[];
  vendedores: VendedorOpcion[];
}) {
  const [state, action, pending] = useActionState(crearVentaAction, initialState);
  const [rifaId, setRifaId] = useState(rifas[0]?.id ?? "");
  const [numeros, setNumeros] = useState("");
  // Clave de idempotencia estable por montaje del formulario: si se reenvía,
  // el servidor devuelve la venta ya creada en vez de duplicarla.
  const [idem] = useState(() => globalThis.crypto.randomUUID());

  const rifa = useMemo(() => rifas.find((r) => r.id === rifaId), [rifas, rifaId]);

  const lista = useMemo(
    () =>
      numeros
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0),
    [numeros],
  );
  const unicos = useMemo(() => [...new Set(lista)], [lista]);
  const total = rifa ? Number(rifa.precio) * unicos.length : 0;

  function agregar(n: number) {
    setNumeros((prev) => {
      const actuales = prev.split(/[\s,]+/).filter(Boolean);
      if (actuales.includes(String(n))) return prev;
      return [...actuales, String(n)].join(", ");
    });
  }

  return (
    <form
      action={action}
      className="mt-6 space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <input type="hidden" name="idem" value={idem} />

      <div>
        <label htmlFor="rifa_id" className={etiqueta}>
          Rifa
        </label>
        <select
          id="rifa_id"
          name="rifa_id"
          value={rifaId}
          onChange={(e) => setRifaId(e.target.value)}
          className={campo}
        >
          {rifas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.codigo} — {r.nombre} ({cop.format(Number(r.precio))} c/u)
            </option>
          ))}
        </select>
        {rifa ? (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Rango {rifa.numeroMin}–{rifa.numeroMax} ·{" "}
            {rifa.disponibles.toLocaleString("es-CO")} boletas disponibles
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="numeros" className={etiqueta}>
          Números de boleta
        </label>
        <input
          id="numeros"
          name="numeros"
          value={numeros}
          onChange={(e) => setNumeros(e.target.value)}
          placeholder="Ej: 7, 15, 42"
          required
          className={campo}
        />
        {rifa && rifa.sugeridos.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Disponibles:</span>
            {rifa.sugeridos.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => agregar(n)}
                className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700 transition hover:bg-red-100 hover:text-red-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-red-950 dark:hover:text-red-300"
              >
                {n}
              </button>
            ))}
          </div>
        ) : null}
        {unicos.length > 0 ? (
          <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {unicos.length} boleta{unicos.length === 1 ? "" : "s"} · Total{" "}
            <span className="text-red-600">{cop.format(total)}</span>
          </p>
        ) : null}
      </div>

      <fieldset className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <legend className="px-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Cliente
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nombre" className={etiqueta}>
              Nombre
            </label>
            <input id="nombre" name="nombre" required minLength={2} className={campo} />
          </div>
          <div>
            <label htmlFor="telefono" className={etiqueta}>
              Teléfono
            </label>
            <input
              id="telefono"
              name="telefono"
              required
              minLength={7}
              placeholder="3001234567"
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="correo" className={etiqueta}>
              Correo <span className="text-zinc-400">(opcional)</span>
            </label>
            <input id="correo" name="correo" type="email" className={campo} />
          </div>
          <div>
            <label htmlFor="documento" className={etiqueta}>
              Documento <span className="text-zinc-400">(opcional)</span>
            </label>
            <input id="documento" name="documento" className={campo} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" name="consentimiento" className="rounded" />
          Autoriza el tratamiento de sus datos (Ley 1581/2012)
        </label>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="canal" className={etiqueta}>
            Canal
          </label>
          <select id="canal" name="canal" defaultValue="web" className={campo}>
            <option value="web">Web</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="vendedor">Vendedor</option>
            <option value="pos">Punto de venta</option>
          </select>
        </div>
        <div>
          <label htmlFor="vendedor_id" className={etiqueta}>
            Vendedor <span className="text-zinc-400">(opcional)</span>
          </label>
          <select id="vendedor_id" name="vendedor_id" defaultValue="" className={campo}>
            <option value="">Sin vendedor</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || unicos.length === 0}
        className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Registrando…" : "Registrar venta"}
      </button>
    </form>
  );
}
