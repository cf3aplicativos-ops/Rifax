// Limitación de tasa en memoria para los puntos de entrada NO autenticados
// (login, restablecimiento de contraseña, consulta pública). Es una barrera de
// defensa en profundidad, no un control distribuido: en serverless cada
// instancia mantiene su propio contador, así que el límite efectivo es mayor
// que el configurado. Aun así corta el abuso automatizado desde un mismo
// origen, que es el escenario real de fuerza bruta y de enumeración.
//
// Para un control estricto y compartido entre instancias haría falta un
// almacén externo (Redis/Upstash) o el rate limiting del borde de Vercel.
import "server-only";

interface Ventana {
  reinicio: number;
  intentos: number;
}

const CUBOS = new Map<string, Ventana>();
// Cota de memoria: si el mapa crece sin control (muchas claves distintas), se
// purga lo caducado y, en el peor caso, se vacía.
const MAX_CLAVES = 10_000;

function purgar(ahora: number): void {
  for (const [k, v] of CUBOS) {
    if (v.reinicio <= ahora) CUBOS.delete(k);
  }
  if (CUBOS.size > MAX_CLAVES) CUBOS.clear();
}

/**
 * Consume un intento para `clave`. Devuelve false cuando ya se superó el
 * límite dentro de la ventana. Ante cualquier error interno permite el paso
 * (fail-open): este control nunca debe dejar fuera a un usuario legítimo por
 * un fallo propio.
 */
export function permitir(clave: string, limite: number, ventanaMs: number): boolean {
  try {
    const ahora = Date.now();
    if (CUBOS.size > MAX_CLAVES / 2) purgar(ahora);

    const actual = CUBOS.get(clave);
    if (!actual || actual.reinicio <= ahora) {
      CUBOS.set(clave, { reinicio: ahora + ventanaMs, intentos: 1 });
      return true;
    }
    actual.intentos += 1;
    return actual.intentos <= limite;
  } catch {
    return true;
  }
}

/** Descarta el contador de una clave (p. ej. tras un login correcto). */
export function reiniciar(clave: string): void {
  CUBOS.delete(clave);
}
