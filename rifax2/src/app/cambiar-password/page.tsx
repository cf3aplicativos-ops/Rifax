"use client";

import { useActionState } from "react";
import { cambiarPasswordAction } from "@/app/app/usuarios/actions";
import type { UsuarioFormState } from "@/app/app/usuarios/actions";
import PasswordInput from "@/components/PasswordInput";

const initial: UsuarioFormState = {};

export default function CambiarPasswordPage() {
  const [state, action, pending] = useActionState(cambiarPasswordAction, initial);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e293b] text-2xl font-black text-[#f5c518] shadow-lg shadow-slate-900/25">R</div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Cambia tu contraseña</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Ingresaste con una contraseña temporal. Por seguridad, defínela nuevamente para continuar.
          </p>
        </div>

        <form action={action} className="space-y-4 rounded-2xl border border-slate-300 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Contraseña temporal (actual)</label>
            <PasswordInput name="actual" autoComplete="current-password" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nueva contraseña</label>
            <PasswordInput name="nueva" autoComplete="new-password" minLength={8} />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mínimo 8 caracteres, distinta de la temporal.</p>
          </div>
          {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p> : null}
          <button type="submit" disabled={pending} className="w-full rounded-lg bg-[#f5c518] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-500/30 transition hover:bg-[#eab308] disabled:opacity-60">
            {pending ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </main>
  );
}
