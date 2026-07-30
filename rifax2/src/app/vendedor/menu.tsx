"use client";

import Link from "next/link";
import { useState } from "react";
import { logoutUserAction } from "@/app/app/actions";

export default function MenuVendedor({ tenant, nombre }: { tenant: string; nombre: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <Link href="/vendedor" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">R</div>
          <div>
            <p className="text-sm font-bold leading-none text-slate-900 dark:text-white">Vendedor</p>
            <p className="text-[11px] leading-none text-slate-400">{tenant}</p>
          </div>
        </Link>
        <button aria-label="Menú" onClick={() => setOpen((o) => !o)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
      </div>
      {open ? (
        <nav className="border-t border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="px-1 py-2 text-xs text-slate-400">{nombre}</p>
          <Link href="/vendedor" onClick={() => setOpen(false)} className="block rounded-lg px-1 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Inicio</Link>
          <Link href="/vendedor/comisiones" onClick={() => setOpen(false)} className="block rounded-lg px-1 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Mis comisiones</Link>
          <Link href="/app/ventas/nueva" onClick={() => setOpen(false)} className="block rounded-lg px-1 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Registrar venta</Link>
          <form action={logoutUserAction} className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">
            <button type="submit" className="w-full rounded-lg px-1 py-2 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">Salir</button>
          </form>
        </nav>
      ) : null}
    </header>
  );
}
