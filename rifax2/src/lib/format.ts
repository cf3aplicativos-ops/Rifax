const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** Formatea un monto (Decimal de Prisma, string o number) como pesos colombianos. */
export function money(valor: { toString(): string } | number | string): string {
  return cop.format(Number(valor.toString()));
}

export function fecha(d: Date): string {
  return d.toLocaleDateString("es-CO");
}

export function fechaHora(d: Date): string {
  return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

export const estadoVentaClase: Record<string, string> = {
  pendiente_pago: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  parcial: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  pagada: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  anulada: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  vencida: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};
