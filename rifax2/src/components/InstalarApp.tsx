"use client";

import { useEffect, useState } from "react";

const CLAVE = "rifax_instalar_ocultado";

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Ningún navegador permite instalar una app "en silencio": siempre exige un
// gesto explícito del usuario (por seguridad). Esto es lo más cercano a
// "automático" que el estándar web permite: en el primer ingreso a este
// dispositivo, aparece solo un aviso con un botón — un toque instala.
// En iOS Safari no existe API de instalación programática: se muestran las
// instrucciones manuales de "Agregar a pantalla de inicio".
export default function InstalarApp() {
  const [visible, setVisible] = useState(false);
  const [prompt, setPrompt] = useState<EventoInstalacion | null>(null);
  const [esIOS, setEsIOS] = useState(false);

  useEffect(() => {
    const yaInstalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (yaInstalada || localStorage.getItem(CLAVE)) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    // navigator.userAgent no existe durante el render del servidor: hay que
    // leerlo en el efecto (tras montar en el cliente) para evitar un desajuste
    // de hidratación entre servidor y cliente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEsIOS(ios);

    if (ios) {
      setVisible(true);
      return;
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setPrompt(e as EventoInstalacion);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function cerrar() {
    setVisible(false);
    localStorage.setItem(CLAVE, "1");
  }

  async function instalar() {
    if (!prompt) return;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // El usuario canceló el diálogo nativo del navegador.
    }
    cerrar();
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[190] mx-auto max-w-sm rounded-xl border border-slate-300 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--rifax-accent,#f5c518)] text-lg font-black text-slate-900">R</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Instala RIFAX en este dispositivo</p>
          {esIOS ? (
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Toca <strong>Compartir</strong> (el ícono con la flecha) en la barra de Safari y luego{" "}
              <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Queda como un acceso directo, sin tener que abrir el navegador cada vez.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            {!esIOS ? (
              <button type="button" onClick={instalar} className="rounded-lg bg-[var(--rifax-accent,#f5c518)] px-3 py-1.5 text-xs font-bold text-slate-900">
                Instalar
              </button>
            ) : null}
            <button type="button" onClick={cerrar} className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              {esIOS ? "Entendido" : "Ahora no"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
