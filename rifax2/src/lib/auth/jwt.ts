// Firma/verificación del JWT de sesión con `jose` (Edge-safe: sin Prisma/Node).
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const SESSION_COOKIE = "rfx_session";

export interface SessionClaims extends JWTPayload {
  /** uuid del principal (super-admin de plataforma o usuario de tenant) */
  sub: string;
  /** tipo de principal */
  kind: "super" | "user";
  /** familia de la sesión en BD (solo usuarios de tenant) */
  sid?: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta la variable de entorno JWT_SECRET");
  return new TextEncoder().encode(secret);
}

export async function signSession(
  claims: { sub: string; kind: "super" | "user"; sid?: string },
  ttlSeconds: number,
): Promise<string> {
  const jwt = new SignJWT({ kind: claims.kind, ...(claims.sid ? { sid: claims.sid } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`);
  return jwt.sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== "string") return null;
    if (payload.kind !== "super" && payload.kind !== "user") return null;
    return payload as SessionClaims;
  } catch {
    return null;
  }
}
