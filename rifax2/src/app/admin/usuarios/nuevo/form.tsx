"use client";

import { useActionState, useState } from "react";
import { crearUsuarioAction, type UsuarioFormState } from "../actions";

export interface RolOpcion {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: number;
}

const initialState: UsuarioFormState = {};

const campo =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
const etiqueta = "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export default function FormUsuario({ roles }: { roles: RolOpcion[] }) {
  const [state, action, pending] = useActionState(crearUsuarioAction, initialState);
  const [rolId, setRolId] = useState(roles[0]?.id ?? "");

  const rol = roles.find((r) => r.id === rolId);

  return (
    <form
      action={action}
      className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div>
        <label htmlFor="nombre" className={etiqueta}>
          Nombre completo
        </label>
        <input id="nombre" name="nombre" required minLength={3} className={campo} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="correo" className={etiqueta}>
            Correo
          </label>
          <input id="correo" name="correo" type="email" required className={campo} />
        </div>
        <div>
          <label htmlFor="telefono" className={etiqueta}>
            Teléfono <span className="text-zinc-400">(opcional)</span>
          </label>
          <input id="telefono" name="telefono" className={campo} />
        </div>
      </div>

      <div>
        <label htmlFor="password" className={etiqueta}>
          Contraseña inicial
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={campo}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Mínimo 8 caracteres. El usuario podrá cambiarla desde su perfil.
        </p>
      </div>

      <div>
        <label htmlFor="rol_id" className={etiqueta}>
          Rol
        </label>
        <select
          id="rol_id"
          name="rol_id"
          value={rolId}
          onChange={(e) => setRolId(e.target.value)}
          className={campo}
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
        {rol ? (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {rol.descripcion ?? "Sin descripción"} · {rol.permisos} permisos
          </p>
        ) : null}
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
        {pending ? "Creando…" : "Crear usuario"}
      </button>
    </form>
  );
}
