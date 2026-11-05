// Офлайн-кэш: сайт открывается без сети (в магазине, в подвале общаги).
// Свои файлы — сначала сеть (чтобы обновления доходили), при её отсутствии — кэш.
// Шрифты и Firebase SDK с CDN — сначала кэш.
const V = 'racion-aea585bb';
const SHELL = ['./', './index.html', './styles.css?v=aea585bb', './data.js?v=aea585bb', './app.js?v=aea585bb', './firebase-config.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('racion-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const timeout = (ms, p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  const same = u.origin === self.location.origin;
  const cdn = (u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/')) || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (!same && !cdn) return; // Firestore и авторизация идут мимо кэша
  if (same) {
    e.respondWith(
      timeout(4000, fetch(req)).then(res => {
        if (res && res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(req, cp)); }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(r => r || caches.match('./')))
    );
  } else {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(V).then(c => c.put(req, cp)); }
        return res;
      }))
    );
  }
});
