"use client";

import { useActionState } from "react";
import { confirmarResetAction, type ConfirmarResetState } from "./actions";

const initial: ConfirmarResetState = {};

export default function RestablecerClient({ token }: { token: string }) {
  const [state, action, pending] = useActionState(confirmarResetAction, initial);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e293b] text-2xl font-black text-[#f5c518] shadow-lg shadow-slate-900/25">R</div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Confirmar restablecimiento</h1>
        </div>

        {state.ok ? (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/40">
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              Listo. Te enviamos una contraseña temporal por correo. Revisa tu bandeja de entrada (y spam) y úsala para ingresar.
            </p>
            <a href="/login" className="mt-4 inline-block rounded-lg bg-[#f5c518] px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-[#eab308]">Volver a ingresar</a>
          </div>
        ) : (
          <form action={action} className="space-y-4 rounded-2xl border border-slate-300 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <input type="hidden" name="token" value={token} />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Confirma que fuiste tú quien pidió restablecer la contraseña. Te enviaremos una nueva por correo.
            </p>
            {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
            <button type="submit" disabled={pending} className="w-full rounded-lg bg-[#f5c518] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-500/30 transition hover:bg-[#eab308] disabled:opacity-60">
              {pending ? "Confirmando…" : "Confirmar restablecimiento"}
            </button>
            {state.error ? (
              <p className="text-center text-sm">
                <a href="/login/olvide" className="font-medium text-slate-600 hover:text-slate-900 hover:underline dark:text-slate-300">Solicitar un nuevo enlace</a>
              </p>
            ) : null}
          </form>
        )}
      </div>
    </main>
  );
}
