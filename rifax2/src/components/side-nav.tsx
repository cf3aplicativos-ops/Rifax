"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";

export interface NavItem { href: string; label: string; icon: string; exact?: boolean }

// Menú lateral azul marino. Dos modos:
//  - "rail" (admin): barra fija colapsable en escritorio + cajón en móvil.
//  - "hamburger" (vendedor/cliente): barra superior con botón de tres líneas
//    que abre y contrae un cajón lateral a cualquier tamaño.
// Ítem activo resaltado en amarillo (--rifax-accent).
const SIDEBAR = "bg-[#1e293b] text-slate-100";
const ACTIVE = "bg-[var(--rifax-accent,#f5c518)] font-semibold text-slate-900";
const IDLE = "text-slate-300 hover:bg-white/10 hover:text-white";

export default function SideNav({
  nav, brand, subtitle, logoUrl, homeHref = "/", footer, mode = "rail", children,
}: {
  nav: NavItem[];
  brand: string;
  subtitle?: string;
  logoUrl: string | null;
  homeHref?: string;
  footer?: (collapsed: boolean) => ReactNode;
  mode?: "rail" | "hamburger";
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const hamburger = mode === "hamburger";
  const activo = (n: NavItem) => (n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + "/"));
  const w = collapsed ? "lg:w-16" : "lg:w-60";

  const Marca = (showText: boolean) => (
    <Link href={homeHref} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 overflow-hidden">
      {logoUrl ? (
        <Image src={logoUrl} alt={brand} width={44} height={44} unoptimized className="h-11 w-11 shrink-0 rounded-xl bg-white/10 object-contain p-0.5" />
      ) : (
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--rifax-accent,#f5c518)] text-lg font-black text-slate-900">{brand.charAt(0).toUpperCase()}</div>
      )}
      {showText ? (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-white">{brand}</p>
          {subtitle ? <p className="truncate text-[11px] leading-tight text-slate-400">{subtitle}</p> : null}
        </div>
      ) : null}
    </Link>
  );

  const NavLinks = (collapsedRail: boolean) => (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {nav.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          onClick={() => setMobileOpen(false)}
          title={n.label}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${activo(n) ? ACTIVE : IDLE} ${collapsedRail ? "lg:justify-center" : ""}`}
        >
          <Icon name={n.icon} className="h-5 w-5 shrink-0" />
          {!collapsedRail ? <span className="truncate">{n.label}</span> : null}
        </Link>
      ))}
    </nav>
  );

  const CerrarBtn = (
    <button onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
    </button>
  );

  // Cajón lateral (overlay). Usado por ambos modos; en hamburguesa es visible a
  // cualquier tamaño (sin lg:hidden).
  const Drawer = mobileOpen ? (
    <div className={`fixed inset-0 z-40 ${hamburger ? "" : "lg:hidden"}`}>
      <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
      <aside className={`absolute inset-y-0 left-0 flex w-64 flex-col ${SIDEBAR}`}>
        <div className="flex items-center justify-between border-b border-white/10 p-3">
          {Marca(true)}
          {CerrarBtn}
        </div>
        {NavLinks(false)}
        {footer ? <div className="border-t border-white/10 p-3">{footer(false)}</div> : null}
      </aside>
    </div>
  ) : null;

  const TresLineas = (
    <button onClick={() => setMobileOpen((o) => !o)} aria-label="Abrir o cerrar menú" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
    </button>
  );

  // ---- Modo hamburguesa (vendedor / cliente) ----
  if (hamburger) {
    return (
      <div className="relative min-h-screen">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-300 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          {TresLineas}
          <Link href={homeHref} className="flex items-center gap-2">
            {logoUrl ? (
              <Image src={logoUrl} alt={brand} width={32} height={32} unoptimized className="h-8 w-8 rounded-lg object-contain" />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--rifax-accent,#f5c518)] text-sm font-black text-slate-900">{brand.charAt(0).toUpperCase()}</span>
            )}
            <span className="font-bold text-slate-900 dark:text-white">{brand}</span>
          </Link>
        </header>
        {Drawer}
        <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    );
  }

  // ---- Modo rail (admin) ----
  const CollapseBtn = (
    <button onClick={() => setCollapsed((c) => !c)} aria-label="Contraer menú" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={collapsed ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} /></svg>
    </button>
  );

  return (
    <div className="relative min-h-screen">
      {/* Sidebar escritorio */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col lg:flex ${SIDEBAR} ${w} transition-all`}>
        <div className="flex items-center justify-between border-b border-white/10 p-3">
          {Marca(!collapsed)}
          {!collapsed ? CollapseBtn : null}
        </div>
        {collapsed ? <div className="flex justify-center py-2">{CollapseBtn}</div> : null}
        {NavLinks(collapsed)}
        {footer ? <div className="border-t border-white/10 p-3">{footer(collapsed)}</div> : null}
      </aside>

      {/* Topbar móvil */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-300 bg-white/95 px-4 py-3 backdrop-blur lg:hidden dark:border-slate-700 dark:bg-slate-900/95">
        {TresLineas}
        <span className="flex items-center gap-2">
          {logoUrl ? <Image src={logoUrl} alt={brand} width={32} height={32} unoptimized className="h-8 w-8 rounded-lg object-contain" /> : <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--rifax-accent,#f5c518)] text-sm font-black text-slate-900">{brand.charAt(0).toUpperCase()}</span>}
          <span className="font-bold text-slate-900 dark:text-white">{brand}</span>
        </span>
        <span className="w-9" />
      </header>

      {Drawer}

      {/* Contenido */}
      <div className={`transition-all ${collapsed ? "lg:pl-16" : "lg:pl-60"}`}>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
