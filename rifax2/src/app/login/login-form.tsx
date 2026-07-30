"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import PasswordInput from "@/components/PasswordInput";

const initialState: LoginState = {};

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e293b] text-2xl font-black text-[#f5c518] shadow-lg shadow-slate-900/25">
          R
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          RIFA<span className="text-[#eab308]">X</span>
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Ingreso a la plataforma
        </p>
      </div>

      <form
        action={action}
        className="space-y-4 rounded-2xl border border-slate-300 bg-white/95 p-6 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
      >
        <div>
          <label htmlFor="correo" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Correo
          </label>
          <input
            id="correo"
            name="correo"
            type="email"
            autoComplete="username"
            required
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Contraseña
          </label>
          <PasswordInput name="password" autoComplete="current-password" />
        </div>

        {state.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[#f5c518] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm shadow-amber-500/30 transition hover:bg-[#eab308] disabled:opacity-60"
        >
          {pending ? "Ingresando…" : "Ingresar"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
        Plataforma multi-empresa de gestión de rifas
      </p>
    </div>
  );
}
