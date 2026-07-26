"use client";

import { useActionState } from "react";
import { crearUsuarioAction, type UsuarioFormState } from "../actions";
import PasswordInput from "@/components/PasswordInput";

const initialState: UsuarioFormState = {};
const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const etiqueta = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

export default function FormUsuario({ roles, sedes }: { roles: { id: string; nombre: string; permisos: number }[]; sedes: { id: string; nombre: string }[] }) {
  const [state, action, pending] = useActionState(crearUsuarioAction, initialState);

  return (
    <form action={action} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <label htmlFor="nombre" className={etiqueta}>Nombre completo</label>
        <input id="nombre" name="nombre" required minLength={3} className={campo} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="correo" className={etiqueta}>Correo</label>
          <input id="correo" name="correo" type="email" required className={campo} />
        </div>
        <div>
          <label htmlFor="telefono" className={etiqueta}>Teléfono <span className="text-slate-400">(opcional)</span></label>
          <input id="telefono" name="telefono" className={campo} />
        </div>
      </div>
      <div>
        <label htmlFor="password" className={etiqueta}>Contraseña inicial</label>
        <PasswordInput name="password" autoComplete="new-password" minLength={8} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rol_id" className={etiqueta}>Rol</label>
          <select id="rol_id" name="rol_id" className={campo}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre} ({r.permisos} permisos)</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="sede_id" className={etiqueta}>Sede <span className="text-slate-400">(opcional)</span></label>
          <select id="sede_id" name="sede_id" defaultValue="" className={campo}>
            <option value="">Todas las sedes</option>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      </div>
      {state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
        {pending ? "Creando…" : "Crear usuario"}
      </button>
    </form>
  );
}
