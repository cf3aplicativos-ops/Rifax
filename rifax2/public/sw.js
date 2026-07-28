// Service worker mínimo para habilitar la instalación como PWA.
// Estrategia network-first para navegaciones, sin cachear agresivamente (evita
// servir una versión vieja de la app).
const CACHE = "rifax-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || new Response("Sin conexión.", { headers: { "Content-Type": "text/plain; charset=utf-8" } }))),
    );
  }
});
