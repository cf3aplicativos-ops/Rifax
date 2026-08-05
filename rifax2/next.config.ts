import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raíz del workspace a esta carpeta. Sin esto, Turbopack detecta el
  // package-lock.json del API padre (C:\Proyectos\Rifax) y elige mal la raíz,
  // lo que puede romper el file-tracing en el deploy de Vercel.
  turbopack: {
    root: import.meta.dirname,
  },
  // El branding sube logo/fondo como data-URI vía server action; el límite por
  // defecto (1MB) no alcanza. Se amplía para permitir imágenes hasta ~1.5MB.
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  // Cabeceras de seguridad para todas las respuestas. Conservadoras: no se añade
  // una CSP restrictiva para no romper estilos/scripts inline de Next ni la
  // inyección del color de marca. Endurece clickjacking, sniffing y fuga de referer.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Evita que la app se embeba en iframes de terceros (clickjacking).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Impide que el navegador "adivine" tipos MIME.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No filtrar la URL completa como referer hacia otros orígenes.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Forzar HTTPS (Vercel ya lo aplica; explícito por defensa en profundidad).
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Desactivar APIs del navegador que la app no usa.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
