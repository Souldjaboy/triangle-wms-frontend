
/*
 * TRIANGLE_PWA_SAFE_CACHE_V1
 *
 * Principe :
 * - HTML / navigation : réseau uniquement
 * - API : réseau uniquement
 * - fichiers statiques versionnés : cache autorisé
 * - anciens caches supprimés automatiquement
 */

const CACHE_NAME = "triangle-static-authfix-YS8vnpKU5PwCzDr9Cm9Sj";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
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

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {

  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
   * Navigation / pages HTML :
   * toujours demander la version actuelle au serveur.
   *
   * On ne renvoie plus une vieille page HTML depuis Cache Storage.
   */
  if (request.mode === "navigate") {

    event.respondWith(
      fetch(request, {
        cache: "no-store"
      })
      .catch(() => {
        return new Response(
          `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connexion indisponible</title>
<style>
body{
  margin:0;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#f8fafc;
  font-family:Arial,sans-serif;
  color:#0f172a
}
.card{
  max-width:520px;
  margin:20px;
  padding:28px;
  background:white;
  border-radius:18px;
  box-shadow:0 15px 40px rgba(15,23,42,.12);
  text-align:center
}
button{
  border:0;
  border-radius:10px;
  padding:12px 18px;
  background:#0f172a;
  color:white;
  font-weight:700;
  cursor:pointer
}
</style>
</head>
<body>
<div class="card">
<h1>Connexion au serveur indisponible</h1>
<p>
Votre appareil semble connecté, mais Triangle WMS
n'arrive pas actuellement à joindre le serveur.
</p>
<button onclick="location.reload()">Réessayer</button>
</div>
</body>
</html>`,
          {
            status: 503,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store"
            }
          }
        );
      })
    );

    return;
  }


  /*
   * API / backend :
   * jamais de cache.
   */
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/disbursements") ||
    url.pathname.startsWith("/permissions") ||
    url.pathname.startsWith("/auth")
  ) {

    event.respondWith(
      fetch(request, {
        cache: "no-store"
      })
    );

    return;
  }


  /*
   * Assets Next hashés :
   * cache-first acceptable.
   */
  if (
    url.origin === self.location.origin &&
    url.pathname.startsWith("/_next/static/")
  ) {

    event.respondWith(
      caches.match(request)
        .then((cached) => {

          if (cached) {
            return cached;
          }

          return fetch(request)
            .then((response) => {

              if (
                response &&
                response.ok &&
                response.type === "basic"
              ) {

                const copy = response.clone();

                caches.open(CACHE_NAME)
                  .then((cache) =>
                    cache.put(request, copy)
                  );
              }

              return response;
            });

        })
    );

    return;
  }


  /*
   * Images/icônes/fonts :
   * réseau d'abord, cache de secours.
   */
  if (
    request.destination === "image" ||
    request.destination === "font"
  ) {

    event.respondWith(
      fetch(request)
        .then((response) => {

          if (response && response.ok) {

            const copy = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) =>
                cache.put(request, copy)
              );
          }

          return response;
        })
        .catch(() => caches.match(request))
    );

    return;
  }


  /*
   * Tout le reste :
   * réseau normal.
   */
  event.respondWith(
    fetch(request)
  );
});


/*
====================================================
 TRIANGLE_WEB_PUSH_SERVICE_WORKER_V2
====================================================
*/

self.addEventListener(
  "push",
  (event) => {
    let payload = {};

    try {
      payload =
        event.data
          ? event.data.json()
          : {};
    } catch {
      payload = {
        message:
          event.data
            ? event.data.text()
            : ""
      };
    }

    const isCall =
      payload.call === true ||
      payload.type === "chat_call";

    const target =
      typeof payload.url === "string" &&
      payload.url.startsWith("/") &&
      !payload.url.startsWith("//")
        ? payload.url
        : "/notifications";

    const secureOpenUrl =
      "/notification-open?target=" +
      encodeURIComponent(target);

    const options = {
      body:
        payload.message ||
        "Nouvelle notification Triangle.",

      icon:
        "/brands/triangle-logo.png",

      badge:
        "/brands/triangle-logo.png",

      tag:
        (
          isCall
            ? "triangle-call-"
            : "triangle-notification-"
        ) +
        String(
          payload.notification_id ||
          Date.now()
        ),

      renotify:
        true,

      requireInteraction:
        isCall,

      vibrate:
        isCall
          ? [
              500,
              200,
              500,
              200,
              800
            ]
          : [
              160,
              80,
              160
            ],

      data: {
        url:
          secureOpenUrl,

        target,

        type:
          payload.type ||
          "notification",

        notification_id:
          payload.notification_id ||
          null
      },

      actions:
        isCall
          ? [
              {
                action:
                  "answer",
                title:
                  "📞 Répondre"
              },

              {
                action:
                  "dismiss",
                title:
                  "Refuser"
              }
            ]
          : [
              {
                action:
                  "open",
                title:
                  "Ouvrir"
              }
            ]
    };

    event.waitUntil(
      self.registration
        .showNotification(
          payload.title ||
          (
            isCall
              ? "📞 Appel entrant Triangle"
              : "Triangle WMS Pro"
          ),
          options
        )
    );
  }
);


self.addEventListener(
  "notificationclick",
  (event) => {
    const notification =
      event.notification;

    const action =
      event.action || "open";

    const data =
      notification.data || {};

    notification.close();

    /*
     * Pour l'instant refuser ferme
     * simplement l'alerte système.
     * Le futur moteur d'appel natif
     * enregistrera réellement REFUSE.
     */
    if (
      action === "dismiss"
    ) {
      return;
    }

    const url =
      data.url ||
      "/notification-open?target=%2Fnotifications";

    event.waitUntil(
      self.clients
        .matchAll({
          type:
            "window",
          includeUncontrolled:
            true
        })
        .then(
          async (clients) => {
            for (const client of clients) {
              try {
                if (
                  "navigate" in client
                ) {
                  await client.navigate(
                    url
                  );
                }

                await client.focus();

                return;
              } catch {}
            }

            if (
              self.clients.openWindow
            ) {
              return self.clients
                .openWindow(url);
            }
          }
        )
    );
  }
);
