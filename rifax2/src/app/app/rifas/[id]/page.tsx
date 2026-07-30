import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { obtenerRifa } from "@/lib/rifas";
import { listarSorteos, premiosPendientes } from "@/lib/sorteos";
import { opcionesDe } from "@/lib/catalogos";
import { money, fecha } from "@/lib/format";
import { agregarPremioAction, agregarPremioAnticipadoAction, ejecutarSorteoAction, cambiarEntregaAction } from "./actions";
import { Icon } from "@/components/icons";

export const dynamic = "force-dynamic";
const entregaOpc = ["pendiente", "contactado", "entregado", "no_reclamado"];
const inp = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export default async function RifaDetalle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ premio?: string; anticipado?: string; sorteo?: string; ganador?: string; entrega?: string; error?: string }>;
}) {
  const user = await requirePermission("rifa.ver");
  const { id } = await params;
  const sp = await searchParams;
  let rifaId: bigint;
  try { rifaId = BigInt(id); } catch { notFound(); }

  const rifa = await obtenerRifa(user.tenant.id, rifaId);
  if (!rifa) notFound();
  const [sorteos, pendientes, loterias] = await Promise.all([
    listarSorteos(user.tenant.id, rifaId),
    premiosPendientes(user.tenant.id, rifaId),
    opcionesDe(user.tenant.id, "loteria"),
  ]);
  const loteriaLabel = (v: string | null) => loterias.find((l) => l.valor === v)?.etiqueta ?? v ?? "—";

  const puedeEditar = hasPermission(user, "rifa.editar");
  const puedeSortear = hasPermission(user, "sorteo.ejecutar");

  return (
    <div className="max-w-3xl">
      <Link href="/app/rifas" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a rifas</Link>
      <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-white">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><Icon name="rifas" /></span>
        <span className="font-mono">{rifa.codigo}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{rifa.estado}</span>
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {rifa.nombre} · {rifa.sedes.nombre} · {money(rifa.precio_boleta)} c/u · {rifa.total_boletas.toLocaleString("es-CO")} boletas ({rifa.numero_min}–{rifa.numero_max})
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Premio mayor con <span className="font-medium text-slate-700 dark:text-slate-300">{loteriaLabel(rifa.loteria)}</span> · sorteo {fecha(rifa.fecha_sorteo)}
      </p>

      {sp.premio ? <Aviso tipo="ok">Premio agregado.</Aviso> : null}
      {sp.anticipado ? <Aviso tipo="ok">Premio anticipado programado.</Aviso> : null}
      {sp.sorteo ? <Aviso tipo="ok">Sorteo ejecutado. Número ganador: <strong>{sp.sorteo}</strong>. {sp.ganador === "1" ? "La boleta estaba vendida y pagada." : "La boleta no tenía comprador pagado."}</Aviso> : null}
      {sp.entrega ? <Aviso tipo="ok">Estado de entrega actualizado.</Aviso> : null}
      {sp.error ? <Aviso tipo="error">{sp.error}</Aviso> : null}

      {/* PREMIOS */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Premios</h2>
        {rifa.premios.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Aún no hay premios. Agrega al menos uno para poder sortear.</p>
        ) : (
          <ol className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {rifa.premios.map((p) => (
              <li key={String(p.id)} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-slate-900 dark:text-slate-100"><span className="mr-2 text-slate-400">#{p.orden}</span>{p.nombre}</span>
                <span className="text-slate-500 dark:text-slate-400">{p.valor_estimado ? money(p.valor_estimado) : ""}</span>
              </li>
            ))}
          </ol>
        )}
        {puedeEditar && rifa.estado !== "sorteada" ? (
          <form action={agregarPremioAction} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="rifa_id" value={String(rifa.id)} />
            <input name="nombre" required placeholder="Nombre del premio" className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <input name="valor_estimado" type="number" min="0" placeholder="Valor (opcional)" className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Agregar premio</button>
          </form>
        ) : null}
      </section>

      {/* PREMIOS ANTICIPADOS */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Premios anticipados</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Se juegan en fechas previas al sorteo mayor, con su propia lotería.</p>
        {rifa.premios_anticipados.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sin premios anticipados programados.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr><th className="px-4 py-2 font-medium">Premio</th><th className="px-4 py-2 font-medium">Fecha</th><th className="px-4 py-2 font-medium">Lotería</th><th className="px-4 py-2 text-right font-medium">Pagos req.</th><th className="px-4 py-2 font-medium">Estado</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                {rifa.premios_anticipados.map((pa) => (
                  <tr key={String(pa.id)}>
                    <td className="px-4 py-2 text-slate-900 dark:text-slate-100">{pa.nombre}{pa.valor_estimado ? <span className="ml-1 text-xs text-slate-400">({money(pa.valor_estimado)})</span> : null}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{fecha(pa.fecha_juego)}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{loteriaLabel(pa.loteria)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">{pa.pagos_requeridos}</td>
                    <td className="px-4 py-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">{pa.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {puedeEditar && rifa.estado !== "sorteada" ? (
          <form action={agregarPremioAnticipadoAction} className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
            <input type="hidden" name="rifa_id" value={String(rifa.id)} />
            <input name="nombre" required placeholder="Nombre del premio" className={inp} />
            <select name="loteria" defaultValue="" className={inp}>
              <option value="">Lotería…</option>
              {loterias.map((l) => <option key={l.valor} value={l.valor}>{l.etiqueta}</option>)}
            </select>
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Fecha de juego</label>
              <input name="fecha_juego" type="date" required className={`${inp} w-full`} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Pagos requeridos</label>
              <input name="pagos_requeridos" type="number" min="1" defaultValue="1" className={`${inp} w-full`} />
            </div>
            <input name="valor_estimado" type="number" min="0" placeholder="Valor estimado (opcional)" className={inp} />
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Programar premio anticipado</button>
          </form>
        ) : null}
      </section>

      {/* SORTEOS */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Sorteos y ganadores</h2>
        {sorteos.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sin sorteos ejecutados.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {sorteos.map((s) => {
              const ganador = s.ganadores[0];
              return (
                <div key={String(s.id)} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{s.premios?.nombre ?? "Premio"} · número ganador <span className="font-mono text-indigo-600 dark:text-indigo-400">{s.numero_ganador}</span></p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">{s.modalidad}</span>
                  </div>
                  {s.modalidad === "commit_reveal" ? (
                    <p className="mt-1 break-all font-mono text-xs text-slate-400">commit {s.commit_hash?.slice(0, 24)}… · semilla {s.semilla?.slice(0, 24)}…</p>
                  ) : s.evidencia_url ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Evidencia: {s.evidencia_url}</p> : null}
                  <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm dark:border-slate-800">
                    <span className="text-slate-700 dark:text-slate-300">{ganador ? (ganador.clientes ? `Ganador: ${ganador.clientes.nombre} (${ganador.clientes.telefono})` : "Boleta no vendida / sin pago") : "Sin registro de boleta"}</span>
                    {ganador && ganador.clientes && puedeSortear ? (
                      <form action={cambiarEntregaAction} className="flex items-center gap-1">
                        <input type="hidden" name="rifa_id" value={String(rifa.id)} />
                        <input type="hidden" name="ganador_id" value={String(ganador.id)} />
                        <select name="estado" defaultValue={ganador.estado_entrega} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                          {entregaOpc.map((e) => <option key={e} value={e}>{e.replace("_", " ")}</option>)}
                        </select>
                        <button type="submit" className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">✓</button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {puedeSortear && pendientes.length > 0 && rifa.estado !== "borrador" ? (
          <form action={ejecutarSorteoAction} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ejecutar sorteo</h3>
            <input type="hidden" name="rifa_id" value={String(rifa.id)} />
            <select name="premio_id" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
              {pendientes.map((p) => <option key={String(p.id)} value={String(p.id)}>#{p.orden} — {p.nombre}</option>)}
            </select>
            <select name="modalidad" defaultValue="commit_reveal" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
              <option value="commit_reveal">Commit-reveal (verificable, número aleatorio)</option>
              <option value="externo">Externo (ingreso manual del número)</option>
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input name="numero_ganador" type="number" min={rifa.numero_min} max={rifa.numero_max} placeholder="Nº ganador (solo externo)" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              <input name="evidencia_url" placeholder="URL de evidencia (externo)" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </div>
            <button type="submit" className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Ejecutar sorteo</button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

function Aviso({ tipo, children }: { tipo: "ok" | "error"; children: React.ReactNode }) {
  const c = tipo === "ok" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return <p className={`mt-4 rounded-lg px-4 py-3 text-sm ${c}`}>{children}</p>;
}
