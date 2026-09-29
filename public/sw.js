/**
 * Minimal app-shell service worker for PWA installability + basic offline fallback.
 * Scope-relative paths so this works at `/` and under Home Assistant Ingress.
 */
const CACHE_NAME = "ai-observatory-shell-v1";

function withinScope(path) {
  return new URL(String(path).replace(/^\//, ""), self.registration.scope).href;
}

const APP_SHELL = [
  "./",
  "manifest.webmanifest",
  "favicon.ico",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png",
  "apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        APP_SHELL.map((path) =>
          cache.add(withinScope(path)).catch(() => {
            /* optional / unavailable assets must not fail install */
          }),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function shouldHandle(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  // Never intercept API / ingestion / server-function traffic
  if (url.pathname.includes("/api/")) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  if (!shouldHandle(event.request)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const cloned = response.clone();
          void caches.open(CACHE_NAME).then((cache) => {
            void cache.put(event.request, cloned).catch(() => {});
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          const shell = await caches.match(withinScope("./"));
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});
