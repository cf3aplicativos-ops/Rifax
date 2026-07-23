"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { crearRifaAction, type RifaFormState } from "../actions";

const initialState: RifaFormState = {};

const campo =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
const etiqueta =
  "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export default function NuevaRifaPage() {
  const [state, action, pending] = useActionState(crearRifaAction, initialState);
  const [digitos, setDigitos] = useState(3);

  const totalBoletas = Math.pow(10, digitos);

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/rifas"
        className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Volver a rifas
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Nueva rifa
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Se creará en estado <strong>borrador</strong>. Las boletas se generan al
        publicarla.
      </p>

      <form
        action={action}
        className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <label htmlFor="nombre" className={etiqueta}>
            Nombre
          </label>
          <input id="nombre" name="nombre" required minLength={3} className={campo} />
        </div>

        <div>
          <label htmlFor="descripcion" className={etiqueta}>
            Descripción <span className="text-zinc-400">(opcional)</span>
          </label>
          <textarea id="descripcion" name="descripcion" rows={2} className={campo} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="numero_digitos" className={etiqueta}>
              Dígitos por boleta
            </label>
            <select
              id="numero_digitos"
              name="numero_digitos"
              value={digitos}
              onChange={(e) => setDigitos(Number(e.target.value))}
              className={campo}
            >
              {[2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>
                  {d} dígitos
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {totalBoletas.toLocaleString("es-CO")} boletas (0 a{" "}
              {(totalBoletas - 1).toLocaleString("es-CO")})
            </p>
          </div>

          <div>
            <label htmlFor="precio_boleta" className={etiqueta}>
              Precio por boleta (COP)
            </label>
            <input
              id="precio_boleta"
              name="precio_boleta"
              type="number"
              min="1"
              step="1"
              required
              className={campo}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="fecha_apertura" className={etiqueta}>
              Apertura
            </label>
            <input
              id="fecha_apertura"
              name="fecha_apertura"
              type="datetime-local"
              required
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="fecha_cierre_ventas" className={etiqueta}>
              Cierre de ventas
            </label>
            <input
              id="fecha_cierre_ventas"
              name="fecha_cierre_ventas"
              type="datetime-local"
              required
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="fecha_sorteo" className={etiqueta}>
              Sorteo
            </label>
            <input
              id="fecha_sorteo"
              name="fecha_sorteo"
              type="datetime-local"
              required
              className={campo}
            />
          </div>
        </div>

        <div>
          <label htmlFor="tasa_derechos" className={etiqueta}>
            Tasa de derechos <span className="text-zinc-400">(opcional, por defecto 0.14)</span>
          </label>
          <input
            id="tasa_derechos"
            name="tasa_derechos"
            type="number"
            min="0"
            max="1"
            step="0.0001"
            placeholder="0.1400"
            className={campo}
          />
        </div>

        {state.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Creando…" : "Crear rifa"}
        </button>
      </form>
    </div>
  );
}
