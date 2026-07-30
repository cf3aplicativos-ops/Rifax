"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { crearTenantAction, type TenantFormState } from "../actions";
import PasswordInput from "@/components/PasswordInput";
import { PageTitle } from "@/components/icons";

const initialState: TenantFormState = {};

const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const etiqueta = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function NuevoTenantPage() {
  const [state, action, pending] = useActionState(crearTenantAction, initialState);
  const [slug, setSlug] = useState("");

  return (
    <div className="max-w-xl">
      <Link href="/panel" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        ← Volver a empresas
      </Link>
      <PageTitle icon="nuevo" className="mt-2">Nueva empresa</PageTitle>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Se crea la empresa (tenant), su administrador y el número de sedes autorizadas.
      </p>

      <form
        action={action}
        className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nombre" className={etiqueta}>Nombre de la empresa</label>
            <input
              id="nombre"
              name="nombre"
              required
              minLength={3}
              onChange={(e) => setSlug(slugify(e.target.value))}
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="slug" className={etiqueta}>Identificador (slug)</label>
            <input
              id="slug"
              name="slug"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              pattern="[a-z0-9-]+"
              className={`${campo} font-mono`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="max_sedes" className={etiqueta}>Sedes autorizadas</label>
          <input id="max_sedes" name="max_sedes" type="number" min={1} defaultValue={1} required className={`${campo} w-32`} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            El admin de la empresa solo podrá crear este número de sedes. Podrás ampliarlo después.
          </p>
        </div>

        <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Administrador de la empresa
          </legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="admin_nombre" className={etiqueta}>Nombre</label>
              <input id="admin_nombre" name="admin_nombre" required minLength={3} className={campo} />
            </div>
            <div>
              <label htmlFor="admin_correo" className={etiqueta}>Correo</label>
              <input id="admin_correo" name="admin_correo" type="email" required className={campo} />
            </div>
          </div>
          <div>
            <label htmlFor="admin_password" className={etiqueta}>Contraseña inicial</label>
            <PasswordInput name="admin_password" autoComplete="new-password" minLength={8} />
          </div>
        </fieldset>

        {state.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Creando…" : "Crear empresa"}
        </button>
      </form>
    </div>
  );
}
