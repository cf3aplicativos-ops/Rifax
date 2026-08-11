"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { editarUsuarioAction } from "../actions";
import PasswordInput from "@/components/PasswordInput";

const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const etiqueta = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

interface Rol { id: string; nombre: string; descripcion: string | null; permisos: string[] }
interface Permiso { id: string; codigo: string }
interface UsuarioEdit {
  id: string; nombre: string; correo: string; telefono: string;
  rolId: string; sedeId: string; permisosPersonalizados: string[] | null; esUnoMismo: boolean;
}

function grupo(codigo: string) {
  return codigo.split(".")[0];
}

// Botón de envío con estado de carga (useFormStatus solo funciona dentro de
// un descendiente del <form>, por eso vive en un componente aparte).
function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar cambios"}
    </button>
  );
}

export default function FormEditarUsuario({
  usuario, roles, permisos, sedes,
}: {
  usuario: UsuarioEdit;
  roles: Rol[];
  permisos: Permiso[];
  sedes: { id: string; nombre: string }[];
}) {
  const [rolId, setRolId] = useState(usuario.rolId);
  const rolActual = roles.find((r) => r.id === rolId);
  // Precarga: si el usuario tiene permisos personalizados, esos; si no, los de su rol actual.
  const inicial = usuario.permisosPersonalizados ?? roles.find((r) => r.id === usuario.rolId)?.permisos ?? [];
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(inicial));
  const [tocado, setTocado] = useState(usuario.permisosPersonalizados !== null);

  function cambiarRolSel(id: string) {
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
    <form action={editarUsuarioAction} className="mt-6 max-w-2xl space-y-4 rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <input type="hidden" name="usuario_id" value={usuario.id} />
      <div>
        <label htmlFor="nombre" className={etiqueta}>Nombre completo</label>
        <input id="nombre" name="nombre" autoFocus required minLength={3} defaultValue={usuario.nombre} className={campo} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="correo" className={etiqueta}>Correo</label>
          <input id="correo" name="correo" type="email" required defaultValue={usuario.correo} className={campo} />
        </div>
        <div>
          <label htmlFor="telefono" className={etiqueta}>Teléfono <span className="text-slate-400">(opcional)</span></label>
          <input id="telefono" name="telefono" defaultValue={usuario.telefono} className={campo} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rol_id" className={etiqueta}>
            Rol {usuario.esUnoMismo ? <span className="text-slate-400">(no puedes cambiar el tuyo)</span> : null}
          </label>
          <select
            id="rol_id"
            name="rol_id"
            value={rolId}
            disabled={usuario.esUnoMismo}
            onChange={(e) => cambiarRolSel(e.target.value)}
            className={`${campo} ${usuario.esUnoMismo ? "opacity-60" : ""}`}
          >
            {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}{r.descripcion ? ` — ${r.descripcion}` : ""} ({r.permisos.length} permisos)</option>)}
          </select>
          {usuario.esUnoMismo ? <input type="hidden" name="rol_id" value={usuario.rolId} /> : null}
        </div>
        <div>
          <label htmlFor="sede_id" className={etiqueta}>Sede <span className="text-slate-400">(opcional)</span></label>
          <select id="sede_id" name="sede_id" defaultValue={usuario.sedeId} className={campo}>
            <option value="">Todas las sedes</option>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="password" className={etiqueta}>Contraseña</label>
        <PasswordInput id="password" name="password" placeholder="••••••••" required={false} autoComplete="new-password" minLength={8} />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Déjala en blanco para mantener la actual. Escribe una nueva (mínimo 8 caracteres) para cambiarla; el usuario deberá confirmarla en su próximo ingreso.
        </p>
      </div>

      <fieldset className="rounded-xl border border-slate-300 p-4 dark:border-slate-700">
        <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
          Permisos {distintoDelRol ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">personalizados</span> : null}
        </legend>
        <p className="mb-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
          {usuario.permisosPersonalizados !== null
            ? "Este usuario ya tiene permisos personalizados (distintos de su rol). Ajústalos si hace falta."
            : "Actualmente usa los permisos de su rol. Marca o desmarca para personalizarlos."}
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

      <BotonGuardar />
    </form>
  );
}
