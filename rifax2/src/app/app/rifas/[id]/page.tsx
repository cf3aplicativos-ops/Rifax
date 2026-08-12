import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { obtenerRifa, imagenesRifa, esCompartida, distribucionPorSede, boletasDisponiblesSede, sedesOperables, rifasCerradas } from "@/lib/rifas";
import { listarSorteos, premiosPendientes } from "@/lib/sorteos";
import { rankingVendedores } from "@/lib/reportes";
import { opcionesDe } from "@/lib/catalogos";
import { money, fecha } from "@/lib/format";
import { agregarPremioAction, agregarPremioAnticipadoAction, ejecutarSorteoAction, cambiarEntregaAction, eliminarPremioAction, guardarLogoRifaAction, guardarBoletaRifaAction, editarRifaAction, cerrarRifaAction, trasladarRifaAction } from "./actions";
import { Icon } from "@/components/icons";
import PremiosAnticipados, { type PA } from "./premios-anticipados";
import DistribucionSedes, { type FilaSede } from "./distribucion-sedes";

export const dynamic = "force-dynamic";
const entregaOpc = ["pendiente", "contactado", "entregado", "no_reclamado"];
const inp = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const datetimeLocal = (d: Date) => d.toISOString().slice(0, 16);

export default async function RifaDetalle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ premio?: string; anticipado?: string; sorteo?: string; ganador?: string; entrega?: string; logo?: string; boleta?: string; asignadas?: string; liberadas?: string; editada?: string; cerrada?: string; trasladados?: string; omitidos?: string; error?: string }>;
}) {
  const user = await requirePermission("rifa.ver");
  const { id } = await params;
  const sp = await searchParams;
  let rifaId: bigint;
  try { rifaId = BigInt(id); } catch { notFound(); }

  const rifa = await obtenerRifa(user.tenant.id, rifaId);
  if (!rifa) notFound();
  const [sorteos, pendientes, loterias, imgs, compartida, ranking] = await Promise.all([
    listarSorteos(user.tenant.id, rifaId),
    premiosPendientes(user.tenant.id, rifaId),
    opcionesDe(user.tenant.id, "loteria"),
    imagenesRifa(user.tenant.id, rifaId),
    esCompartida(user.tenant.id, rifaId),
    rankingVendedores(user.tenant.id, rifaId),
  ]);
  const logoUrl = imgs.logo;
  const boletaUrl = imgs.boleta;
  const loteriaLabel = (v: string | null) => loterias.find((l) => l.valor === v)?.etiqueta ?? v ?? "—";

  const puedeEditar = hasPermission(user, "rifa.editar");
  const puedeSortear = hasPermission(user, "sorteo.ejecutar");
  const puedeCerrar = hasPermission(user, "rifa.cerrar");
  const puedeTrasladar = hasPermission(user, "rifa.trasladar") && user.rol === "admin";
  const rifasOrigen = puedeTrasladar && rifa.estado === "activa" ? await rifasCerradas(user.tenant.id, rifaId) : [];

  // Datos de distribución por sede (solo rifas compartidas).
  let distrib: { sedes: { id: string; nombre: string }[]; sinAsignar: number; filas: FilaSede[] } | null = null;
  if (compartida) {
    const [dist, sedesAll] = await Promise.all([
      distribucionPorSede(user.tenant.id, rifaId),
      sedesOperables(user.tenant.id, user.sede?.id ?? null),
    ]);
    const filas: FilaSede[] = await Promise.all(
      dist.sedes.map(async (s) => ({
        ...s,
        numeros: await boletasDisponiblesSede(user.tenant.id, rifaId, BigInt(s.sedeId), 300),
      })),
    );
    distrib = { sedes: sedesAll.map((s) => ({ id: String(s.id), nombre: s.nombre })), sinAsignar: dist.sinAsignar, filas };
  }

  return (
    <div>
      <Link href="/app/rifas" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a rifas</Link>
      <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-white">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><Icon name="rifas" /></span>
        <span className="font-mono">{rifa.codigo}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{rifa.estado}</span>
        {compartida ? <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">compartida</span> : null}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {rifa.nombre} · {rifa.sedes.nombre} · {money(rifa.precio_boleta)} c/u · {rifa.total_boletas.toLocaleString("es-CO")} boletas ({rifa.numero_min}–{rifa.numero_max})
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Premio mayor con <span className="font-medium text-slate-700 dark:text-slate-300">{loteriaLabel(rifa.loteria)}</span> · sorteo {fecha(rifa.fecha_sorteo)}
      </p>

      {puedeEditar ? (
        <Link href={`/app/rifas/${rifa.id}/importar`} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          ⬆ Importar (carga masiva)
        </Link>
      ) : null}

      {puedeEditar && !["sorteada", "liquidada", "archivada"].includes(rifa.estado) ? (
        <details className="mt-4 rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">✏️ Editar datos de la rifa</summary>
          <form action={editarRifaAction} className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
            <input type="hidden" name="rifa_id" value={String(rifa.id)} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Nombre</label>
                <input name="nombre" defaultValue={rifa.nombre} required minLength={3} className={`w-full ${inp}`} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Lotería (premio mayor)</label>
                <select name="loteria" defaultValue={rifa.loteria ?? ""} className={`w-full ${inp}`}>
                  <option value="">— Sin definir —</option>
                  {loterias.map((l) => <option key={l.valor} value={l.valor}>{l.etiqueta}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Descripción</label>
              <textarea name="descripcion" defaultValue={rifa.descripcion ?? ""} rows={2} className={`w-full ${inp}`} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Precio por boleta (COP)</label>
                <input name="precio_boleta" type="number" min="1" step="1" defaultValue={rifa.precio_boleta.toString()} required className={`w-full ${inp}`} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Tasa de derechos</label>
                <input name="tasa_derechos" type="number" min="0" max="1" step="0.0001" defaultValue={rifa.tasa_derechos.toString()} className={`w-full ${inp}`} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Apertura</label>
                <input name="fecha_apertura" type="datetime-local" defaultValue={datetimeLocal(rifa.fecha_apertura)} required className={`w-full ${inp}`} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Cierre ventas</label>
                <input name="fecha_cierre_ventas" type="datetime-local" defaultValue={datetimeLocal(rifa.fecha_cierre_ventas)} required className={`w-full ${inp}`} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Sorteo</label>
                <input name="fecha_sorteo" type="datetime-local" defaultValue={datetimeLocal(rifa.fecha_sorteo)} required className={`w-full ${inp}`} />
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              La sede, la cantidad de dígitos y si es compartida no se pueden cambiar aquí porque ya determinaron
              las boletas generadas.
            </p>
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Guardar cambios</button>
          </form>
        </details>
      ) : null}

      {sp.editada ? <Aviso tipo="ok">Datos de la rifa actualizados.</Aviso> : null}
      {sp.premio ? <Aviso tipo="ok">Premio agregado.</Aviso> : null}
      {sp.anticipado ? <Aviso tipo="ok">Premio anticipado programado.</Aviso> : null}
      {sp.sorteo ? <Aviso tipo="ok">Sorteo ejecutado. Número ganador: <strong>{sp.sorteo}</strong>. {sp.ganador === "1" ? "La boleta estaba vendida y pagada." : "La boleta no tenía comprador pagado."}</Aviso> : null}
      {sp.entrega ? <Aviso tipo="ok">Estado de entrega actualizado.</Aviso> : null}
      {sp.logo ? <Aviso tipo="ok">Logo de la rifa actualizado.</Aviso> : null}
      {sp.boleta ? <Aviso tipo="ok">Imagen de la boleta actualizada.</Aviso> : null}
      {sp.asignadas && sp.asignadas !== "0" ? <Aviso tipo="ok">{sp.asignadas} boleta(s) asignada(s) a la sede.</Aviso> : null}
      {sp.liberadas ? <Aviso tipo="ok">{sp.liberadas} boleta(s) liberada(s).</Aviso> : null}
      {sp.cerrada ? <Aviso tipo="ok">Rifa finalizada y cerrada. Ya no se pueden vender más boletas.</Aviso> : null}
      {sp.trasladados ? (
        <Aviso tipo="ok">
          {sp.trasladados} número(s) trasladado(s) con su vendedor.
          {sp.omitidos && sp.omitidos !== "0" ? ` ${sp.omitidos} no se pudieron trasladar (ya no disponibles en esta rifa, fuera de rango, o vendedor inactivo) — detalle en Auditoría.` : ""}
        </Aviso>
      ) : null}
      {sp.error ? <Aviso tipo="error">{sp.error}</Aviso> : null}

      {/* LOGO DE LA RIFA (para el recibo) */}
      {puedeEditar ? (
        <section className="mt-6 rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Logo de la rifa</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Aparecerá en el recibo de caja. Si no defines uno, se usa el logo de la empresa.</p>
          <form action={guardarLogoRifaAction} className="mt-3 flex flex-wrap items-center gap-4">
            <input type="hidden" name="rifa_id" value={String(rifa.id)} />
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt="logo rifa" className="h-16 w-16 rounded-lg border border-slate-300 object-contain p-1 dark:border-slate-700" />
            ) : <div className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400 dark:border-slate-700">sin logo</div>}
            <input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700 dark:text-slate-300" />
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Guardar logo</button>
            {logoUrl ? <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><input type="checkbox" name="quitar" className="rounded" /> quitar</label> : null}
          </form>

          {/* IMAGEN DE LA BOLETA (#1) */}
          <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Imagen de la boleta</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">La imagen (diseño) de la boleta de esta rifa. Configurable en cualquier momento.</p>
            <form action={guardarBoletaRifaAction} className="mt-3 flex flex-wrap items-center gap-4">
              <input type="hidden" name="rifa_id" value={String(rifa.id)} />
              {boletaUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={boletaUrl} alt="boleta" className="h-20 w-32 rounded-lg border border-slate-300 object-contain p-1 dark:border-slate-700" />
              ) : <div className="grid h-20 w-32 place-items-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400 dark:border-slate-700">sin imagen</div>}
              <input name="boleta" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700 dark:text-slate-300" />
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Guardar boleta</button>
              {boletaUrl ? <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><input type="checkbox" name="quitar" className="rounded" /> quitar</label> : null}
            </form>
          </div>
        </section>
      ) : null}

      {/* PREMIOS */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Premios</h2>
        {rifa.premios.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Aún no hay premios. Agrega al menos uno para poder sortear.</p>
        ) : (
          <ol className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-300 dark:divide-slate-800 dark:border-slate-700">
            {rifa.premios.map((p) => (
              <li key={String(p.id)} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="text-slate-900 dark:text-slate-100"><span className="mr-2 text-slate-400">#{p.orden}</span>{p.nombre}</span>
                <span className="flex items-center gap-3">
                  <span className="text-slate-500 dark:text-slate-400">{p.valor_estimado ? money(p.valor_estimado) : ""}</span>
                  {puedeEditar && rifa.estado !== "sorteada" ? (
                    <form action={eliminarPremioAction}>
                      <input type="hidden" name="rifa_id" value={String(rifa.id)} />
                      <input type="hidden" name="premio_id" value={String(p.id)} />
                      <button type="submit" className="rounded-md border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">Eliminar</button>
                    </form>
                  ) : null}
                </span>
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
        <PremiosAnticipados
          rifaId={String(rifa.id)}
          editable={puedeEditar && rifa.estado !== "sorteada"}
          loterias={loterias}
          lista={rifa.premios_anticipados.map((pa): PA => ({
            id: String(pa.id),
            nombre: pa.nombre,
            loteria: pa.loteria,
            fechaISO: new Date(pa.fecha_juego).toISOString().slice(0, 10),
            fechaTexto: fecha(pa.fecha_juego),
            pagos: pa.pagos_requeridos,
            valor: pa.valor_estimado ? money(pa.valor_estimado) : null,
            estado: pa.estado,
          }))}
        />
        {puedeEditar && rifa.estado !== "sorteada" ? (
          <form action={agregarPremioAnticipadoAction} className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-slate-300 bg-white p-4 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-900">
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

      {/* DISTRIBUCIÓN POR SEDE (rifa compartida) */}
      {compartida && distrib ? (
        <DistribucionSedes rifaId={String(rifa.id)} editable={puedeEditar} sedes={distrib.sedes} sinAsignar={distrib.sinAsignar} filas={distrib.filas} />
      ) : null}

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
                <div key={String(s.id)} className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{s.premios?.nombre ?? "Premio"} · número ganador <span className="font-mono text-indigo-600 dark:text-indigo-400">{s.numero_ganador}</span></p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">{s.modalidad}</span>
                  </div>
                  {s.modalidad === "commit_reveal" ? (
                    <p className="mt-1 break-all font-mono text-xs text-slate-400">commit {s.commit_hash?.slice(0, 24)}… · semilla {s.semilla?.slice(0, 24)}…</p>
                  ) : s.evidencia_url ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Evidencia: {s.evidencia_url}</p> : null}
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm dark:border-slate-700">
                    <span className="text-slate-700 dark:text-slate-300">{ganador ? (ganador.clientes ? `Ganador: ${ganador.clientes.nombre} (${ganador.clientes.telefono})` : "Boleta no vendida / sin pago") : "Sin registro de boleta"}</span>
                    {ganador && ganador.clientes && puedeSortear ? (
                      <form action={cambiarEntregaAction} className="flex items-center gap-1">
                        <input type="hidden" name="rifa_id" value={String(rifa.id)} />
                        <input type="hidden" name="ganador_id" value={String(ganador.id)} />
                        <select name="estado" defaultValue={ganador.estado_entrega} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                          {entregaOpc.map((e) => <option key={e} value={e}>{e.replace("_", " ")}</option>)}
                        </select>
                        <button type="submit" aria-label="Guardar estado de entrega" className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">✓</button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {puedeSortear && pendientes.length > 0 && rifa.estado !== "borrador" ? (
          <form action={ejecutarSorteoAction} className="mt-4 space-y-3 rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
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

      {/* RANKING DE VENDEDORES (#15) */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ranking de vendedores</h2>
        {ranking.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Aún no hay ventas de vendedores en esta rifa.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Vendedor</th>
                  <th className="px-4 py-3 font-medium">Sede</th>
                  <th className="px-4 py-3 text-right font-medium">Boletas</th>
                  <th className="px-4 py-3 text-right font-medium">Ventas</th>
                  <th className="px-4 py-3 text-right font-medium">Recaudado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
                {ranking.map((r) => (
                  <tr key={r.vendedorId}>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {r.posicion === 1 ? "🥇" : r.posicion === 2 ? "🥈" : r.posicion === 3 ? "🥉" : r.posicion}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{r.vendedorNombre}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{r.sedeNombre}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{r.boletas.toLocaleString("es-CO")}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{r.ventas.toLocaleString("es-CO")}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">{money(r.recaudado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* FINALIZAR Y CERRAR RIFA (#15) */}
      {puedeCerrar && ["activa", "sorteada"].includes(rifa.estado) ? (
        <section className="mt-10 rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-300">Finalizar y cerrar rifa</h2>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-400">
            Deja la rifa como cerrada: no se podrán vender más boletas. El ranking de arriba queda disponible para
            consultar en cualquier momento. Esta acción no se puede deshacer desde aquí.
          </p>
          <form action={cerrarRifaAction} className="mt-3">
            <input type="hidden" name="rifa_id" value={String(rifa.id)} />
            <button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700">
              Finalizar y cerrar rifa
            </button>
          </form>
        </section>
      ) : null}

      {/* TRASLADO DE VENDEDORES DESDE UNA RIFA FINALIZADA (#13) */}
      {puedeTrasladar && rifa.estado === "activa" ? (
        rifasOrigen.length === 0 ? null : (
          <section className="mt-10 rounded-xl border border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Traer vendedores de una rifa finalizada</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Cada vendedor que tenía números vendidos (con cliente) en la rifa elegida recibe automáticamente el
              mismo número reservado aquí, si sigue disponible y existe en el rango de esta rifa. Solo el
              administrador de la empresa puede hacer esto.
            </p>
            <form action={trasladarRifaAction} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="rifa_destino_id" value={String(rifa.id)} />
              <select name="rifa_origen_id" required className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                <option value="">Elige la rifa finalizada de origen…</option>
                {rifasOrigen.map((r) => <option key={String(r.id)} value={String(r.id)}>{r.codigo} — {r.nombre}</option>)}
              </select>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Trasladar vendedores</button>
            </form>
          </section>
        )
      ) : null}
    </div>
  );
}

function Aviso({ tipo, children }: { tipo: "ok" | "error"; children: React.ReactNode }) {
  const c = tipo === "ok" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return <p role={tipo === "error" ? "alert" : "status"} className={`mt-4 rounded-lg px-4 py-3 text-sm ${c}`}>{children}</p>;
}
