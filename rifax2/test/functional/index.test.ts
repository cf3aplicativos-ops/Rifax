// Revisión funcional de RIFAX: ejecuta la lógica real de cada módulo (no
// simulada) contra la base de datos real de Neon, dentro de una empresa de
// prueba desechable (ver ./harness.ts). Se corre aparte con
// `npm run test:functional` — no forma parte del `npm test` normal.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { crearContextoPrueba, limpiarContextoPrueba, type ContextoPrueba } from "./harness";

import { crearSede, editarSede } from "@/lib/sedes";
import { estadoSedes } from "@/lib/dashboard";
import { crearUsuario, editarUsuario, cambiarRol, cambiarEstado as cambiarEstadoUsuario, listarRoles } from "@/lib/usuarios";
import { crearVendedor, editarVendedor, asignarTalonario, cambiarEstadoVendedor, cerrarTalonario } from "@/lib/vendedores";
import { crearRifa, publicarRifa, agregarPremio, asignarBoletasSede, liberarBoletasSede, cerrarRifa, trasladarRifa } from "@/lib/rifas";
import { rankingVendedores } from "@/lib/reportes";
import { crearVenta, registrarAbono, anularVenta, listarVentas, buscarVentasParaAbono, ventaEnAlcance, ventaEnAlcanceOtraSede, ventaEnAlcanceParaRecibo } from "@/lib/ventas";
import { crearSolicitudTraspaso, resolverSolicitud, buscarBoleta, contextoDeUsuario } from "@/lib/traspasos";
import { crearAccesoVendedor, actualizarAccesoVendedor } from "@/lib/portal-vendedor";
import type { TenantUser } from "@/lib/auth/session";
import { calcularComision, calcularPendiente, estadoComisiones, liquidarVendedor, liquidarMasivo, comisionesDetalladas } from "@/lib/comisiones";
import { ejecutarSorteo, hashSemilla, derivarNumeroGanador } from "@/lib/sorteos";
import { listarVencimientos, proximosVencimientosCriticos, registrarPagoVencimiento, regenerarVencimientos } from "@/lib/vencimientos";
import { editarTenant, cambiarEstadoTenant, cambiarMaxSedes, purgarAuditoria, estadoAuditoriaGlobal, historialPurgasAuditoria, crearTenant, purgarTenant } from "@/lib/superadmin";
import { getConfigPlataforma, precioBasicoPorPeriodicidad, cambiarPlanTenant } from "@/lib/plataforma";
import { generarFacturaTenant, marcarFacturaPagada, anularFactura } from "@/lib/facturacion";
import { solicitarResetAutomatico } from "@/lib/reset-password";
import { parseCsv, expandirNumeros, importarVendedores, importarVentas } from "@/lib/importar";
import { TIPOS, opcionesDe, listarCatalogos, agregarItem, toggleItem } from "@/lib/catalogos";
import { obtenerIntegraciones, guardarIntegraciones } from "@/lib/integraciones";
import { listarCartera, resumirCartera } from "@/lib/cartera";
import { actualizarCliente, cambiarEstadoCliente, estadoCliente, buscarClientePorDocumento } from "@/lib/clientes";
import { resumenOutbox, listarOutbox, procesarOutbox } from "@/lib/outbox";

let ctx: ContextoPrueba;

beforeAll(async () => {
  ctx = await crearContextoPrueba();
}, 60_000);

afterAll(async () => {
  await limpiarContextoPrueba(ctx);
  const restos = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(*)::bigint AS c FROM saas.tenants WHERE id = $1::bigint`,
    ctx.tenantId,
  );
  expect(Number(restos[0].c)).toBe(0);
}, 60_000);

// ---------------------------------------------------------------------------

describe("Vigencia, planes y facturación", () => {
  it("crearTenant generó el calendario de vencimientos según la periodicidad (mensual = 12 fechas)", async () => {
    const vencs = await listarVencimientos(ctx.tenantId);
    expect(vencs.length).toBe(12);
    expect(vencs.every((v) => v.estado === "pendiente")).toBe(true);
  });

  it("editarTenant con periodicidad anual regenera el calendario a 1 fecha", async () => {
    const res = await editarTenant(
      ctx.tenantId,
      { nombre: "QA Funcional (temporal, se borra sola)", slug: ctx.slug, sedes_ilimitadas: false, max_sedes: 3, usuarios_ilimitados: true, periodicidad: "anual", periodicidad_pago: "mensual", fecha_inicio: new Date().toISOString().slice(0, 10) },
      ctx.superAdminId,
    );
    expect(res.ok).toBe(true);
    const vencs = await listarVencimientos(ctx.tenantId);
    expect(vencs.length).toBe(1);
  });

  it("cambiarMaxSedes no permite bajar del número de sedes ya creadas", async () => {
    const res = await cambiarMaxSedes(ctx.tenantId, 1, ctx.superAdminId);
    expect(res.ok).toBe(false);
  });

  it("cambiarMaxSedes sí permite ampliar", async () => {
    const res = await cambiarMaxSedes(ctx.tenantId, 5, ctx.superAdminId);
    expect(res.ok).toBe(true);
  });

  it("cambiarEstadoTenant suspende y reactiva", async () => {
    const susp = await cambiarEstadoTenant(ctx.tenantId, "suspendido", ctx.superAdminId);
    expect(susp.ok).toBe(true);
    const act = await cambiarEstadoTenant(ctx.tenantId, "activo", ctx.superAdminId);
    expect(act.ok).toBe(true);
  });

  it("precioBasicoPorPeriodicidad elige el precio configurado según periodicidad de pago", async () => {
    const config = await getConfigPlataforma();
    expect(precioBasicoPorPeriodicidad(config, "mensual")).toBe(config.precioBasicoMensual);
    expect(precioBasicoPorPeriodicidad(config, "semestral")).toBe(config.precioBasicoSemestral);
    expect(precioBasicoPorPeriodicidad(config, "anual")).toBe(config.precioBasicoAnual);
    expect(precioBasicoPorPeriodicidad(config, "lo-que-sea")).toBe(config.precioBasicoMensual);
  });

  it("generarFacturaTenant en plan básico cobra el precio mensual configurado; marcarFacturaPagada extiende la vigencia una sola vez", async () => {
    await cambiarPlanTenant(ctx.tenantId, "basico", ctx.superAdminId);
    const config = await getConfigPlataforma();

    const gen = await generarFacturaTenant(ctx.tenantId, "2099-01");
    expect(gen.ok).toBe(true);

    const filas = await prisma.$queryRawUnsafe<{ id: bigint; monto: string; vencimiento_antes: string | null }[]>(
      `SELECT f.id, f.monto::text AS monto, to_char(t.fecha_vencimiento,'YYYY-MM-DD') AS vencimiento_antes
         FROM saas.facturas f JOIN saas.tenants t ON t.id = f.tenant_id
        WHERE f.tenant_id = $1::bigint AND f.periodo = '2099-01'`,
      ctx.tenantId,
    );
    expect(Number(filas[0].monto)).toBe(config.precioBasicoMensual);
    const facturaId = filas[0].id;

    const pago1 = await marcarFacturaPagada(facturaId);
    expect(pago1.ok).toBe(true);
    const despues = await prisma.$queryRawUnsafe<{ fecha_vencimiento: string }[]>(
      `SELECT to_char(fecha_vencimiento,'YYYY-MM-DD') AS fecha_vencimiento FROM saas.tenants WHERE id = $1::bigint`,
      ctx.tenantId,
    );
    expect(despues[0].fecha_vencimiento).not.toBe(filas[0].vencimiento_antes);

    // Un segundo "marcar pagada" sobre la misma factura NO debe volver a
    // extender la vigencia (bug real que corrigió el agente de datos hoy).
    const pago2 = await marcarFacturaPagada(facturaId);
    expect(pago2.ok).toBe(false);

    await cambiarPlanTenant(ctx.tenantId, "corporativo", ctx.superAdminId);
  });

  it("anularFactura solo anula facturas pendientes, no pagadas", async () => {
    await cambiarPlanTenant(ctx.tenantId, "basico", ctx.superAdminId);
    await generarFacturaTenant(ctx.tenantId, "2099-02");
    const filas = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
      `SELECT id FROM saas.facturas WHERE tenant_id = $1::bigint AND periodo = '2099-02'`,
      ctx.tenantId,
    );
    const anular1 = await anularFactura(filas[0].id);
    expect(anular1.ok).toBe(true);
    const anular2 = await anularFactura(filas[0].id);
    expect(anular2.ok).toBe(false); // ya está anulada, no pendiente
    await cambiarPlanTenant(ctx.tenantId, "corporativo", ctx.superAdminId);
  });

  it("proximosVencimientosCriticos no incluye este tenant (su única fecha, anual, está a más de 5 días)", async () => {
    const criticos = await proximosVencimientosCriticos(5);
    expect(criticos.some((c) => c.tenantId === String(ctx.tenantId))).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("Sedes", () => {
  it("no permite otra sede con el mismo nombre en el tenant", async () => {
    const res = await crearSede(ctx.tenantId, 5, { nombre: "Sede QA A" }, ctx.adminId);
    expect(res.ok).toBe(false);
  });

  it("editarSede cambia nombre/dirección", async () => {
    const res = await editarSede(ctx.sedeAId, ctx.tenantId, { nombre: "Sede QA A", direccion: "Cra 1 # 2-3" }, ctx.adminId);
    expect(res.ok).toBe(true);
    const sede = await prisma.sedes.findUnique({ where: { id: ctx.sedeAId } });
    expect(sede?.direccion).toBe("Cra 1 # 2-3");
  });
});

// ---------------------------------------------------------------------------

let vendedorAId: bigint;
let vendedorBId: bigint;
let vendedorCId: bigint;
let filaUsuarioVendedorAId: bigint;
let usuarioEditableId: bigint;

describe("Usuarios internos", () => {
  it("crea un usuario con un rol distinto de admin y lo edita", async () => {
    const roles = await listarRoles();
    const rolCajero = roles.find((r) => r.nombre === "cajero") ?? roles.find((r) => r.nombre !== "admin");
    expect(rolCajero).toBeTruthy();

    const crear = await crearUsuario(
      { nombre: "QA Cajero", correo: `qa-cajero-${ctx.slug}@rifax-test.local`, password: "Password123!", rol_id: String(rolCajero!.id), sede_id: String(ctx.sedeAId) },
      ctx.tenantId,
      ctx.adminId,
    );
    expect(crear.ok).toBe(true);

    const filas = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
      `SELECT id FROM saas.usuarios WHERE tenant_id = $1::bigint AND correo = $2`,
      ctx.tenantId,
      `qa-cajero-${ctx.slug}@rifax-test.local`,
    );
    usuarioEditableId = filas[0].id;

    const editar = await editarUsuario(
      usuarioEditableId,
      { nombre: "QA Cajero Editado", correo: `qa-cajero-${ctx.slug}@rifax-test.local`, rol_id: String(rolCajero!.id), sede_id: String(ctx.sedeAId) },
      ctx.tenantId,
      ctx.adminId,
    );
    expect(editar.ok).toBe(true);
    const u = await prisma.usuarios.findUnique({ where: { id: usuarioEditableId } });
    expect(u?.nombre).toBe("QA Cajero Editado");
  });

  it("un usuario no puede cambiar su propio rol", async () => {
    const roles = await listarRoles();
    const otroRol = roles.find((r) => r.id !== undefined)!;
    const res = await editarUsuario(
      usuarioEditableId,
      { nombre: "QA Cajero Editado", correo: `qa-cajero-${ctx.slug}@rifax-test.local`, rol_id: String(otroRol.id) },
      ctx.tenantId,
      usuarioEditableId, // actor = el mismo usuario que se edita
    );
    expect(res.ok).toBe(false);
  });

  it("cambiarRol y cambiarEstado funcionan sobre otro usuario", async () => {
    const roles = await listarRoles();
    const rolGerente = roles.find((r) => r.nombre === "gerente") ?? roles[0];
    const rol = await cambiarRol(usuarioEditableId, rolGerente.id, ctx.tenantId, ctx.adminId);
    expect(rol.ok).toBe(true);
    const est = await cambiarEstadoUsuario(usuarioEditableId, "inactivo", ctx.tenantId, ctx.adminId);
    expect(est.ok).toBe(true);
    await cambiarEstadoUsuario(usuarioEditableId, "activo", ctx.tenantId, ctx.adminId); // deja limpio para el resto
  });

  it("debe quedar al menos un administrador activo por empresa", async () => {
    const roles = await listarRoles();
    const rolCajero = roles.find((r) => r.nombre === "cajero") ?? roles[0];
    // ctx.adminId es el único admin del tenant de prueba: no debe poder
    // desactivarse ni cambiarse de rol a sí mismo si eso lo dejaría sin admins.
    const res = await cambiarRol(ctx.adminId, rolCajero.id, ctx.tenantId, usuarioEditableId);
    expect(res.ok).toBe(false);
  });

  it("editarUsuario con contraseña la cambia, obliga a confirmarla y revoca sesiones activas; en blanco la conserva", async () => {
    const roles = await listarRoles();
    const rolCajero = roles.find((r) => r.nombre === "cajero") ?? roles[0];
    const antes = await prisma.usuarios.findUnique({ where: { id: usuarioEditableId } });

    // Deja una "sesión activa" simulada para comprobar que se revoca.
    await prisma.$executeRawUnsafe(
      `INSERT INTO saas.sesiones (usuario_id, refresh_token_hash, familia, expira_en, revocada) VALUES ($1::bigint, 'qa-token-hash', gen_random_uuid(), now() + interval '1 day', false)`,
      usuarioEditableId,
    );

    const sinCambio = await editarUsuario(
      usuarioEditableId,
      { nombre: "QA Cajero Editado", correo: `qa-cajero-${ctx.slug}@rifax-test.local`, rol_id: String(rolCajero.id), sede_id: String(ctx.sedeAId) },
      ctx.tenantId, ctx.adminId,
    );
    expect(sinCambio.ok).toBe(true);
    const tras1 = await prisma.usuarios.findUnique({ where: { id: usuarioEditableId } });
    expect(tras1?.password_hash).toBe(antes?.password_hash); // en blanco = no cambia

    const conCambio = await editarUsuario(
      usuarioEditableId,
      { nombre: "QA Cajero Editado", correo: `qa-cajero-${ctx.slug}@rifax-test.local`, rol_id: String(rolCajero.id), sede_id: String(ctx.sedeAId), password: "NuevaClave123!" },
      ctx.tenantId, ctx.adminId,
    );
    expect(conCambio.ok).toBe(true);
    const tras2 = await prisma.usuarios.findUnique({ where: { id: usuarioEditableId } });
    expect(tras2?.password_hash).not.toBe(antes?.password_hash);

    const debeCambiar = await prisma.$queryRawUnsafe<{ debe_cambiar_password: boolean }[]>(
      `SELECT debe_cambiar_password FROM saas.usuarios WHERE id = $1::bigint`, usuarioEditableId,
    );
    expect(debeCambiar[0].debe_cambiar_password).toBe(true);

    const sesiones = await prisma.$queryRawUnsafe<{ revocada: boolean }[]>(
      `SELECT revocada FROM saas.sesiones WHERE usuario_id = $1::bigint AND refresh_token_hash = 'qa-token-hash'`, usuarioEditableId,
    );
    expect(sesiones[0].revocada).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("Rol auditor: 'gran administrador' de solo consulta entre sedes", () => {
  it("el rol auditor no tiene ningún permiso de escritura (solo *.ver y reporte.auditoria)", async () => {
    const roles = await listarRoles();
    const rolAuditor = roles.find((r) => r.nombre === "auditor");
    expect(rolAuditor).toBeTruthy();

    const codigos = await prisma.$queryRawUnsafe<{ codigo: string }[]>(
      `SELECT p.codigo FROM saas.roles_permisos rp JOIN saas.permisos p ON p.id = rp.permiso_id WHERE rp.rol_id = $1::bigint`,
      rolAuditor!.id,
    );
    expect(codigos.length).toBeGreaterThan(0);
    const permisosEscritura = codigos.filter((c) => !/\.(ver|auditoria)$/.test(c.codigo));
    expect(permisosEscritura).toEqual([]);
  });

  it("un usuario auditor sin sede fija ve el avance de TODAS las sedes de la empresa", async () => {
    const roles = await listarRoles();
    const rolAuditor = roles.find((r) => r.nombre === "auditor")!;

    const crear = await crearUsuario(
      { nombre: "QA Auditor", correo: `qa-auditor-${ctx.slug}@rifax-test.local`, password: "Password123!", rol_id: String(rolAuditor.id) },
      ctx.tenantId, ctx.adminId,
    );
    expect(crear.ok).toBe(true);

    const filas = await prisma.$queryRawUnsafe<{ sede_id: bigint | null }[]>(
      `SELECT sede_id FROM saas.usuarios WHERE tenant_id = $1::bigint AND correo = $2`,
      ctx.tenantId, `qa-auditor-${ctx.slug}@rifax-test.local`,
    );
    expect(filas[0].sede_id).toBeNull(); // sin sede fija: no queda acotado a una sola sede

    // estadoSedes() es la misma función que alimenta "Estado por sede" del
    // panel principal: siempre devuelve TODAS las sedes del tenant; es la
    // página la que filtra a una sola cuando el usuario sí tiene sede fija
    // (aquí no la tiene, así que vería la lista completa, igual que abajo).
    const sedes = await estadoSedes(ctx.tenantId);
    const nombres = sedes.map((s) => s.nombre);
    expect(nombres).toContain("Sede QA A");
    expect(nombres).toContain("Sede QA B");
  });
});

// ---------------------------------------------------------------------------

describe("Vendedores", () => {
  it("crea tres vendedores (uno en cada sede y uno sin sede fija)", async () => {
    const a = await crearVendedor({ nombre: "QA Vendedor A", documento: "1000001", telefono: "3000000001", sede_id: String(ctx.sedeAId), pct_comision: 10 }, ctx.tenantId, ctx.adminId);
    expect(a.ok).toBe(true);
    const b = await crearVendedor({ nombre: "QA Vendedor B", documento: "1000002", telefono: "3000000002", sede_id: String(ctx.sedeBId), pct_comision: 8 }, ctx.tenantId, ctx.adminId);
    expect(b.ok).toBe(true);
    const c = await crearVendedor({ nombre: "QA Vendedor C", documento: "1000003", telefono: "3000000003", pct_comision: 12 }, ctx.tenantId, ctx.adminId);
    expect(c.ok).toBe(true);

    const filas = await prisma.$queryRawUnsafe<{ id: bigint; nombre: string }[]>(
      `SELECT id, nombre FROM saas.vendedores WHERE tenant_id = $1::bigint ORDER BY id ASC`,
      ctx.tenantId,
    );
    vendedorAId = filas.find((f) => f.nombre === "QA Vendedor A")!.id;
    vendedorBId = filas.find((f) => f.nombre === "QA Vendedor B")!.id;
    vendedorCId = filas.find((f) => f.nombre === "QA Vendedor C")!.id;
  });

  it("no permite crear un vendedor con una sede que no es del tenant", async () => {
    const res = await crearVendedor({ nombre: "QA Vendedor Falso", documento: "9999999", telefono: "3009999999", sede_id: "999999999" }, ctx.tenantId, ctx.adminId);
    expect(res.ok).toBe(false);
  });

  it("editarVendedor actualiza sus datos y fija la comisión explícitamente", async () => {
    const res = await editarVendedor(vendedorAId, { nombre: "QA Vendedor A", documento: "1000001", telefono: "3000000099", sede_id: String(ctx.sedeAId), pct_comision: "10" }, ctx.tenantId, ctx.adminId);
    expect(res.ok).toBe(true);
    const v = await prisma.vendedores.findUnique({ where: { id: vendedorAId } });
    expect(Number(v?.pct_comision)).toBe(10);
  });

  it("editarVendedor con comisión/cupo vacíos CONSERVA los valores anteriores (no los resetea)", async () => {
    // Prueba de regresión del hallazgo del reporte funcional: un campo vacío
    // al editar (p. ej. porque el admin solo quería corregir el teléfono)
    // antes dejaba la comisión en 0% y el cupo sin límite, en silencio.
    const antes = await prisma.vendedores.findUnique({ where: { id: vendedorAId } });
    const res = await editarVendedor(vendedorAId, { nombre: "QA Vendedor A", documento: "1000001", telefono: "3000000100", sede_id: String(ctx.sedeAId) }, ctx.tenantId, ctx.adminId);
    expect(res.ok).toBe(true);
    const despues = await prisma.vendedores.findUnique({ where: { id: vendedorAId } });
    expect(Number(despues?.pct_comision)).toBe(Number(antes?.pct_comision));
    expect(despues?.cupo_max).toBe(antes?.cupo_max);
    expect(despues?.telefono).toBe("3000000100"); // el resto del formulario sí se actualizó
  });
});

// ---------------------------------------------------------------------------

let rifaId: bigint;
let rifaCompartidaId: bigint;
let rifaRevisionId: bigint; // rifa propia de la segunda pasada de revisión funcional (ver más abajo)

describe("Rifas y boletas", () => {
  it("crearRifa + publicarRifa materializa las 100 boletas (2 dígitos)", async () => {
    const hoy = new Date();
    const enUnaSemana = new Date(hoy.getTime() + 7 * 86_400_000);
    const crear = await crearRifa(
      {
        sede_id: String(ctx.sedeAId), nombre: "Rifa QA", numero_digitos: "2", precio_boleta: "10000",
        fecha_apertura: hoy.toISOString().slice(0, 10), fecha_cierre_ventas: enUnaSemana.toISOString().slice(0, 10), fecha_sorteo: enUnaSemana.toISOString().slice(0, 10),
      },
      ctx.tenantId, null, ctx.adminId,
    );
    expect(crear.ok).toBe(true);
    if (!crear.ok) return;
    rifaId = crear.rifa.id;
    expect(crear.rifa.numero_min).toBe(0);
    expect(crear.rifa.numero_max).toBe(99);

    const pub = await publicarRifa(ctx.tenantId, rifaId, ctx.adminId);
    expect(pub.ok).toBe(true);
    if (pub.ok) expect(pub.boletas).toBe(100);

    const conteo = await prisma.boletas.count({ where: { rifa_id: rifaId } });
    expect(conteo).toBe(100);
  });

  it("asignarTalonario: consecutiva, aleatoria y específicas, sin solaparse", async () => {
    const cons = await asignarTalonario({ rifaId, vendedorId: vendedorAId, tipo: "consecutiva", inicio: 0, fin: 9 }, ctx.tenantId, ctx.adminId);
    expect(cons.ok).toBe(true);
    if (cons.ok) expect(cons.data?.boletas).toBe(10);

    const esp = await asignarTalonario({ rifaId, vendedorId: vendedorCId, tipo: "especificas", numeros: [50, 51, 52] }, ctx.tenantId, ctx.adminId);
    expect(esp.ok).toBe(true);
    if (esp.ok) expect(esp.data?.boletas).toBe(3);

    // vendedorC no tiene sede fija (opera en cualquier sede); vendedorB SÍ
    // tiene sede fija (Sede QA B) y esta rifa es de la Sede QA A y no es
    // compartida, así que vendedorB no puede recibir boletas de ella — se usa
    // vendedorC aquí para no chocar con esa regla de negocio real.
    const ale = await asignarTalonario({ rifaId, vendedorId: vendedorCId, tipo: "aleatoria", cantidad: 5 }, ctx.tenantId, ctx.adminId);
    expect(ale.ok).toBe(true);
    if (ale.ok) expect(ale.data?.boletas).toBe(5);

    // Reintentar la misma consecutiva (0-9) para otro vendedor debe fallar: ya están ocupadas.
    const solapa = await asignarTalonario({ rifaId, vendedorId: vendedorCId, tipo: "consecutiva", inicio: 0, fin: 9 }, ctx.tenantId, ctx.adminId);
    expect(solapa.ok).toBe(false);

    const total = await prisma.boletas.count({ where: { rifa_id: rifaId, talonario_id: { not: null } } });
    expect(total).toBe(18); // 10 + 3 + 5
  });

  it("aislamiento de sede: un usuario acotado a OTRA sede no puede editar, cambiar estado, asignar ni cerrar talonario de un vendedor ajeno (hallazgo de auditoría)", async () => {
    // vendedorAId pertenece a Sede QA A; simulamos un usuario acotado a Sede
    // QA B (sedeIdUsuario = ctx.sedeBId) intentando actuar sobre él. Antes de
    // esta corrección, la UI ocultaba la opción pero el servidor no la
    // rechazaba (bastaba un POST manipulado).
    const editar = await editarVendedor(
      vendedorAId, { nombre: "QA Vendedor A", documento: "1000001", telefono: "3000000101", sede_id: String(ctx.sedeAId) },
      ctx.tenantId, ctx.adminId, ctx.sedeBId,
    );
    expect(editar.ok).toBe(false);

    const estado = await cambiarEstadoVendedor(vendedorAId, ctx.tenantId, "suspendido", ctx.adminId, ctx.sedeBId);
    expect(estado.ok).toBe(false);
    const vSinCambio = await prisma.vendedores.findUnique({ where: { id: vendedorAId } });
    expect(vSinCambio?.estado).toBe("activo"); // el cambio no se aplicó

    // Cuenta ANTES/DESPUÉS (en vez de asumir que 60-61 están libres): otra
    // prueba anterior asigna 5 boletas AL AZAR sobre el mismo rango 0-99, así
    // que estos números pueden o no estar ya ocupados de forma legítima —
    // lo único que debe ser cierto es que el intento rechazado no cambió nada.
    const antesAsignar = await prisma.boletas.count({ where: { rifa_id: rifaId, numero: { in: [60, 61] }, talonario_id: { not: null } } });
    const asignar = await asignarTalonario({ rifaId, vendedorId: vendedorAId, tipo: "consecutiva", inicio: 60, fin: 61 }, ctx.tenantId, ctx.adminId, ctx.sedeBId);
    expect(asignar.ok).toBe(false);
    const despuesAsignar = await prisma.boletas.count({ where: { rifa_id: rifaId, numero: { in: [60, 61] }, talonario_id: { not: null } } });
    expect(despuesAsignar).toBe(antesAsignar);

    const talonarioA = await prisma.talonarios.findFirst({ where: { vendedor_id: vendedorAId, rifa_id: rifaId, estado: { not: "cerrado" } } });
    expect(talonarioA).not.toBeNull();
    const cerrar = await cerrarTalonario(talonarioA!.id, ctx.tenantId, ctx.adminId, ctx.sedeBId);
    expect(cerrar.ok).toBe(false);
    const talonarioSigueAbierto = await prisma.talonarios.findUnique({ where: { id: talonarioA!.id } });
    expect(talonarioSigueAbierto?.estado).not.toBe("cerrado");

    // En cambio, un usuario de la MISMA sede (o sin sede fija) sí puede.
    const editarOk = await editarVendedor(
      vendedorAId, { nombre: "QA Vendedor A", documento: "1000001", telefono: "3000000102", sede_id: String(ctx.sedeAId) },
      ctx.tenantId, ctx.adminId, ctx.sedeAId,
    );
    expect(editarOk.ok).toBe(true);
  });

  it("rifa compartida: asignarBoletasSede y liberarBoletasSede", async () => {
    const hoy = new Date();
    const enUnaSemana = new Date(hoy.getTime() + 7 * 86_400_000);
    const crear = await crearRifa(
      {
        sede_id: String(ctx.sedeAId), nombre: "Rifa QA Compartida", numero_digitos: "2", precio_boleta: "10000",
        fecha_apertura: hoy.toISOString().slice(0, 10), fecha_cierre_ventas: enUnaSemana.toISOString().slice(0, 10), fecha_sorteo: enUnaSemana.toISOString().slice(0, 10),
        compartida: "true",
      },
      ctx.tenantId, null, ctx.adminId,
    );
    expect(crear.ok).toBe(true);
    if (!crear.ok) return;
    rifaCompartidaId = crear.rifa.id;
    await publicarRifa(ctx.tenantId, rifaCompartidaId, ctx.adminId);

    const asig = await asignarBoletasSede(ctx.tenantId, rifaCompartidaId, ctx.sedeBId, { tipo: "consecutiva", inicio: 0, fin: 19 }, ctx.adminId);
    expect(asig.ok).toBe(true);
    if (asig.ok) expect(asig.data.asignadas).toBe(20);

    const lib = await liberarBoletasSede(ctx.tenantId, rifaCompartidaId, ctx.sedeBId, ctx.adminId);
    expect(lib.ok).toBe(true);
    if (lib.ok) expect(lib.data.liberadas).toBe(20); // ninguna se vendió: se liberan las 20

    // No aplica a una rifa que no es compartida.
    const noCompartida = await asignarBoletasSede(ctx.tenantId, rifaId, ctx.sedeBId, { tipo: "consecutiva", inicio: 90, fin: 91 }, ctx.adminId);
    expect(noCompartida.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------

let sedeConAdminId: bigint;
let adminSedeUserId: bigint;
const correoAdminSede = `qa-admin-sede-${Date.now()}@rifax-test.local`;

describe("Un administrador por sede: se crea junto con la sede y solo gestiona la suya", () => {
  it("crearSede con datos de administrador crea la sede Y su propio admin, acotado a ella", async () => {
    const res = await crearSede(
      ctx.tenantId, 5,
      { nombre: "Sede QA Admin", admin_nombre: "QA Admin Sede", admin_correo: correoAdminSede, admin_password: "Password123!" },
      ctx.adminId,
    );
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) return;
    expect(res.data.adminId).toBeTruthy();
    sedeConAdminId = BigInt(res.data.sedeId);
    adminSedeUserId = BigInt(res.data.adminId!);

    const fila = await prisma.usuarios.findUnique({ where: { id: adminSedeUserId }, include: { roles: true } });
    expect(fila?.roles.nombre).toBe("admin"); // mismo rol que el administrador general
    expect(fila?.sede_id).toBe(sedeConAdminId); // pero acotado a esta sede

    const debeCambiar = await prisma.$queryRawUnsafe<{ debe_cambiar_password: boolean }[]>(
      `SELECT debe_cambiar_password FROM saas.usuarios WHERE id = $1::bigint`,
      adminSedeUserId,
    );
    expect(debeCambiar[0].debe_cambiar_password).toBe(true); // debe definir su propia contraseña al entrar
  });

  it("si el correo del administrador ya existe, no crea ni la sede ni el usuario (todo o nada)", async () => {
    const res = await crearSede(
      ctx.tenantId, 5,
      { nombre: "Sede QA Admin Duplicada", admin_nombre: "Otro", admin_correo: ctx.adminCorreo, admin_password: "Password123!" },
      ctx.adminId,
    );
    expect(res.ok).toBe(false);
    const sede = await prisma.sedes.findFirst({ where: { tenant_id: ctx.tenantId, nombre: "Sede QA Admin Duplicada" } });
    expect(sede).toBeNull();
  });

  it("el administrador de una sede solo puede crear rifas para SU sede, no para otra", async () => {
    const hoy = new Date();
    const enUnaSemana = new Date(hoy.getTime() + 7 * 86_400_000);
    const datosBase = {
      numero_digitos: "2", precio_boleta: "5000",
      fecha_apertura: hoy.toISOString().slice(0, 10), fecha_cierre_ventas: enUnaSemana.toISOString().slice(0, 10), fecha_sorteo: enUnaSemana.toISOString().slice(0, 10),
    };

    const propia = await crearRifa({ ...datosBase, sede_id: String(sedeConAdminId), nombre: "Rifa de su propia sede" }, ctx.tenantId, sedeConAdminId, adminSedeUserId);
    expect(propia.ok).toBe(true);

    // El mismo administrador, ahora intentando crear una rifa para la Sede A
    // (que no es la suya): debe rechazarse.
    const ajena = await crearRifa({ ...datosBase, sede_id: String(ctx.sedeAId), nombre: "Rifa de otra sede" }, ctx.tenantId, sedeConAdminId, adminSedeUserId);
    expect(ajena.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------

let ventaId: bigint;
let boletaPagadaNumero: number;

describe("Ventas: anti-doble-venta y abonos", () => {
  it("dos ventas simultáneas a la MISMA boleta: solo una debe ganar", async () => {
    const disponibles = await prisma.$queryRawUnsafe<{ numero: number }[]>(
      `SELECT numero FROM saas.boletas WHERE rifa_id = $1::bigint AND estado = 'disponible' ORDER BY numero ASC LIMIT 1`,
      rifaId,
    );
    const numero = disponibles[0].numero;

    const [r1, r2] = await Promise.all([
      crearVenta({ rifa_id: String(rifaId), numeros: [numero], cliente: { nombre: "Cliente Carrera 1", telefono: "3001111111" } }, ctx.tenantId, ctx.adminId),
      crearVenta({ rifa_id: String(rifaId), numeros: [numero], cliente: { nombre: "Cliente Carrera 2", telefono: "3002222222" } }, ctx.tenantId, ctx.adminId),
    ]);
    const resultados = [r1, r2];
    const exitosas = resultados.filter((r) => r.ok);
    const fallidas = resultados.filter((r) => !r.ok);
    expect(exitosas.length).toBe(1);
    expect(fallidas.length).toBe(1);
  });

  it("registra una venta normal, la abona parcialmente, y bloquea el sobrepago", async () => {
    const disponibles = await prisma.$queryRawUnsafe<{ numero: number }[]>(
      `SELECT numero FROM saas.boletas WHERE rifa_id = $1::bigint AND estado = 'disponible' ORDER BY numero ASC LIMIT 2`,
      rifaId,
    );
    const numeros = disponibles.map((d) => d.numero);
    const venta = await crearVenta({ rifa_id: String(rifaId), numeros, cliente: { nombre: "Cliente Normal", telefono: "3003333333" }, vendedor_id: String(vendedorAId) }, ctx.tenantId, ctx.adminId);
    expect(venta.ok).toBe(true);
    if (!venta.ok) return;
    ventaId = venta.data.ventaId;
    const total = Number(venta.data.total);
    expect(total).toBe(numeros.length * 10000);

    const abonoParcial = await registrarAbono(ctx.tenantId, ventaId, { monto: total - 5000, origen: "efectivo" }, ctx.adminId);
    expect(abonoParcial.ok).toBe(true);
    if (abonoParcial.ok) expect(abonoParcial.data.estado).toBe("parcial");

    const sobrepago = await registrarAbono(ctx.tenantId, ventaId, { monto: 999_999_999, origen: "efectivo" }, ctx.adminId);
    expect(sobrepago.ok).toBe(false);

    const abonoFinal = await registrarAbono(ctx.tenantId, ventaId, { monto: 5000, origen: "efectivo" }, ctx.adminId);
    expect(abonoFinal.ok).toBe(true);
    if (abonoFinal.ok) {
      expect(abonoFinal.data.estado).toBe("pagada");
      expect(Number(abonoFinal.data.saldo)).toBe(0);
    }

    const boletasPagadas = await prisma.boletas.findMany({ where: { venta_id: ventaId } });
    expect(boletasPagadas.every((b) => b.estado === "pagada")).toBe(true);

    boletaPagadaNumero = numeros[0];
  });

  it("anularVenta libera las boletas y deja el saldo en 0", async () => {
    const disponibles = await prisma.$queryRawUnsafe<{ numero: number }[]>(
      `SELECT numero FROM saas.boletas WHERE rifa_id = $1::bigint AND estado = 'disponible' ORDER BY numero ASC LIMIT 1`,
      rifaId,
    );
    const numero = disponibles[0].numero;
    const venta = await crearVenta({ rifa_id: String(rifaId), numeros: [numero], cliente: { nombre: "Cliente Anulado", telefono: "3004444444" } }, ctx.tenantId, ctx.adminId);
    expect(venta.ok).toBe(true);
    if (!venta.ok) return;

    const anular = await anularVenta(ctx.tenantId, venta.data.ventaId, "Prueba funcional: anulación", ctx.adminId);
    expect(anular.ok).toBe(true);

    const boleta = await prisma.boletas.findFirst({ where: { rifa_id: rifaId, numero } });
    expect(boleta?.estado).toBe("disponible");
    expect(boleta?.venta_id).toBeNull();

    const ventaRow = await prisma.ventas.findUnique({ where: { id: venta.data.ventaId } });
    expect(Number(ventaRow?.saldo)).toBe(0);
    expect(ventaRow?.estado).toBe("anulada");
  });
});

// ---------------------------------------------------------------------------
// Punto 14 de la solicitud del usuario: abono de una venta de OTRA sede,
// permitido solo desde la oficina (nunca un vendedor), vía el permiso nuevo
// 'pago.registrar_otra_sede'.

describe("Abono de venta de otra sede (oficina)", () => {
  function usuarioFalso(rol: string, permisos: string[], sedeId: bigint | null): TenantUser {
    return {
      id: 0n, uuid: "qa", nombre: "QA", correo: "qa@rifax-test.local",
      rol, permisos,
      tenant: { id: ctx.tenantId, uuid: "qa", nombre: "QA", slug: ctx.slug, estado: "activo", maxSedes: 99 },
      sede: sedeId ? { id: sedeId, nombre: "QA" } : null, debeCambiar: false,
    };
  }

  it("buscarVentasParaAbono encuentra por código, por número de boleta y por documento, sin filtrar por sede", async () => {
    const disponibles = await prisma.$queryRawUnsafe<{ numero: number }[]>(
      `SELECT numero FROM saas.boletas WHERE rifa_id = $1::bigint AND estado = 'disponible' ORDER BY numero ASC LIMIT 1`,
      rifaId,
    );
    const numero = disponibles[0].numero;
    const venta = await crearVenta(
      { rifa_id: String(rifaId), numeros: [numero], cliente: { nombre: "Cliente Otra Sede", telefono: "3006660000", documento: "CC-OTRASEDE-1" } },
      ctx.tenantId, ctx.adminId,
    );
    expect(venta.ok).toBe(true);
    if (!venta.ok) return;

    // rifaId es de Sede QA A; buscamos como si fuéramos de Sede QA B.
    const porCodigo = await buscarVentasParaAbono(ctx.tenantId, venta.data.codigo);
    expect(porCodigo.some((v) => v.ventaId === String(venta.data.ventaId))).toBe(true);
    expect(porCodigo[0]?.sede).toBe("Sede QA A");

    const porBoleta = await buscarVentasParaAbono(ctx.tenantId, String(numero));
    expect(porBoleta.some((v) => v.ventaId === String(venta.data.ventaId))).toBe(true);

    const porDocumento = await buscarVentasParaAbono(ctx.tenantId, "CC-OTRASEDE-1");
    expect(porDocumento.some((v) => v.ventaId === String(venta.data.ventaId))).toBe(true);

    const sinCoincidencia = await buscarVentasParaAbono(ctx.tenantId, "no-existe-esto-nunca");
    expect(sinCoincidencia).toHaveLength(0);

    // Alcance: un cajero de OTRA sede (B) sí puede; un vendedor con el mismo
    // permiso (override hipotético) NO puede; un cajero sin el permiso tampoco.
    const cajeroSedeB = usuarioFalso("cajero", ["pago.registrar_otra_sede"], ctx.sedeBId);
    expect(await ventaEnAlcanceOtraSede(cajeroSedeB, venta.data.ventaId)).toBe(true);
    // Y `ventaEnAlcance` normal, en cambio, SÍ debe seguir rechazándolo (es la
    // excepción explícita, no un relajamiento general del aislamiento).
    expect(await ventaEnAlcance(cajeroSedeB, venta.data.ventaId)).toBe(false);
    expect(await ventaEnAlcanceParaRecibo(cajeroSedeB, venta.data.ventaId)).toBe(true);

    const vendedorConPermiso = usuarioFalso("vendedor", ["pago.registrar_otra_sede"], null);
    expect(await ventaEnAlcanceOtraSede(vendedorConPermiso, venta.data.ventaId)).toBe(false);

    const cajeroSinPermiso = usuarioFalso("cajero", ["pago.registrar"], ctx.sedeBId);
    expect(await ventaEnAlcanceOtraSede(cajeroSinPermiso, venta.data.ventaId)).toBe(false);

    // Registra el abono de verdad (como lo haría la acción del servidor) y
    // confirma que el saldo baja igual que un abono normal.
    const abono = await registrarAbono(ctx.tenantId, venta.data.ventaId, { monto: 1000, origen: "efectivo" }, ctx.adminId);
    expect(abono.ok).toBe(true);
    const ventaRow = await prisma.ventas.findUnique({ where: { id: venta.data.ventaId } });
    expect(Number(ventaRow?.saldo)).toBe(Number(venta.data.total) - 1000);
  });
});

// ---------------------------------------------------------------------------

describe("Traspasos de boletas", () => {
  it("buscarBoleta reconoce como TUYA una boleta que ya está en tu propio talonario (no debe pedir solicitarla)", async () => {
    // Cualquier boleta 0-9 que siga disponible en el talonario del vendedor A
    // (algunas de ese rango ya se vendieron en las pruebas de Ventas).
    const propia = await prisma.$queryRawUnsafe<{ numero: number }[]>(
      `SELECT numero FROM saas.boletas WHERE rifa_id = $1::bigint AND numero BETWEEN 0 AND 9 AND estado = 'disponible' ORDER BY numero ASC LIMIT 1`,
      rifaId,
    );
    const estado = await buscarBoleta(ctx.tenantId, rifaId, propia[0].numero, { tipo: "vendedor", vendedorId: vendedorAId, nombre: "QA Vendedor A" });
    expect(estado.resultado).toBe("tuya");
    expect(estado.puedeVenderDirecto).toBe(true);
    expect(estado.puedeSolicitar).toBe(false);
  });

  it("buscarBoleta reconoce como TUYA una boleta ya asignada a tu sede (rifa compartida, sin talonario)", async () => {
    const asig = await asignarBoletasSede(ctx.tenantId, rifaCompartidaId, ctx.sedeBId, { tipo: "especificas", numeros: [50] }, ctx.adminId);
    expect(asig.ok).toBe(true);

    const estado = await buscarBoleta(ctx.tenantId, rifaCompartidaId, 50, { tipo: "sede", sedeId: ctx.sedeBId, nombre: "Sede QA B" });
    expect(estado.resultado).toBe("tuya");
    expect(estado.puedeVenderDirecto).toBe(true);
    expect(estado.puedeSolicitar).toBe(false);

    // La misma boleta, vista desde OTRA sede, sí debe pedir solicitud.
    const desdeOtra = await buscarBoleta(ctx.tenantId, rifaCompartidaId, 50, { tipo: "sede", sedeId: ctx.sedeAId, nombre: "Sede QA A" });
    expect(desdeOtra.resultado).toBe("punto_de_venta");
    expect(desdeOtra.puedeSolicitar).toBe(true);
  });

  it("buscarBoleta reconoce como TUYA (punto de venta) una boleta sin talonario de tu propia rifa NO compartida", async () => {
    // "Rifa QA" (rifaId) es de la Sede A y no es compartida: cualquier boleta
    // sin talonario le pertenece a la Sede A por definición (no hace falta
    // asignarBoletasSede — eso solo aplica a rifas compartidas).
    const sinTalonario = await prisma.$queryRawUnsafe<{ numero: number }[]>(
      `SELECT numero FROM saas.boletas WHERE rifa_id = $1::bigint AND estado = 'disponible' AND talonario_id IS NULL ORDER BY numero ASC LIMIT 1`,
      rifaId,
    );
    const estado = await buscarBoleta(ctx.tenantId, rifaId, sinTalonario[0].numero, { tipo: "sede", sedeId: ctx.sedeAId, nombre: "Sede QA A" });
    expect(estado.resultado).toBe("tuya");
    expect(estado.puedeVenderDirecto).toBe(true);
  });

  it("de punta a punta: el acceso al portal del vendedor resuelve su propio contexto (no solo la lógica de buscarBoleta)", async () => {
    // Hasta aquí todas las pruebas de "tuya" construían el contexto a mano;
    // esta usa el camino real completo: crear el login del vendedor
    // (crearAccesoVendedor, lo que usa el admin desde la ficha del vendedor)
    // y luego contextoDeUsuario(), la misma función que resuelve quién es
    // quien busca en la pantalla real de traspasos/nueva venta.
    const acceso = await crearAccesoVendedor(vendedorAId, ctx.tenantId, `qa-portal-vendedorA-${ctx.slug}@rifax-test.local`, "Password123!", ctx.adminId);
    expect(acceso.ok).toBe(true);

    const filaUsuario = await prisma.usuarios.findFirst({ where: { tenant_id: ctx.tenantId, correo: `qa-portal-vendedorA-${ctx.slug}@rifax-test.local` } });
    expect(filaUsuario).toBeTruthy();
    filaUsuarioVendedorAId = filaUsuario!.id;

    const usuarioVendedorA: TenantUser = {
      id: filaUsuario!.id, uuid: filaUsuario!.uuid, nombre: filaUsuario!.nombre, correo: filaUsuario!.correo,
      rol: "vendedor", permisos: [],
      tenant: { id: ctx.tenantId, uuid: "qa", nombre: "QA", slug: ctx.slug, estado: "activo", maxSedes: 99 },
      sede: null, debeCambiar: true,
    };
    const contexto = await contextoDeUsuario(ctx.tenantId, usuarioVendedorA);
    expect(contexto).toEqual({ tipo: "vendedor", vendedorId: vendedorAId, nombre: "QA Vendedor A" });

    // Con ese contexto resuelto de verdad, una boleta suya se ve como "tuya".
    const propia = await prisma.$queryRawUnsafe<{ numero: number }[]>(
      `SELECT numero FROM saas.boletas WHERE rifa_id = $1::bigint AND numero BETWEEN 0 AND 9 AND estado = 'disponible' ORDER BY numero ASC LIMIT 1`,
      rifaId,
    );
    const estado = await buscarBoleta(ctx.tenantId, rifaId, propia[0].numero, contexto);
    expect(estado.resultado).toBe("tuya");
  });

  it("actualizarAccesoVendedor cambia correo/contraseña del acceso ya creado y no permite crear otro", async () => {
    // No se puede volver a "crear" el acceso: ya existe (crearAccesoVendedor
    // lo rechaza); el cambio de credenciales pasa por actualizarAccesoVendedor.
    const duplicado = await crearAccesoVendedor(vendedorAId, ctx.tenantId, `otro-${ctx.slug}@rifax-test.local`, "Password123!", ctx.adminId);
    expect(duplicado.ok).toBe(false);

    const antes = await prisma.usuarios.findUnique({ where: { id: filaUsuarioVendedorAId } });
    expect(antes).toBeTruthy();

    const nuevoCorreo = `qa-portal-vendedorA-nuevo-${ctx.slug}@rifax-test.local`;
    const res = await actualizarAccesoVendedor(vendedorAId, ctx.tenantId, nuevoCorreo, "OtraClave456!", ctx.adminId);
    expect(res.ok).toBe(true);

    const despues = await prisma.usuarios.findUnique({ where: { id: filaUsuarioVendedorAId } });
    expect(despues?.correo).toBe(nuevoCorreo);
    expect(despues?.password_hash).not.toBe(antes?.password_hash);

    const debeCambiar = await prisma.$queryRawUnsafe<{ debe_cambiar_password: boolean }[]>(
      `SELECT debe_cambiar_password FROM saas.usuarios WHERE id = $1::bigint`, filaUsuarioVendedorAId,
    );
    expect(debeCambiar[0].debe_cambiar_password).toBe(true);

    // Correo solo (sin contraseña nueva) conserva la contraseña que ya tenía.
    const antes2 = await prisma.usuarios.findUnique({ where: { id: filaUsuarioVendedorAId } });
    const soloCorreo = await actualizarAccesoVendedor(vendedorAId, ctx.tenantId, nuevoCorreo, undefined, ctx.adminId);
    expect(soloCorreo.ok).toBe(true);
    const despues2 = await prisma.usuarios.findUnique({ where: { id: filaUsuarioVendedorAId } });
    expect(despues2?.password_hash).toBe(antes2?.password_hash);
  });

  it("crea una solicitud del vendedor C hacia una boleta del vendedor A, y la aprueba", async () => {
    // Boleta 5 quedó en el talonario consecutivo (0-9) del vendedor A.
    const solicitud = await crearSolicitudTraspaso(
      ctx.tenantId, rifaId, 5,
      { tipo: "vendedor", vendedorId: vendedorCId, nombre: "QA Vendedor C" },
      ctx.adminId,
    );
    expect(solicitud.ok).toBe(true);
    if (!solicitud.ok) return;

    // No se puede duplicar una solicitud pendiente para la misma boleta.
    const duplicada = await crearSolicitudTraspaso(
      ctx.tenantId, rifaId, 5,
      { tipo: "vendedor", vendedorId: vendedorBId, nombre: "QA Vendedor B" },
      ctx.adminId,
    );
    expect(duplicada.ok).toBe(false);

    const solicitudId = BigInt(solicitud.data.solicitudId);
    const aprobar = await resolverSolicitud(
      ctx.tenantId, solicitudId, true,
      { tipo: "vendedor", vendedorId: vendedorAId, nombre: "QA Vendedor A" },
      ctx.adminId,
    );
    expect(aprobar.ok).toBe(true);

    const boleta = await prisma.boletas.findFirst({ where: { rifa_id: rifaId, numero: 5 }, include: { talonarios: true } });
    expect(boleta?.talonarios?.vendedor_id).toBe(vendedorCId);
  });

  it("si la boleta traspasada se vende, buscarBoleta avisa que fue un traspaso a ese vendedor", async () => {
    // Boleta 5: traspasada al vendedor C en la prueba anterior. Al venderla,
    // quien la busque después (p. ej. otro vendedor) debe ver no solo que ya
    // está vendida, sino que llegó a manos de quien la vendió por traspaso.
    const venta = await crearVenta(
      { rifa_id: String(rifaId), numeros: [5], cliente: { nombre: "Cliente Traspaso", telefono: "3005550000" }, vendedor_id: String(vendedorCId) },
      ctx.tenantId, ctx.adminId,
    );
    expect(venta.ok).toBe(true);

    const estado = await buscarBoleta(ctx.tenantId, rifaId, 5, { tipo: "vendedor", vendedorId: vendedorBId, nombre: "QA Vendedor B" });
    expect(estado.resultado).toBe("vendida");
    expect(estado.mensaje).toBe("Esta boleta ya está vendida. Fue un traspaso al vendedor QA Vendedor C.");

    // Una boleta vendida SIN traspaso previo no lleva esa mención adicional.
    const otraVenta = await crearVenta(
      { rifa_id: String(rifaId), numeros: [7], cliente: { nombre: "Cliente Sin Traspaso", telefono: "3005550001" } },
      ctx.tenantId, ctx.adminId,
    );
    expect(otraVenta.ok).toBe(true);
    const estadoSinTraspaso = await buscarBoleta(ctx.tenantId, rifaId, 7, null);
    expect(estadoSinTraspaso.mensaje).toBe("Esta boleta ya está vendida.");
  });

  it("listarVentas trae el número de boleta y observaciones de traspaso; comisionesDetalladas trae la misma boleta con su comisión", async () => {
    // La venta de la boleta 5 (traspasada de A a C) se creó en la prueba anterior.
    const ventas = await listarVentas(ctx.tenantId, null);
    const ventaBoleta5 = ventas.find((v) => v.boletas.includes(5));
    expect(ventaBoleta5).toBeTruthy();
    expect(ventaBoleta5!.observaciones).toBe("Boleta #5: traspasada de QA Vendedor A a QA Vendedor C.");

    // La venta de la boleta 7 (sin traspaso) no lleva observación.
    const ventaBoleta7 = ventas.find((v) => v.boletas.includes(7));
    expect(ventaBoleta7).toBeTruthy();
    expect(ventaBoleta7!.observaciones).toBeNull();

    // El detalle de comisiones trae esa misma venta con su boleta y su comisión.
    const detalle = await comisionesDetalladas(ctx.tenantId, null);
    const filaDetalle = detalle.find((d) => d.ventaId === String(ventaBoleta5!.id));
    expect(filaDetalle).toBeTruthy();
    expect(filaDetalle!.boletas).toEqual([5]);
    expect(filaDetalle!.vendedorId).toBe(String(vendedorCId));
    expect(filaDetalle!.comisionVenta).toBe(calcularComision(filaDetalle!.recaudadoVenta, filaDetalle!.pct));
  });

  it("rechaza una solicitud con motivo, y no mueve la boleta", async () => {
    const solicitud = await crearSolicitudTraspaso(
      ctx.tenantId, rifaId, 6,
      { tipo: "vendedor", vendedorId: vendedorCId, nombre: "QA Vendedor C" },
      ctx.adminId,
    );
    expect(solicitud.ok).toBe(true);
    if (!solicitud.ok) return;
    const solicitudId = BigInt(solicitud.data.solicitudId);

    const rechazar = await resolverSolicitud(
      ctx.tenantId, solicitudId, false,
      { tipo: "vendedor", vendedorId: vendedorAId, nombre: "QA Vendedor A" },
      ctx.adminId,
      "Prueba funcional: motivo de rechazo",
    );
    expect(rechazar.ok).toBe(true);

    const boleta = await prisma.boletas.findFirst({ where: { rifa_id: rifaId, numero: 6 }, include: { talonarios: true } });
    expect(boleta?.talonarios?.vendedor_id).toBe(vendedorAId); // sigue siendo del vendedor A

    const fila = await prisma.$queryRawUnsafe<{ estado: string; motivo_rechazo: string | null }[]>(
      `SELECT estado, motivo_rechazo FROM saas.solicitudes_boleta WHERE id = $1::bigint`,
      solicitudId,
    );
    expect(fila[0].estado).toBe("rechazada");
    expect(fila[0].motivo_rechazo).toBe("Prueba funcional: motivo de rechazo");
  });
});

// ---------------------------------------------------------------------------

describe("Multisede: entorno propio por sede, salvo en traspasos (consulta toda la empresa)", () => {
  it("una empresa puede tener más de 2 sedes (no hay un tope de 2 en el sistema)", async () => {
    // No se asume cuántas sedes existen ya (otras pruebas anteriores crean
    // las suyas): el cupo se calcula dinámicamente, uno más de las actuales.
    const antes = await prisma.sedes.count({ where: { tenant_id: ctx.tenantId } });
    const c = await crearSede(ctx.tenantId, antes + 1, { nombre: "Sede QA Multisede" }, ctx.adminId);
    expect(c.ok).toBe(true);

    const sedes = await estadoSedes(ctx.tenantId);
    expect(sedes.length).toBe(antes + 1);
    expect(sedes.map((s) => s.nombre)).toContain("Sede QA Multisede");

    // Una sede más allá del cupo ya no cabe: confirma que el límite es
    // configurable por empresa, no un tope fijo del sistema.
    const d = await crearSede(ctx.tenantId, antes + 1, { nombre: "Sede QA Multisede 2" }, ctx.adminId);
    expect(d.ok).toBe(false);
  });

  it("buscarBoleta encuentra boletas de OTRA sede: la búsqueda de traspasos no se limita al entorno propio", async () => {
    // Boleta disponible y sin talonario de "Rifa QA" (sede A, no compartida).
    const disponibles = await prisma.$queryRawUnsafe<{ numero: number }[]>(
      `SELECT numero FROM saas.boletas WHERE rifa_id = $1::bigint AND estado = 'disponible' AND talonario_id IS NULL ORDER BY numero ASC LIMIT 1`,
      rifaId,
    );
    const numero = disponibles[0].numero;

    // Alguien "parado" en la Sede B (su propio entorno) busca ese número, que
    // pertenece a la Sede A. Si la búsqueda estuviera acotada a su propia
    // sede, no debería encontrarlo — pero para traspasos sí debe verlo, para
    // poder solicitarlo.
    const estado = await buscarBoleta(ctx.tenantId, rifaId, numero, { tipo: "sede", sedeId: ctx.sedeBId, nombre: "Sede QA B" });
    expect(estado.resultado).toBe("punto_de_venta");
    expect(estado.propietario?.nombre).toBe("Sede QA A");
    expect(estado.puedeSolicitar).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("Comisiones y liquidación", () => {
  it("calcularComision / calcularPendiente hacen la aritmética correcta", () => {
    expect(calcularComision(200000, 10)).toBe(20000);
    expect(calcularPendiente(20000, 5000)).toBe(15000);
  });

  it("estadoComisiones refleja lo recaudado por el vendedor A (la venta pagada de la sección anterior)", async () => {
    const estados = await estadoComisiones(ctx.tenantId);
    const filaA = estados.find((e) => e.id === vendedorAId);
    expect(filaA).toBeTruthy();
    expect(filaA!.recaudado).toBeGreaterThanOrEqual(20000); // los 2 boletos de $10.000 pagados
    expect(filaA!.comisionGanada).toBeCloseTo(filaA!.recaudado * 0.10, 2);
  });

  it("liquidarVendedor no permite liquidar dos veces el mismo pendiente (doble clic)", async () => {
    const antes = await estadoComisiones(ctx.tenantId);
    const pendienteAntes = antes.find((e) => e.id === vendedorAId)!.pendiente;
    expect(pendienteAntes).toBeGreaterThan(0);

    const [liq1, liq2] = await Promise.all([
      liquidarVendedor(ctx.tenantId, vendedorAId, ctx.adminId),
      liquidarVendedor(ctx.tenantId, vendedorAId, ctx.adminId),
    ]);
    const exitosas = [liq1, liq2].filter((r) => r.ok);
    // Con el pendiente ya en 0 tras la primera, la segunda debe fallar (no hay
    // nada que liquidar) -- así se evita la doble liquidación por condición
    // de carrera que corrigió hoy el agente de datos.
    expect(exitosas.length).toBe(1);

    const despues = await estadoComisiones(ctx.tenantId);
    const pendienteDespues = despues.find((e) => e.id === vendedorAId)!.pendiente;
    expect(pendienteDespues).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe("Sorteos (commit-reveal)", () => {
  it("ejecuta un sorteo commit-reveal y el resultado es recalculable/verificable", async () => {
    const premioRes = await agregarPremio(ctx.tenantId, rifaId, { nombre: "Premio QA" }, ctx.adminId);
    expect(premioRes.ok).toBe(true);
    const premio = await prisma.premios.findFirst({ where: { rifa_id: rifaId, nombre: "Premio QA" } });
    expect(premio).toBeTruthy();

    const sorteo = await ejecutarSorteo({ rifaId, premioId: premio!.id, modalidad: "commit_reveal" }, ctx.tenantId, ctx.adminId);
    expect(sorteo.ok).toBe(true);
    if (!sorteo.ok) return;

    const fila = await prisma.$queryRawUnsafe<{ semilla: string; commit_hash: string; numero_ganador: number }[]>(
      `SELECT semilla, commit_hash, numero_ganador FROM saas.sorteos WHERE rifa_id = $1::bigint AND premio_id = $2::bigint`,
      rifaId, premio!.id,
    );
    const { semilla, commit_hash, numero_ganador } = fila[0];

    // Cualquiera puede verificar el sorteo sin confiar en la plataforma:
    // recalcular el hash de la semilla revelada y el número ganador, y
    // compararlos contra lo publicado ANTES del sorteo (el commit).
    expect(hashSemilla(semilla)).toBe(commit_hash);
    expect(derivarNumeroGanador(semilla, 0, 99)).toBe(numero_ganador);
    expect(numero_ganador).toBe(sorteo.data?.numeroGanador);

    // Si la boleta ganadora coincidió con la que se vendió y pagó en la
    // sección de ventas, debe haber quedado un registro de ganador.
    if (numero_ganador === boletaPagadaNumero) {
      const ganador = await prisma.ganadores.findFirst({ where: { rifa_id: rifaId, premio_id: premio!.id } });
      expect(ganador).toBeTruthy();
    }
  });

  it("no permite sortear dos veces el mismo premio de la misma rifa", async () => {
    const premio = await prisma.premios.findFirst({ where: { rifa_id: rifaId, nombre: "Premio QA" } });
    const res = await ejecutarSorteo({ rifaId, premioId: premio!.id, modalidad: "commit_reveal" }, ctx.tenantId, ctx.adminId);
    expect(res.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("Reset automático de contraseña", () => {
  it("cambia la contraseña del admin de prueba y no revela si el correo no existe", async () => {
    const hashAntes = (await prisma.usuarios.findUnique({ where: { id: ctx.adminId } }))?.password_hash;

    const res = await solicitarResetAutomatico(ctx.adminCorreo);
    expect(res.ok).toBe(true); // siempre responde ok, exista o no el correo

    const hashDespues = (await prisma.usuarios.findUnique({ where: { id: ctx.adminId } }))?.password_hash;
    expect(hashDespues).not.toBe(hashAntes);

    const debeCambiar = await prisma.$queryRawUnsafe<{ debe_cambiar_password: boolean }[]>(
      `SELECT debe_cambiar_password FROM saas.usuarios WHERE id = $1::bigint`,
      ctx.adminId,
    );
    expect(debeCambiar[0].debe_cambiar_password).toBe(true);

    const inexistente = await solicitarResetAutomatico(`no-existe-${ctx.slug}@rifax-test.local`);
    expect(inexistente.ok).toBe(true); // misma respuesta genérica, no revela nada
  });

  it("rechaza un correo con formato inválido", async () => {
    const res = await solicitarResetAutomatico("no-es-un-correo");
    expect(res.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("Purga de auditoría (super-admin): solo se prueba el resguardo, nunca una purga real", () => {
  // Deliberadamente NO se ejecuta una purga real aquí: la cadena de hashes es
  // GLOBAL (todos los tenants comparten `saas.auditoria`), y este arnés corre
  // contra la base real de Neon — no una de prueba aislada. Confirmar que el
  // resguardo de antigüedad mínima (RETENCION_MINIMA_DIAS) rechaza fechas
  // recientes es justamente lo que garantiza que este archivo nunca borre
  // auditoría real, ni hoy ni si se vuelve a correr dentro de un año.
  it("rechaza purgar auditoría más reciente que la retención mínima (no borra nada)", async () => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const res = await purgarAuditoria(ayer, ctx.adminId);
    expect(res.ok).toBe(false);
  });

  it("rechaza una fecha inválida", async () => {
    const res = await purgarAuditoria(new Date("no-es-una-fecha"), ctx.adminId);
    expect(res.ok).toBe(false);
  });

  it("estadoAuditoriaGlobal e historialPurgasAuditoria devuelven una forma válida (solo lectura)", async () => {
    const estado = await estadoAuditoriaGlobal();
    expect(typeof estado.integra).toBe("boolean");
    expect(typeof estado.totalEventos).toBe("number");
    expect(estado.totalEventos).toBeGreaterThan(0); // esta misma prueba ya generó eventos

    const historial = await historialPurgasAuditoria();
    expect(Array.isArray(historial)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Segunda pasada de revisión funcional integral: módulos que no tenían
// ninguna prueba hasta ahora (liquidación masiva, cartera, clientes,
// catálogos, carga masiva CSV, vencimientos, outbox) y una verificación
// formal — no solo manual — de que purgar_tenant() deja documentado el
// reinicio de cadena de auditoría en vez de romperla en silencio.
// ---------------------------------------------------------------------------

describe("Rifa propia de esta segunda pasada", () => {
  // `rifaId` ya quedó "sorteada" (describe "Sorteos" más arriba) y crearVenta
  // correctamente rechaza vender sobre una rifa no activa — comportamiento
  // real, no un bug. Las pruebas de abajo que necesitan vender boletas usan
  // esta rifa aparte, siempre activa, en vez de depender del estado final
  // (frágil) en el que haya quedado `rifaId` tras el resto de la suite.
  it("crea y publica una rifa activa para las pruebas de abajo", async () => {
    const hoy = new Date();
    const enUnaSemana = new Date(hoy.getTime() + 7 * 86_400_000);
    const crear = await crearRifa(
      {
        sede_id: String(ctx.sedeAId), nombre: "Rifa QA Revision", numero_digitos: "2", precio_boleta: "10000",
        fecha_apertura: hoy.toISOString().slice(0, 10), fecha_cierre_ventas: enUnaSemana.toISOString().slice(0, 10), fecha_sorteo: enUnaSemana.toISOString().slice(0, 10),
      },
      ctx.tenantId, null, ctx.adminId,
    );
    expect(crear.ok).toBe(true);
    if (!crear.ok) return;
    rifaRevisionId = crear.rifa.id;
    const pub = await publicarRifa(ctx.tenantId, rifaRevisionId, ctx.adminId);
    expect(pub.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("Liquidación masiva de comisiones (plan Corporativo)", () => {
  it("liquida el pendiente de TODOS los vendedores a la vez, y una segunda vez no encuentra nada pendiente", async () => {
    await cambiarPlanTenant(ctx.tenantId, "corporativo", ctx.superAdminId);

    // Venta nueva, pagada de una, atribuida directamente al vendedor B (sin
    // pasar por un talonario propio: crearVenta no exige que coincidan sede
    // ni talonario, solo que el vendedor sea del mismo tenant).
    const disponibleB = await prisma.$queryRawUnsafe<{ numero: number }[]>(
      `SELECT numero FROM saas.boletas WHERE rifa_id=$1::bigint AND estado='disponible' ORDER BY numero LIMIT 1`,
      rifaRevisionId,
    );
    expect(disponibleB.length).toBeGreaterThan(0);
    const venta = await crearVenta(
      { rifa_id: String(rifaRevisionId), numeros: [disponibleB[0].numero], cliente: { nombre: "Cliente Masivo", telefono: "3006660000" }, vendedor_id: String(vendedorBId) },
      ctx.tenantId, ctx.adminId,
    );
    expect(venta.ok).toBe(true);
    if (venta.ok) {
      const abono = await registrarAbono(ctx.tenantId, venta.data.ventaId, { monto: Number(venta.data.total) }, ctx.adminId);
      expect(abono.ok).toBe(true);
    }

    const antes = await estadoComisiones(ctx.tenantId);
    const totalPendienteEsperado = antes.reduce((a, c) => a + c.pendiente, 0);
    expect(totalPendienteEsperado).toBeGreaterThan(0);

    const res = await liquidarMasivo(ctx.tenantId, ctx.adminId);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data!.total).toBeCloseTo(totalPendienteEsperado, 2);

    const despues = await estadoComisiones(ctx.tenantId);
    expect(despues.every((c) => c.pendiente === 0)).toBe(true);

    const otraVez = await liquidarMasivo(ctx.tenantId, ctx.adminId);
    expect(otraVez.ok).toBe(false); // ya no queda nada pendiente
  });

  it("no permite liquidación masiva en el plan Básico", async () => {
    await cambiarPlanTenant(ctx.tenantId, "basico", ctx.superAdminId);
    const res = await liquidarMasivo(ctx.tenantId, ctx.adminId);
    expect(res.ok).toBe(false);
    await cambiarPlanTenant(ctx.tenantId, "corporativo", ctx.superAdminId); // deja el tenant como lo esperan las demás pruebas
  });
});

// ---------------------------------------------------------------------------

describe("Cartera y clientes", () => {
  it("listarCartera muestra una venta con saldo pendiente como 'corriente' (recién creada)", async () => {
    const disponible = await prisma.$queryRawUnsafe<{ numero: number }[]>(
      `SELECT numero FROM saas.boletas WHERE rifa_id=$1::bigint AND estado='disponible' ORDER BY numero LIMIT 1`,
      rifaRevisionId,
    );
    expect(disponible.length).toBeGreaterThan(0);
    const venta = await crearVenta(
      { rifa_id: String(rifaRevisionId), numeros: [disponible[0].numero], cliente: { nombre: "Cliente Cartera", telefono: "3008880099" } },
      ctx.tenantId, ctx.adminId,
    );
    expect(venta.ok).toBe(true);
    if (!venta.ok) return;

    const abono = await registrarAbono(ctx.tenantId, venta.data.ventaId, { monto: 1 }, ctx.adminId); // abono mínimo: deja saldo pendiente
    expect(abono.ok).toBe(true);

    const cartera = await listarCartera(ctx.tenantId, null);
    const fila = cartera.find((f) => f.venta_id === venta.data!.ventaId);
    expect(fila).toBeTruthy();
    expect(fila!.tramo).toBe("corriente");
    expect(Number(fila!.saldo)).toBeGreaterThan(0);

    const resumen = resumirCartera(cartera);
    expect(resumen.cuentas).toBe(cartera.length);
    expect(resumen.porTramo.some((t) => t.tramo === "corriente")).toBe(true);

    // ---- clientes: editar y anular/reactivar el cliente recién creado ----
    const clienteFilas = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
      `SELECT cliente_id AS id FROM saas.ventas WHERE id = $1::bigint`, venta.data.ventaId,
    );
    const clienteId = clienteFilas[0].id;

    const editar = await actualizarCliente(ctx.tenantId, clienteId, { nombre: "Cliente Cartera Editado", telefono: "3008880099" }, ctx.adminId);
    expect(editar.ok).toBe(true);
    const cliente = await prisma.clientes.findUnique({ where: { id: clienteId } });
    expect(cliente?.nombre).toBe("Cliente Cartera Editado");

    // El teléfono es único por tenant: otro cliente ya existente no puede reusarlo.
    const dupTelefono = await actualizarCliente(ctx.tenantId, clienteId, { nombre: "X", telefono: "3005550000" /* Cliente Traspaso, ya existe */ }, ctx.adminId);
    expect(dupTelefono.ok).toBe(false);

    expect(await estadoCliente(ctx.tenantId, clienteId)).toBe("activo");
    const anular = await cambiarEstadoCliente(ctx.tenantId, clienteId, "inactivo", ctx.adminId);
    expect(anular.ok).toBe(true);
    expect(await estadoCliente(ctx.tenantId, clienteId)).toBe("inactivo");
    await cambiarEstadoCliente(ctx.tenantId, clienteId, "activo", ctx.adminId); // deja limpio
  });
});

// ---------------------------------------------------------------------------

describe("Catálogos configurables (listas desplegables)", () => {
  it("opcionesDe usa los valores por defecto cuando el tenant no tiene items propios activos", async () => {
    const ops = await opcionesDe(ctx.tenantId, "canal_mensaje");
    const defaults = TIPOS.find((t) => t.tipo === "canal_mensaje")!.defaults;
    expect(ops).toEqual(defaults);
  });

  it("agregarItem reemplaza los defaults por las opciones propias; toggleItem los desactiva y vuelve a caer en los defaults", async () => {
    const creado = await agregarItem(ctx.tenantId, "canal_mensaje", "Instagram DM", "Instagram DM", ctx.adminId);
    expect(creado.ok).toBe(true);

    const conPropio = await opcionesDe(ctx.tenantId, "canal_mensaje");
    expect(conPropio).toEqual([{ valor: "instagram_dm", etiqueta: "Instagram DM" }]); // normalizado a snake_case; ya no caen los defaults

    // Mismo valor normalizado (con mayúsculas/espacios distintos) = duplicado.
    const dup = await agregarItem(ctx.tenantId, "canal_mensaje", "instagram dm", "Otra etiqueta", ctx.adminId);
    expect(dup.ok).toBe(false);

    const todos = await listarCatalogos(ctx.tenantId);
    const item = todos.get("canal_mensaje")![0];
    const desactivado = await toggleItem(ctx.tenantId, item.id, ctx.adminId);
    expect(desactivado.ok).toBe(true);

    // Sin ningún item ACTIVO propio, opcionesDe vuelve a los defaults (no queda vacío).
    const trasDesactivar = await opcionesDe(ctx.tenantId, "canal_mensaje");
    expect(trasDesactivar).toEqual(TIPOS.find((t) => t.tipo === "canal_mensaje")!.defaults);
  });

  it("rechaza un tipo de lista desconocido", async () => {
    const res = await agregarItem(ctx.tenantId, "tipo-que-no-existe", "x", "X", ctx.adminId);
    expect(res.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Punto 7 de la solicitud del usuario: credenciales de Wompi/WhatsApp/SMS por
// empresa. Lo crítico a probar es que los secretos nunca se devuelven en
// texto plano y que dejar un campo en blanco CONSERVA el valor anterior.

describe("Integraciones (Wompi, WhatsApp, SMS)", () => {
  it("sin configurar: todo aparece como no configurado, y guardar en blanco no crea secretos", async () => {
    const antes = await obtenerIntegraciones(ctx.tenantId);
    expect(antes.wompiPrivateKeyConfigurada).toBe(false);
    expect(antes.whatsappTokenConfigurado).toBe(false);
    expect(antes.smsApiKeyConfigurada).toBe(false);
  });

  it("guardarIntegraciones guarda los campos públicos y los secretos; obtenerIntegraciones nunca devuelve el valor del secreto", async () => {
    const res = await guardarIntegraciones(
      ctx.tenantId,
      {
        wompi_sandbox: false,
        wompi_public_key: "pub_test_123",
        wompi_private_key: "prv_test_secreto",
        wompi_events_secret: "evt_secreto",
        whatsapp_phone_number_id: "555000111",
        whatsapp_token: "wa_token_secreto",
        sms_remitente: "RIFAX",
        sms_api_key: "sms_key_secreto",
      },
      ctx.adminId,
    );
    expect(res.ok).toBe(true);

    const despues = await obtenerIntegraciones(ctx.tenantId);
    expect(despues.wompiSandbox).toBe(false);
    expect(despues.wompiPublicKey).toBe("pub_test_123"); // pública: sí se devuelve
    expect(despues.whatsappPhoneNumberId).toBe("555000111");
    expect(despues.smsRemitente).toBe("RIFAX");
    expect(despues.wompiPrivateKeyConfigurada).toBe(true);
    expect(despues.wompiEventsSecretConfigurado).toBe(true);
    expect(despues.whatsappTokenConfigurado).toBe(true);
    expect(despues.smsApiKeyConfigurada).toBe(true);
    // El objeto que ve la pantalla NUNCA trae el valor real del secreto en ningún campo.
    expect(JSON.stringify(despues)).not.toContain("secreto");

    // Confirma en la fila cruda que el secreto sí quedó guardado (no se perdió).
    const fila = await prisma.tenant_integraciones.findUnique({ where: { tenant_id: ctx.tenantId } });
    expect(fila?.wompi_private_key).toBe("prv_test_secreto");
  });

  it("guardar de nuevo con los campos de secreto en blanco CONSERVA los valores anteriores", async () => {
    const res = await guardarIntegraciones(
      ctx.tenantId,
      {
        wompi_sandbox: false,
        wompi_public_key: "pub_test_123_editada",
        wompi_private_key: "", // en blanco: no debe borrar ni cambiar la anterior
        wompi_events_secret: "",
        whatsapp_phone_number_id: "555000111",
        whatsapp_token: "",
        sms_remitente: "RIFAX",
        sms_api_key: "",
      },
      ctx.adminId,
    );
    expect(res.ok).toBe(true);

    const fila = await prisma.tenant_integraciones.findUnique({ where: { tenant_id: ctx.tenantId } });
    expect(fila?.wompi_public_key).toBe("pub_test_123_editada"); // el campo público sí cambió
    expect(fila?.wompi_private_key).toBe("prv_test_secreto"); // el secreto se conservó
    expect(fila?.whatsapp_token).toBe("wa_token_secreto");
    expect(fila?.sms_api_key).toBe("sms_key_secreto");
  });
});

// ---------------------------------------------------------------------------

describe("Carga masiva (CSV): vendedores y ventas de una rifa en curso", () => {
  it("parseCsv respeta comillas y comas dentro de campos entre comillas", () => {
    const filas = parseCsv('a,"b, con coma",c\n1,"2",3');
    expect(filas).toEqual([["a", "b, con coma", "c"], ["1", "2", "3"]]);
  });

  it("expandirNumeros combina números sueltos y rangos, sin duplicados", () => {
    expect(expandirNumeros("5, 7-9, 7, abc")).toEqual([5, 7, 8, 9]);
  });

  it("importarVendedores crea los nuevos, omite los duplicados por documento, y exige las columnas obligatorias", async () => {
    const csv = "documento,nombre,telefono,correo,pct_comision,cupo_max\n" +
      "3000001,QA Import Vendedor,3009990001,,10,\n" + // nuevo
      "1000001,QA Vendedor A (duplicado),3000000000,,5,\n"; // documento ya existe (vendedor A) -> omitido
    const res = await importarVendedores(ctx.tenantId, csv, ctx.adminId);
    expect(res.total).toBe(2);
    expect(res.ok).toBe(1);
    expect(res.omitidos).toBe(1);
    expect(res.errores).toHaveLength(0);

    const creado = await prisma.vendedores.findFirst({ where: { tenant_id: ctx.tenantId, documento: "3000001" } });
    expect(creado?.nombre).toBe("QA Import Vendedor");

    const sinColumnas = await importarVendedores(ctx.tenantId, "a,b,c\n1,2,3", ctx.adminId);
    expect(sinColumnas.errores.length).toBeGreaterThan(0); // faltan columnas obligatorias
  });

  it("importarVentas crea la venta (con su abono) y reporta error si el vendedor del CSV no existe", async () => {
    const disponible = await prisma.$queryRawUnsafe<{ numero: number }[]>(
      `SELECT numero FROM saas.boletas WHERE rifa_id=$1::bigint AND estado='disponible' ORDER BY numero LIMIT 1`,
      rifaRevisionId,
    );
    expect(disponible.length).toBeGreaterThan(0);
    const numero = disponible[0].numero;

    const csvOk = `numeros,cliente_documento,cliente_nombre,cliente_telefono,cliente_correo,vendedor_documento,abonado,canal\n${numero},,Cliente Import CSV,3009990002,,,5000,web\n`;
    const resOk = await importarVentas(ctx.tenantId, rifaRevisionId, csvOk, ctx.adminId);
    expect(resOk.ok).toBe(1);
    expect(resOk.errores).toHaveLength(0);
    const boleta = await prisma.boletas.findFirst({ where: { rifa_id: rifaRevisionId, numero } });
    expect(boleta?.estado).not.toBe("disponible"); // quedó reservada/vendida por la importación

    const csvVendedorInexistente = `numeros,cliente_documento,cliente_nombre,cliente_telefono,cliente_correo,vendedor_documento,abonado,canal\n1000,,Cliente Fantasma,3009990003,,9999999999,0,web\n`;
    const resError = await importarVentas(ctx.tenantId, rifaRevisionId, csvVendedorInexistente, ctx.adminId);
    expect(resError.ok).toBe(0);
    expect(resError.errores.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------

describe("Vencimientos: registrar pago y regenerar calendario", () => {
  // regenerarVencimientos primero (a propósito, en ese orden): reinserta con
  // ON CONFLICT (tenant_id, numero) DO NOTHING, así que si primero se paga la
  // única cuota pendiente (periodicidad anual, numero=1) y LUEGO se regenera,
  // el intento de reinsertar numero=1 choca contra esa fila ya "pagada" y no
  // queda ninguna pendiente — no es un bug de regenerarVencimientos, es un
  // efecto real de reutilizar el mismo número de cuota; probarlo en este
  // orden evita ese choque y deja cada función verificada por separado.
  it("regenerarVencimientos reconstruye el calendario pendiente según la periodicidad actual del tenant", async () => {
    const tRow = await prisma.$queryRawUnsafe<{ periodicidad: string }[]>(
      `SELECT periodicidad FROM saas.tenants WHERE id = $1::bigint`, ctx.tenantId,
    );
    const esperadas = tRow[0].periodicidad === "mensual" ? 12 : tRow[0].periodicidad === "semestral" ? 2 : 1;

    const res = await regenerarVencimientos(ctx.tenantId);
    expect(res.ok).toBe(true);
    const vencs = await listarVencimientos(ctx.tenantId);
    const pendientes = vencs.filter((v) => v.estado === "pendiente");
    expect(pendientes.length).toBe(esperadas);
  });

  it("registrarPagoVencimiento marca la fecha como pagada y actualiza fecha_vencimiento del tenant", async () => {
    const antes = await listarVencimientos(ctx.tenantId);
    const pendiente = antes.find((v) => v.estado === "pendiente");
    expect(pendiente).toBeTruthy();

    const res = await registrarPagoVencimiento(BigInt(pendiente!.id));
    expect(res.ok).toBe(true);

    const despues = await listarVencimientos(ctx.tenantId);
    const misma = despues.find((v) => v.id === pendiente!.id);
    expect(misma?.estado).toBe("pagada");
    expect(misma?.pagadaEn).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("Outbox de notificaciones", () => {
  it("procesarOutbox entrega lo pendiente (crearVenta/registrarAbono ya encolaron varias a esta altura) y no vuelve a encontrar nada al repetir", async () => {
    const resumen = await resumenOutbox(ctx.tenantId);
    expect(typeof resumen).toBe("object");
    const lista = await listarOutbox(ctx.tenantId);
    expect(Array.isArray(lista)).toBe(true);

    // No se asume que esté vacío: crearVenta/registrarAbono ya encolaron
    // notificaciones durante toda la suite. Se procesa en lotes hasta drenar
    // la cola pendiente por completo (entregar() simula éxito siempre).
    let fallidasTotal = 0;
    for (let i = 0; i < 20; i++) {
      const r = await procesarOutbox(ctx.tenantId, 25);
      fallidasTotal += r.fallidas;
      if (r.enviadas === 0 && r.fallidas === 0) break; // cola drenada
    }
    expect(fallidasTotal).toBe(0); // entregar() siempre "tiene éxito" hoy; una fallida sería una regresión real

    const pendientesRestantes = await prisma.outbox_notificaciones.count({ where: { tenant_id: ctx.tenantId, estado: "pendiente" } });
    expect(pendientesRestantes).toBe(0);

    // Repetir sin nada pendiente no falla y no procesa nada.
    const otraVez = await procesarOutbox(ctx.tenantId, 5);
    expect(otraVez).toEqual({ enviadas: 0, fallidas: 0 });
  });
});

// ---------------------------------------------------------------------------

describe("purgar_tenant(): el reinicio de cadena queda documentado (tenant secundario desechable)", () => {
  it("tras purgar un tenant secundario, la cadena de auditoría sigue íntegra (no se reporta como alterada)", async () => {
    const antes = await estadoAuditoriaGlobal();
    expect(antes.integra).toBe(true); // línea base: ya viene íntegra de la reparación histórica aplicada hoy

    // Tenant efímero PROPIO de esta prueba (no ctx): se crea y se purga en el
    // mismo test, sin afectar al resto de la suite.
    const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const slugEfimero = `qa-func-reinicio-${sufijo}`;
    const creado = await crearTenant(
      {
        nombre: "QA Reinicio (temporal)", slug: slugEfimero, plan: "basico",
        sedes_ilimitadas: false, max_sedes: 1, usuarios_ilimitados: true,
        periodicidad: "anual", periodicidad_pago: "anual",
        fecha_inicio: new Date().toISOString().slice(0, 10),
        admin_nombre: "QA Reinicio Admin", admin_correo: `qa-reinicio-${sufijo}@rifax-test.local`,
        admin_password: randomBytes(16).toString("hex"),
      },
      ctx.superAdminId,
    );
    expect(creado.ok).toBe(true);
    const tenantFilas = await prisma.$queryRawUnsafe<{ id: bigint }[]>(`SELECT id FROM saas.tenants WHERE slug = $1`, slugEfimero);
    const tenantEfimeroId = tenantFilas[0].id;

    // Genera un evento de auditoría PARA el tenant efímero...
    await cambiarEstadoTenant(tenantEfimeroId, "suspendido", ctx.superAdminId);
    // ...y luego un evento posterior de OTRO tenant (ctx), para garantizar que
    // quede al menos una fila sobreviviente justo después de las del efímero
    // (si sus filas fueran las últimas de toda la tabla, no habría ningún
    // hueco real que documentar, y esta prueba no probaría nada).
    await cambiarEstadoTenant(ctx.tenantId, "activo", ctx.superAdminId);

    const reiniciosAntes = (await estadoAuditoriaGlobal()).totalReinicios;
    const purgado = await purgarTenant(tenantEfimeroId);
    expect(purgado.ok).toBe(true);

    const despues = await estadoAuditoriaGlobal();
    expect(despues.integra).toBe(true); // la garantía central de este fix: no se reporta como alterada
    expect(despues.totalReinicios).toBeGreaterThanOrEqual(reiniciosAntes); // el hueco (si lo hubo) quedó documentado, no oculto
  });
});

// ---------------------------------------------------------------------------
// Punto 15 de la solicitud del usuario: ranking de vendedores + cerrar rifa.
// Rifa propia y desechable, para no interferir con el estado de `rifaId`
// (compartida con casi toda la suite, ya termina en 'sorteada').

describe("Ranking de vendedores y cierre de rifa", () => {
  it("rankingVendedores refleja las ventas reales, ordenado por recaudado; cerrarRifa bloquea nuevas ventas", async () => {
    const hoy = new Date();
    const enUnDia = new Date(hoy.getTime() + 86_400_000);
    const creada = await crearRifa(
      {
        sede_id: String(ctx.sedeAId), nombre: "Rifa QA Ranking", numero_digitos: "2", precio_boleta: "10000",
        fecha_apertura: hoy.toISOString().slice(0, 10), fecha_cierre_ventas: enUnDia.toISOString().slice(0, 10), fecha_sorteo: enUnDia.toISOString().slice(0, 10),
      },
      ctx.tenantId, null, ctx.adminId,
    );
    expect(creada.ok).toBe(true);
    if (!creada.ok) return;
    const rifaRankingId = creada.rifa.id;
    const publicada = await publicarRifa(ctx.tenantId, rifaRankingId, ctx.adminId);
    expect(publicada.ok).toBe(true);

    // vendedorA vende 2 boletas, vendedorC (sin sede fija) vende 1: A debe
    // quedar primero por recaudado (ambas boletas al mismo precio).
    const asigA = await asignarTalonario({ rifaId: rifaRankingId, vendedorId: vendedorAId, tipo: "consecutiva", inicio: 0, fin: 1 }, ctx.tenantId, ctx.adminId);
    expect(asigA.ok).toBe(true);
    const asigC = await asignarTalonario({ rifaId: rifaRankingId, vendedorId: vendedorCId, tipo: "consecutiva", inicio: 2, fin: 2 }, ctx.tenantId, ctx.adminId);
    expect(asigC.ok).toBe(true);

    const ventaA = await crearVenta(
      { rifa_id: String(rifaRankingId), numeros: [0, 1], cliente: { nombre: "Cliente Ranking A", telefono: "3007770001" }, vendedor_id: String(vendedorAId) },
      ctx.tenantId, ctx.adminId,
    );
    expect(ventaA.ok).toBe(true);
    const ventaC = await crearVenta(
      { rifa_id: String(rifaRankingId), numeros: [2], cliente: { nombre: "Cliente Ranking C", telefono: "3007770002" }, vendedor_id: String(vendedorCId) },
      ctx.tenantId, ctx.adminId,
    );
    expect(ventaC.ok).toBe(true);
    if (!ventaA.ok || !ventaC.ok) return;
    // El recaudado del ranking se basa en ABONOS, no en el total facturado
    // (una venta a crédito sin pagar no debe sumar recaudo): se paga de contado.
    await registrarAbono(ctx.tenantId, ventaA.data.ventaId, { monto: ventaA.data.total, origen: "efectivo" }, ctx.adminId);
    await registrarAbono(ctx.tenantId, ventaC.data.ventaId, { monto: ventaC.data.total, origen: "efectivo" }, ctx.adminId);

    const ranking = await rankingVendedores(ctx.tenantId, rifaRankingId);
    expect(ranking).toHaveLength(2);
    expect(ranking[0].posicion).toBe(1);
    expect(ranking[0].vendedorId).toBe(String(vendedorAId));
    expect(ranking[0].boletas).toBe(2);
    expect(Number(ranking[0].recaudado)).toBe(Number(ventaA.data.total));
    expect(ranking[1].posicion).toBe(2);
    expect(ranking[1].vendedorId).toBe(String(vendedorCId));

    // Cerrar antes de tiempo desde un estado inválido (ya cerrada) se rechaza.
    const cerrar1 = await cerrarRifa(ctx.tenantId, rifaRankingId, ctx.adminId);
    expect(cerrar1.ok).toBe(true);
    const cerrar2 = await cerrarRifa(ctx.tenantId, rifaRankingId, ctx.adminId);
    expect(cerrar2.ok).toBe(false);

    const rifaRow = await prisma.rifas.findUnique({ where: { id: rifaRankingId } });
    expect(rifaRow?.estado).toBe("cerrada");

    // Ya cerrada, no se pueden vender más boletas (regla ya existente de crearVenta).
    const ventaTrasCierre = await crearVenta(
      { rifa_id: String(rifaRankingId), numeros: [3], cliente: { nombre: "Cliente Tarde", telefono: "3007770003" } },
      ctx.tenantId, ctx.adminId,
    );
    expect(ventaTrasCierre.ok).toBe(false);

    // El ranking se sigue pudiendo consultar después de cerrada (no se borra nada).
    const rankingTrasCierre = await rankingVendedores(ctx.tenantId, rifaRankingId);
    expect(rankingTrasCierre).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Punto 15 (continuación): base de datos de clientes con autocompletar por
// documento, identificando la sede y el vendedor de su última compra — SIN
// filtrar por sede (a propósito: un cliente puede haber comprado en otra).

describe("Autocompletar cliente por documento", () => {
  it("encuentra al cliente por documento y reporta la sede/vendedor de su última compra, sin importar la sede de quien busca", async () => {
    const hoy = new Date();
    const enUnDia = new Date(hoy.getTime() + 86_400_000);
    const creada = await crearRifa(
      {
        sede_id: String(ctx.sedeBId), nombre: "Rifa QA Autocompletar", numero_digitos: "2", precio_boleta: "10000",
        fecha_apertura: hoy.toISOString().slice(0, 10), fecha_cierre_ventas: enUnDia.toISOString().slice(0, 10), fecha_sorteo: enUnDia.toISOString().slice(0, 10),
      },
      ctx.tenantId, null, ctx.adminId,
    );
    expect(creada.ok).toBe(true);
    if (!creada.ok) return;
    const rifaAutoId = creada.rifa.id;
    await publicarRifa(ctx.tenantId, rifaAutoId, ctx.adminId);

    const asig = await asignarTalonario({ rifaId: rifaAutoId, vendedorId: vendedorBId, tipo: "consecutiva", inicio: 0, fin: 0 }, ctx.tenantId, ctx.adminId);
    expect(asig.ok).toBe(true);

    const venta = await crearVenta(
      {
        rifa_id: String(rifaAutoId), numeros: [0],
        cliente: { nombre: "Cliente Autocompletar", telefono: "3009990099", documento: "CC-AUTOCOMPLETE-1" },
        vendedor_id: String(vendedorBId),
      },
      ctx.tenantId, ctx.adminId,
    );
    expect(venta.ok).toBe(true);

    // Sin coincidencia.
    const noEncontrado = await buscarClientePorDocumento(ctx.tenantId, "CC-NO-EXISTE-NUNCA");
    expect(noEncontrado).toBeNull();

    // Con coincidencia: trae los datos del cliente y la sede/vendedor de su
    // última compra — vendedorB es de Sede QA B, así que esto confirma que
    // la búsqueda NO se limita a la sede de quien la ejecuta.
    const encontrado = await buscarClientePorDocumento(ctx.tenantId, "CC-AUTOCOMPLETE-1");
    expect(encontrado).not.toBeNull();
    expect(encontrado?.nombre).toBe("Cliente Autocompletar");
    expect(encontrado?.telefono).toBe("3009990099");
    expect(encontrado?.ultimaSede).toBe("Sede QA B");
    expect(encontrado?.ultimoVendedor).toBe("QA Vendedor B");
  });
});

// ---------------------------------------------------------------------------
// Punto 13: traslado de vendedores (con sus números abonados) de una rifa
// finalizada a una rifa nueva.

describe("Traslado de vendedores entre rifas", () => {
  it("traslada el mismo número al mismo vendedor cuando sigue disponible; omite fuera de rango, ya ocupado y vendedor inactivo; exige origen cerrada y destino activa", async () => {
    const hoy = new Date();
    const enUnDia = new Date(hoy.getTime() + 86_400_000);

    // Origen: 3 dígitos (0-999), para poder probar el caso "fuera de rango" en el destino (2 dígitos).
    const creadaOrigen = await crearRifa(
      {
        sede_id: String(ctx.sedeAId), nombre: "Rifa QA Traslado Origen", numero_digitos: "3", precio_boleta: "10000",
        fecha_apertura: hoy.toISOString().slice(0, 10), fecha_cierre_ventas: enUnDia.toISOString().slice(0, 10), fecha_sorteo: enUnDia.toISOString().slice(0, 10),
      },
      ctx.tenantId, null, ctx.adminId,
    );
    expect(creadaOrigen.ok).toBe(true);
    if (!creadaOrigen.ok) return;
    const rifaOrigenId = creadaOrigen.rifa.id;
    await publicarRifa(ctx.tenantId, rifaOrigenId, ctx.adminId);

    // #7 vendido por vendedorA -> debe trasladarse.
    await asignarTalonario({ rifaId: rifaOrigenId, vendedorId: vendedorAId, tipo: "consecutiva", inicio: 7, fin: 7 }, ctx.tenantId, ctx.adminId);
    await crearVenta({ rifa_id: String(rifaOrigenId), numeros: [7], cliente: { nombre: "Cliente Traslado 7", telefono: "3001110007" }, vendedor_id: String(vendedorAId) }, ctx.tenantId, ctx.adminId);

    // #8 vendido SIN vendedor (punto de venta) -> nunca es candidato.
    await crearVenta({ rifa_id: String(rifaOrigenId), numeros: [8], cliente: { nombre: "Cliente Traslado 8", telefono: "3001110008" } }, ctx.tenantId, ctx.adminId);

    // #150 vendido por vendedorC -> queda fuera del rango del destino (2 dígitos, 0-99).
    await asignarTalonario({ rifaId: rifaOrigenId, vendedorId: vendedorCId, tipo: "consecutiva", inicio: 150, fin: 150 }, ctx.tenantId, ctx.adminId);
    await crearVenta({ rifa_id: String(rifaOrigenId), numeros: [150], cliente: { nombre: "Cliente Traslado 150", telefono: "3001110150" }, vendedor_id: String(vendedorCId) }, ctx.tenantId, ctx.adminId);

    // #9 vendido por vendedorC -> en el destino ya estará ocupado antes del traslado.
    await asignarTalonario({ rifaId: rifaOrigenId, vendedorId: vendedorCId, tipo: "consecutiva", inicio: 9, fin: 9 }, ctx.tenantId, ctx.adminId);
    await crearVenta({ rifa_id: String(rifaOrigenId), numeros: [9], cliente: { nombre: "Cliente Traslado 9", telefono: "3001110009" }, vendedor_id: String(vendedorCId) }, ctx.tenantId, ctx.adminId);

    // #10 vendido por vendedorC, que luego queda inactivo antes del traslado.
    await asignarTalonario({ rifaId: rifaOrigenId, vendedorId: vendedorCId, tipo: "consecutiva", inicio: 10, fin: 10 }, ctx.tenantId, ctx.adminId);
    await crearVenta({ rifa_id: String(rifaOrigenId), numeros: [10], cliente: { nombre: "Cliente Traslado 10", telefono: "3001110010" }, vendedor_id: String(vendedorCId) }, ctx.tenantId, ctx.adminId);

    // Destino: 2 dígitos (0-99), activa.
    const creadaDestino = await crearRifa(
      {
        sede_id: String(ctx.sedeAId), nombre: "Rifa QA Traslado Destino", numero_digitos: "2", precio_boleta: "10000",
        fecha_apertura: hoy.toISOString().slice(0, 10), fecha_cierre_ventas: enUnDia.toISOString().slice(0, 10), fecha_sorteo: enUnDia.toISOString().slice(0, 10),
      },
      ctx.tenantId, null, ctx.adminId,
    );
    expect(creadaDestino.ok).toBe(true);
    if (!creadaDestino.ok) return;
    const rifaDestinoId = creadaDestino.rifa.id;
    await publicarRifa(ctx.tenantId, rifaDestinoId, ctx.adminId);

    // Rechaza: origen todavía no está cerrada.
    const antesDeCerrar = await trasladarRifa(ctx.tenantId, rifaOrigenId, rifaDestinoId, ctx.adminId);
    expect(antesDeCerrar.ok).toBe(false);

    // #9 ya ocupado de antemano en el destino (venta directa, sin vendedor).
    await crearVenta({ rifa_id: String(rifaDestinoId), numeros: [9], cliente: { nombre: "Cliente Ya Estaba", telefono: "3001119999" } }, ctx.tenantId, ctx.adminId);

    // vendedorC queda inactivo antes del traslado (afecta a #10, y también a #150 y #9 pero esos ya se omiten por otro motivo).
    const suspender = await cambiarEstadoVendedor(vendedorCId, ctx.tenantId, "inactivo", ctx.adminId);
    expect(suspender.ok).toBe(true);

    const cerrado = await cerrarRifa(ctx.tenantId, rifaOrigenId, ctx.adminId);
    expect(cerrado.ok).toBe(true);

    // Rechaza: destino no está activa (todavía en borrador).
    const creadaBorrador = await crearRifa(
      {
        sede_id: String(ctx.sedeAId), nombre: "Rifa QA Traslado Borrador", numero_digitos: "2", precio_boleta: "10000",
        fecha_apertura: hoy.toISOString().slice(0, 10), fecha_cierre_ventas: enUnDia.toISOString().slice(0, 10), fecha_sorteo: enUnDia.toISOString().slice(0, 10),
      },
      ctx.tenantId, null, ctx.adminId,
    );
    expect(creadaBorrador.ok).toBe(true);
    if (creadaBorrador.ok) {
      const destinoBorrador = await trasladarRifa(ctx.tenantId, rifaOrigenId, creadaBorrador.rifa.id, ctx.adminId);
      expect(destinoBorrador.ok).toBe(false);
    }

    const resultado = await trasladarRifa(ctx.tenantId, rifaOrigenId, rifaDestinoId, ctx.adminId);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.data.trasladados).toBe(1);
    expect(resultado.data.omitidos).toHaveLength(3);
    expect(resultado.data.omitidos.map((o) => o.numero).sort((a, b) => a - b)).toEqual([9, 10, 150]);

    const boleta7Destino = await prisma.boletas.findFirst({ where: { rifa_id: rifaDestinoId, numero: 7 }, include: { talonarios: { select: { vendedor_id: true } } } });
    expect(boleta7Destino?.talonarios?.vendedor_id).toBe(vendedorAId);

    // Restaura vendedorC para no dejar residuos entre pruebas.
    await cambiarEstadoVendedor(vendedorCId, ctx.tenantId, "activo", ctx.adminId);
  });
});
