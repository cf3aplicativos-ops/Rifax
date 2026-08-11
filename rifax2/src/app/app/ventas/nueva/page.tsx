import Link from "next/link";
import { PageTitle } from "@/components/icons";
import { requirePermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { rifasActivas, boletasDisponibles } from "@/lib/ventas";
import { imagenesRifa } from "@/lib/rifas";
import { rifasVentaVendedor } from "@/lib/portal-vendedor";
import { opcionesDe } from "@/lib/catalogos";
import FormVenta from "./form";

export const dynamic = "force-dynamic";

export default async function NuevaVentaPage() {
  const user = await requirePermission("venta.crear");
  const canales = await opcionesDe(user.tenant.id, "canal_venta");
  const esVendedor = user.rol === "vendedor";

  // Vendedor: solo su información, sus rifas y sus boletas asignadas.
  if (esVendedor) {
    const vend = await prisma.vendedores.findFirst({
      where: { tenant_id: user.tenant.id, usuario_id: user.id },
      select: { id: true, nombre: true },
    });
    if (!vend) {
      return (
        <div>
          <Link href="/vendedor" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver</Link>
          <PageTitle icon="nuevo" className="mt-2">Nueva venta</PageTitle>
          <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Tu usuario no está vinculado a un vendedor. Pide al administrador que cree tu acceso.
          </p>
        </div>
      );
    }
    const rifas = await rifasVentaVendedor(user.tenant.id, vend.id);
    return (
      <div>
        <Link href="/vendedor" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver</Link>
        <PageTitle icon="nuevo" className="mt-2">Nueva venta</PageTitle>
        {rifas.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No tienes talonarios con boletas disponibles en rifas activas.
          </p>
        ) : (
          <FormVenta rifas={rifas} canales={canales} modo="vendedor" vendedorNombre={vend.nombre} />
        )}
      </div>
    );
  }

  // Admin / cajero: comportamiento general.
  const activas = await rifasActivas(user.tenant.id, user.sede?.id ?? null);
  const rifas = await Promise.all(
    activas.map(async (r) => ({
      id: String(r.id),
      codigo: r.codigo,
      nombre: r.nombre,
      precio: r.precio_boleta.toString(),
      numeroMin: r.numero_min,
      numeroMax: r.numero_max,
      // En rifa compartida, sugiere solo las boletas de la sede del usuario (si está acotado).
      sugeridos: await boletasDisponibles(user.tenant.id, r.id, 10, r.compartida ? (user.sede?.id ?? null) : null),
      boletaImagenUrl: (await imagenesRifa(user.tenant.id, r.id)).boleta,
    })),
  );

  return (
    <div>
      <Link href="/app/ventas" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        ← Volver a ventas
      </Link>
      <PageTitle icon="nuevo" className="mt-2">Nueva venta</PageTitle>
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
