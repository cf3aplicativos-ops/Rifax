import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { rifasActivas, boletasDisponibles } from "@/lib/ventas";
import { opcionesDe } from "@/lib/catalogos";
import FormVenta from "./form";

export const dynamic = "force-dynamic";

export default async function NuevaVentaPage() {
  const user = await requirePermission("venta.crear");
  const [activas, canales] = await Promise.all([
    rifasActivas(user.tenant.id, user.sede?.id ?? null),
    opcionesDe(user.tenant.id, "canal_venta"),
  ]);

  const rifas = await Promise.all(
    activas.map(async (r) => ({
      id: String(r.id),
      codigo: r.codigo,
      nombre: r.nombre,
      precio: r.precio_boleta.toString(),
      numeroMin: r.numero_min,
      numeroMax: r.numero_max,
      sugeridos: await boletasDisponibles(user.tenant.id, r.id, 10),
    })),
  );

  return (
    <div className="max-w-3xl">
      <Link href="/app/ventas" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        ← Volver a ventas
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Nueva venta</h1>
      {rifas.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No hay rifas activas. Publica una rifa antes de vender.
        </p>
      ) : (
        <FormVenta rifas={rifas} canales={canales} />
      )}
    </div>
  );
}
