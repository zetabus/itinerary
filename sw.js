const CACHE_NAME = 'itinerary-shell-cache-v2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Do not intercept or cache third-party resources.
  if (url.origin !== self.location.origin) return;

  const isAppDocument =
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html');

  // Network-first for the main application page.
  if (isAppDocument) {
    const networkRequest = fetch(event.request, { cache: 'no-cache' });

    event.waitUntil(
      networkRequest
        .then(response => {
          if (!response || !response.ok) return;

          return caches.open(CACHE_NAME)
            .then(cache => cache.put('./index.html', response.clone()));
        })
        .catch(() => undefined)
    );

    event.respondWith(
      networkRequest.catch(async () => {
        const cachedPage = await caches.match('./index.html');

        return cachedPage || new Response(
          'The application has not been cached yet. Connect once, then reload.',
          {
            status: 503,
            statusText: 'Offline',
            headers: {
              'Content-Type': 'text/plain; charset=utf-8'
            }
          }
        );
      })
    );

    return;
  }

  // Cache-first for local application assets.
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;

        return fetch(event.request)
          .then(response => {
            if (response && response.ok) {
              const copy = response.clone();

              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, copy))
                .catch(() => undefined);
            }

            return response;
          });
      })
      .catch(() => new Response(
        'Offline resource unavailable.',
        {
          status: 503,
          statusText: 'Offline',
          headers: {
            'Content-Type': 'text/plain; charset=utf-8'
          }
        }
      ))
  );
});
