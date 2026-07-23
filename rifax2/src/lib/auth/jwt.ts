// Firma/verificación del JWT de sesión con `jose` (Web Crypto): funciona tanto
// en runtime Node (server components/actions) como en el Edge (middleware).
// Este módulo NO importa Prisma ni nada de Node, para poder usarse en middleware.
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const SESSION_COOKIE = "rfx_session";

export interface SessionClaims extends JWTPayload {
  /** uuid del usuario */
  sub: string;
  /** familia de la sesión (columna sesiones.familia) */
  sid: string;
  /** nombre del rol */
  rol: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta la variable de entorno JWT_SECRET");
  return new TextEncoder().encode(secret);
}

export async function signSession(
  claims: { sub: string; sid: string; rol: string },
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT({ sid: claims.sid, rol: claims.rol })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    return payload as SessionClaims;
  } catch {
    return null;
  }
}
