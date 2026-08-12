import { requireUser } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { listarVentas } from "@/lib/ventas";
import { money, estadoVentaClase } from "@/lib/format";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

interface Compra {
  rifaCodigo: string;
  boletas: number[];
  total: string;
  saldo: string;
  estado: string;
}

export default async function MisClientesVendedor() {
  const user = await requireUser();
  const vendedor = await prisma.vendedores.findFirst({ where: { tenant_id: user.tenant.id, usuario_id: user.id }, select: { id: true } });

  if (!vendedor) {
    return <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Tu usuario no está vinculado a un vendedor.</p>;
  }

  // Todas sus ventas activas (sin restricción de sede: son SUS ventas, sin
  // importar en cuál sede las hizo), agrupadas por cliente para responder
  // directamente "qué clientes tengo y qué números juegan cada uno".
  const ventas = (await listarVentas(user.tenant.id, null, vendedor.id)).filter((v) => v.estado !== "anulada");

  const porCliente = new Map<string, { nombre: string; telefono: string; compras: Compra[] }>();
  for (const v of ventas) {
    const id = String(v.cliente_id);
    if (!porCliente.has(id)) porCliente.set(id, { nombre: v.clientes.nombre, telefono: v.clientes.telefono, compras: [] });
    porCliente.get(id)!.compras.push({
      rifaCodigo: v.rifas.codigo,
      boletas: v.boletas,
      total: v.total.toString(),
      saldo: v.saldo.toString(),
      estado: v.estado,
    });
  }
  const clientes = [...porCliente.values()];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><Icon name="usuarios" /></span>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Mis clientes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{clientes.length} cliente{clientes.length === 1 ? "" : "s"} con compras activas.</p>
        </div>
      </div>

      {clientes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Aún no tienes ventas registradas.
        </p>
      ) : (
        <div className="space-y-3">
          {clientes.map((c) => (
            <div key={c.telefono} className="rounded-2xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="font-semibold text-slate-900 dark:text-white">{c.nombre}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{c.telefono}</p>
              <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                {c.compras.map((compra, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{compra.rifaCodigo}</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {compra.boletas.map((n) => (
                          <span key={n} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{n}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoVentaClase[compra.estado] ?? estadoVentaClase.pendiente_pago}`}>{compra.estado.replace("_", " ")}</span>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saldo {money(compra.saldo)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
