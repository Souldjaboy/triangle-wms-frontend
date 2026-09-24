"use client";

/* TRIANGLE_ANTI_SHAKE_V1 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  authFetch,
} from "../app/lib/api";
import { usePermissions } from "../app/lib/permissions";
import { moduleForInternalUrl } from "../app/lib/route-access";

type NotificationItem = {
  id: number;
  user_id?: number;
  title?: string;
  message?: string;
  type?: string;
  is_read?: boolean;
  status?: string;
  priority?: string;
  action_url?: string;
  created_at?: string;
  related_entity_type?: string;
  related_entity_id?: number;
};

function readCurrentUser() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  const raw =
    localStorage.getItem(
      "business_user"
    ) ||
    localStorage.getItem(
      "user"
    ) ||
    localStorage.getItem(
      "admin_user"
    );

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function GlobalTriangleNotifications() {
  const { can, loading: permissionsLoading } = usePermissions();
  /* TRIANGLE_HIDE_PRIVATE_NOTIFICATIONS_ON_AUTH_V2 */

  const canShowPrivateNotifications =
    () => {
      if (
        typeof window === "undefined"
      ) {
        return false;
      }

      const path =
        window.location.pathname;

      if (
        path.startsWith("/login") ||
        path.startsWith("/register") ||
        path.startsWith("/verification") ||
        path.startsWith("/mot-de-passe")
      ) {
        return false;
      }

      const token =
        localStorage.getItem("business_token") ||
        localStorage.getItem("token");

      const user =
        localStorage.getItem("business_user") ||
        localStorage.getItem("user");

      return Boolean(
        token &&
        user
      );
    };

  const [
    notifications,
    setNotifications,
  ] =
    useState<
      NotificationItem[]
    >([]);

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    incomingCall,
    setIncomingCall,
  ] =
    useState<
      NotificationItem | null
    >(null);

  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<any>(null);

  const knownIds =
    useRef<Set<number>>(
      new Set()
    );

  const initialized =
    useRef(false);

  const ringtoneRef =
    useRef<
      HTMLAudioElement | null
    >(null);

  const pollRef =
    useRef<
      ReturnType<
        typeof setInterval
      > | null
    >(null);


  const unreadCount =
    useMemo(
      () =>
        notifications.filter(
          (n) =>
            !n.is_read &&
            n.status !==
              "read"
        ).length,

      [notifications]
    );


  const stopRingtone =
    () => {
      try {
        ringtoneRef
          .current
          ?.pause();

        if (
          ringtoneRef.current
        ) {
          ringtoneRef.current.currentTime =
            0;
        }
      } catch {}
    };


  const playRingtone =
    async () => {
      try {
        if (
          !ringtoneRef.current
        ) {
          /*
           * Son généré directement par le navigateur.
           * Aucun fichier audio externe requis.
           */
          const AudioContextClass =
            window.AudioContext ||
            (window as any)
              .webkitAudioContext;

          if (!AudioContextClass) {
            return;
          }

          const ctx =
            new AudioContextClass();

          const oscillator =
            ctx.createOscillator();

          const gain =
            ctx.createGain();

          oscillator.type =
            "sine";

          oscillator.frequency.value =
            720;

          gain.gain.value =
            0.08;

          oscillator.connect(
            gain
          );

          gain.connect(
            ctx.destination
          );

          oscillator.start();

          const interval =
            window.setInterval(
              () => {
                gain.gain.value =
                  gain.gain.value >
                  0
                    ? 0
                    : 0.08;
              },
              450
            );

          ringtoneRef.current =
            {
              pause() {
                clearInterval(
                  interval
                );

                try {
                  oscillator.stop();
                  ctx.close();
                } catch {}
              },

              currentTime: 0,
            } as any;
        }
      } catch (error) {
        console.warn(
          "Sonnerie non disponible",
          error
        );
      }
    };


  const markRead =
    async (
      notification:
        NotificationItem
    ) => {
      if (
        notification.is_read ||
        notification.status ===
          "read"
      ) {
        return;
      }

      try {
        await authFetch(
          `/notifications/${notification.id}/read`,
          {
            method:
              "PUT",
          }
        );

        setNotifications(
          (previous) =>
            previous.map(
              (item) =>
                item.id ===
                notification.id
                  ? {
                      ...item,
                      is_read:
                        true,
                      status:
                        "read",
                    }
                  : item
            )
        );
      } catch (
        error
      ) {
        console.error(
          "Notification lecture",
          error
        );
      }
    };


  const fetchNotifications =
    async () => {
      const user =
        readCurrentUser();

      if (
        !user?.id
      ) {
        return;
      }
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

        const list:
          NotificationItem[] =
          Array.isArray(data)
            ? data
            : [];

        setNotifications((previous) =>
          JSON.stringify(previous) === JSON.stringify(list)
            ? previous
            : list
        );

        /*
         * Premier chargement :
         * on mémorise l'existant,
         * sans faire sonner les
         * centaines d'anciennes notifications.
         */
        if (
          !initialized.current
        ) {
          list.forEach(
            (n) =>
              knownIds.current.add(
                Number(n.id)
              )
          );

          initialized.current =
            true;

          /*
           * Cependant un appel très récent
           * (moins de 90 sec) peut être présenté
           * même au premier chargement.
           */
          const now =
            Date.now();

          const recentCall =
            list.find(
              (n) => {
                if (
                  n.type !==
                  "chat_call"
                ) {
                  return false;
                }

                if (
                  n.is_read ||
                  n.status ===
                    "read"
                ) {
                  return false;
                }

                const time =
                  n.created_at
                    ? new Date(
                        n.created_at
                      ).getTime()
                    : 0;

                return (
                  time > 0 &&
                  now - time <
                    90000
                );
              }
            );

          if (
            recentCall
          ) {
            setIncomingCall(
              recentCall
            );

            playRingtone();
          }

          return;
        }


        /*
         * Après initialisation :
         * identifier uniquement
         * les nouvelles notifications.
         */
        const fresh =
          list
            .filter(
              (n) =>
                !knownIds.current.has(
                  Number(n.id)
                )
            )
            .reverse();

        for (
          const item
          of fresh
        ) {
          knownIds.current.add(
            Number(item.id)
          );

          if (
            item.type ===
            "chat_call"
          ) {
            setIncomingCall(
              item
            );

            playRingtone();
          } else {
            /*
             * Notification navigateur
             * si permission accordée.
             */
            if (
              "Notification" in
                window &&
              Notification.permission ===
                "granted"
            ) {
              try {
                new Notification(
                  item.title ||
                    "Triangle WMS",
                  {
                    body:
                      item.message ||
                      "",
                  }
                );
              } catch {}
            }
          }
        }
      } catch (
        error
      ) {
        console.error(
          "Polling notifications",
          error
        );
      }
    };


  useEffect(() => {
    const user =
      readCurrentUser();

    if (
      !user?.id
    ) {
      return;
    }

    setCurrentUser(
      user
    );

    /*
     * Demander l'autorisation
     * notifications du navigateur.
     */
    if (
      "Notification" in
        window &&
      Notification.permission ===
        "default"
    ) {
      Notification
        .requestPermission()
        .catch(() => {});
    }

    fetchNotifications();

    /*
     * 2 secondes :
     * suffisamment rapide pour
     * les appels entrants sans
     * installer Socket.IO immédiatement.
     */
    pollRef.current =
      setInterval(fetchNotifications, 10000);

    return () => {
      if (
        pollRef.current
      ) {
        clearInterval(
          pollRef.current
        );
      }

      stopRingtone();
    };
  }, []);


  const openNotification =
    async (
      item:
        NotificationItem
    ) => {
      await markRead(
        item
      );

      if (
        item.action_url
      ) {
        const requiredModule = moduleForInternalUrl(item.action_url);
        if (requiredModule && (permissionsLoading || !can(requiredModule, "view"))) {
          window.alert("Accès refusé : vous n’avez pas la permission d’ouvrir ce module.");
          return;
        }
        window.location.assign(item.action_url);
      }
    };


  const answerCall =
    async () => {
      if (
        !incomingCall
      ) {
        return;
      }

      stopRingtone();

      await markRead(
        incomingCall
      );

      const url =
        incomingCall.action_url ||
        "/chat";

      const requiredModule = moduleForInternalUrl(url);
      if (requiredModule && (permissionsLoading || !can(requiredModule, "view"))) {
        setIncomingCall(null);
        window.alert("Accès refusé : vous n’avez pas la permission d’ouvrir ce module.");
        return;
      }

      setIncomingCall(
        null
      );

      window.location.href =
        url;
    };


  const rejectCall =
    async () => {
      if (
        !incomingCall
      ) {
        return;
      }

      stopRingtone();

      await markRead(
        incomingCall
      );

      setIncomingCall(
        null
      );
    };


  if (
    !currentUser ||
    !canShowPrivateNotifications()
  ) {
    return null;
  }


  return (
    <>
      {/* CLOCHE GLOBALE */}
      <div className="fixed right-4 top-4 z-[9500] print:hidden">

        <button
          type="button"
          onClick={() =>
            setOpen(
              !open
            )
          }
          className="relative flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-xl text-white shadow-xl"
          title="Notifications Triangle"
        >
          🔔

          {unreadCount >
            0 && (
            <span className="absolute -right-2 -top-2 min-w-6 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-xs font-black text-white">
              {unreadCount >
              99
                ? "99+"
                : unreadCount}
            </span>
          )}
        </button>


        {open && (
          <div className="mt-2 max-h-[75vh] w-[min(92vw,420px)] overflow-y-auto rounded-2xl border bg-white shadow-2xl">

            <div className="sticky top-0 flex items-center justify-between border-b bg-white p-4">

              <div>
                <div className="font-black">
                  Notifications
                </div>

                <div className="text-xs text-slate-500">
                  {unreadCount} non lue
                  {unreadCount >
                  1
                    ? "s"
                    : ""}
                </div>
              </div>

              <a
                href="/notifications"
                className="text-sm font-bold text-blue-700"
              >
                Tout voir
              </a>
            </div>


            <div>
              {notifications
                .slice(
                  0,
                  30
                )
                .map(
                  (
                    item
                  ) => {
                    const unread =
                      !item.is_read &&
                      item.status !==
                        "read";

                    return (
                      <button
                        key={
                          item.id
                        }
                        type="button"
                        onClick={() =>
                          openNotification(
                            item
                          )
                        }
                        className={`block w-full border-b p-4 text-left hover:bg-slate-50 ${
                          unread
                            ? "bg-yellow-50"
                            : "bg-white"
                        }`}
                      >
                        <div className="flex gap-3">

                          <div className="text-xl">
                            {item.type ===
                            "chat_call"
                              ? "📞"
                              : item.type ===
                                "chat_message"
                                ? "💬"
                                : item.type ===
                                  "chat_audio"
                                  ? "🎤"
                                  : item.type ===
                                    "finance"
                                    ? "💰"
                                    : "🔔"}
                          </div>

                          <div className="min-w-0 flex-1">

                            <div className="font-black">
                              {item.title ||
                                "Notification"}
                            </div>

                            <div className="mt-1 text-sm text-slate-600">
                              {item.message}
                            </div>

                            {item.created_at && (
                              <div className="mt-2 text-[11px] text-slate-400">
                                {new Date(
                                  item.created_at
                                ).toLocaleString(
                                  "fr-FR"
                                )}
                              </div>
                            )}

                          </div>

                          {unread && (
                            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-red-600" />
                          )}
                        </div>
                      </button>
                    );
                  }
                )}

              {!notifications.length && (
                <div className="p-8 text-center text-slate-500">
                  Aucune notification.
                </div>
              )}
            </div>
          </div>
        )}
      </div>


      {/* APPEL ENTRANT GLOBAL */}
      {incomingCall && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/65 p-4 print:hidden">

          <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl">

            <div className="mx-auto mb-5 flex h-24 w-24 animate-pulse items-center justify-center rounded-full bg-emerald-100 text-5xl">
              📞
            </div>

            <div className="text-xs font-black uppercase tracking-widest text-emerald-700">
              Appel entrant
            </div>

            <h2 className="mt-2 text-2xl font-black">
              {incomingCall.title ||
                "Appel Triangle"}
            </h2>

            <p className="mt-3 text-slate-600">
              {incomingCall.message ||
                "Un utilisateur Triangle vous appelle."}
            </p>


            <div className="mt-8 grid grid-cols-2 gap-4">

              <button
                type="button"
                onClick={
                  rejectCall
                }
                className="rounded-2xl bg-red-600 px-5 py-4 text-lg font-black text-white"
              >
                ❌ Refuser
              </button>


              <button
                type="button"
                onClick={
                  answerCall
                }
                className="rounded-2xl bg-emerald-600 px-5 py-4 text-lg font-black text-white"
              >
                📞 Répondre
              </button>

            </div>

          </div>
        </div>
      )}
    </>
  );
}
