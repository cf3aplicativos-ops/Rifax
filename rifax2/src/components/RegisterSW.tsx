"use client";

import { useEffect } from "react";

/** Registra el service worker para habilitar la instalación como app (PWA). */
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
