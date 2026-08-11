// Pruebas de las reglas de negocio de editarTenant (src/lib/superadmin.ts):
// unicidad de slug y los "pisos" de capacidad (no bajar de sedes/usuarios ya
// existentes). Se usa un doble (mock) de Prisma -- no se toca la base de
// datos real ni se depende de la red.
import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  tenants: { update: vi.fn() },
  $executeRawUnsafe: vi.fn(),
};

const prismaMock = {
  tenants: { findUnique: vi.fn() },
  usuarios: { count: vi.fn() },
  $queryRawUnsafe: vi.fn(),
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, default: prismaMock }));
// generarVencimientos toca la BD; solo se invoca cuando cambia la
// periodicidad o la fecha de inicio. Se sustituye por un doble para poder
// probar ese camino sin tocar la base de datos.
vi.mock("@/lib/vencimientos", () => ({ generarVencimientos: vi.fn(async () => ({ ok: true })) }));

const { editarTenant } = await import("@/lib/superadmin");
const { generarVencimientos } = await import("@/lib/vencimientos");

const TENANT = 5n;
const SUPERADMIN = 1n;

const tenantActual = { id: TENANT, slug: "empresa-actual", nombre: "Empresa Actual", _count: { sedes: 3 } };

const datosBase = { nombre: "Empresa Nueva", slug: "empresa-actual", max_sedes: 5 };

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx));
  // Fila "antes" que se lee para decidir si cambia el calendario de vencimientos.
  prismaMock.$queryRawUnsafe.mockResolvedValue([{ periodicidad: "mensual", fecha_inicio: "2026-01-01" }]);
  prismaMock.usuarios.count.mockResolvedValue(0);
});

describe("editarTenant", () => {
  it("rechaza datos que no pasan el esquema (slug con mayúsculas)", async () => {
    const r = await editarTenant(TENANT, { ...datosBase, slug: "Empresa Actual" }, SUPERADMIN);
    expect(r.ok).toBe(false);
    expect(prismaMock.tenants.findUnique).not.toHaveBeenCalled();
  });

  it("devuelve error si la empresa no existe", async () => {
    prismaMock.tenants.findUnique.mockResolvedValueOnce(null);
    const r = await editarTenant(TENANT, datosBase, SUPERADMIN);
    expect(r).toEqual({ ok: false, error: "Empresa no encontrada." });
  });

  it("rechaza un slug ya usado por otra empresa", async () => {
    prismaMock.tenants.findUnique
      .mockResolvedValueOnce(tenantActual) // lookup de la empresa a editar
      .mockResolvedValueOnce({ id: 99n }); // slug duplicado en otra empresa
    const r = await editarTenant(TENANT, { ...datosBase, slug: "otra-empresa" }, SUPERADMIN);
    expect(r).toEqual({ ok: false, error: "Ya existe un tenant con el slug 'otra-empresa'." });
  });

  it("impide bajar max_sedes por debajo de las sedes ya creadas", async () => {
    prismaMock.tenants.findUnique.mockResolvedValueOnce(tenantActual); // tiene 3 sedes
    const r = await editarTenant(TENANT, { ...datosBase, max_sedes: 2 }, SUPERADMIN);
    expect(r).toEqual({ ok: false, error: "La empresa ya tiene 3 sedes; no puede bajar de ese número." });
  });

  it("permite max_sedes ilimitadas aunque el número sea menor que las sedes actuales", async () => {
    prismaMock.tenants.findUnique.mockResolvedValueOnce(tenantActual);
    const r = await editarTenant(TENANT, { ...datosBase, sedes_ilimitadas: true, max_sedes: 1 }, SUPERADMIN);
    expect(r).toEqual({ ok: true });
  });

  it("impide bajar max_usuarios por debajo de los usuarios ya creados", async () => {
    prismaMock.tenants.findUnique.mockResolvedValueOnce(tenantActual);
    prismaMock.usuarios.count.mockResolvedValueOnce(4);
    const r = await editarTenant(TENANT, { ...datosBase, max_usuarios: 2 }, SUPERADMIN);
    expect(r).toEqual({ ok: false, error: "La empresa ya tiene 4 usuario(s); no puede bajar de ese número." });
  });

  it("camino feliz: actualiza y no regenera el calendario si la periodicidad y la fecha no cambian", async () => {
    prismaMock.tenants.findUnique.mockResolvedValueOnce(tenantActual);
    const r = await editarTenant(TENANT, { ...datosBase, periodicidad: "mensual", fecha_inicio: "2026-01-01" }, SUPERADMIN);
    expect(r).toEqual({ ok: true });
    expect(tx.tenants.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: TENANT }, data: expect.objectContaining({ nombre: datosBase.nombre, slug: datosBase.slug }) }));
    expect(generarVencimientos).not.toHaveBeenCalled();
  });

  it("regenera el calendario de vencimientos cuando cambia la periodicidad", async () => {
    prismaMock.tenants.findUnique.mockResolvedValueOnce(tenantActual);
    const r = await editarTenant(TENANT, { ...datosBase, periodicidad: "anual" }, SUPERADMIN);
    expect(r).toEqual({ ok: true });
    expect(generarVencimientos).toHaveBeenCalledTimes(1);
  });

  it("no revalida el slug si no cambió respecto al actual", async () => {
    prismaMock.tenants.findUnique.mockResolvedValueOnce(tenantActual); // slug igual a datosBase.slug
    const r = await editarTenant(TENANT, datosBase, SUPERADMIN);
    expect(r).toEqual({ ok: true });
    // Solo una llamada a findUnique (la de la propia empresa); no se consulta duplicado de slug.
    expect(prismaMock.tenants.findUnique).toHaveBeenCalledTimes(1);
  });
});
