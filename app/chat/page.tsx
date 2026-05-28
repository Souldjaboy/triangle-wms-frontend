"use client";

import { useEffect, useRef, useState } from "react";

export default function ChatPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<any[]>([]);

  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const fetchUsers = async () => {
    const res = await fetch("http://localhost:5050/users", {
      headers: getHeaders(),
    });

    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
  };

  const fetchConversations = async (userId: number) => {
    const res = await fetch(
      `http://localhost:5050/chat/conversations/${userId}`,
      { headers: getHeaders() }
    );

    const data = await res.json();
    setConversations(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      fetchConversations(user.id);
    }

    fetchUsers();
  }, []);

  const fetchMessages = async (conversation: any) => {
    setSelectedConversation(conversation);

    const res = await fetch(
      `http://localhost:5050/chat/messages/${conversation.id}`,
      { headers: getHeaders() }
    );

    const data = await res.json();
    setMessages(Array.isArray(data) ? data : []);
  };

  const createConversation = async () => {
    if (!currentUser || !receiverId) {
      alert("Choisis un utilisateur.");
      return;
    }

    const receiver = users.find(
      (u: any) => String(u.id) === String(receiverId)
    );

    const res = await fetch("http://localhost:5050/chat/conversations", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        title: `${currentUser.fullname} / ${receiver?.fullname}`,
        type: "private",
        created_by: currentUser.id,
        participants: [currentUser.id, Number(receiverId)],
      }),
    });

    const conversation = await res.json();

    if (!res.ok) {
      alert(conversation.error || "Erreur création conversation.");
      return;
    }

    await fetchConversations(currentUser.id);
    await fetchMessages(conversation);
  };

  const sendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) return;

    await fetch("http://localhost:5050/chat/messages", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        conversation_id: selectedConversation.id,
        sender_id: currentUser.id,
        receiver_id: receiverId ? Number(receiverId) : null,
        content: newMessage,
        message_type: "text",
        audio_url: "",
      }),
    });

    setNewMessage("");
    fetchMessages(selectedConversation);
  };

  const startRecording = async () => {
    if (!selectedConversation) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        if (audioBlob.size === 0) {
          alert("Aucun son enregistré. Vérifie le micro.");
          return;
        }

        const formData = new FormData();
        formData.append("audio", audioBlob, "voice-message.webm");

        const uploadResponse = await fetch(
          "http://localhost:5050/chat/upload-audio",
          {
            method: "POST",
            body: formData,
          }
        );

        const uploadData = await uploadResponse.json();

        await fetch("http://localhost:5050/chat/messages", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            conversation_id: selectedConversation.id,
            sender_id: currentUser.id,
            receiver_id: receiverId ? Number(receiverId) : null,
            content: "",
            message_type: "audio",
            audio_url: uploadData.audio_url,
          }),
        });

        fetchMessages(selectedConversation);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
    } catch (error) {
      alert("Micro non autorisé ou indisponible.");
      console.error(error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="p-8 text-black">
        Vous devez être connecté.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">Chat interne</h1>

      <p className="text-gray-500 mb-8">
        Messages écrits, messages vocaux et réunions vidéo.
      </p>

      <div className="grid grid-cols-3 gap-8">
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-bold text-black mb-5">
            Nouvelle conversation
          </h2>

          <select
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
            className="border p-3 rounded-xl text-black w-full mb-4"
          >
            <option value="">Choisir utilisateur</option>

            {users
              .filter((u: any) => u.id !== currentUser.id)
              .map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.fullname} - {user.role}
                </option>
              ))}
          </select>

          <button
            onClick={createConversation}
            className="bg-yellow-500 text-black font-bold rounded-xl py-3 w-full mb-6"
          >
            Créer conversation
          </button>

          <h2 className="text-2xl font-bold text-black mb-5">
            Conversations
          </h2>

          {conversations.length === 0 ? (
            <p className="text-gray-500">Aucune conversation.</p>
          ) : (
            <div className="space-y-3">
              {conversations.map((conversation: any) => (
                <button
                  key={conversation.id}
                  onClick={() => fetchMessages(conversation)}
                  className={`w-full text-left border rounded-xl p-4 ${
                    selectedConversation?.id === conversation.id
                      ? "bg-yellow-100 border-yellow-500"
                      : "bg-white"
                  }`}
                >
                  <p className="font-bold text-black">
                    {conversation.title}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-2 bg-white rounded-2xl shadow p-6 flex flex-col h-[650px]">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Sélectionne ou crée une conversation.
            </div>
          ) : (
            <>
              <div className="border-b pb-4 mb-4">
                <h2 className="text-2xl font-bold text-black">
                  {selectedConversation.title}
                </h2>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => {
                      const roomName = `Triangle-WMS-Conversation-${selectedConversation.id}`;
                      window.open(
                        `https://meet.jit.si/${roomName}`,
                        "_blank"
                      );
                    }}
                    className="bg-green-600 text-white px-5 py-2 rounded-xl font-bold"
                  >
                    🎥 Vidéo
                  </button>

                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`px-5 py-2 rounded-xl font-bold ${
                      isRecording
                        ? "bg-red-600 text-white"
                        : "bg-black text-white"
                    }`}
                  >
                    {isRecording ? "⏹ Stop" : "🎤 Vocal"}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {messages.length === 0 ? (
                  <p className="text-gray-500">
                    Aucun message pour le moment.
                  </p>
                ) : (
                  messages.map((message: any) => {
                    const mine = message.sender_id === currentUser.id;

                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          mine ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-lg rounded-2xl p-4 ${
                            mine
                              ? "bg-yellow-500 text-black"
                              : "bg-gray-100 text-black"
                          }`}
                        >
                          {!mine && (
                            <p className="text-sm font-bold mb-2">
                              {message.sender_name} ({message.sender_role})
                            </p>
                          )}

                          {message.message_type === "audio" &&
                          message.audio_url ? (
                            <audio
                              controls
                              src={message.audio_url}
                              className="mt-2 w-full"
                            />
                          ) : (
                            <p>{message.content}</p>
                          )}

                          <p className="text-xs opacity-70 mt-2">
                            {message.created_at
                              ? new Date(message.created_at).toLocaleString(
                                  "fr-FR"
                                )
                              : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendMessage();
                  }}
                  placeholder="Écrire un message..."
                  className="flex-1 border p-4 rounded-xl text-black"
                />

                <button
                  type="button"
                  onClick={sendMessage}
                  className="bg-black text-white font-bold px-8 rounded-xl"
                >
                  Envoyer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
