import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/rbac";
import { getBranding } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import { brandCss } from "@/lib/color";
import AppShell from "./shell";
import VencimientoAviso from "./vencimiento-aviso";

const nav = [
  { href: "/app", label: "Inicio", icon: "inicio", exact: true, permiso: null },
  { href: "/app/rifas", label: "Rifas", icon: "rifas", permiso: "rifa.ver" },
  { href: "/app/ventas", label: "Ventas", icon: "ventas", permiso: "venta.ver" },
  { href: "/app/traspasos", label: "Traspasos", icon: "traspaso", permiso: "boleta.traspasar", ocultarVendedor: true },
  { href: "/app/cartera", label: "Cartera", icon: "cartera", permiso: "cartera.ver" },
  { href: "/app/conciliacion", label: "Conciliación IA", icon: "ia", permiso: "conciliacion.usar", ocultarVendedor: true },
  { href: "/app/reportes", label: "Reportes", icon: "reportes", permiso: "reporte.ver" },
  { href: "/app/vendedores", label: "Vendedores", icon: "vendedores", permiso: "vendedor.ver" },
  { href: "/app/comisiones", label: "Comisiones", icon: "comisiones", permiso: "cartera.ver" },
  { href: "/app/notificaciones", label: "Notificaciones", icon: "notificaciones", permiso: "mensaje.enviar", ocultarVendedor: true },
  { href: "/app/usuarios", label: "Usuarios", icon: "usuarios", permiso: "usuario.ver" },
  { href: "/app/sedes", label: "Sedes", icon: "sedes", permiso: "sede.ver" },
  { href: "/app/config", label: "Configuración", icon: "config", permiso: "config.gestionar" },
  { href: "/manual/manual-usuario.html", label: "Manual de usuario", icon: "manual", permiso: null, external: true },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Tras un restablecimiento, obliga a cambiar la contraseña temporal.
  if (user.debeCambiar) redirect("/cambiar-password");
  const branding = await getBranding(user.tenant.id);

  const items = nav
    .filter((n) => n.permiso === null || user.permisos.includes(n.permiso))
    // Ítems operativos (no aplican a un vendedor) se ocultan para ese rol.
    .filter((n) => !(user.rol === "vendedor" && "ocultarVendedor" in n && n.ocultarVendedor))
    .map((n) => ({ href: n.href, label: n.label, icon: n.icon, exact: n.exact, external: "external" in n && n.external }));

  // Vigencia del plan para el aviso emergente de vencimiento (#1d).
  const vfilas = await prisma.$queryRawUnsafe<{ dias: number | null; fecha: string | null }[]>(
    `SELECT (fecha_vencimiento - CURRENT_DATE)::int AS dias, to_char(fecha_vencimiento,'DD/MM/YYYY') AS fecha
       FROM saas.tenants WHERE id = $1::bigint`,
    user.tenant.id,
  );
  const venc = vfilas[0];

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950">
      <style>{brandCss(branding.colorPrimario)}</style>
      {venc?.dias != null && venc.fecha ? <VencimientoAviso dias={Number(venc.dias)} fecha={venc.fecha} /> : null}

      {/* #3 Fondo: imagen fija que se ajusta a la pantalla, con gradiente degradado
          para que el contenido sea legible. */}
      {branding.fondoUrl ? (
        <>
          <div
            className="fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${branding.fondoUrl})` }}
          />
          <div className="fixed inset-0 -z-10 bg-gradient-to-br from-white/85 via-white/90 to-white/97 dark:from-slate-950/88 dark:via-slate-950/92 dark:to-slate-950/97" />
        </>
      ) : null}

      <AppShell
        nav={items}
        tenant={user.tenant.nombre}
        sede={user.sede ? `Sede: ${user.sede.nombre}` : "Todas las sedes"}
        userName={user.nombre}
        userRol={user.rol}
        logoUrl={branding.logoUrl}
        puedeTraspasar={user.permisos.includes("boleta.traspasar")}
      >
        {children}
      </AppShell>
    </div>
  );
}
