"use strict";

const CACHE_NAME = "jarvis-shell-v1";
const SHELL_ASSETS = [
  "/jarvis/",
  "/jarvis/index.html",
  "/jarvis/app.css",
  "/jarvis/app.js",
  "/jarvis/pwa.js",
  "/jarvis/manifest.webmanifest",
  "/jarvis/icon.svg"
];
const SHELL_PATHS = new Set(SHELL_ASSETS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("jarvis-shell-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

function cacheableShellResponse(response) {
  if (!response || !response.ok || response.type !== "basic") return false;
  if (response.headers.has("set-cookie")) return false;
  if (/no-store/i.test(response.headers.get("cache-control") || "")) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API responses, owner-authenticated requests, or arbitrary data.
  if (url.pathname.startsWith("/api/") ||
      request.headers.has("authorization") ||
      request.headers.has("x-admin-secret")) return;

  const isJarvisNavigation = request.mode === "navigate" &&
    (url.pathname === "/jarvis" || url.pathname.startsWith("/jarvis/"));

  if (isJarvisNavigation) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (cacheableShellResponse(response)) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("/jarvis/", response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match("/jarvis/");
        return cached || new Response("J.A.R.V.I.S. is offline and its app shell is not cached on this device.", {
          status: 503,
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
        });
      }
    })());
    return;
  }

  if (!SHELL_PATHS.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      event.waitUntil(fetch(request).then(async (response) => {
        if (cacheableShellResponse(response)) await cache.put(request, response);
      }).catch(() => undefined));
      return cached;
    }
    try {
      const response = await fetch(request);
      if (cacheableShellResponse(response)) await cache.put(request, response.clone());
      return response;
    } catch {
      return new Response("This J.A.R.V.I.S. resource is not available offline.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
      });
    }
  })());
});
