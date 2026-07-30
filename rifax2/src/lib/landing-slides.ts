// Carrusel de la landing — CONFIGURABLE.
// Edita este arreglo para cambiar las fotos y textos del carrusel superior.
// Cada slide admite:
//   - imagen:   URL de una foto (https://…) o data URI. Si se define, se usa de fondo.
//   - gradiente: clases Tailwind de respaldo cuando no hay imagen.
//   - titulo / subtitulo: textos superpuestos (opcionales).
export interface Slide {
  imagen?: string;
  gradiente?: string;
  titulo?: string;
  subtitulo?: string;
}

export const slidesLanding: Slide[] = [
  {
    gradiente: "bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#0f172a]",
    titulo: "Gestión inteligente de rifas",
    subtitulo: "Organiza, vende y sortea con transparencia verificable.",
  },
  {
    gradiente: "bg-gradient-to-br from-[#f5c518] via-[#f59e0b] to-[#eab308]",
    titulo: "Sorteos con resultados en vivo",
    subtitulo: "Tus ganadores, publicados al instante y a la vista de todos.",
  },
  {
    gradiente: "bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#f5c518]",
    titulo: "Vendedores y sedes bajo control",
    subtitulo: "Comisiones, cartera y auditoría en una sola plataforma.",
  },
];
