const CACHE_NAME = 'reality-sync-shell-v2';
const MAX_RUNTIME_ASSET_ENTRIES = 24;
const scopeUrl = new URL(self.registration.scope);
const indexUrl = new URL('index.html', scopeUrl);
const CORE_URLS = [
  scopeUrl.href,
  indexUrl.href,
  new URL('manifest.webmanifest', scopeUrl).href,
  new URL('icon.svg', scopeUrl).href,
];

function isRuntimeAsset(requestUrl) {
  const url = new URL(requestUrl);
  return url.origin === scopeUrl.origin && url.pathname.startsWith(new URL('assets/', scopeUrl).pathname);
}

function isAppShellNavigation(url) {
  return url.pathname === scopeUrl.pathname || url.pathname === indexUrl.pathname;
}

async function trimRuntimeAssets(cache) {
  const runtimeKeys = (await cache.keys()).filter((request) => isRuntimeAsset(request.url));
  const overflow = runtimeKeys.length - MAX_RUNTIME_ASSET_ENTRIES;
  if (overflow <= 0) return;
  await Promise.all(runtimeKeys.slice(0, overflow).map((request) => cache.delete(request)));
}

async function putResponse(request, response) {
  if (!response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  if (isRuntimeAsset(typeof request === 'string' ? request : request.url)) await trimRuntimeAssets(cache);
}

async function putNavigationResponse(response) {
  if (!response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await Promise.all([
    cache.put(scopeUrl.href, response.clone()),
    cache.put(indexUrl.href, response.clone()),
  ]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(scopeUrl.href)) return;

  if (request.mode === 'navigate') {
    // Privacy/terms/support are real documents under the same service-worker
    // scope. Never let one of those responses replace the cached SPA shell.
    if (!isAppShellNavigation(url)) return;
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) await putNavigationResponse(response);
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match(indexUrl.href)
          || await cache.match(scopeUrl.href)
          || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await putResponse(request, response);
    return response;
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const scopedClients = clients.filter((client) => client.url.startsWith(scopeUrl.href));
      for (const client of scopedClients) {
        if ('focus' in client) {
          await client.focus();
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(scopeUrl.href);
      return undefined;
    }),
  );
});
