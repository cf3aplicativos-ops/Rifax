import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth/rbac";
import { obtenerVendedor } from "@/lib/vendedores";
import { prisma } from "@/lib/prisma";
import { fecha } from "@/lib/format";
import { cerrarTalonarioAction, crearAccesoVendedorAction, actualizarAccesoVendedorAction, editarVendedorAction } from "../actions";
import FormAsignarTalonario from "./form-asignar";
import { Icon } from "@/components/icons";
import PasswordInput from "@/components/PasswordInput";

export const dynamic = "force-dynamic";

const clase: Record<string, string> = {
  asignado: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  en_venta: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  rendido: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cerrado: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default async function VendedorDetalle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ asignadas?: string; liberadas?: string; acceso?: string; acceso_actualizado?: string; editado?: string; error?: string }>;
}) {
  const user = await requirePermission("vendedor.ver");
  const { id } = await params;
  const sp = await searchParams;
  let vId: bigint;
  try { vId = BigInt(id); } catch { notFound(); }

  // Un usuario acotado a una sede solo alcanza a los vendedores de esa sede.
  const vendedor = await obtenerVendedor(user.tenant.id, vId, user.sede?.id ?? null);
  if (!vendedor) notFound();

  const rifas = await prisma.rifas.findMany({
    where: { tenant_id: user.tenant.id, estado: "activa", ...(user.sede ? { sede_id: user.sede.id } : {}) },
    orderBy: { id: "desc" },
    select: { id: true, codigo: true, nombre: true, numero_min: true, numero_max: true },
  });

  const puedeAsignar = hasPermission(user, "talonario.asignar");
  const puedeCerrar = hasPermission(user, "talonario.devolver");
  const vePii = hasPermission(user, "vendedor.ver_pii");
  // Editar expone documento/teléfono en el formulario: exige también poder verlos.
  const puedeEditarDatos = hasPermission(user, "vendedor.editar") && vePii;
  const sedes = puedeEditarDatos
    ? await prisma.sedes.findMany({
        where: { tenant_id: user.tenant.id, estado: "activa", ...(user.sede ? { id: user.sede.id } : {}) },
        orderBy: { nombre: "asc" },
        select: { id: true, nombre: true },
      })
    : [];
  const asignadas = vendedor.talonarios.filter((t) => t.estado !== "cerrado").reduce((a, t) => a + (t.numero_fin - t.numero_inicio + 1), 0);
  const accesoUsuario = vendedor.usuario_id
    ? await prisma.usuarios.findUnique({ where: { id: vendedor.usuario_id }, select: { correo: true } })
    : null;

  return (
    <div>
      <Link href="/app/vendedores" className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">← Volver a vendedores</Link>
      <div className="mt-2 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"><Icon name="vendedores" /></span>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{vendedor.nombre}</h1>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {vePii ? `${vendedor.documento} · ${vendedor.telefono}` : "datos protegidos"} · {Number(vendedor.pct_comision.toString())}% comisión · {vendedor.cupo_max ? `${asignadas}/${vendedor.cupo_max}` : asignadas} boletas
      </p>
      <p className="mt-2">
        {vendedor.sedes ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">Sede: {vendedor.sedes.nombre}</span>
        ) : (
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">Todas las sedes</span>
        )}
      </p>

      {sp.acceso ? <Aviso tipo="ok">Acceso al portal de vendedor creado. Ya puede ingresar.</Aviso> : null}
      {sp.asignadas ? <Aviso tipo="ok">Talonario asignado: {sp.asignadas} boletas.</Aviso> : null}
      {sp.liberadas ? <Aviso tipo="neutral">Talonario cerrado. {sp.liberadas} boletas liberadas.</Aviso> : null}
      {sp.editado ? <Aviso tipo="ok">Datos del vendedor actualizados.</Aviso> : null}
      {sp.acceso_actualizado ? <Aviso tipo="ok">Credenciales de acceso actualizadas.</Aviso> : null}
      {sp.error ? <Aviso tipo="error">{sp.error}</Aviso> : null}

      {puedeEditarDatos ? (
        <details className="mt-4 rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">✏️ Editar vendedor</summary>
          <form action={editarVendedorAction} className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
            <input type="hidden" name="vendedor_id" value={String(vendedor.id)} />
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Nombre completo</label>
              <input name="nombre" defaultValue={vendedor.nombre} required minLength={3} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Documento</label>
                <input name="documento" defaultValue={vendedor.documento} required minLength={3} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Teléfono</label>
                <input name="telefono" defaultValue={vendedor.telefono} required minLength={7} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Correo <span className="text-slate-400">(opcional)</span></label>
              <input name="correo" type="email" defaultValue={vendedor.correo ?? ""} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </div>
            {sedes.length > 0 ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Sede <span className="text-slate-400">(opcional)</span></label>
                <select name="sede_id" defaultValue={vendedor.sede_id ? String(vendedor.sede_id) : ""} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                  <option value="">Todas las sedes</option>
                  {sedes.map((s) => <option key={String(s.id)} value={String(s.id)}>{s.nombre}</option>)}
                </select>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Comisión % <span className="text-slate-400">(opcional)</span></label>
                <input name="pct_comision" type="number" min="0" max="100" step="0.01" defaultValue={vendedor.pct_comision.toString()} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Cupo máx. boletas <span className="text-slate-400">(opcional)</span></label>
                <input name="cupo_max" type="number" min="1" step="1" defaultValue={vendedor.cupo_max ?? ""} placeholder="Sin límite" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </div>
            </div>
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Guardar cambios</button>
          </form>
        </details>
      ) : null}

      {hasPermission(user, "usuario.crear") ? (
        <div className="mt-6 rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Acceso al portal de vendedor</h2>
          {vendedor.usuario_id && accesoUsuario ? (
            <form action={actualizarAccesoVendedorAction} className="mt-2 space-y-3">
              <input type="hidden" name="vendedor_id" value={String(vendedor.id)} />
              <p className="text-sm text-emerald-700 dark:text-emerald-400">✓ Este vendedor ya tiene acceso al portal móvil.</p>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Correo de acceso</label>
                <input name="correo" type="email" required defaultValue={accesoUsuario.correo} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Contraseña</label>
                <PasswordInput name="password" placeholder="••••••••" required={false} autoComplete="new-password" minLength={8} />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Déjala en blanco para mantener la actual. Escribe una nueva (mínimo 8 caracteres) para cambiarla.</p>
              </div>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Guardar credenciales</button>
            </form>
          ) : (
            <form action={crearAccesoVendedorAction} className="mt-2 flex flex-wrap items-end gap-2">
              <input type="hidden" name="vendedor_id" value={String(vendedor.id)} />
              <input name="correo" type="email" required placeholder="correo@empresa.co" className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              <div className="w-44">
                <PasswordInput name="password" required minLength={8} placeholder="contraseña (≥8)" autoComplete="new-password" />
              </div>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700">Crear acceso</button>
            </form>
          )}
        </div>
      ) : null}

      <h2 className="mt-8 text-lg font-semibold text-slate-900 dark:text-white">Talonarios</h2>
      {vendedor.talonarios.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Sin talonarios asignados.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr><th className="px-4 py-3 font-medium">Rifa</th><th className="px-4 py-3 font-medium">Rango</th><th className="px-4 py-3 text-right font-medium">Boletas</th><th className="px-4 py-3 font-medium">Estado</th><th className="px-4 py-3 font-medium">Asignado</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-950">
              {vendedor.talonarios.map((t) => (
                <tr key={String(t.id)}>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{t.rifas.codigo}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{t.numero_inicio}–{t.numero_fin}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{(t.numero_fin - t.numero_inicio + 1).toLocaleString("es-CO")}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${clase[t.estado] ?? clase.cerrado}`}>{t.estado.replace("_", " ")}</span></td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{fecha(t.asignado_en)}</td>
                  <td className="px-4 py-3 text-right">
                    {t.estado !== "cerrado" && puedeCerrar ? (
                      <form action={cerrarTalonarioAction}>
                        <input type="hidden" name="talonario_id" value={String(t.id)} />
                        <input type="hidden" name="vendedor_id" value={String(vendedor.id)} />
                        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cerrar</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {puedeAsignar && vendedor.estado === "activo" ? (
        rifas.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">No hay rifas activas para asignar talonarios.</p>
        ) : (
          <FormAsignarTalonario
            vendedorId={String(vendedor.id)}
            sedeVendedor={vendedor.sedes?.nombre ?? null}
            rifas={rifas.map((r) => ({ id: String(r.id), codigo: r.codigo, nombre: r.nombre, min: r.numero_min, max: r.numero_max }))}
          />
        )
      ) : null}
    </div>
  );
}

function Aviso({ tipo, children }: { tipo: "ok" | "error" | "neutral"; children: React.ReactNode }) {
  const c = tipo === "ok" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : tipo === "error" ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return <p role={tipo === "error" ? "alert" : "status"} className={`mt-4 rounded-lg px-4 py-3 text-sm ${c}`}>{children}</p>;
}
