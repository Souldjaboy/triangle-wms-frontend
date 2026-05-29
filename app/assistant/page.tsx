"use client";

import { useState } from "react";

export default function AssistantPage() {
  const [messages, setMessages] = useState<any[]>([
    {
      role: "assistant",
      content:
        "Bonjour, je suis l’assistant IA de Triangle WMS Pro. Je peux t’aider sur la logistique, les stocks, les inventaires, les documents, le pointage et l’organisation.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const savedUser = localStorage.getItem("user");
    const user = savedUser ? JSON.parse(savedUser) : null;

    const userMessage = {
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: input,
          user,
        }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || data.error || "Erreur IA.",
        },
      ]);
    } catch (error) {
      console.error(error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Erreur de connexion avec l’assistant IA.",
        },
      ]);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Assistant IA
      </h1>

      <p className="text-gray-500 mb-8">
        Assistant intelligent spécialisé en logistique, WMS, stock, inventaire,
        documents, RH et organisation.
      </p>

      <div className="bg-white rounded-2xl shadow p-6 h-[650px] flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-4 mb-5">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-3xl rounded-2xl p-4 whitespace-pre-wrap ${
                  message.role === "user"
                    ? "bg-yellow-500 text-black"
                    : "bg-gray-100 text-black"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="text-gray-500 font-bold">
              L’assistant réfléchit...
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Pose ta question à l’assistant IA..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            className="flex-1 border p-4 rounded-xl text-black"
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-black text-white font-bold px-8 rounded-xl"
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}