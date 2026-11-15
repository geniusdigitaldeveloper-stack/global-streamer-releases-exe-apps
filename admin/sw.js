/* Global Streamer Admin: cangkerang aplikasi boleh dibuka walaupun talian perlahan. Data sentiasa diambil terus daripada Firebase. */
const CACHE = 'gs-admin-v2';
const SCOPE = self.registration.scope;                       // cth https://.../global-streamer-releases-exe-apps/admin/
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll([SCOPE, SCOPE + 'manifest.webmanifest'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;      // Firebase dan CDN: terus ke rangkaian
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match(SCOPE))));
});
