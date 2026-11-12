// Tiene in memoria i file dell'app, così si apre anche senza rete.
// Strategia: prima la rete, chiedendo sempre al server se il file è cambiato (cache: 'no-cache'),
// così pagina e programma arrivano sempre nella stessa versione; senza rete, la copia salvata.
const CACHE = 'agenda-v3';
const SHELL = ['./', 'index.html', 'app.css?v=3', 'app.js?v=3', 'config.js?v=3', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => fetch(u, { cache: 'reload' }).then((res) => { if (res.ok) return c.put(u, res); }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req.url, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.url, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.url, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
  );
});
