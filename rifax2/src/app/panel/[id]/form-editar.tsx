"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { editarTenantAction } from "../actions";
import type { TenantDetalle } from "@/lib/superadmin";

const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const etiqueta = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

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

export default function FormEditarTenant({ tenant }: { tenant: TenantDetalle }) {
  const [sedesIlim, setSedesIlim] = useState(tenant.sedesIlimitadas);
  const [usuariosIlim, setUsuariosIlim] = useState(tenant.usuariosIlimitados);

  return (
    <form action={editarTenantAction} className="mt-6 space-y-5 rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <input type="hidden" name="tenant_id" value={tenant.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nombre" className={etiqueta}>Nombre de la empresa</label>
          <input id="nombre" name="nombre" required minLength={3} defaultValue={tenant.nombre} className={campo} />
        </div>
        <div>
          <label htmlFor="slug" className={etiqueta}>Identificador (slug)</label>
          <input id="slug" name="slug" required defaultValue={tenant.slug} pattern="[a-z0-9-]+" className={`${campo} font-mono`} />
        </div>
      </div>

      <fieldset className="space-y-4 rounded-xl border border-slate-300 p-4 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-300">Cupos</legend>
        <div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" name="sedes_ilimitadas" checked={sedesIlim} onChange={(e) => setSedesIlim(e.target.checked)} className="rounded" />
            Sedes ilimitadas
          </label>
          {!sedesIlim ? (
            <div className="mt-2">
              <label htmlFor="max_sedes" className={etiqueta}>Sedes autorizadas</label>
              <input id="max_sedes" name="max_sedes" type="number" min={1} defaultValue={tenant.maxSedes} className={`${campo} w-32`} />
            </div>
          ) : null}
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" name="usuarios_ilimitados" checked={usuariosIlim} onChange={(e) => setUsuariosIlim(e.target.checked)} className="rounded" />
            Usuarios ilimitados
          </label>
          {!usuariosIlim ? (
            <div className="mt-2">
              <label htmlFor="max_usuarios" className={etiqueta}>Número de usuarios</label>
              <input id="max_usuarios" name="max_usuarios" type="number" min={1} defaultValue={tenant.maxUsuarios ?? 5} className={`${campo} w-32`} />
            </div>
          ) : null}
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-slate-300 p-4 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-300">Vigencia y pago</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="fecha_inicio" className={etiqueta}>Fecha de inicio</label>
            <input id="fecha_inicio" name="fecha_inicio" type="date" defaultValue={tenant.fechaInicio ?? ""} className={campo} />
          </div>
          <div>
            <label htmlFor="periodicidad" className={etiqueta}>Periodicidad del plan</label>
            <select id="periodicidad" name="periodicidad" defaultValue={tenant.periodicidad} className={campo}>
              <option value="mensual">Mensual</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>
          </div>
          <div>
            <label htmlFor="periodicidad_pago" className={etiqueta}>Periodicidad de pago</label>
            <select id="periodicidad_pago" name="periodicidad_pago" defaultValue={tenant.periodicidadPago} className={campo}>
              <option value="mensual">Mensual</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Si cambias la periodicidad del plan o la fecha de inicio, el calendario de vencimientos se regenera (las fechas marcadas como pagadas también se reinician).
        </p>
      </fieldset>

      <BotonGuardar />
    </form>
  );
}
