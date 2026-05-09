const CACHE_VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_NAME = `coffee-tracker-${CACHE_VERSION}`;
const MAX_CACHE_ENTRIES = 50;
const PRECACHE_URLS = ['/static/offline.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_CACHE_ENTRIES) {
    await cache.delete(keys[0]);
  }
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.protocol === 'chrome-extension:') return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const { pathname } = url;

  // Cache-first for static assets
  if (pathname.startsWith('/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const res = await fetch(event.request);
        cache.put(event.request, res.clone()).then(() => trimCache(cache));
        return res;
      })
    );
    return;
  }

  // Network-only for auth routes
  if (pathname.startsWith('/auth/')) {
    return fetch(event.request);
  }

  // Network-only for mutations
  const method = event.request.method.toUpperCase();
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    return fetch(event.request);
  }

  // Stale-while-revalidate for all other GET routes
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cacheKey = new Request(new URL(pathname, self.location.origin).href);
      const cached = await cache.match(cacheKey);

      if (cached) {
        event.waitUntil(
          fetch(event.request).then(res => {
            if (res.ok) {
              cache.put(cacheKey, res.clone()).then(() => trimCache(cache));
            }
          }).catch(() => {})
        );
        return cached;
      }

      try {
        const res = await fetch(event.request);
        if (res.ok) {
          cache.put(cacheKey, res.clone()).then(() => trimCache(cache));
        }
        return res;
      } catch {
        const offline = await cache.match('/static/offline.html');
        return offline || new Response('Offline', { status: 200 });
      }
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'INVALIDATE') {
    caches.open(CACHE_NAME).then(cache => {
      cache.keys().then(keys => {
        keys.forEach(req => {
          const url = new URL(req.url);
          if (event.data.paths.some(p => url.pathname.startsWith(p))) {
            cache.delete(req);
          }
        });
      });
    });
  }
});
