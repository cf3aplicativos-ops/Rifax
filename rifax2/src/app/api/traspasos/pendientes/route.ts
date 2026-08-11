// Solicitudes de traspaso de boleta pendientes de resolver para el usuario en
// sesión (autenticada). Usada por el aviso sonoro/emergente del cliente para
// detectar solicitudes nuevas mediante sondeo periódico.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { contextoDeUsuario, listarSolicitudesRecibidas, listarSolicitudesRecibidasTenant, listarSolicitudesEnviadas } from "@/lib/traspasos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await getSession();
  if (!sesion || sesion.kind !== "user") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const user = sesion.user;
  if (!user.permisos.includes("boleta.traspasar")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const contexto = await contextoDeUsuario(user.tenant.id, user);
  const [recibidas, enviadasFilas] = await Promise.all([
    contexto ? listarSolicitudesRecibidas(user.tenant.id, contexto) : listarSolicitudesRecibidasTenant(user.tenant.id),
    contexto ? listarSolicitudesEnviadas(user.tenant.id, contexto) : Promise.resolve([]),
  ]);

  const pendientes = recibidas
    .filter((f) => f.estado === "pendiente")
    .map((f) => ({ id: f.id, numero: f.numero, rifa: f.rifa, solicitante: f.solicitante, creadoEn: f.creadoEn }));

  // Enviadas: solo las ya resueltas (aprobada/rechazada) importan para el aviso
  // al solicitante; se limita a las más recientes para no acumular sin fin.
  // Incluye rifaId para que, si es aprobada y el solicitante tiene abierta la
  // pantalla de "Nueva venta" con esa misma rifa, la boleta pueda agregarse
  // sola a su lista de seleccionadas sin que tenga que volver a buscarla.
  const enviadas = enviadasFilas
    .filter((f) => f.estado !== "pendiente")
    .slice(0, 30)
    .map((f) => ({ id: f.id, numero: f.numero, rifa: f.rifa, rifaId: f.rifaId, propietario: f.propietario, estado: f.estado, motivoRechazo: f.motivoRechazo }));

  return NextResponse.json({ ok: true, pendientes, enviadas }, { headers: { "Cache-Control": "no-store" } });
}
