// Pruebas deterministas de los esquemas zod de validación de entrada para la
// lógica crítica (ventas, vendedores, sedes, usuarios, rifas). Solo se ejercita
// `.safeParse`, sin tocar la base de datos.
import { describe, it, expect } from "vitest";
import { crearVentaSchema } from "@/lib/ventas";
import { crearVendedorSchema } from "@/lib/vendedores";
import { crearSedeSchema } from "@/lib/sedes";
import { crearUsuarioSchema } from "@/lib/usuarios";
import { crearRifaSchema } from "@/lib/rifas";

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
