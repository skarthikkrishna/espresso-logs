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
  const method = event.request.method.toUpperCase();
  const isAuthOrOAuthPath =
    pathname === '/auth' ||
    pathname.startsWith('/auth/') ||
    pathname === '/oauth' ||
    pathname.startsWith('/oauth/') ||
    (pathname === '/login' && url.searchParams.has('oauth_success'));

  if (isAuthOrOAuthPath || method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for Vite-hashed assets only — they are content-addressed and
  // immutable by URL, so serving from cache is always safe.
  // Scoped to /static/spa/assets/ to avoid caching index.html or other
  // non-hashed resources cache-first (which would cause stale SPA shell 404s
  // after a rebuild rotates chunk filenames).
  if (pathname.startsWith('/static/spa/assets/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone()).then(() => trimCache(cache));
        return res;
      })
    );
    return;
  }

  // Network-first for all other GET routes (SPA navigations, API, non-hashed
  // static files).  Serving stale SPA shells that reference deleted hashed
  // chunks causes hard 404 failures after every rebuild; network-first ensures
  // the current index.html is always used.  Cache is used only as an offline
  // fallback when the network is unreachable.
  event.respondWith(
    fetch(event.request).then(res => {
      if (res.ok) {
        const cacheKey = new Request(new URL(pathname, self.location.origin).href);
        caches.open(CACHE_NAME).then(cache => {
          cache.put(cacheKey, res.clone()).then(() => trimCache(cache));
        });
      }
      return res;
    }).catch(async () => {
      const cacheKey = new Request(new URL(pathname, self.location.origin).href);
      const cached = await caches.open(CACHE_NAME).then(c => c.match(cacheKey));
      if (cached) return cached;
      const offline = await caches.match('/static/offline.html');
      return offline || new Response('Offline', { status: 200 });
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
