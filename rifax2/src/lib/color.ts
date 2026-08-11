// Utilidades de color para aplicar el color de marca configurable de cada
// empresa (Configuración) a los botones primarios de la interfaz.

export function darken(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (x: number) => Math.max(0, Math.round(x * (1 - amt))).toString(16).padStart(2, "0");
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

// Luminancia relativa aproximada (0 = negro, 1 = blanco) para decidir el
// color de texto que contrasta sobre el color de marca.
export function luminancia(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// CSS que rebautiza la paleta "indigo" de Tailwind (usada como color
// primario de botones en toda la app) al color de marca configurado, con el
// color de texto correcto por contraste.
export function brandCss(colorEntrada: string): string {
  // El valor se interpola dentro de un bloque <style>. Se guarda ya validado
  // (guardarBranding), pero aquí se vuelve a exigir el formato #rrggbb: así
  // ningún valor que llegue por otra vía puede inyectar reglas CSS.
  const colorPrimario = /^#[0-9a-fA-F]{6}$/.test(colorEntrada) ? colorEntrada : "#f5c518";
  const claro = luminancia(colorPrimario) > 0.6;
  const fgPrimario = claro ? "#1e293b" : "#ffffff";
  return (
    `:root{--rifax-accent:${colorPrimario};--color-indigo-50:${colorPrimario}14;--color-indigo-500:${colorPrimario};--color-indigo-600:${colorPrimario};--color-indigo-700:${darken(colorPrimario, 0.12)};}` +
    `.bg-indigo-600{color:${fgPrimario} !important}`
  );
}
