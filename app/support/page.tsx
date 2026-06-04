"use client";

import { useState } from "react";
import { apiUrl } from "../lib/api";
import WhatsAppSupportButton from "../../components/WhatsAppSupportButton";

export default function SupportPage() {
  const [form, setForm] = useState({
    name: "",
    entreprise: "",
    email: "",
    phone: "",
    message: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: any) => {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    setError("");

    try {
      const response = await fetch(apiUrl("/support/contact"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source_page: typeof window !== "undefined" ? window.location.pathname : "/support",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Erreur support.");
        return;
      }
      setStatus("Demande support enregistrée.");
      setForm({ name: "", entreprise: "", email: "", phone: "", message: "" });
    } catch (err) {
      console.error(err);
      setError("Erreur serveur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-2xl">
        <h1 className="text-3xl font-bold">Support Triangle WMS Pro</h1>
        <p className="mt-2 text-gray-600">
          Envoyez une demande au support ou contactez directement WhatsApp.
        </p>

        {status && <div className="mt-5 rounded-xl bg-green-100 p-4 font-bold text-green-700">{status}</div>}
        {error && <div className="mt-5 rounded-xl bg-red-100 p-4 font-bold text-red-700">{error}</div>}

        <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            ["name", "Nom"],
            ["entreprise", "Entreprise"],
            ["email", "Email"],
            ["phone", "Téléphone"],
          ].map(([key, label]) => (
            <input
              key={key}
              value={(form as any)[key]}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              placeholder={label}
              className="rounded-xl border p-4 text-black"
            />
          ))}
          <textarea
            value={form.message}
            onChange={(event) => setForm({ ...form, message: event.target.value })}
            placeholder="Message"
            className="min-h-36 rounded-xl border p-4 text-black md:col-span-2"
            required
          />
          <button
            disabled={loading}
            className="rounded-xl bg-yellow-500 px-6 py-4 font-bold text-black md:col-span-2"
          >
            {loading ? "Envoi..." : "Envoyer la demande"}
          </button>
        </form>

        <div className="mt-5">
          <WhatsAppSupportButton className="w-full" />
        </div>
      </div>
    </main>
  );
}
