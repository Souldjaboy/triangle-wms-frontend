"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  authFetch,
} from "../app/lib/api";

type NotificationItem = {
  id: number;
  title?: string;
  message?: string;
  type?: string;
  action_url?: string;
  created_at?: string;
  is_read?: boolean;
  status?: string;
};

function currentUser() {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  const raw =
    localStorage.getItem(
      "business_user"
    ) ||
    localStorage.getItem(
      "user"
    );

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}


export default function ChatRealtimeBridge() {
  const [
    toast,
    setToast,
  ] =
    useState<
      NotificationItem | null
    >(null);

  const initialized =
    useRef(false);

  const knownIds =
    useRef<
      Set<number>
    >(new Set());


  useEffect(() => {
    const user =
      currentUser();

    if (!user?.id) {
      return;
    }

    const path =
      window.location.pathname;

    /*
     * Ne jamais afficher de contenu privé
     * sur les écrans de connexion.
     */
    if (
      path.startsWith("/login") ||
      path.startsWith("/register") ||
      path.startsWith("/verification")
    ) {
      return;
    }

    let alive = true;


    const check =
      async () => {
        try {
          const res =
            await authFetch(
              `/notifications/${user.id}`,
              {
                cache:
                  "no-store",
              }
            );

          if (!res.ok) {
            return;
          }

          const data =
            await res
              .json()
              .catch(
                () => []
              );

          if (
            !alive ||
            !Array.isArray(data)
          ) {
            return;
          }

          /*
           * Au premier chargement :
           * mémoriser l'ancien historique
           * sans faire apparaître 500 popups.
           */
          if (
            !initialized.current
          ) {
            data.forEach(
              (
                item:
                  NotificationItem
              ) => {
                knownIds.current.add(
                  Number(item.id)
                );
              }
            );

            initialized.current =
              true;

            return;
          }


          const fresh =
            data.filter(
              (
                item:
                  NotificationItem
              ) =>
                !knownIds.current.has(
                  Number(item.id)
                )
            );

          for (
            const item
            of fresh
          ) {
            knownIds.current.add(
              Number(item.id)
            );
          }


          /*
           * Les appels ont déjà leur popup
           * plein écran dans
           * GlobalTriangleNotifications.
           *
           * Ici on s'occupe des messages,
           * vocaux, fichiers et documents.
           */
          const newest =
            fresh.find(
              (
                item:
                  NotificationItem
              ) =>
                [
                  "chat_message",
                  "chat_audio",
                ].includes(
                  String(
                    item.type ||
                    ""
                  )
                )
            );

          if (newest) {
            setToast(
              newest
            );

            /*
             * Masquage automatique après 8 s,
             * sauf si utilisateur clique avant.
             */
            window.setTimeout(
              () => {
                setToast(
                  (
                    current
                  ) =>
                    current?.id ===
                    newest.id
                      ? null
                      : current
                );
              },
              8000
            );
          }
        } catch (
          error
        ) {
          console.warn(
            "CHAT NOTIFICATION POLL:",
            error
          );
        }
      };


    check();

    const timer =
      window.setInterval(
        /* TRIANGLE_CHAT_ANTI_SHAKE_V1 */
        check,
        10000
      );


    return () => {
      alive = false;

      window.clearInterval(
        timer
      );
    };
  }, []);


  const openToast =
    async () => {
      if (!toast) {
        return;
      }

      try {
        await authFetch(
          `/notifications/${toast.id}/read`,
          {
            method:
              "PUT",
          }
        );
      } catch {}


      const target =
        toast.action_url &&
        toast.action_url.startsWith("/") &&
        !toast.action_url.startsWith("//")
          ? toast.action_url
          : "/chat";


      setToast(null);

      window.location.href =
        target;
  };


  if (!toast) {
    return null;
  }


  return (
    <button
      type="button"
      onClick={
        openToast
      }
      className="fixed left-1/2 top-20 z-[9800] w-[min(92vw,460px)] -translate-x-1/2 rounded-2xl border border-yellow-400 bg-white p-4 text-left shadow-2xl print:hidden"
    >
      <div className="flex items-start gap-3">

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-2xl">
          {toast.type ===
          "chat_audio"
            ? "🎤"
            : "💬"}
        </div>


        <div className="min-w-0 flex-1">

          <div className="font-black text-slate-950">
            {toast.title ||
              "Nouveau message Triangle"}
          </div>

          <div className="mt-1 text-sm text-slate-600">
            {toast.message ||
              "Vous avez reçu un nouveau message."}
          </div>

          <div className="mt-2 text-xs font-bold text-blue-700">
            Cliquer pour ouvrir la conversation
          </div>

        </div>


        <div className="h-3 w-3 shrink-0 rounded-full bg-red-600" />

      </div>
    </button>
  );
}
