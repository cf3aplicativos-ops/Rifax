import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/rbac";
import { getBranding } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import AppShell from "./shell";
import VencimientoAviso from "./vencimiento-aviso";

const nav = [
  { href: "/app", label: "Inicio", icon: "inicio", exact: true, permiso: null },
  { href: "/app/rifas", label: "Rifas", icon: "rifas", permiso: "rifa.ver" },
  { href: "/app/ventas", label: "Ventas", icon: "ventas", permiso: "venta.ver" },
  { href: "/app/traspasos", label: "Traspasos", icon: "traspaso", permiso: "boleta.traspasar", ocultarVendedor: true },
  { href: "/app/cartera", label: "Cartera", icon: "cartera", permiso: "cartera.ver" },
  { href: "/app/reportes", label: "Reportes", icon: "reportes", permiso: "reporte.ver" },
  { href: "/app/vendedores", label: "Vendedores", icon: "vendedores", permiso: "vendedor.ver" },
  { href: "/app/comisiones", label: "Comisiones", icon: "comisiones", permiso: "cartera.ver" },
  { href: "/app/notificaciones", label: "Notificaciones", icon: "notificaciones", permiso: "mensaje.enviar", ocultarVendedor: true },
  { href: "/app/usuarios", label: "Usuarios", icon: "usuarios", permiso: "usuario.ver" },
  { href: "/app/sedes", label: "Sedes", icon: "sedes", permiso: "sede.ver" },
  { href: "/app/config", label: "Configuración", icon: "config", permiso: "config.gestionar" },
];

function darken(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (x: number) => Math.max(0, Math.round(x * (1 - amt))).toString(16).padStart(2, "0");
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

// Luminancia relativa aproximada (0 = negro, 1 = blanco) para decidir el color
// de texto que contrasta sobre el color de marca.
function luminancia(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Tras un restablecimiento, obliga a cambiar la contraseña temporal.
  if (user.debeCambiar) redirect("/cambiar-password");
  const branding = await getBranding(user.tenant.id);
  const brand = branding.colorPrimario;
  // Si el color de marca es claro (p. ej. el amarillo Rifax), el texto sobre los
  // elementos primarios debe ser oscuro para que contraste.
  const claro = luminancia(brand) > 0.6;
  const fgPrimario = claro ? "#1e293b" : "#ffffff";
  const brandCss =
    `:root{--rifax-accent:${brand};--color-indigo-50:${brand}14;--color-indigo-500:${brand};--color-indigo-600:${brand};--color-indigo-700:${darken(brand, 0.12)};}` +
    (claro ? ".bg-indigo-600{color:" + fgPrimario + " !important}" : "");

  const items = nav
    .filter((n) => n.permiso === null || user.permisos.includes(n.permiso))
    // Ítems operativos (no aplican a un vendedor) se ocultan para ese rol.
    .filter((n) => !(user.rol === "vendedor" && "ocultarVendedor" in n && n.ocultarVendedor))
    .map((n) => ({ href: n.href, label: n.label, icon: n.icon, exact: n.exact }));

  // Vigencia del plan para el aviso emergente de vencimiento (#1d).
  const vfilas = await prisma.$queryRawUnsafe<{ dias: number | null; fecha: string | null }[]>(
    `SELECT (fecha_vencimiento - CURRENT_DATE)::int AS dias, to_char(fecha_vencimiento,'DD/MM/YYYY') AS fecha
       FROM saas.tenants WHERE id = $1::bigint`,
    user.tenant.id,
  );
  const venc = vfilas[0];

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950">
      <style>{brandCss}</style>
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
      >
        {children}
      </AppShell>
    </div>
  );
}
