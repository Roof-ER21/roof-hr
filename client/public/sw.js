/**
 * Roof HR service worker.
 *
 * Scope is deliberately narrow. The manifest advertised `display: standalone`
 * with no service worker at all, so the app installed to a home screen and then
 * showed the browser's offline page the moment signal dropped. Attendance
 * check-in happens in the field, which is exactly where signal is worst.
 *
 * What this does:
 *   - Precaches the app shell so the PWA opens without a network.
 *   - Serves built assets cache-first. They are content-hashed, so a cached
 *     one is never stale.
 *   - Leaves /api ALONE. Never cache an HR API response: a stale PTO balance
 *     or candidate record read as current is worse than an honest error.
 *
 * It does not queue writes for later replay. A check-in that silently succeeds
 * offline and then fails to sync is a payroll problem, so the UI should say it
 * could not reach the server rather than pretend.
 */
const VERSION = 'roofhr-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // Individually, so one 404 does not fail the whole install.
      .then((cache) => Promise.allSettled(SHELL_URLS.map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the API. See the note above.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/mcp')) return;

  // Content-hashed build output: cache-first is safe and fast.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Navigations: network first so a deploy is picked up immediately, falling
  // back to the cached shell when there is no signal.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((hit) => hit || Response.error())),
    );
  }
});
