"use client";

import SideNav, { type NavItem } from "@/components/side-nav";
import { Icon } from "@/components/icons";
import { logoutUserAction } from "@/app/app/actions";

export default function VendedorShell({
  nav, tenant, userName, logoUrl, children,
}: {
  nav: NavItem[]; tenant: string; userName: string; logoUrl: string | null; children: React.ReactNode;
}) {
  const footer = (collapsed: boolean) => (
    <>
      <div className="flex items-center gap-2 rounded-lg px-2 py-2">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-white">{userName.charAt(0).toUpperCase()}</div>
        {!collapsed ? (
          <div className="min-w-0"><p className="truncate text-sm font-medium text-white">{userName}</p><p className="truncate text-xs text-slate-400">Vendedor</p></div>
        ) : null}
      </div>
      <form action={logoutUserAction} className="mt-1">
        <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10">
          <Icon name="salir" className="h-4 w-4 shrink-0" />{!collapsed ? "Salir" : null}
        </button>
      </form>
    </>
  );

  return (
    <SideNav nav={nav} brand={tenant} subtitle="Vendedor" logoUrl={logoUrl} homeHref="/vendedor" footer={footer}>
      {children}
    </SideNav>
  );
}
