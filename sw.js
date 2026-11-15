// Service worker: permite abrir la app sin conexión y recibir archivos compartidos desde otras apps.
// Cambia VERSION en cada publicación para que los móviles reciban la nueva versión.
const VERSION = "v0.2.0";
const CACHE = "migarantia-" + VERSION;
const ARCHIVOS = ["./", "index.html", "app.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith("migarantia-v") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Archivos compartidos desde otra app (Compartir → Mi garantía)
  if (req.method === "POST" && url.pathname.endsWith("/compartir")) {
    e.respondWith((async () => {
      const datos = await req.formData();
      const cache = await caches.open("migarantia-compartidos");
      let n = 0;
      for (const f of datos.getAll("archivos")) {
        if (!(f instanceof File)) continue;
        await cache.put(new Request("./compartido/" + Date.now() + "-" + n++),
          new Response(f, { headers: { "Content-Type": f.type || "application/octet-stream", "X-Nombre": encodeURIComponent(f.name || "documento") } }));
      }
      return Response.redirect("./?compartido=1", 303);
    })());
    return;
  }
  if (req.method !== "GET") return;

  // Páginas y código: primero la red (para recibir mejoras); sin conexión, la copia guardada.
  if (req.mode === "navigate" || url.pathname.endsWith(".js") || url.pathname.endsWith(".webmanifest")) {
    e.respondWith(
      fetch(req)
        .then((r) => { if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req.mode === "navigate" ? "index.html" : req, copia)); } return r; })
        .catch(() => caches.match(req.mode === "navigate" ? "index.html" : req).then((r) => r || caches.match(req, { ignoreSearch: true })))
    );
    return;
  }
  // Resto (iconos): primero la copia guardada.
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
