import { requirePermission } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { capacidades } from "@/lib/planes";
import { listarVendedores } from "@/lib/vendedores";
import { iaDisponible } from "@/lib/ia";
import { Icon } from "@/components/icons";
import ConciliacionForm from "./form";

export const dynamic = "force-dynamic";

export default async function ConciliacionPage() {
  const user = await requirePermission("conciliacion.usar");

  const planFilas = await prisma.$queryRawUnsafe<{ plan: string }[]>(
    `SELECT plan FROM saas.tenants WHERE id=$1::bigint`,
    user.tenant.id,
  );
  const cap = capacidades(planFilas[0]?.plan);

  if (!cap.conciliacionIA) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
          <Icon name="ia" className="h-6 w-6" />
        </span>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Conciliación con IA</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Esta función está disponible en el plan <strong>Corporativo</strong>. Contacta al administrador de la
          plataforma para actualizar tu plan.
        </p>
      </div>
    );
  }

  const vendedores = await listarVendedores(user.tenant.id);
  const vendedoresOpciones = vendedores
    .filter((v) => v.estado === "activo")
    .map((v) => ({ id: String(v.id), nombre: v.nombre }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
          <Icon name="ia" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Conciliación con IA</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            La IA solo <strong>sugiere</strong> coincidencias entre pagos y cartera pendiente. Nada se registra
            hasta que tú lo revisas y confirmas.
          </p>
        </div>
      </div>

      {!iaDisponible() ? (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          El servicio de IA todavía no está configurado en la plataforma (falta la clave del proveedor). Puedes
          explorar la pantalla, pero los análisis fallarán hasta que se configure.
        </div>
      ) : null}

      <ConciliacionForm vendedores={vendedoresOpciones} />
    </div>
  );
}
