// Απλός service worker: network-first. Πάντα φορτώνει τη νέα έκδοση όταν υπάρχει
// σύνδεση, και κρατά αντίγραφο για να ανοίγει η εφαρμογή (το "κέλυφος") χωρίς δίκτυο.
const CACHE = "dromologia-shell-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // τα δεδομένα (Supabase) δεν κρατιούνται
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
