// Mary Mary's service worker: keeps a copy of the app on the phone so it opens
// without signal, and swaps in the new version after each update.
// The build replaces __VERSION__, so every publish gets a fresh cache.

const CACHE = "mary-mary-__VERSION__";
const CORE = ["./", "./index.html", "./app.js?v=__VERSION__", "./app.css?v=__VERSION__", "./manifest.webmanifest", "./icons/apple-touch-icon.png", "./icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mary-mary-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  // Weather and postcode look-ups always go to the internet; the app saves its own copy.
  if (url.origin !== self.location.origin && !isFont) return;

  // Pages: try the internet first (to get updates), fall back to the saved copy.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }

  // Everything else (code, icons, fonts): saved copy first, then the internet.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok || res.type === "opaque") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

// Urgent alerts (v0.9): GitHub sends them (scripts/notify.ts), this shows them.
self.addEventListener("push", (event) => {
  let m = {};
  try {
    m = event.data ? event.data.json() : {};
  } catch {
    m = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(m.title || "Mary Mary", {
      body: m.body || "",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      tag: m.tag || "mary-mary",
      data: { url: m.url || "#/weather" },
    }),
  );
});

// Tapping an alert opens Mary Mary at the right screen (the weather, usually).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "#/weather", self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.registration.scope));
      if (open) return open.navigate(target).then((c) => (c || open).focus()).catch(() => open.focus());
      return self.clients.openWindow(target);
    }),
  );
});
