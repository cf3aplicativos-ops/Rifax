import Link from "next/link";
import { PageTitle } from "@/components/icons";
import { requirePermission } from "@/lib/auth/rbac";
import { sedesOperables } from "@/lib/rifas";
import { opcionesDe } from "@/lib/catalogos";
import FormRifa from "./form";

export const dynamic = "force-dynamic";

export default async function NuevaRifaPage() {
  const user = await requirePermission("rifa.crear");
  const [sedes, loterias] = await Promise.all([
    sedesOperables(user.tenant.id, user.sede?.id ?? null),
    opcionesDe(user.tenant.id, "loteria"),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app/rifas" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        ← Volver a rifas
      </Link>
      <PageTitle icon="nuevo" className="mt-2">Nueva rifa</PageTitle>

      {sedes.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No hay sedes activas. Crea o activa una sede antes de registrar rifas.
        </p>
      ) : (
        <FormRifa sedes={sedes.map((s) => ({ id: String(s.id), nombre: s.nombre }))} loterias={loterias} />
      )}
    </div>
  );
}
