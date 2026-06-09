const CACHE_NAME = "multi-tenant-app-v3";
const APP_SHELL = [
  "/manifest.webmanifest",
  "/brands/triangle-logo.svg",
  "/brands/malilink-logo.svg",
  "/brands/hafiya-logo.svg"
];

const PRIVATE_PATH_PREFIXES = [
  "/api",
  "/dashboard",
  "/super-admin",
  "/produits",
  "/stocks",
  "/pos",
  "/comptabilite",
  "/laboratoire",
  "/documents",
  "/badges",
  "/utilisateurs",
  "/notifications",
  "/marketplace/cart",
  "/marketplace/checkout",
  "/marketplace/orders",
  "/client/dashboard",
  "/client/orders",
  "/client/profile"
];

function isPrivateRequest(request, url) {
  if (request.method !== "GET") return true;
  if (request.headers.get("authorization")) return true;
  if (url.searchParams.has("token")) return true;
  if (url.pathname.includes("/_next/data/")) return true;
  return PRIVATE_PATH_PREFIXES.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || isPrivateRequest(request, url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          `<!doctype html>
          <html lang="fr">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>Application hors connexion</title>
              <style>
                body{font-family:Arial,sans-serif;background:#f3f4f6;margin:0;min-height:100vh;display:grid;place-items:center;color:#111827}
                main{max-width:520px;background:white;border-radius:18px;padding:28px;box-shadow:0 18px 50px rgba(0,0,0,.12);text-align:center}
                h1{margin:0 0 12px;font-size:28px}
                p{font-size:16px;line-height:1.5;color:#4b5563}
              </style>
            </head>
            <body>
              <main>
                <h1>Application hors connexion</h1>
                <p>Connexion Internet requise pour synchroniser cette application.</p>
              </main>
            </body>
          </html>`,
          {
            headers: {
              "Content-Type": "text/html; charset=utf-8"
            }
          }
        )
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (
          response.ok &&
          response.type === "basic" &&
          ["style", "script", "image", "font"].includes(request.destination)
        ) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }

        return response;
      });
    })
  );
});
