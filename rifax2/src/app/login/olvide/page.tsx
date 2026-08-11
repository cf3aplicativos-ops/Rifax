"use client";

import { useActionState } from "react";
import { solicitarResetAction, type OlvideState } from "./actions";

const initial: OlvideState = {};

export default function OlvidePage() {
  const [state, action, pending] = useActionState(solicitarResetAction, initial);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e293b] text-2xl font-black text-[#f5c518] shadow-lg shadow-slate-900/25">R</div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Recuperar acceso</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Te ayudamos a restablecer tu contraseña.</p>
        </div>

        {state.ok ? (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/40">
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              Si el correo está registrado, te enviamos una contraseña temporal. Revisa tu bandeja de entrada (y spam) y úsala para ingresar.
            </p>
            <a href="/login" className="mt-4 inline-block rounded-lg bg-[#f5c518] px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-[#eab308]">Volver a ingresar</a>
          </div>
        ) : (
          <form action={action} className="space-y-4 rounded-2xl border border-slate-300 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Escribe tu correo registrado. Si coincide con tu cuenta, te enviamos una contraseña temporal de inmediato.
            </p>
            <div>
              <label htmlFor="correo" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Correo</label>
              <input id="correo" name="correo" type="email" autoComplete="username" autoFocus required className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </div>
            {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
            <button type="submit" disabled={pending} className="w-full rounded-lg bg-[#f5c518] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-500/30 transition hover:bg-[#eab308] disabled:opacity-60">
              {pending ? "Enviando…" : "Solicitar restablecimiento"}
            </button>
            <p className="text-center text-sm">
              <a href="/login" className="font-medium text-slate-600 hover:text-slate-900 hover:underline dark:text-slate-300">← Volver a ingresar</a>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
