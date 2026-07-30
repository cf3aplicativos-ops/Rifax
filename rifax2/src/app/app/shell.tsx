"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutUserAction } from "./actions";

export interface NavItem { href: string; label: string }

export default function AppShell({
  nav,
  tenant,
  sede,
  userName,
  userRol,
  logoUrl,
  children,
}: {
  nav: NavItem[];
  tenant: string;
  sede: string;
  userName: string;
  userRol: string;
  logoUrl: string | null;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const activo = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));
  const w = collapsed ? "lg:w-16" : "lg:w-60";

  const Logo = (
    <div className="flex items-center gap-2 overflow-hidden">
      {logoUrl ? (
        <Image src={logoUrl} alt={tenant} width={40} height={40} unoptimized className="h-10 w-10 shrink-0 rounded-xl object-contain" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">{tenant.charAt(0).toUpperCase()}</div>
      )}
      {!collapsed ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-slate-900 dark:text-white">{tenant}</p>
          <p className="truncate text-[11px] leading-tight text-slate-400">{sede}</p>
        </div>
      ) : null}
    </div>
  );

  const NavLinks = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {nav.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          onClick={() => setMobileOpen(false)}
          title={n.label}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
            activo(n.href)
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          {collapsed ? (
            <span className="grid h-5 w-5 shrink-0 place-items-center text-[13px] font-bold">{n.label.charAt(0)}</span>
          ) : (
            <span className="truncate">{n.label}</span>
          )}
        </Link>
      ))}
    </nav>
  );

  const Footer = (
    <div className="border-t border-slate-200 p-3 dark:border-slate-800">
      <Link href="/app/perfil" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{userName.charAt(0).toUpperCase()}</div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{userName}</p>
            <p className="truncate text-xs text-slate-400">{userRol}</p>
          </div>
        ) : null}
      </Link>
      <form action={logoutUserAction} className="mt-1">
        <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
          {collapsed ? "⎋" : "Salir"}
        </button>
      </form>
    </div>
  );

  return (
    <div className="relative min-h-screen">
      {/* Sidebar desktop */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-200 bg-white/90 backdrop-blur lg:flex dark:border-slate-800 dark:bg-slate-900/90 ${w} transition-all`}>
        <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-800">
          {Logo}
          <button onClick={() => setCollapsed((c) => !c)} aria-label="Contraer menú" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={collapsed ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} /></svg>
          </button>
        </div>
        {NavLinks}
        {Footer}
      </aside>

      {/* Topbar móvil */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-900/90">
        <button onClick={() => setMobileOpen(true)} aria-label="Abrir menú" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
        {Logo}
        <span className="w-9" />
      </header>

      {/* Drawer móvil */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-800">
              {Logo}
              <button onClick={() => setMobileOpen(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            {NavLinks}
            {Footer}
          </aside>
        </div>
      ) : null}

      {/* Contenido */}
      <div className={`transition-all ${collapsed ? "lg:pl-16" : "lg:pl-60"}`}>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
