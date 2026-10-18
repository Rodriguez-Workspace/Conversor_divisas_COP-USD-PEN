/**
 * Service Worker: Soporte Offline Completo y Estrategias Híbridas de Caché
 * - Static Assets: Stale-While-Revalidate / Cache-First
 * - API Routes (/api/rates): Network-First con fallback a caché
 */

const CACHE_NAME = 'currency-pwa-v1.0.6';

// Recursos críticos para funcionamiento 100% offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/icons/icon.svg',
  '/js/core/converter.js',
  '/js/core/cacheManager.js',
  '/js/services/api.js',
  '/js/ui/view.js',
  '/js/app.js'
];

/**
 * Instalación: Pre-cacheados de shell de la aplicación
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precargando shell de la aplicación...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

/**
 * Activación: Limpieza de cachés antiguas
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purgando versión de caché obsoleta:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/**
 * Intercepción de peticiones de red
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Peticiones a la API (/api/rates) -> Network-First con Fallback a Caché
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstApiStrategy(event.request));
    return;
  }

  // 2. Recursos estáticos locales -> Stale-While-Revalidate
  if (event.request.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidateStrategy(event.request));
    return;
  }

  // 3. Peticiones externas normales (fuentes, etc.) -> Network con fallback a cache
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

/**
 * Estrategia Network-First para APIs
 * Intenta red; si responde, guarda copia en caché. Si falla, usa caché previa.
 */
async function networkFirstApiStrategy(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (networkError) {
    console.warn('[SW] Red no disponible para API, buscando respuesta en caché:', request.url);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback de respuesta JSON offline de emergencia
    return new Response(JSON.stringify({
      success: true,
      base: 'USD',
      rates: { USD: 1.0, COP: 3182.78, PEN: 3.43 },
      timestamp: Date.now(),
      source: 'sw_offline_fallback',
      cached: true,
      remainingTtlSeconds: 0,
      offline: true
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Worker-Offline': 'true'
      }
    });
  }
}

/**
 * Estrategia Stale-While-Revalidate para archivos estáticos del shell
 * Retorna inmediatamente la caché si existe y actualiza en segundo plano.
 */
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((err) => {
      // Ignorar error si estamos offline y ya teníamos caché
      return cachedResponse;
    });

  return cachedResponse || fetchPromise;
}
