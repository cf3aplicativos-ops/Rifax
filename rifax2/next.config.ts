import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fija la raíz del workspace a esta carpeta. Sin esto, Turbopack detecta el
  // package-lock.json del API padre (C:\Proyectos\Rifax) y elige mal la raíz,
  // lo que puede romper el file-tracing en el deploy de Vercel.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
