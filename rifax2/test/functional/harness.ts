// Arnés de pruebas funcionales: crea una empresa (tenant) de prueba REAL
// contra la base de datos de Neon (no simulada) para poder ejecutar la
// lógica de negocio de cada módulo tal cual corre en producción, y la purga
// por completo al terminar con la misma función SQL que usa "eliminar
// empresa en 3 pasos" del super-admin. No usa el navegador ni credenciales
// de nadie: crea y destruye su propia empresa desechable.
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { crearTenant, purgarTenant } from "@/lib/superadmin";
import { crearSede } from "@/lib/sedes";

export interface ContextoPrueba {
  tenantId: bigint;
  slug: string;
  superAdminId: bigint;
  sedeAId: bigint;
  sedeBId: bigint;
  adminId: bigint;
  adminCorreo: string;
}

export async function crearContextoPrueba(): Promise<ContextoPrueba> {
  const sufijo = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const slug = `qa-func-${sufijo}`;
  const adminCorreo = `qa-func-${sufijo}@rifax-test.local`;

  const admins = await prisma.$queryRawUnsafe<{ id: bigint }[]>(`SELECT id FROM saas.plataforma_admins LIMIT 1`);
  if (admins.length === 0) throw new Error("No hay ningún super-admin en la BD; no se puede crear el tenant de prueba.");
  const superAdminId = admins[0].id;

  // Contraseña desechable generada por código: nunca se escribe en un
  // formulario ni se muestra a nadie, solo existe en memoria del proceso de
  // prueba y en el hash guardado para esta cuenta que se borra al final.
  const passwordDesechable = randomBytes(16).toString("hex");

  const res = await crearTenant(
    {
      nombre: "QA Funcional (temporal, se borra sola)",
      slug,
      plan: "corporativo",
      sedes_ilimitadas: false,
      max_sedes: 3,
      usuarios_ilimitados: true,
      periodicidad: "mensual",
      periodicidad_pago: "mensual",
      fecha_inicio: new Date().toISOString().slice(0, 10),
      admin_nombre: "QA Admin",
      admin_correo: adminCorreo,
      admin_password: passwordDesechable,
    },
    superAdminId,
  );
  if (!res.ok) throw new Error(`No se pudo crear el tenant de prueba: ${res.error}`);

  const tenantFilas = await prisma.$queryRawUnsafe<{ id: bigint }[]>(`SELECT id FROM saas.tenants WHERE slug = $1`, slug);
  const tenantId = tenantFilas[0].id;

  const adminFilas = await prisma.$queryRawUnsafe<{ id: bigint }[]>(
    `SELECT id FROM saas.usuarios WHERE tenant_id = $1::bigint AND correo = $2`,
    tenantId,
    adminCorreo,
  );
  const adminId = adminFilas[0].id;

  const sedeA = await crearSede(tenantId, 3, { nombre: "Sede QA A" }, adminId);
  if (!sedeA.ok) throw new Error(`No se pudo crear la sede A de prueba: ${sedeA.error}`);
  const sedeB = await crearSede(tenantId, 3, { nombre: "Sede QA B" }, adminId);
  if (!sedeB.ok) throw new Error(`No se pudo crear la sede B de prueba: ${sedeB.error}`);

  const sedes = await prisma.$queryRawUnsafe<{ id: bigint; nombre: string }[]>(
    `SELECT id, nombre FROM saas.sedes WHERE tenant_id = $1::bigint ORDER BY id ASC`,
    tenantId,
  );
  const sedeAId = sedes.find((s) => s.nombre === "Sede QA A")!.id;
  const sedeBId = sedes.find((s) => s.nombre === "Sede QA B")!.id;

  return { tenantId, slug, superAdminId, sedeAId, sedeBId, adminId, adminCorreo };
}

export async function limpiarContextoPrueba(ctx: { tenantId: bigint }): Promise<void> {
  const res = await purgarTenant(ctx.tenantId);
  if (!res.ok) throw new Error(`No se pudo purgar el tenant de prueba: ${res.error}`);
}
