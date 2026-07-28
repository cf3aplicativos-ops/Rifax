// Proxy (Edge): protege /panel (super-admin) y /app (tenant) verificando el JWT
// con jose. La validación completa (sesión no revocada, tenant activo, permisos,
// y que el tipo de principal corresponde al área) ocurre en los server components.
import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/jwt";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? await verifySession(token) : null;

  if (!claims) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirige cada tipo de principal a su área correcta.
  const path = req.nextUrl.pathname;
  if (path.startsWith("/panel") && claims.kind !== "super") {
    return NextResponse.redirect(new URL("/app", req.url));
  }
  if ((path.startsWith("/app") || path.startsWith("/vendedor")) && claims.kind !== "user") {
    return NextResponse.redirect(new URL("/panel", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/panel", "/panel/:path*", "/app", "/app/:path*", "/vendedor", "/vendedor/:path*"],
};
