"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  authFetch,
} from "../app/lib/api";


function urlBase64ToUint8Array(
  base64String: string
) {
  const padding =
    "=".repeat(
      (
        4 -
        (
          base64String.length %
          4
        )
      ) %
      4
    );

  const base64 =
    (
      base64String +
      padding
    )
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const rawData =
    window.atob(base64);

  return Uint8Array.from(
    [...rawData].map(
      (char) =>
        char.charCodeAt(0)
    )
  );
}


export default function TrianglePushManager() {
  const [
    visible,
    setVisible,
  ] =
    useState(false);

  const [
    busy,
    setBusy,
  ] =
    useState(false);


  const isLoggedIn =
    () => {
      const token =
        localStorage.getItem(
          "business_token"
        ) ||
        localStorage.getItem(
          "token"
        );

      const user =
        localStorage.getItem(
          "business_user"
        ) ||
        localStorage.getItem(
          "user"
        );

      return Boolean(
        token &&
        user
      );
    };


  const isPublicAuthPage =
    () => {
      const path =
        window.location.pathname;

      return (
        path.startsWith("/login") ||
        path.startsWith("/register") ||
        path.startsWith("/verification") ||
        path.startsWith("/mot-de-passe")
      );
    };


  const registerPush =
    async (
      askPermission:
        boolean
    ) => {
      if (
        !isLoggedIn() ||
        isPublicAuthPage()
      ) {
        return;
      }

      if (
        !(
          "serviceWorker" in navigator
        ) ||
        !(
          "PushManager" in window
        ) ||
        !(
          "Notification" in window
        )
      ) {
        return;
      }

      let permission =
        Notification.permission;

      if (
        permission === "default" &&
        askPermission
      ) {
        permission =
          await Notification
            .requestPermission();
      }

      if (
        permission !== "granted"
      ) {
        setVisible(
          permission === "default"
        );

        return;
      }

      const registration =
        await navigator
          .serviceWorker
          .ready;

      let subscription =
        await registration
          .pushManager
          .getSubscription();

      if (!subscription) {
        const keyResponse =
          await authFetch(
            "/push/public-key",
            {
              cache:
                "no-store"
            }
          );

        const keyData =
          await keyResponse
            .json()
            .catch(
              () => ({})
            );

        if (
          !keyResponse.ok ||
          !keyData.publicKey
        ) {
          throw new Error(
            keyData.error ||
            "Clé Push indisponible."
          );
        }

        subscription =
          await registration
            .pushManager
            .subscribe({
              userVisibleOnly:
                true,

              applicationServerKey:
                urlBase64ToUint8Array(
                  keyData.publicKey
                )
            });
      }

      const serialized =
        subscription.toJSON();

      const response =
        await authFetch(
          "/push/subscribe",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                endpoint:
                  serialized.endpoint,

                keys:
                  serialized.keys ||
                  {}
              })
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => ({})
          );

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Enregistrement push impossible."
        );
      }

      setVisible(false);
    };


  useEffect(() => {
    if (
      typeof window === "undefined" ||
      isPublicAuthPage() ||
      !isLoggedIn()
    ) {
      return;
    }

    if (
      !(
        "serviceWorker" in navigator
      ) ||
      !(
        "PushManager" in window
      ) ||
      !(
        "Notification" in window
      )
    ) {
      return;
    }

    if (
      Notification.permission ===
      "granted"
    ) {
      registerPush(false)
        .catch(
          (error) =>
            console.warn(
              "Triangle Push:",
              error
            )
        );
    } else if (
      Notification.permission ===
      "default"
    ) {
      setVisible(true);
    }
  }, []);


  const activate =
    async () => {
      setBusy(true);

      try {
        await registerPush(true);
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Activation impossible."
        );
      } finally {
        setBusy(false);
      }
    };


  if (!visible) {
    return null;
  }


  return (
    <div className="fixed bottom-20 left-1/2 z-[9900] w-[min(92vw,430px)] -translate-x-1/2 rounded-2xl border border-yellow-400 bg-white p-4 shadow-2xl print:hidden">

      <div className="flex gap-3">

        <div className="text-3xl">
          🔔
        </div>

        <div className="flex-1">

          <div className="font-black">
            Activer les notifications Triangle
          </div>

          <p className="mt-1 text-sm text-slate-600">
            Recevez messages, fichiers,
            validations et appels même
            lorsque Triangle n'est pas ouvert.
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={activate}
            className="mt-3 rounded-xl bg-yellow-500 px-4 py-2 font-black text-black disabled:opacity-60"
          >
            {busy
              ? "Activation…"
              : "Activer sur cet appareil"}
          </button>

        </div>

      </div>

    </div>
  );
}
