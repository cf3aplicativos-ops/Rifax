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
};

export default nextConfig;
