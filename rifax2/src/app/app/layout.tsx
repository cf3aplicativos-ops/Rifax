import { requireUser } from "@/lib/auth/rbac";
import { getBranding } from "@/lib/branding";
import AppShell from "./shell";

const nav = [
  { href: "/app", label: "Inicio", permiso: null },
  { href: "/app/rifas", label: "Rifas", permiso: "rifa.ver" },
  { href: "/app/ventas", label: "Ventas", permiso: "venta.ver" },
  { href: "/app/cartera", label: "Cartera", permiso: "cartera.ver" },
  { href: "/app/reportes", label: "Reportes", permiso: "reporte.ver" },
  { href: "/app/vendedores", label: "Vendedores", permiso: "vendedor.ver" },
  { href: "/app/comisiones", label: "Comisiones", permiso: "cartera.ver" },
  { href: "/app/notificaciones", label: "Notificaciones", permiso: "mensaje.enviar" },
  { href: "/app/usuarios", label: "Usuarios", permiso: "usuario.ver" },
  { href: "/app/sedes", label: "Sedes", permiso: "sede.ver" },
  { href: "/app/config", label: "Configuración", permiso: "config.gestionar" },
];

function darken(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (x: number) => Math.max(0, Math.round(x * (1 - amt))).toString(16).padStart(2, "0");
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const branding = await getBranding(user.tenant.id);
  const brand = branding.colorPrimario;
  const brandCss = `:root{--color-indigo-50:${brand}14;--color-indigo-500:${brand};--color-indigo-600:${brand};--color-indigo-700:${darken(brand, 0.14)};}`;

  const items = nav.filter((n) => n.permiso === null || user.permisos.includes(n.permiso)).map((n) => ({ href: n.href, label: n.label }));

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950">
      <style>{brandCss}</style>

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
