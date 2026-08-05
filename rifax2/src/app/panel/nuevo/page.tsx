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

function addMeses(base: Date, meses: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + meses);
  return d;
}
// Fechas de vencimiento según periodicidad: mensual=12, semestral=2, anual=1.
function calcularVencimientos(inicioISO: string, periodicidad: string): string[] {
  const base = inicioISO && /^\d{4}-\d{2}-\d{2}$/.test(inicioISO) ? new Date(inicioISO + "T00:00:00") : new Date();
  const n = periodicidad === "mensual" ? 12 : periodicidad === "semestral" ? 2 : 1;
  const pasoMeses = periodicidad === "mensual" ? 1 : periodicidad === "semestral" ? 6 : 12;
  const fmt = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  return Array.from({ length: n }, (_, k) => fmt.format(addMeses(base, (k + 1) * pasoMeses)));
}

export default function NuevoTenantPage() {
  const [state, action, pending] = useActionState(crearTenantAction, initialState);
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState("basico");
  const [sedesIlim, setSedesIlim] = useState(false);
  const [usuariosIlim, setUsuariosIlim] = useState(false);
  const [maxSedes, setMaxSedes] = useState("1");
  const [maxUsuarios, setMaxUsuarios] = useState("2");
  const [fechaInicio, setFechaInicio] = useState("");
  const [periodicidad, setPeriodicidad] = useState("mensual");
  const vencimientos = calcularVencimientos(fechaInicio, periodicidad);

  // Al elegir el plan se ajustan los límites por defecto:
  //  básico → 1 sede, 2 usuarios; corporativo → sedes y usuarios ilimitados.
  function cambiarPlan(p: string) {
    setPlan(p);
    if (p === "corporativo") {
      setSedesIlim(true);
      setUsuariosIlim(true);
    } else {
      setSedesIlim(false);
      setUsuariosIlim(false);
      setMaxSedes("1");
      setMaxUsuarios("2");
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/panel" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        ← Volver a empresas
      </Link>
      <PageTitle icon="nuevo" className="mt-2">Nueva empresa</PageTitle>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Se crea la empresa (tenant), su administrador y el número de sedes autorizadas.
      </p>

      <form
        action={action}
        className="mt-6 space-y-5 rounded-2xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
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

        {/* Logo de la empresa (se muestra a la izquierda, en el menú) */}
        <div>
          <label htmlFor="logo" className={etiqueta}>Logo de la empresa <span className="text-slate-400">(opcional · PNG, JPG, WEBP o SVG, máx. 400 KB)</span></label>
          <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700 dark:text-slate-300" />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Aparecerá a la izquierda, en el menú lateral del aplicativo. Podrás cambiarlo después en Configuración.</p>
        </div>

        {/* Plan y límites */}
        <fieldset className="space-y-4 rounded-xl border border-slate-300 p-4 dark:border-slate-700">
          <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-300">Plan y límites</legend>
          <div>
            <label htmlFor="plan" className={etiqueta}>Plan</label>
            <select id="plan" name="plan" value={plan} onChange={(e) => cambiarPlan(e.target.value)} className={campo}>
              <option value="basico">Básico (1 sede · 2 usuarios)</option>
              <option value="corporativo">Corporativo (sedes y usuarios ilimitados)</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" name="sedes_ilimitadas" checked={sedesIlim} onChange={(e) => setSedesIlim(e.target.checked)} className="rounded" />
              Sedes ilimitadas
            </label>
            {!sedesIlim ? (
              <div className="mt-2">
                <label htmlFor="max_sedes" className={etiqueta}>Sedes autorizadas</label>
                <input id="max_sedes" name="max_sedes" type="number" min={1} value={maxSedes} onChange={(e) => setMaxSedes(e.target.value)} className={`${campo} w-32`} />
              </div>
            ) : null}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" name="usuarios_ilimitados" checked={usuariosIlim} onChange={(e) => setUsuariosIlim(e.target.checked)} className="rounded" />
              Usuarios ilimitados
            </label>
            {/* El número de usuarios se muestra SIEMPRE (también en Corporativo). */}
            <div className="mt-2">
              <label htmlFor="max_usuarios" className={etiqueta}>
                Número de usuarios {usuariosIlim ? <span className="text-slate-400">(cupo opcional; ilimitado)</span> : null}
              </label>
              <input id="max_usuarios" name="max_usuarios" type="number" min={1} value={maxUsuarios} onChange={(e) => setMaxUsuarios(e.target.value)} className={`${campo} w-32`} />
            </div>
          </div>
        </fieldset>

        {/* Vigencia y pago */}
        <fieldset className="space-y-4 rounded-xl border border-slate-300 p-4 dark:border-slate-700">
          <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-300">Vigencia y pago</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="fecha_inicio" className={etiqueta}>Fecha de inicio</label>
              <input id="fecha_inicio" name="fecha_inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={campo} />
            </div>
            <div>
              <label htmlFor="periodicidad" className={etiqueta}>Periodicidad del plan</label>
              <select id="periodicidad" name="periodicidad" value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value)} className={campo}>
                <option value="mensual">Mensual</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </select>
            </div>
            <div>
              <label htmlFor="periodicidad_pago" className={etiqueta}>Periodicidad de pago</label>
              <select id="periodicidad_pago" name="periodicidad_pago" defaultValue="mensual" className={campo}>
                <option value="mensual">Mensual</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>
          {/* Fechas de vencimiento calculadas (mensual=12, semestral=2, anual=1). */}
          <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Fechas de vencimiento ({vencimientos.length})
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {vencimientos.map((v, i) => (
                <span key={i} className="rounded-md bg-white px-2 py-1 font-mono text-xs text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-300">{v}</span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Se generan automáticamente desde la fecha de inicio (o desde hoy). Podrás registrar el pago de cada fecha en el panel.
            </p>
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border border-slate-300 p-4 dark:border-slate-700">
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
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
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
