import { NextRequest, NextResponse } from "next/server";

// CSP con nonce por petición (cierra el hallazgo de seguridad pendiente desde
// el 2026-08-04 en docs/bitacora.md: "agregar CSP", nunca aplicado). No existe
// ningún otro proxy/middleware en el proyecto — esta pieza SOLO genera el
// nonce y la cabecera; no toca autenticación ni redirecciones, para no
// arriesgar el resto del enrutamiento existente.
//
// `style-src` usa 'unsafe-inline' (no nonce) a propósito: hay varios
// `style={{...}}` en línea (charts.tsx, login, landing, carrusel, reportes,
// panel) — un nonce no se puede aplicar al atributo `style`, solo a un
// elemento `<style>`, y si el nonce está presente en la directiva el
// navegador ignora 'unsafe-inline' por completo, rompiendo esos usos.
// `script-src` sí es estricto (nonce + 'strict-dynamic') porque no hay ningún
// `<script>` manual en el proyecto: solo los que inyecta el propio Next.js,
// que sí reciben el nonce automáticamente.
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Excluye estáticos/imágenes/API — las rutas /api devuelven JSON, no HTML,
  // así que no necesitan CSP ni el costo de generar un nonce que no van a usar.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
