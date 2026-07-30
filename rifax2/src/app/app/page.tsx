import Link from "next/link";
import { requireUser, hasPermission } from "@/lib/auth/rbac";
import { estadoSedes, boletasPorEstado, carteraPorTramo } from "@/lib/dashboard";
import { money } from "@/lib/format";
import { BarChart, Donut } from "@/components/charts";
import PrintButton from "@/components/PrintButton";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";

const estadoClase: Record<string, string> = {
  activa: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  inactiva: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default async function AppHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;

  const sede = user.sede?.id ?? null;
  const [sedes, boletas, tramos] = await Promise.all([
    estadoSedes(user.tenant.id),
    boletasPorEstado(user.tenant.id, sede),
    carteraPorTramo(user.tenant.id, sede),
  ]);
  // Si el usuario está acotado a una sede, solo muestra la suya.
  const visibles = user.sede ? sedes.filter((s) => s.id === user.sede!.id) : sedes;

  const tramoLabel: Record<string, string> = { corriente: "Corriente", mora_1: "Mora 8–15d", mora_2: "Mora 16–30d", mora_3: "Mora +30d" };

  const tot = visibles.reduce(
    (a, s) => ({
      recaudado: a.recaudado + Number(s.recaudado),
      cartera: a.cartera + Number(s.cartera),
      ventas: a.ventas + s.ventas,
      rifas: a.rifas + s.rifasActivas,
    }),
    { recaudado: 0, cartera: 0, ventas: 0, rifas: 0 },
  );

  const boletasVendidas = boletas.pagada + boletas.reservada;
  const boletasChart = [
    { label: "Pagadas", value: boletas.pagada, color: "#10b981" },
    { label: "Reservadas", value: boletas.reservada, color: "#f59e0b" },
    { label: "Disponibles", value: boletas.disponible, color: "#cbd5e1" },
  ];

  return (
    <div>
      <style>{"@media print{header{display:none!important}.no-print{display:none!important}}"}</style>
      {denied ? (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          No tienes el permiso <code className="font-mono">{denied}</code> para esa sección.
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><Icon name="inicio" /></span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Hola, {user.nombre.split(" ")[0]}</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {user.tenant.nombre} · {user.rol} · {user.sede ? `Sede ${user.sede.nombre}` : `${sedes.length} sede${sedes.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <PrintButton label="Imprimir informe" />
          {hasPermission(user, "rifa.crear") ? (
            <Link href="/app/rifas/nueva" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">+ Nueva rifa</Link>
          ) : null}
        </div>
      </div>

      {sedes.length === 0 && hasPermission(user, "sede.crear") ? (
        <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950/40">
          <h2 className="font-semibold text-indigo-900 dark:text-indigo-200">Empieza creando una sede</h2>
          <p className="mt-1 text-sm text-indigo-700 dark:text-indigo-300">Tu empresa tiene {user.tenant.maxSedes} sede(s) autorizada(s).</p>
          <Link href="/app/sedes" className="mt-3 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Gestionar sedes →</Link>
        </div>
      ) : null}

      {/* Totales */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tarjeta v={money(tot.recaudado)} l="Recaudado" tono="text-emerald-600 dark:text-emerald-400" />
        <Tarjeta v={money(tot.cartera)} l="Cartera pendiente" tono="text-amber-600 dark:text-amber-400" />
        <Tarjeta v={String(tot.ventas)} l="Ventas" />
        <Tarjeta v={String(tot.rifas)} l="Rifas activas" />
      </div>

      {/* Gráficas gerenciales */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Boletas ({boletasVendidas.toLocaleString("es-CO")} vendidas)</h2>
          <div className="mt-4"><Donut data={boletasChart} /></div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recaudo por sede</h2>
          <div className="mt-4"><BarChart data={visibles.map((s) => ({ label: s.nombre, value: Number(s.recaudado) }))} format={money} /></div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cartera por antigüedad</h2>
          <div className="mt-4"><BarChart data={tramos.map((t) => ({ label: tramoLabel[t.tramo] ?? t.tramo, value: t.saldo }))} format={money} color="#f59e0b" /></div>
        </div>
      </div>

      {/* Estado por sede */}
      {visibles.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Estado por sede</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibles.map((s) => (
              <div key={String(s.id)} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{s.nombre}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoClase[s.estado] ?? estadoClase.inactiva}`}>{s.estado}</span>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <Fila k="Rifas activas" v={String(s.rifasActivas)} />
                  <Fila k="Ventas" v={String(s.ventas)} />
                  <Fila k="Recaudado" v={money(s.recaudado)} tono="text-emerald-600 dark:text-emerald-400" />
                  <Fila k="Cartera" v={money(s.cartera)} tono="text-amber-600 dark:text-amber-400" />
                </dl>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Tarjeta({ v, l, tono }: { v: string; l: string; tono?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className={`text-xl font-bold ${tono ?? "text-slate-900 dark:text-white"}`}>{v}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{l}</p>
    </div>
  );
}

function Fila({ k, v, tono }: { k: string; v: string; tono?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
      <dd className={`font-medium ${tono ?? "text-slate-900 dark:text-slate-100"}`}>{v}</dd>
    </div>
  );
}
