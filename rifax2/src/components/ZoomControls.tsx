"use client";

import { useEffect, useState } from "react";
import { EVENTO_ENFOQUE, alternarEnfoque } from "./side-nav";

const MIN = 80;
const MAX = 150;
const STEP = 10;
const KEY = "rifax_zoom";

// Control flotante de tamaño de pantalla: ajusta el zoom de todo el contenido
// (escalando el tamaño de fuente raíz, del que dependen la mayoría de medidas
// de Tailwind) y permite normalizar la vista en pantalla completa, ocultando
// el menú lateral y las barras superiores (side-nav.tsx escucha el mismo
// evento para mostrarse/ocultarse). Se muestra en todas las pantallas, pero
// no en impresiones.
export default function ZoomControls() {
  const [zoom, setZoom] = useState(100);
  const [enfoque, setEnfoque] = useState(false);

  useEffect(() => {
    const guardado = Number(localStorage.getItem(KEY));
    const inicial = guardado >= MIN && guardado <= MAX ? guardado : 100;
    // localStorage no existe durante el render del servidor: hay que leerlo
    // en el efecto (tras montar en el cliente) para evitar un desajuste de
    // hidratación entre servidor y cliente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZoom(inicial);
    document.documentElement.style.fontSize = inicial === 100 ? "" : `${inicial}%`;

    const onFsChange = () => {
      // Si el navegador sale de pantalla completa por su cuenta (Esc),
      // también se restaura el menú (mismo evento explícito que usan los
      // botones, así nunca queda desincronizado).
      if (!document.fullscreenElement) alternarEnfoque(false);
    };
    const onEnfoque = (e: Event) => setEnfoque((e as CustomEvent<boolean>).detail);
    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener(EVENTO_ENFOQUE, onEnfoque);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      window.removeEventListener(EVENTO_ENFOQUE, onEnfoque);
    };
  }, []);

  function aplicar(nuevo: number) {
    const clamped = Math.min(MAX, Math.max(MIN, nuevo));
    setZoom(clamped);
    document.documentElement.style.fontSize = clamped === 100 ? "" : `${clamped}%`;
    localStorage.setItem(KEY, String(clamped));
  }

  function alternarPantallaCompleta() {
    const activar = !enfoque;
    if (activar) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    alternarEnfoque(activar);
  }

  return (
    <div className="fixed bottom-3 right-3 z-[100] flex items-center gap-0.5 rounded-full border border-slate-300 bg-white/95 p-1 text-slate-600 shadow-lg backdrop-blur print:hidden dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300">
      <button
        type="button"
        onClick={() => aplicar(zoom - STEP)}
        disabled={zoom <= MIN}
        aria-label="Reducir tamaño de pantalla"
        title="Reducir tamaño"
        className="grid h-8 w-8 place-items-center rounded-full text-sm font-bold hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
      >
        A−
      </button>
      <button
        type="button"
        onClick={() => aplicar(100)}
        aria-label="Restablecer tamaño de pantalla al 100%"
        title={`Tamaño actual ${zoom}% — clic para restablecer`}
        className="grid h-8 min-w-9 place-items-center rounded-full px-1 text-[11px] font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        {zoom}%
      </button>
      <button
        type="button"
        onClick={() => aplicar(zoom + STEP)}
        disabled={zoom >= MAX}
        aria-label="Aumentar tamaño de pantalla"
        title="Aumentar tamaño"
        className="grid h-8 w-8 place-items-center rounded-full text-sm font-bold hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
      >
        A+
      </button>
      <button
        type="button"
        onClick={alternarPantallaCompleta}
        aria-label={enfoque ? "Mostrar menú y salir de pantalla completa" : "Pantalla completa: ocultar menú"}
        title={enfoque ? "Mostrar menú" : "Pantalla completa (oculta el menú)"}
        className="grid h-8 w-8 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {enfoque ? (
            <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
          ) : (
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
          )}
        </svg>
      </button>
    </div>
  );
}
