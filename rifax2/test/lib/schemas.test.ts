// Pruebas deterministas de los esquemas zod de validación de entrada para la
// lógica crítica (ventas, vendedores, sedes, usuarios, rifas). Solo se ejercita
// `.safeParse`, sin tocar la base de datos.
import { describe, it, expect } from "vitest";
import { crearVentaSchema } from "@/lib/ventas";
import { crearVendedorSchema } from "@/lib/vendedores";
import { crearSedeSchema } from "@/lib/sedes";
import { crearUsuarioSchema, editarUsuarioSchema } from "@/lib/usuarios";
import { crearRifaSchema } from "@/lib/rifas";
import { editarTenantSchema } from "@/lib/superadmin";

describe("crearVentaSchema", () => {
  const base = {
    rifa_id: "1",
    numeros: [1, 2, 3],
    cliente: { nombre: "Juan Pérez", telefono: "3001234567" },
  };

  it("acepta una venta mínima válida", () => {
    const r = crearVentaSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.canal).toBe("web"); // default
  });

  it("rechaza si no hay números de boleta", () => {
    const r = crearVentaSchema.safeParse({ ...base, numeros: [] });
    expect(r.success).toBe(false);
  });

  it("rechaza números negativos", () => {
    const r = crearVentaSchema.safeParse({ ...base, numeros: [-1] });
    expect(r.success).toBe(false);
  });

  it("rechaza nombre de cliente muy corto", () => {
    const r = crearVentaSchema.safeParse({ ...base, cliente: { ...base.cliente, nombre: "A" } });
    expect(r.success).toBe(false);
  });

  it("rechaza teléfono muy corto", () => {
    const r = crearVentaSchema.safeParse({ ...base, cliente: { ...base.cliente, telefono: "123" } });
    expect(r.success).toBe(false);
  });

  it("rechaza correo inválido si se indica", () => {
    const r = crearVentaSchema.safeParse({ ...base, cliente: { ...base.cliente, correo: "no-es-correo" } });
    expect(r.success).toBe(false);
  });

  it("coacciona rifa_id de string a bigint", () => {
    const r = crearVentaSchema.safeParse(base);
    expect(r.success && typeof r.data.rifa_id).toBe("bigint");
  });
});

describe("crearVendedorSchema", () => {
  const base = { nombre: "Vendedor Uno", documento: "123456", telefono: "3009876543" };

  it("acepta datos mínimos válidos", () => {
    expect(crearVendedorSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza pct_comision fuera de 0-100", () => {
    expect(crearVendedorSchema.safeParse({ ...base, pct_comision: 150 }).success).toBe(false);
    expect(crearVendedorSchema.safeParse({ ...base, pct_comision: -1 }).success).toBe(false);
  });

  it("rechaza cupo_max no positivo", () => {
    expect(crearVendedorSchema.safeParse({ ...base, cupo_max: 0 }).success).toBe(false);
  });

  it("rechaza documento vacío", () => {
    expect(crearVendedorSchema.safeParse({ ...base, documento: "" }).success).toBe(false);
  });
});

describe("crearSedeSchema", () => {
  it("acepta solo el nombre (resto opcional)", () => {
    expect(crearSedeSchema.safeParse({ nombre: "Sede Norte" }).success).toBe(true);
  });

  it("rechaza nombre muy corto", () => {
    expect(crearSedeSchema.safeParse({ nombre: "A" }).success).toBe(false);
  });
});

describe("crearUsuarioSchema", () => {
  const base = { nombre: "Ana Admin", correo: "ana@example.com", password: "12345678", rol_id: "1" };

  it("acepta datos mínimos válidos", () => {
    expect(crearUsuarioSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza contraseña corta", () => {
    expect(crearUsuarioSchema.safeParse({ ...base, password: "123" }).success).toBe(false);
  });

  it("rechaza correo inválido", () => {
    expect(crearUsuarioSchema.safeParse({ ...base, correo: "no-correo" }).success).toBe(false);
  });
});

describe("crearRifaSchema", () => {
  const base = {
    sede_id: "1",
    nombre: "Rifa de prueba",
    numero_digitos: 3,
    precio_boleta: 5000,
    fecha_apertura: "2026-01-01",
    fecha_cierre_ventas: "2026-02-01",
    fecha_sorteo: "2026-02-02",
  };

  it("acepta datos mínimos válidos", () => {
    const r = crearRifaSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.compartida).toBe(false); // default
  });

  it("rechaza número de dígitos fuera de rango (2-6)", () => {
    expect(crearRifaSchema.safeParse({ ...base, numero_digitos: 1 }).success).toBe(false);
    expect(crearRifaSchema.safeParse({ ...base, numero_digitos: 7 }).success).toBe(false);
  });

  it("rechaza precio de boleta no positivo", () => {
    expect(crearRifaSchema.safeParse({ ...base, precio_boleta: 0 }).success).toBe(false);
  });

  it("rechaza tasa_derechos fuera de 0-1", () => {
    expect(crearRifaSchema.safeParse({ ...base, tasa_derechos: 1.5 }).success).toBe(false);
  });
});

describe("editarUsuarioSchema", () => {
  const base = { nombre: "Ana Admin", correo: "ana@example.com", rol_id: "1" };

  it("acepta datos mínimos válidos (sin password, a diferencia de crear)", () => {
    const r = editarUsuarioSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("rechaza nombre muy corto", () => {
    expect(editarUsuarioSchema.safeParse({ ...base, nombre: "An" }).success).toBe(false);
  });

  it("rechaza correo inválido", () => {
    expect(editarUsuarioSchema.safeParse({ ...base, correo: "no-correo" }).success).toBe(false);
  });

  it("coacciona rol_id de string a bigint", () => {
    const r = editarUsuarioSchema.safeParse(base);
    expect(r.success && typeof r.data.rol_id).toBe("bigint");
  });

  it("acepta sede_id y permisos opcionales", () => {
    const r = editarUsuarioSchema.safeParse({ ...base, sede_id: "2", permisos: ["1", "2", "3"] });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(typeof r.data.sede_id).toBe("bigint");
      expect(r.data.permisos).toHaveLength(3);
    }
  });

  it("rechaza rol_id no numérico", () => {
    expect(editarUsuarioSchema.safeParse({ ...base, rol_id: "abc" }).success).toBe(false);
  });
});

describe("editarTenantSchema", () => {
  const base = { nombre: "Empresa Prueba", slug: "empresa-prueba" };

  it("acepta datos mínimos y aplica los defaults documentados", () => {
    const r = editarTenantSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sedes_ilimitadas).toBe(false);
      expect(r.data.max_sedes).toBe(1);
      expect(r.data.usuarios_ilimitados).toBe(false);
      expect(r.data.periodicidad).toBe("mensual");
      expect(r.data.periodicidad_pago).toBe("mensual");
    }
  });

  it("rechaza nombre muy corto", () => {
    expect(editarTenantSchema.safeParse({ ...base, nombre: "AB" }).success).toBe(false);
  });

  it("rechaza slug con mayúsculas o caracteres inválidos", () => {
    expect(editarTenantSchema.safeParse({ ...base, slug: "Empresa Prueba" }).success).toBe(false);
    expect(editarTenantSchema.safeParse({ ...base, slug: "empresa_prueba!" }).success).toBe(false);
  });

  it("acepta slug válido en minúsculas, números y guiones", () => {
    expect(editarTenantSchema.safeParse({ ...base, slug: "empresa-2" }).success).toBe(true);
  });

  it("rechaza max_sedes fuera de rango (1-9999)", () => {
    expect(editarTenantSchema.safeParse({ ...base, max_sedes: 0 }).success).toBe(false);
    expect(editarTenantSchema.safeParse({ ...base, max_sedes: 10000 }).success).toBe(false);
  });

  it("rechaza periodicidad fuera del enum permitido", () => {
    expect(editarTenantSchema.safeParse({ ...base, periodicidad: "semanal" }).success).toBe(false);
  });

  it("acepta booleanos explícitos para sedes_ilimitadas/usuarios_ilimitados (como los envía la action, ya convertidos desde el checkbox)", () => {
    const r = editarTenantSchema.safeParse({ ...base, sedes_ilimitadas: true, usuarios_ilimitados: false });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sedes_ilimitadas).toBe(true);
      expect(r.data.usuarios_ilimitados).toBe(false);
    }
  });

  it("z.coerce.boolean trata cualquier string no vacío como true (incluida la palabra 'false'): la action de panel/actions.ts evita este riesgo convirtiendo el checkbox a boolean antes de llamar al schema", () => {
    // Documenta el comportamiento real de z.coerce.boolean para que quede
    // explícito el motivo por el que nunca se le debe pasar el string "false".
    const r = editarTenantSchema.safeParse({ ...base, usuarios_ilimitados: "false" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.usuarios_ilimitados).toBe(true);
  });
});
