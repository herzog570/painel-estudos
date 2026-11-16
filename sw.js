/* Service worker: casca em cache (funciona offline); dados.js sempre tenta a rede primeiro. */
const CACHE = "painel-v3";
const SHELL = ["./", "./index.html", "./style.css", "./config.js", "./manifest.json",
  "./js/md.js", "./js/model.js", "./js/charts.js", "./js/planner.js", "./js/views.js", "./js/perfil.js", "./js/app_views.js", "./js/api.js", "./js/main.js",
  "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.hostname === "cdn.jsdelivr.net") {                          // biblioteca de login: guarda para abrir offline
    e.respondWith(caches.open(CACHE).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;                       // Supabase, fontes do Google: sempre pela rede
  const networkFirst = /dados\.js$|config\.js$|\.js$|\.css$|\.html$|\/$/.test(url.pathname);
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (networkFirst) {
      try { const r = await fetch(e.request, { cache: "no-store" }); if (r.ok) cache.put(e.request, r.clone()); return r; }
      catch (_) { const c = await cache.match(e.request); if (c) return c; throw _; }
    }
    const c = await cache.match(e.request); if (c) return c;
    const r = await fetch(e.request); if (r.ok) cache.put(e.request, r.clone()); return r;
  })());
});
