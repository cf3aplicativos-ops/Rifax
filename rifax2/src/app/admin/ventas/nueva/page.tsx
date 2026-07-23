import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { boletasDisponibles } from "@/lib/ventas";
import FormVenta from "./form";

export const dynamic = "force-dynamic";

export default async function NuevaVentaPage() {
  await requirePermission("venta.crear");

  const activas = await prisma.rifas.findMany({
    where: { estado: "activa" },
    orderBy: { id: "desc" },
  });

  // Todo lo que cruza al cliente debe ser serializable (sin BigInt ni Decimal).
  const rifas = await Promise.all(
    activas.map(async (r) => ({
      id: String(r.id),
      codigo: r.codigo,
      nombre: r.nombre,
      precio: r.precio_boleta.toString(),
      numeroMin: r.numero_min,
      numeroMax: r.numero_max,
      disponibles: await prisma.boletas.count({
        where: { rifa_id: r.id, estado: "disponible" },
      }),
      sugeridos: await boletasDisponibles(r.id, 10),
    })),
  );

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/ventas"
        className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Volver a ventas
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Nueva venta</h1>

      {rifas.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No hay rifas activas. Publica una rifa antes de registrar ventas.
        </p>
      ) : (
        <FormVenta rifas={rifas} />
      )}
    </div>
  );
}
