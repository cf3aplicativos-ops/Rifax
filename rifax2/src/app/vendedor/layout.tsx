import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/rbac";
import { getBranding } from "@/lib/branding";
import VendedorShell from "./shell";
import type { NavItem } from "@/components/side-nav";

const nav: NavItem[] = [
  { href: "/vendedor", label: "Inicio", icon: "inicio", exact: true },
  { href: "/vendedor/comisiones", label: "Mis comisiones", icon: "comisiones" },
  { href: "/app/ventas/nueva", label: "Registrar venta", icon: "nuevo" },
];

export default async function VendedorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Solo para rol vendedor; otros roles usan el panel /app.
  if (user.rol !== "vendedor") redirect("/app");
  const branding = await getBranding(user.tenant.id);

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950">
      <style>{`:root{--rifax-accent:${branding.colorPrimario}}`}</style>
      <VendedorShell nav={nav} tenant={user.tenant.nombre} userName={user.nombre} logoUrl={branding.logoUrl}>
        {children}
      </VendedorShell>
    </div>
  );
}
