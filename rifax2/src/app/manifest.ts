import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RIFAX SaaS — Gestión de rifas",
    short_name: "RIFAX",
    description: "Plataforma multi-empresa de gestión de rifas: sedes, ventas, cartera y sorteos.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#1e293b",
    icons: [
      { src: "/icon-app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-app-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
