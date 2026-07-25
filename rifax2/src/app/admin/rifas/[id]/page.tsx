import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { obtenerRifa } from "@/lib/rifas";
import { listarSorteos, premiosPendientes } from "@/lib/sorteos";
import { money } from "@/lib/format";
import { agregarPremioAction, ejecutarSorteoAction, cambiarEntregaAction } from "./actions";

export const dynamic = "force-dynamic";

const entregaOpciones = ["pendiente", "contactado", "entregado", "no_reclamado"];

export default async function RifaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ premio?: string; sorteo?: string; ganador?: string; entrega?: string; error?: string }>;
}) {
  const user = await requirePermission("rifa.ver");
  const { id } = await params;
  const sp = await searchParams;

  let rifaId: bigint;
  try {
    rifaId = BigInt(id);
  } catch {
    notFound();
  }

  const rifa = await obtenerRifa(rifaId);
  if (!rifa) notFound();

  const [sorteos, pendientes] = await Promise.all([
    listarSorteos(rifaId),
    premiosPendientes(rifaId),
  ]);

  const puedeEditar = hasPermission(user, "rifa.editar");
  const puedeSortear = hasPermission(user, "sorteo.ejecutar");

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/rifas"
        className="text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Volver a rifas
      </Link>
      <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        <span className="font-mono">{rifa.codigo}</span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {rifa.estado}
        </span>
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {rifa.nombre} · {money(rifa.precio_boleta)} c/u · {rifa.total_boletas.toLocaleString("es-CO")}{" "}
        boletas ({rifa.numero_min}–{rifa.numero_max})
      </p>

      {sp.premio ? <Aviso tipo="ok">Premio agregado.</Aviso> : null}
      {sp.sorteo ? (
        <Aviso tipo="ok">
          Sorteo ejecutado. Número ganador: <strong>{sp.sorteo}</strong>.{" "}
          {sp.ganador === "1" ? "La boleta estaba vendida y pagada." : "La boleta no tenía comprador pagado."}
        </Aviso>
      ) : null}
      {sp.entrega ? <Aviso tipo="ok">Estado de entrega actualizado.</Aviso> : null}
      {sp.error ? <Aviso tipo="error">{sp.error}</Aviso> : null}

      {/* PREMIOS */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Premios</h2>
        {rifa.premios.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay premios. Agrega al menos uno para poder sortear.
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {rifa.premios.map((p) => (
              <li key={String(p.id)} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-zinc-900 dark:text-zinc-100">
                  <span className="mr-2 text-zinc-400">#{p.orden}</span>
                  {p.nombre}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {p.valor_estimado ? money(p.valor_estimado) : ""}
                </span>
              </li>
            ))}
          </ol>
        )}

        {puedeEditar && rifa.estado !== "sorteada" ? (
          <form action={agregarPremioAction} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="rifa_id" value={String(rifa.id)} />
            <input
              name="nombre"
              required
              placeholder="Nombre del premio"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <input
              name="valor_estimado"
              type="number"
              min="0"
              placeholder="Valor (opcional)"
              className="w-40 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Agregar premio
            </button>
          </form>
        ) : null}
      </section>

      {/* SORTEOS / GANADORES */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Sorteos y ganadores
        </h2>

        {sorteos.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Sin sorteos ejecutados.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {sorteos.map((s) => {
              const ganador = s.ganadores[0];
              return (
                <div
                  key={String(s.id)}
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      {s.premios?.nombre ?? "Premio"} · número ganador{" "}
                      <span className="font-mono text-red-600 dark:text-red-400">
                        {s.numero_ganador}
                      </span>
                    </p>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {s.modalidad}
                    </span>
                  </div>

                  {s.modalidad === "commit_reveal" ? (
                    <p className="mt-1 break-all font-mono text-xs text-zinc-400">
                      commit {s.commit_hash?.slice(0, 24)}… · semilla {s.semilla?.slice(0, 24)}…
                    </p>
                  ) : s.evidencia_url ? (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Evidencia: {s.evidencia_url}
                    </p>
                  ) : null}

                  <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2 text-sm dark:border-zinc-800">
                    {ganador ? (
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {ganador.clientes
                          ? `Ganador: ${ganador.clientes.nombre} (${ganador.clientes.telefono})`
                          : "Boleta no vendida / sin pago"}
                      </span>
                    ) : (
                      <span className="text-zinc-500 dark:text-zinc-400">Sin registro de boleta</span>
                    )}

                    {ganador && ganador.clientes && puedeSortear ? (
                      <form action={cambiarEntregaAction} className="flex items-center gap-1">
                        <input type="hidden" name="rifa_id" value={String(rifa.id)} />
                        <input type="hidden" name="ganador_id" value={String(ganador.id)} />
                        <select
                          name="estado"
                          defaultValue={ganador.estado_entrega}
                          className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        >
                          {entregaOpciones.map((e) => (
                            <option key={e} value={e}>
                              {e.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                        >
                          ✓
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ejecutar sorteo del siguiente premio pendiente */}
        {puedeSortear && pendientes.length > 0 && rifa.estado !== "borrador" ? (
          <form
            action={ejecutarSorteoAction}
            className="mt-4 space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Ejecutar sorteo
            </h3>
            <input type="hidden" name="rifa_id" value={String(rifa.id)} />

            <select
              name="premio_id"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {pendientes.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  #{p.orden} — {p.nombre}
                </option>
              ))}
            </select>

            <select
              name="modalidad"
              defaultValue="commit_reveal"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="commit_reveal">Commit-reveal (verificable, número aleatorio)</option>
              <option value="externo">Externo (ingreso manual del número)</option>
            </select>

            <div className="grid grid-cols-2 gap-3">
              <input
                name="numero_ganador"
                type="number"
                min={rifa.numero_min}
                max={rifa.numero_max}
                placeholder={`Nº ganador (solo externo)`}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <input
                name="evidencia_url"
                placeholder="URL de evidencia (externo)"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Ejecutar sorteo
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

function Aviso({ tipo, children }: { tipo: "ok" | "error"; children: React.ReactNode }) {
  const clase =
    tipo === "ok"
      ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
      : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return <p className={`mt-4 rounded-lg px-4 py-3 text-sm ${clase}`}>{children}</p>;
}
