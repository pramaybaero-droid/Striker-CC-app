// Simple service worker: cache shell, network-first for APIs
const CACHE = "striker-community-v3";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./dist/react.production.min.js",
  "./dist/react-dom.production.min.js",
  "./dist/supabase.min.js",
  "./dist/app.bundle.js",
  "./src/util.jsx",
  "./src/store.jsx",
  "./src/parts.jsx",
  "./src/cloud.jsx",
  "./src/community.jsx",
  "./src/signin.jsx",
  "./src/welcome.jsx",
  "./src/toss.jsx",
  "./src/drive.jsx",
  "./src/drive_ui.jsx",
  "./src/scoreboard.jsx",
  "./src/leaderboard.jsx",
  "./src/app.jsx",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never intercept auth / API / realtime
  if (url.hostname.includes("supabase.co") ||
      url.hostname.includes("googleapis.com") ||
      url.hostname.includes("google.com") ||
      url.hostname.includes("gstatic.com")) return;

  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
