// Pruebas de las reglas de negocio de editarUsuario (src/lib/usuarios.ts):
// auto-protección de rol, unicidad de correo, sede válida y regla de "al
// menos un admin activo". Se usa un doble (mock) de Prisma -- no se toca la
// base de datos real ni se depende de la red.
import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  usuarios: { update: vi.fn() },
  $executeRawUnsafe: vi.fn(),
};

const prismaMock = {
  usuarios: { findFirst: vi.fn(), count: vi.fn() },
  roles: { findUnique: vi.fn() },
  sedes: { findFirst: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, default: prismaMock }));

const { editarUsuario } = await import("@/lib/usuarios");

const TENANT = 1n;
const ACTOR = 10n;
const USUARIO = 20n;

const rolAdmin = { id: 1n, nombre: "admin" };
const rolVendedor = { id: 2n, nombre: "vendedor" };

const datosBase = { nombre: "Juan Pérez", correo: "juan@example.com", rol_id: "2" };

beforeEach(() => {
  // resetAllMocks (a diferencia de clearAllMocks) también vacía la cola de
  // mockResolvedValueOnce entre pruebas, evitando fugas de un test a otro
  // cuando alguna rama del código no consume todos los valores encolados.
  vi.resetAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx));
});

describe("editarUsuario", () => {
  it("rechaza datos que no pasan el esquema (p. ej. correo inválido)", async () => {
    const r = await editarUsuario(USUARIO, { ...datosBase, correo: "no-correo" }, TENANT, ACTOR);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/correo/i);
    // No debe consultar la base si el esquema ya rechazó la entrada.
    expect(prismaMock.usuarios.findFirst).not.toHaveBeenCalled();
  });

  it("devuelve error si el usuario no existe en el tenant", async () => {
    prismaMock.usuarios.findFirst.mockResolvedValueOnce(null);
    const r = await editarUsuario(USUARIO, datosBase, TENANT, ACTOR);
    expect(r).toEqual({ ok: false, error: "Usuario no encontrado." });
  });

  it("impide que un usuario cambie su propio rol", async () => {
    prismaMock.usuarios.findFirst.mockResolvedValueOnce({ id: USUARIO, rol_id: 1n, correo: datosBase.correo, roles: rolAdmin });
    const r = await editarUsuario(USUARIO, { ...datosBase, rol_id: "2" }, TENANT, USUARIO); // actorId === usuarioId
    expect(r).toEqual({ ok: false, error: "No puedes cambiar tu propio rol." });
  });

  it("devuelve error si el rol indicado no existe", async () => {
    prismaMock.usuarios.findFirst.mockResolvedValueOnce({ id: USUARIO, rol_id: 1n, correo: datosBase.correo, roles: rolAdmin });
    prismaMock.roles.findUnique.mockResolvedValueOnce(null);
    const r = await editarUsuario(USUARIO, datosBase, TENANT, ACTOR);
    expect(r).toEqual({ ok: false, error: "El rol indicado no existe." });
  });

  it("rechaza un correo ya usado por otro usuario del mismo tenant", async () => {
    prismaMock.usuarios.findFirst
      .mockResolvedValueOnce({ id: USUARIO, rol_id: 2n, correo: "otro@example.com", roles: rolVendedor }) // usuario actual
      .mockResolvedValueOnce({ id: 99n }); // duplicado encontrado
    prismaMock.roles.findUnique.mockResolvedValueOnce(rolVendedor);
    const r = await editarUsuario(USUARIO, datosBase, TENANT, ACTOR);
    expect(r).toEqual({ ok: false, error: "Ya existe otro usuario con ese correo en tu empresa." });
  });

  it("rechaza una sede que no pertenece al tenant", async () => {
    prismaMock.usuarios.findFirst
      .mockResolvedValueOnce({ id: USUARIO, rol_id: 2n, correo: datosBase.correo, roles: rolVendedor })
      .mockResolvedValueOnce(null); // sin duplicado de correo
    prismaMock.roles.findUnique.mockResolvedValueOnce(rolVendedor);
    prismaMock.sedes.findFirst.mockResolvedValueOnce(null);
    const r = await editarUsuario(USUARIO, { ...datosBase, sede_id: "5" }, TENANT, ACTOR);
    expect(r).toEqual({ ok: false, error: "Sede inválida." });
  });

  it("impide degradar al último administrador activo del tenant", async () => {
    prismaMock.usuarios.findFirst.mockResolvedValueOnce({ id: USUARIO, rol_id: 1n, correo: datosBase.correo, roles: rolAdmin });
    prismaMock.roles.findUnique.mockResolvedValueOnce(rolVendedor); // pasa de admin a vendedor
    prismaMock.usuarios.count.mockResolvedValueOnce(1); // solo queda 1 admin activo (este mismo)
    const r = await editarUsuario(USUARIO, { ...datosBase, rol_id: "2" }, TENANT, ACTOR);
    expect(r).toEqual({ ok: false, error: "Debe quedar al menos un administrador activo." });
  });

  it("permite degradar de admin a vendedor si hay más de un admin activo", async () => {
    prismaMock.usuarios.findFirst
      .mockResolvedValueOnce({ id: USUARIO, rol_id: 1n, correo: datosBase.correo, roles: rolAdmin })
      .mockResolvedValueOnce(null); // sin duplicado de correo
    prismaMock.roles.findUnique.mockResolvedValueOnce(rolVendedor);
    prismaMock.usuarios.count.mockResolvedValueOnce(2); // hay otro admin además de este
    const r = await editarUsuario(USUARIO, { ...datosBase, rol_id: "2" }, TENANT, ACTOR);
    expect(r).toEqual({ ok: true });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("camino feliz: actualiza datos y registra auditoría dentro de la transacción", async () => {
    prismaMock.usuarios.findFirst
      .mockResolvedValueOnce({ id: USUARIO, rol_id: 2n, correo: "viejo@example.com", roles: rolVendedor })
      .mockResolvedValueOnce(null);
    prismaMock.roles.findUnique.mockResolvedValueOnce(rolVendedor);
    const r = await editarUsuario(USUARIO, datosBase, TENANT, ACTOR);
    expect(r).toEqual({ ok: true });
    expect(tx.usuarios.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USUARIO }, data: expect.objectContaining({ nombre: datosBase.nombre, correo: datosBase.correo }) }),
    );
    // auditar() termina en un $executeRawUnsafe con la acción 'usuario.editar'
    // (buscamos por contenido en vez de posición exacta, ya que 'ip' viaja
    // como null y expect.anything() no acepta null).
    const llamadaAuditoria = tx.$executeRawUnsafe.mock.calls.find((c) => String(c[0]).includes("registrar_auditoria"));
    expect(llamadaAuditoria).toBeDefined();
    expect(llamadaAuditoria?.[3]).toBe("usuario.editar");
    expect(llamadaAuditoria?.[9]).toBe(TENANT);
  });

  it("al editarse a sí mismo (mismo rol) no toca los permisos personalizados de otros ni borra los propios", async () => {
    prismaMock.usuarios.findFirst
      .mockResolvedValueOnce({ id: USUARIO, rol_id: 2n, correo: datosBase.correo, roles: rolVendedor })
      .mockResolvedValueOnce(null);
    prismaMock.roles.findUnique.mockResolvedValueOnce(rolVendedor);
    const r = await editarUsuario(USUARIO, datosBase, TENANT, USUARIO); // actorId === usuarioId, mismo rol
    expect(r).toEqual({ ok: true });
    // No debe haber DELETE de usuario_permisos cuando el usuario se edita a sí mismo.
    const deleteCalls = tx.$executeRawUnsafe.mock.calls.filter((c) => String(c[0]).includes("DELETE FROM saas.usuario_permisos"));
    expect(deleteCalls).toHaveLength(0);
  });
});
