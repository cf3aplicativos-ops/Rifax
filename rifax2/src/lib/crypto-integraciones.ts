// Cifrado en reposo para los secretos de integraciones por tenant (Wompi,
// WhatsApp, SMS) — cierra el hallazgo de seguridad pendiente desde el
// 2026-08-11 en docs/bitacora.md: "guardados en columnas planas (no cifradas
// en reposo)... si se requiere cifrado adicional es un cambio aparte".
//
// AES-256-GCM con una clave derivada por SHA-256 de INTEGRACIONES_ENCRYPTION_KEY
// (así acepta cualquier cadena, sin exigir exactamente 32 bytes en base64, el
// mismo criterio simple que ya usan JWT_SECRET/CRON_SECRET en este proyecto).
// Formato guardado: base64(iv[12] + authTag[16] + texto cifrado).
import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITMO = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function claveDerivada(): Buffer {
  const secreto = process.env.INTEGRACIONES_ENCRYPTION_KEY;
  if (!secreto) throw new Error("Falta INTEGRACIONES_ENCRYPTION_KEY en las variables de entorno.");
  return createHash("sha256").update(secreto).digest();
}

export function encriptar(texto: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITMO, claveDerivada(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), cifrado]).toString("base64");
}

export function desencriptar(valorCifrado: string): string {
  const buf = Buffer.from(valorCifrado, "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const cifrado = buf.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = createDecipheriv(ALGORITMO, claveDerivada(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString("utf8");
}
