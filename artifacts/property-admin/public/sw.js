// Web app service worker: network-first with a cached shell.
//
// Makes the portal installable and lets an already-visited page render with no
// signal. GET navigations/assets are cached opportunistically; anything that
// changes state (POST/PATCH/DELETE — including photo uploads) is never
// intercepted, so a queued upload can't silently succeed offline.
const CACHE = "portal-shell-v1";
const SCOPE = new URL(self.registration.scope).pathname;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch the API or the CDN

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match(SCOPE))),
  );
});
