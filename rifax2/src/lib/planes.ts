// Definición de planes comerciales y sus capacidades. Fuente única de verdad
// para el gating de funciones (habilitar/deshabilitar según el plan del tenant)
// y para los textos de la landing. Sin dependencias de BD.

export type Plan = "basico" | "corporativo";

export interface CapacidadesPlan {
  etiqueta: string;
  maxSedes: number | null; // null = ilimitado
  maxUsuarios: number | null; // null = ilimitado
  liquidacionMasiva: boolean;
  integraciones: boolean; // pasarela, WhatsApp/SMS (requiere credenciales externas)
  conciliacionIA: boolean; // requiere credenciales externas
  sla: boolean;
  portalVendedor: boolean;
  portalCliente: boolean;
  // Bullets que se muestran en la landing.
  incluye: string[];
}

export const PLANES: Record<Plan, CapacidadesPlan> = {
  basico: {
    etiqueta: "Básico",
    maxSedes: 1,
    maxUsuarios: 2,
    liquidacionMasiva: false,
    integraciones: false,
    conciliacionIA: false,
    sla: false,
    portalVendedor: true,
    portalCliente: true,
    incluye: [
      "1 sede",
      "Hasta 2 usuarios",
      "Rifas, ventas y cartera",
      "Vendedores y talonarios",
      "Sorteos verificables",
      "Reportes y branding propio",
      "Portal de cliente y auditoría",
    ],
  },
  corporativo: {
    etiqueta: "Corporativo",
    maxSedes: null,
    maxUsuarios: null,
    liquidacionMasiva: true,
    integraciones: true,
    conciliacionIA: true,
    sla: true,
    portalVendedor: true,
    portalCliente: true,
    incluye: [
      "Sedes y usuarios ilimitados",
      "Vendedores ilimitados + liquidación masiva",
      "Portales de vendedor y cliente",
      "Integraciones (pasarela, WhatsApp/SMS)",
      "Conciliación con IA",
      "SLA, soporte prioritario y capacitación",
      "Datos totalmente aislados por empresa",
    ],
  },
};

export function capacidades(plan: string | null | undefined): CapacidadesPlan {
  return PLANES[(plan as Plan) ?? "basico"] ?? PLANES.basico;
}

export function esPlan(v: unknown): v is Plan {
  return v === "basico" || v === "corporativo";
}
