"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  authFetch,
} from "../lib/api";

type User = {
  id: number;
  fullname: string;
  email?: string;
  role?: string;
  profile_image_url?: string;
};

type Conversation = {
  id: number;
  title: string;
  type: "private" | "group";
  created_by: number;
  participant_count?: number;
  participant_names?: string;
};

export default function ChatPage() {
  const [currentUser, setCurrentUser] =
    useState<any>(null);

  const [users, setUsers] =
    useState<User[]>([]);

  const [
    conversations,
    setConversations,
  ] =
    useState<Conversation[]>([]);

  const [
    selectedConversation,
    setSelectedConversation,
  ] =
    useState<Conversation | null>(
      null
    );

  const [
    messages,
    setMessages,
  ] =
    useState<any[]>([]);

  const [
    participants,
    setParticipants,
  ] =
    useState<any[]>([]);

  const [
    newMessage,
    setNewMessage,
  ] =
    useState("");

  const [
    creationMode,
    setCreationMode,
  ] =
    useState<
      "private" | "group"
    >("private");

  const [
    selectedUsers,
    setSelectedUsers,
  ] =
    useState<number[]>([]);

  const [
    groupTitle,
    setGroupTitle,
  ] =
    useState("");

  const [
    showCreator,
    setShowCreator,
  ] =
    useState(false);

  const [
    showMembers,
    setShowMembers,
  ] =
    useState(false);

  const [
    isRecording,
    setIsRecording,
  ] =
    useState(false);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    uploading,
    setUploading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    info,
    setInfo,
  ] =
    useState("");

  const [
    shareUrl,
    setShareUrl,
  ] =
    useState("");

  const [
    shareTitle,
    setShareTitle,
  ] =
    useState("");

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const cameraInputRef =
    useRef<HTMLInputElement>(null);

  const mediaRecorderRef =
    useRef<MediaRecorder | null>(
      null
    );

  const audioChunksRef =
    useRef<Blob[]>([]);

  const messagesEndRef =
    useRef<HTMLDivElement>(null);


  const readCurrentUser = () => {
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
  };


  const json = async (
    res: Response
  ) =>
    res
      .json()
      .catch(() => ({}));


  const loadUsers = async () => {
    const res =
      await authFetch(
        "/chat/users",
        {
          cache: "no-store",
        }
      );

    const data =
      await json(res);

    if (!res.ok) {
      throw new Error(
        data.error ||
        "Impossible de charger les utilisateurs."
      );
    }

    setUsers(
      Array.isArray(data)
        ? data
        : []
    );
  };


  const loadConversations =
    async (
      userId: number
    ) => {
      const res =
        await authFetch(
          `/chat/conversations/${userId}`,
          {
            cache:
              "no-store",
          }
        );

      const data =
        await json(res);

      if (!res.ok) {
        throw new Error(
          data.error ||
          "Impossible de charger les conversations."
        );
      }

      const list =
        Array.isArray(data)
          ? data
          : [];

      setConversations(
        list
      );

      return list;
    };


  const loadParticipants =
    async (
      conversation:
        Conversation
    ) => {
      const res =
        await authFetch(
          `/chat/conversations/${conversation.id}/participants`,
          {
            cache:
              "no-store",
          }
        );

      const data =
        await json(res);

      if (res.ok) {
        setParticipants(
          Array.isArray(data)
            ? data
            : []
        );
      }
    };


  const loadMessages =
    async (
      conversation:
        Conversation
    ) => {
      setSelectedConversation(
        conversation
      );

      setError("");

      const res =
        await authFetch(
          `/chat/messages/${conversation.id}`,
          {
            cache:
              "no-store",
          }
        );

      const data =
        await json(res);

      if (!res.ok) {
        setError(
          data.error ||
          "Impossible de charger les messages."
        );
        return;
      }

      setMessages(
        Array.isArray(data)
          ? data
          : []
      );

      await loadParticipants(
        conversation
      );
    };


  useEffect(() => {
    const user =
      readCurrentUser();

    if (!user) {
      setError(
        "Vous devez être connecté."
      );
      return;
    }

    setCurrentUser(user);

    const params =
      new URLSearchParams(
        window.location.search
      );

    setShareUrl(
      params.get(
        "share_url"
      ) || ""
    );

    setShareTitle(
      params.get(
        "share_title"
      ) || ""
    );

    Promise.all([
      loadUsers(),

      loadConversations(
        Number(user.id)
      ),
    ])
      .then(
        ([, list]) => {
          const wanted =
            params.get(
              "conversation"
            );

          if (wanted) {
            const found =
              list.find(
                (
                  c:
                    Conversation
                ) =>
                  String(c.id) ===
                  wanted
              );

            if (found) {
              loadMessages(
                found
              );
            }
          }
        }
      )
      .catch(
        (e) =>
          setError(
            e.message
          )
      );
  }, []);


  useEffect(() => {
    messagesEndRef
      .current
      ?.scrollIntoView({
        behavior:
          "smooth",
      });
  }, [messages]);


  /*
   * CHAT_LIVE_REFRESH_V1
   *
   * Tant qu'une conversation est ouverte,
   * relire son historique toutes les 2 secondes.
   * Ainsi un message envoyé par l'autre personne
   * apparaît sans recharger la page.
   */
  useEffect(() => {
    const conversationId =
      Number(
        selectedConversation?.id || 0
      );

    if (!conversationId) {
      return;
    }

    let active = true;

    const refreshMessages =
      async () => {
        try {
          const res =
            await authFetch(
              `/chat/messages/${conversationId}`,
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
            active &&
            Array.isArray(data)
          ) {
            setMessages(
              data
            );
          }
        } catch (
          error
        ) {
          console.warn(
            "CHAT LIVE REFRESH:",
            error
          );
        }
      };

    refreshMessages();

    const timer =
      window.setInterval(
        refreshMessages,
        2000
      );

    return () => {
      active = false;

      window.clearInterval(
        timer
      );
    };
  }, [
    selectedConversation?.id
  ]);


  /*
   * Rafraîchir également la liste
   * des conversations.
   */
  useEffect(() => {
    const userId =
      Number(
        currentUser?.id || 0
      );

    if (!userId) {
      return;
    }

    const timer =
      window.setInterval(
        () => {
          loadConversations(
            userId
          ).catch(() => {});
        },
        5000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    currentUser?.id
  ]);


  const toggleUser = (
    id: number
  ) => {
    setSelectedUsers(
      (prev) =>
        prev.includes(id)
          ? prev.filter(
              (x) =>
                x !== id
            )
          : [
              ...prev,
              id,
            ]
    );
  };


  const createConversation =
    async () => {
      if (!currentUser) {
        return;
      }

      if (
        creationMode ===
          "private" &&
        selectedUsers.length !==
          1
      ) {
        setError(
          "Choisissez une personne."
        );
        return;
      }

      if (
        creationMode ===
          "group" &&
        selectedUsers.length <
          1
      ) {
        setError(
          "Choisissez au moins une personne."
        );
        return;
      }

      if (
        creationMode ===
          "group" &&
        !groupTitle.trim()
      ) {
        setError(
          "Donnez un nom au groupe."
        );
        return;
      }

      setBusy(true);
      setError("");

      try {
        const other =
          users.find(
            (u) =>
              u.id ===
              selectedUsers[0]
          );

        const title =
          creationMode ===
          "group"
            ? groupTitle.trim()
            : other
                ?.fullname ||
              "Conversation";

        const res =
          await authFetch(
            "/chat/conversations",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  title,

                  type:
                    creationMode,

                  participants:
                    [
                      Number(
                        currentUser.id
                      ),
                      ...selectedUsers,
                    ],
                }),
            }
          );

        const data =
          await json(res);

        if (!res.ok) {
          throw new Error(
            data.error ||
            "Erreur création conversation."
          );
        }

        await loadConversations(
          Number(
            currentUser.id
          )
        );

        setSelectedUsers(
          []
        );

        setGroupTitle("");

        setShowCreator(
          false
        );

        await loadMessages(
          data
        );
      } catch (e: any) {
        setError(
          e.message
        );
      } finally {
        setBusy(false);
      }
    };


  const postMessage =
    async (
      payload:
        Record<
          string,
          any
        >
    ) => {
      if (
        !selectedConversation
      ) {
        return false;
      }

      const res =
        await authFetch(
          "/chat/messages",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                conversation_id:
                  selectedConversation.id,

                ...payload,
              }),
          }
        );

      const data =
        await json(res);

      if (!res.ok) {
        setError(
          data.error ||
          "Erreur envoi message."
        );

        return false;
      }

      await loadMessages(
        selectedConversation
      );

      return true;
    };


  const sendText =
    async () => {
      const text =
        newMessage.trim();

      if (!text) return;

      setNewMessage("");

      const ok =
        await postMessage({
          content: text,

          message_type:
            "text",
        });

      if (!ok) {
        setNewMessage(
          text
        );
      }
    };


  const uploadFile =
    async (
      file: File
    ) => {
      if (
        !selectedConversation
      ) {
        setError(
          "Choisissez d'abord une conversation."
        );

        return;
      }

      setUploading(true);
      setError("");

      try {
        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        formData.append(
          "conversation_id",
          String(
            selectedConversation.id
          )
        );

        const res =
          await authFetch(
            "/chat/upload-file",
            {
              method:
                "POST",

              body:
                formData,
            }
          );

        const data =
          await json(res);

        if (!res.ok) {
          throw new Error(
            data.error ||
            "Erreur upload fichier."
          );
        }

        const ok =
          await postMessage({
            content: "",

            message_type:
              data.message_type ||
              "file",

            file_url:
              data.file_url,

            file_name:
              data.file_name,

            file_size:
              data.file_size,

            file_mime:
              data.file_mime,
          });

        if (ok) {
          setInfo(
            `${file.name} envoyé.`
          );
        }
      } catch (e: any) {
        setError(
          e.message
        );
      } finally {
        setUploading(false);
      }
    };


  const handleFileInput = (
    e:
      ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      e.target
        .files?.[0];

    if (file) {
      uploadFile(file);
    }

    e.target.value =
      "";
  };


  const startRecording =
    async () => {
      if (
        !selectedConversation
      ) {
        setError(
          "Choisissez une conversation."
        );
        return;
      }

      try {
        const stream =
          await navigator
            .mediaDevices
            .getUserMedia({
              audio: true,
            });

        const recorder =
          new MediaRecorder(
            stream
          );

        mediaRecorderRef.current =
          recorder;

        audioChunksRef.current =
          [];

        recorder.ondataavailable =
          (event) => {
            if (
              event.data.size >
              0
            ) {
              audioChunksRef.current.push(
                event.data
              );
            }
          };

        recorder.onstop =
          async () => {
            const blob =
              new Blob(
                audioChunksRef.current,
                {
                  type:
                    recorder.mimeType ||
                    "audio/webm",
                }
              );

            stream
              .getTracks()
              .forEach(
                (track) =>
                  track.stop()
              );

            if (!blob.size) {
              return;
            }

            const file =
              new File(
                [blob],
                `vocal-${Date.now()}.webm`,
                {
                  type:
                    blob.type ||
                    "audio/webm",
                }
              );

            await uploadFile(
              file
            );
          };

        recorder.start(
          500
        );

        setIsRecording(
          true
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        setError(
          "Microphone non autorisé ou indisponible."
        );
      }
    };


  const stopRecording =
    () => {
      mediaRecorderRef
        .current
        ?.stop();

      setIsRecording(
        false
      );
    };


  const launchCall =
    async (
      mode:
        "audio" |
        "video"
    ) => {
      if (
        !selectedConversation
      ) {
        return;
      }

      setBusy(true);
      setError("");

      try {
        const res =
          await authFetch(
            "/chat/calls",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  conversation_id:
                    selectedConversation.id,

                  mode,
                }),
            }
          );

        const data =
          await json(res);

        if (!res.ok) {
          throw new Error(
            data.error ||
            "Impossible de lancer l'appel."
          );
        }

        await loadMessages(
          selectedConversation
        );

        window.open(
          data.meeting_url,
          "_blank",
          "noopener,noreferrer"
        );
      } catch (e: any) {
        setError(
          e.message
        );
      } finally {
        setBusy(false);
      }
    };


  const sendSharedDocument =
    async () => {
      if (
        !selectedConversation ||
        !shareUrl
      ) {
        return;
      }

      const ok =
        await postMessage({
          content:
            "Document partagé depuis Triangle WMS",

          message_type:
            "document",

          document_url:
            shareUrl,

          document_title:
            shareTitle ||
            "Document Triangle WMS",
        });

      if (ok) {
        setShareUrl("");

        setShareTitle("");

        window.history
          .replaceState(
            {},
            "",
            `/chat?conversation=${selectedConversation.id}`
          );
      }
    };


  const addMember =
    async (
      userId: number
    ) => {
      if (
        !selectedConversation
      ) {
        return;
      }

      const res =
        await authFetch(
          `/chat/conversations/${selectedConversation.id}/participants`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                user_id:
                  userId,
              }),
          }
        );

      const data =
        await json(res);

      if (!res.ok) {
        setError(
          data.error ||
          "Impossible d'ajouter le membre."
        );
        return;
      }

      setParticipants(
        data.participants ||
          []
      );

      await loadConversations(
        Number(
          currentUser.id
        )
      );
    };


  const removeMember =
    async (
      userId: number
    ) => {
      if (
        !selectedConversation
      ) {
        return;
      }

      if (
        !confirm(
          "Retirer cette personne du groupe ?"
        )
      ) {
        return;
      }

      const res =
        await authFetch(
          `/chat/conversations/${selectedConversation.id}/participants/${userId}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await json(res);

      if (!res.ok) {
        setError(
          data.error ||
          "Impossible de retirer le membre."
        );
        return;
      }

      setParticipants(
        data.participants ||
          []
      );

      await loadConversations(
        Number(
          currentUser.id
        )
      );
    };


  const participantIds =
    useMemo(
      () =>
        new Set(
          participants.map(
            (p) =>
              Number(p.id)
          )
        ),

      [participants]
    );


  const formatBytes = (
    value: any
  ) => {
    const n =
      Number(
        value || 0
      );

    if (!n) return "";

    if (n < 1024) {
      return `${n} o`;
    }

    if (
      n <
      1024 * 1024
    ) {
      return `${(
        n / 1024
      ).toFixed(1)} Ko`;
    }

    if (
      n <
      1024 *
        1024 *
        1024
    ) {
      return `${(
        n /
        1024 /
        1024
      ).toFixed(1)} Mo`;
    }

    return `${(
      n /
      1024 /
      1024 /
      1024
    ).toFixed(1)} Go`;
  };


  const renderMessage =
    (
      message: any
    ) => {
      if (
        message.message_type ===
          "audio" &&
        (
          message.file_url ||
          message.audio_url
        )
      ) {
        return (
          <audio
            controls
            src={
              message.file_url ||
              message.audio_url
            }
            className="w-full max-w-sm"
          />
        );
      }

      if (
        message.message_type ===
          "image" &&
        message.file_url
      ) {
        return (
          <a
            href={
              message.file_url
            }
            target="_blank"
            rel="noreferrer"
          >
            <img
              src={
                message.file_url
              }
              alt={
                message.file_name ||
                "Photo"
              }
              className="max-h-80 max-w-full rounded-xl object-contain"
            />

            <div className="mt-2 text-xs">
              {
                message.file_name
              }
            </div>
          </a>
        );
      }

      if (
        message.message_type ===
          "video" &&
        message.file_url
      ) {
        return (
          <div>
            <video
              controls
              src={
                message.file_url
              }
              className="max-h-80 max-w-full rounded-xl"
            />

            <div className="mt-2 text-xs">
              {
                message.file_name
              }
            </div>
          </div>
        );
      }

      if (
        message.message_type ===
          "file" &&
        message.file_url
      ) {
        return (
          <a
            href={
              message.file_url
            }
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-current/20 p-3 font-bold underline"
          >
            📎{" "}
            {message.file_name ||
              "Fichier"}

            {message.file_size ? (
              <span className="ml-2 text-xs font-normal opacity-70">
                {formatBytes(
                  message.file_size
                )}
              </span>
            ) : null}
          </a>
        );
      }

      if (
        (
          message.message_type ===
            "document" ||
          message.message_type ===
            "call"
        ) &&
        message.document_url
      ) {
        return (
          <div>
            {message.content ? (
              <p className="mb-2">
                {
                  message.content
                }
              </p>
            ) : null}

            <a
              href={
                message.document_url
              }
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-current/20 p-3 font-black underline"
            >
              {message.message_type ===
              "call"
                ? "📞 "
                : "📄 "}

              {message.document_title ||
                "Ouvrir"}
            </a>
          </div>
        );
      }

      return (
        <p className="whitespace-pre-wrap break-words">
          {
            message.content
          }
        </p>
      );
    };


  if (!currentUser) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow">
          {error ||
            "Chargement du chat…"}
        </div>
      </main>
    );
  }


  return (
    <main className="min-h-screen bg-slate-100 p-3 text-slate-950 md:p-6">
      <div className="mx-auto max-w-7xl">

        <div className="mb-4">
          <h1 className="text-2xl font-black md:text-4xl">
            Chat interne
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Privé, groupes, documents,
            photos, vocaux et appels.
          </p>
        </div>


        {error && (
          <div className="mb-3 rounded-xl bg-red-100 p-3 font-bold text-red-800">
            {error}
          </div>
        )}


        {info && (
          <div className="mb-3 rounded-xl bg-emerald-100 p-3 font-bold text-emerald-800">
            {info}
          </div>
        )}


        <div className="grid gap-4 lg:grid-cols-3">

          <aside className="rounded-2xl bg-white p-4 shadow-sm">

            <button
              type="button"
              onClick={() =>
                setShowCreator(
                  !showCreator
                )
              }
              className="mb-4 w-full rounded-xl bg-yellow-500 px-4 py-3 font-black"
            >
              ＋ Nouvelle conversation
            </button>


            {showCreator && (
              <div className="mb-5 rounded-xl border p-3">

                <div className="mb-3 grid grid-cols-2 gap-2">

                  <button
                    type="button"
                    onClick={() => {
                      setCreationMode(
                        "private"
                      );

                      setSelectedUsers(
                        []
                      );
                    }}
                    className={`rounded-lg p-2 font-bold ${
                      creationMode ===
                      "private"
                        ? "bg-black text-white"
                        : "bg-slate-100"
                    }`}
                  >
                    👤 Privé
                  </button>


                  <button
                    type="button"
                    onClick={() => {
                      setCreationMode(
                        "group"
                      );

                      setSelectedUsers(
                        []
                      );
                    }}
                    className={`rounded-lg p-2 font-bold ${
                      creationMode ===
                      "group"
                        ? "bg-black text-white"
                        : "bg-slate-100"
                    }`}
                  >
                    👥 Groupe
                  </button>

                </div>


                {creationMode ===
                  "group" && (
                  <input
                    value={
                      groupTitle
                    }
                    onChange={(
                      e
                    ) =>
                      setGroupTitle(
                        e.target
                          .value
                      )
                    }
                    placeholder="Nom du groupe"
                    className="mb-3 w-full rounded-xl border p-3"
                  />
                )}


                <div className="max-h-60 space-y-2 overflow-y-auto">

                  {users
                    .filter(
                      (u) =>
                        Number(
                          u.id
                        ) !==
                        Number(
                          currentUser.id
                        )
                    )
                    .map(
                      (
                        user
                      ) => {
                        const checked =
                          selectedUsers.includes(
                            user.id
                          );

                        return (
                          <label
                            key={
                              user.id
                            }
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                              checked
                                ? "border-yellow-500 bg-yellow-50"
                                : ""
                            }`}
                          >
                            <input
                              type={
                                creationMode ===
                                "private"
                                  ? "radio"
                                  : "checkbox"
                              }
                              checked={
                                checked
                              }
                              onChange={() => {
                                if (
                                  creationMode ===
                                  "private"
                                ) {
                                  setSelectedUsers(
                                    [
                                      user.id,
                                    ]
                                  );
                                } else {
                                  toggleUser(
                                    user.id
                                  );
                                }
                              }}
                            />

                            <span>
                              <strong>
                                {
                                  user.fullname
                                }
                              </strong>

                              <span className="block text-xs text-slate-500">
                                {user.role ||
                                  ""}
                              </span>
                            </span>
                          </label>
                        );
                      }
                    )}
                </div>


                <button
                  type="button"
                  disabled={
                    busy
                  }
                  onClick={
                    createConversation
                  }
                  className="mt-3 w-full rounded-xl bg-black p-3 font-black text-white disabled:opacity-50"
                >
                  {creationMode ===
                  "group"
                    ? "Créer le groupe"
                    : "Démarrer la conversation"}
                </button>
              </div>
            )}


            <h2 className="mb-3 text-lg font-black">
              Conversations
            </h2>


            <div className="max-h-[65vh] space-y-2 overflow-y-auto">

              {conversations.map(
                (
                  conversation
                ) => (
                  <button
                    key={
                      conversation.id
                    }
                    type="button"
                    onClick={() =>
                      loadMessages(
                        conversation
                      )
                    }
                    className={`w-full rounded-xl border p-3 text-left ${
                      selectedConversation?.id ===
                      conversation.id
                        ? "border-yellow-500 bg-yellow-50"
                        : "bg-white"
                    }`}
                  >
                    <div className="font-black">
                      {conversation.type ===
                      "group"
                        ? "👥 "
                        : "👤 "}

                      {
                        conversation.title
                      }
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {conversation.type ===
                      "group"
                        ? `${
                            conversation.participant_count ||
                            0
                          } membres`
                        : conversation.participant_names ||
                          "Conversation privée"}
                    </div>
                  </button>
                )
              )}


              {!conversations.length && (
                <p className="text-sm text-slate-500">
                  Aucune conversation.
                </p>
              )}
            </div>

          </aside>


          <section className="flex min-h-[72vh] flex-col rounded-2xl bg-white shadow-sm lg:col-span-2">

            {!selectedConversation ? (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-slate-500">
                Choisissez ou créez une conversation.
              </div>
            ) : (
              <>

                <header className="border-b p-4">

                  <div className="flex flex-wrap items-center justify-between gap-3">

                    <div>
                      <h2 className="text-xl font-black">
                        {
                          selectedConversation.title
                        }
                      </h2>

                      <div className="text-xs text-slate-500">
                        {
                          participants.length
                        }{" "}
                        participant
                        {participants.length >
                        1
                          ? "s"
                          : ""}
                      </div>
                    </div>


                    <div className="flex flex-wrap gap-2">

                      <button
                        type="button"
                        onClick={() =>
                          launchCall(
                            "audio"
                          )
                        }
                        className="rounded-xl bg-emerald-600 px-3 py-2 font-bold text-white"
                      >
                        📞 Appel
                      </button>


                      <button
                        type="button"
                        onClick={() =>
                          launchCall(
                            "video"
                          )
                        }
                        className="rounded-xl bg-blue-600 px-3 py-2 font-bold text-white"
                      >
                        📹 Vidéo
                      </button>


                      <button
                        type="button"
                        onClick={() =>
                          setShowMembers(
                            !showMembers
                          )
                        }
                        className="rounded-xl bg-slate-900 px-3 py-2 font-bold text-white"
                      >
                        👥 Membres
                      </button>

                    </div>
                  </div>


                  {showMembers && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3">

                      <div className="space-y-2">

                        {participants.map(
                          (
                            participant
                          ) => (
                            <div
                              key={
                                participant.id
                              }
                              className="flex items-center justify-between rounded-lg bg-white p-2"
                            >
                              <div>
                                <strong>
                                  {
                                    participant.fullname
                                  }
                                </strong>

                                <span className="ml-2 text-xs text-slate-500">
                                  {participant.conversation_role ===
                                  "admin"
                                    ? "Administrateur"
                                    : participant.role ||
                                      ""}
                                </span>
                              </div>


                              {selectedConversation.type ===
                                "group" &&
                                Number(
                                  selectedConversation.created_by
                                ) ===
                                  Number(
                                    currentUser.id
                                  ) &&
                                Number(
                                  participant.id
                                ) !==
                                  Number(
                                    selectedConversation.created_by
                                  ) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeMember(
                                        participant.id
                                      )
                                    }
                                    className="text-xs font-bold text-red-600"
                                  >
                                    Retirer
                                  </button>
                                )}
                            </div>
                          )
                        )}
                      </div>


                      {selectedConversation.type ===
                        "group" &&
                        Number(
                          selectedConversation.created_by
                        ) ===
                          Number(
                            currentUser.id
                          ) && (
                          <div className="mt-3">

                            <div className="mb-2 text-xs font-bold uppercase text-slate-500">
                              Ajouter un membre
                            </div>

                            <div className="flex flex-wrap gap-2">

                              {users
                                .filter(
                                  (
                                    user
                                  ) =>
                                    !participantIds.has(
                                      Number(
                                        user.id
                                      )
                                    )
                                )
                                .map(
                                  (
                                    user
                                  ) => (
                                    <button
                                      type="button"
                                      key={
                                        user.id
                                      }
                                      onClick={() =>
                                        addMember(
                                          user.id
                                        )
                                      }
                                      className="rounded-lg border bg-white px-2 py-1 text-xs font-bold"
                                    >
                                      +{" "}
                                      {
                                        user.fullname
                                      }
                                    </button>
                                  )
                                )}
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                </header>


                {shareUrl && (
                  <div className="m-4 rounded-xl border-2 border-yellow-400 bg-yellow-50 p-4">

                    <div className="font-black">
                      📄 Document prêt à partager
                    </div>

                    <div className="mt-1 break-all text-sm">
                      {shareTitle ||
                        shareUrl}
                    </div>

                    <button
                      type="button"
                      onClick={
                        sendSharedDocument
                      }
                      className="mt-3 rounded-xl bg-yellow-500 px-4 py-2 font-black"
                    >
                      Envoyer dans cette conversation
                    </button>
                  </div>
                )}


                <div className="flex-1 space-y-3 overflow-y-auto p-4">

                  {messages.map(
                    (
                      message
                    ) => {
                      const mine =
                        Number(
                          message.sender_id
                        ) ===
                        Number(
                          currentUser.id
                        );

                      return (
                        <div
                          key={
                            message.id
                          }
                          className={`flex ${
                            mine
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[88%] rounded-2xl p-3 md:max-w-[70%] ${
                              mine
                                ? "bg-yellow-500 text-black"
                                : "bg-slate-100 text-slate-950"
                            }`}
                          >
                            {!mine && (
                              <div className="mb-1 text-xs font-black">
                                {
                                  message.sender_name
                                }
                              </div>
                            )}

                            {renderMessage(
                              message
                            )}

                            <div className="mt-2 text-[10px] opacity-60">
                              {message.created_at
                                ? new Date(
                                    message.created_at
                                  ).toLocaleString(
                                    "fr-FR"
                                  )
                                : ""}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}

                  <div
                    ref={
                      messagesEndRef
                    }
                  />
                </div>


                <footer className="border-t p-3">

                  <input
                    ref={
                      fileInputRef
                    }
                    type="file"
                    className="hidden"
                    onChange={
                      handleFileInput
                    }
                  />


                  <input
                    ref={
                      cameraInputRef
                    }
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={
                      handleFileInput
                    }
                  />


                  <div className="mb-2 flex flex-wrap gap-2">

                    <button
                      type="button"
                      disabled={
                        uploading
                      }
                      onClick={() =>
                        fileInputRef
                          .current
                          ?.click()
                      }
                      className="rounded-xl bg-slate-100 px-3 py-2 font-bold"
                    >
                      📎{" "}
                      {uploading
                        ? "Envoi…"
                        : "Fichier"}
                    </button>


                    <button
                      type="button"
                      disabled={
                        uploading
                      }
                      onClick={() =>
                        cameraInputRef
                          .current
                          ?.click()
                      }
                      className="rounded-xl bg-slate-100 px-3 py-2 font-bold"
                    >
                      📷 Photo
                    </button>


                    <button
                      type="button"
                      onClick={
                        isRecording
                          ? stopRecording
                          : startRecording
                      }
                      className={`rounded-xl px-3 py-2 font-bold ${
                        isRecording
                          ? "bg-red-600 text-white"
                          : "bg-slate-100"
                      }`}
                    >
                      {isRecording
                        ? "⏹ Arrêter"
                        : "🎤 Vocal"}
                    </button>

                  </div>


                  <div className="flex gap-2">

                    <textarea
                      value={
                        newMessage
                      }
                      onChange={(
                        e
                      ) =>
                        setNewMessage(
                          e.target.value
                        )
                      }
                      onKeyDown={(
                        e
                      ) => {
                        if (
                          e.key ===
                            "Enter" &&
                          !e.shiftKey
                        ) {
                          e.preventDefault();

                          sendText();
                        }
                      }}
                      rows={1}
                      placeholder="Écrire un message…"
                      className="min-h-12 flex-1 resize-none rounded-xl border p-3"
                    />


                    <button
                      type="button"
                      onClick={
                        sendText
                      }
                      className="rounded-xl bg-black px-5 font-black text-white"
                    >
                      Envoyer
                    </button>

                  </div>

                </footer>

              </>
            )}
          </section>

        </div>
      </div>
    </main>
  );
}
