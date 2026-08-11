import Link from "next/link";
import { requirePermission } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/icons";
import FormAbonoOtraSede from "./form";

export const dynamic = "force-dynamic";

export default async function AbonoOtraSedePage() {
  const user = await requirePermission("pago.registrar_otra_sede");
  // Regla de negocio: esto es exclusivamente de oficina, nunca de un vendedor
  // (aunque tuviera el permiso por un override de permisos del tenant).
  if (user.rol === "vendedor") redirect("/app?denied=pago.registrar_otra_sede");

  return (
    <div>
      <Link href="/app/ventas" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        ← Volver a ventas
      </Link>
      <PageTitle icon="cuenta" className="mt-2">Abonar venta de otra sede</PageTitle>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Para clientes que pagan en esta oficina una venta registrada en otra sede de la empresa. Busca la venta por
        su código, el número de una boleta o el documento del cliente, confirma que es la correcta, registra el
        pago y genera el recibo.
      </p>
      <FormAbonoOtraSede />
    </div>
  );
}
