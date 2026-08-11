"use client";

import { useActionState, useMemo, useState } from "react";
import { crearUsuarioAction, type UsuarioFormState } from "../actions";
import PasswordInput from "@/components/PasswordInput";

const initialState: UsuarioFormState = {};
const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const etiqueta = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

interface Rol { id: string; nombre: string; descripcion: string | null; permisos: string[] }
interface Permiso { id: string; codigo: string }

function grupo(codigo: string) {
  return codigo.split(".")[0];
}

export default function FormUsuario({
  roles, permisos, sedes,
}: {
  roles: Rol[];
  permisos: Permiso[];
  sedes: { id: string; nombre: string }[];
}) {
  const [state, action, pending] = useActionState(crearUsuarioAction, initialState);
  const [rolId, setRolId] = useState(roles[0]?.id ?? "");
  const rolActual = roles.find((r) => r.id === rolId);
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(roles[0]?.permisos ?? []));
  const [tocado, setTocado] = useState(false);

  function cambiarRol(id: string) {
    setRolId(id);
    const r = roles.find((x) => x.id === id);
    setMarcados(new Set(r?.permisos ?? []));
    setTocado(false);
  }
  function toggle(pid: string) {
    setMarcados((prev) => {
      const n = new Set(prev);
      if (n.has(pid)) n.delete(pid); else n.add(pid);
      return n;
    });
    setTocado(true);
  }

  const grupos = useMemo(() => {
    const m = new Map<string, Permiso[]>();
    for (const p of permisos) {
      const g = grupo(p.codigo);
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(p);
    }
    return [...m.entries()];
  }, [permisos]);

  const distintoDelRol = tocado && rolActual && (
    marcados.size !== rolActual.permisos.length || rolActual.permisos.some((p) => !marcados.has(p))
  );

  return (
    <form action={action} className="mt-6 max-w-2xl space-y-4 rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <div>
        <label htmlFor="nombre" className={etiqueta}>Nombre completo</label>
        <input id="nombre" name="nombre" autoFocus required minLength={3} className={campo} />
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
          <select id="rol_id" name="rol_id" value={rolId} onChange={(e) => cambiarRol(e.target.value)} className={campo}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}{r.descripcion ? ` — ${r.descripcion}` : ""} ({r.permisos.length} permisos)</option>)}
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

      {/* Editor de permisos: precargados según el rol, editables por decisión. */}
      <fieldset className="rounded-xl border border-slate-300 p-4 dark:border-slate-700">
        <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Permisos {distintoDelRol ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">personalizados</span> : null}
        </legend>
        <p className="mb-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
          Se cargan los del rol; marca o desmarca para ajustarlos a este usuario.
        </p>
        <div className="space-y-3">
          {grupos.map(([g, lista]) => (
            <div key={g}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{g}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {lista.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                    <input type="checkbox" name="permisos" value={p.id} checked={marcados.has(p.id)} onChange={() => toggle(p.id)} className="rounded" />
                    <span className="font-mono text-xs">{p.codigo}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
        {pending ? "Creando…" : "Crear usuario"}
      </button>
    </form>
  );
}
