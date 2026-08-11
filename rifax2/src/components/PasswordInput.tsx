"use client";

import { useState } from "react";

/**
 * Campo de contraseña con botón de ojo para mostrar/ocultar (requisito global).
 * Se usa en login, alta de usuarios/tenants y cambio de contraseña.
 */
export default function PasswordInput({
  name,
  id,
  placeholder,
  required = true,
  autoComplete = "current-password",
  minLength,
  className = "",
  autoFocus = false,
}: {
  name: string;
  id?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  className?: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id ?? name}
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
      >
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
      <path d="M6.6 6.6C3.6 8.3 2 12 2 12s3.5 7 10 7a9.1 9.1 0 0 0 5.4-1.6" />
      <path d="M3 3l18 18" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
