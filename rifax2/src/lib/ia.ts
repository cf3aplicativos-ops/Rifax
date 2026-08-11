// Cliente mínimo para el proveedor de IA (Groq, API compatible con OpenAI).
// Sin SDK adicional: una sola llamada HTTP. Si falta la clave, se informa con
// un mensaje claro en vez de fallar de forma confusa.
import "server-only";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODELO_TEXTO = "llama-3.3-70b-versatile";
const MODELO_VISION = "meta-llama/llama-4-scout-17b-16e-instruct";

export function iaDisponible(): boolean {
  return !!process.env.GROQ_API_KEY;
}

type ParteMensaje = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export interface MensajeIA { role: "system" | "user"; content: string | ParteMensaje[] }

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export async function preguntarJSON<T>(mensajes: MensajeIA[], opciones?: { vision?: boolean }): Promise<Resultado<T>> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { ok: false, error: "La conciliación con IA no está configurada en la plataforma. Contacta al administrador." };

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: opciones?.vision ? MODELO_VISION : MODELO_TEXTO,
        messages: mensajes,
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });
    if (!res.ok) {
      console.error("Error IA (Groq):", res.status, await res.text().catch(() => ""));
      return { ok: false, error: "El servicio de IA no pudo procesar la solicitud. Intenta de nuevo." };
    }
    const json = await res.json();
    const texto = json?.choices?.[0]?.message?.content;
    if (!texto || typeof texto !== "string") return { ok: false, error: "La IA no devolvió un resultado utilizable." };
    return { ok: true, data: JSON.parse(texto) as T };
  } catch (e) {
    console.error("Error IA (Groq):", e);
    return { ok: false, error: "No se pudo contactar el servicio de IA." };
  }
}
