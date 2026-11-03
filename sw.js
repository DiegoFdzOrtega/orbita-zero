/* =====================================================================
   Órbita Zero · service worker
   ---------------------------------------------------------------------
   Guarda todos los archivos del juego en la caché del navegador la
   primera vez. Después el juego se abre al instante y funciona SIN
   CONEXIÓN, como una app instalada (solo al servirlo por https, por
   ejemplo en GitHub Pages).
   Al cambiar archivos, sube la VERSION para que se renueve la caché.
   ===================================================================== */
const VERSION = "orbita-zero-v3";
const ARCHIVOS = [
  "./", "index.html", "manifest.webmanifest",
  "iconos/icono-192.png", "iconos/icono-512.png",
  "lib/diegofo-ui.min.js",
  "motor/nucleo.js", "motor/pantalla.js", "motor/nodo.js", "motor/entrada.js", "motor/fisica.js",
  "motor/audio.js", "motor/recursos.js", "motor/particulas.js", "motor/guardado.js",
  "motor/depurador.js", "motor/ui.js", "motor/motor.js",
  "juego/progreso.js", "juego/arte.js", "juego/entidades.js", "juego/escena-batalla.js", "juego/main.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

// Borra las cachés de versiones anteriores
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Primero la caché; si no está, la red
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
