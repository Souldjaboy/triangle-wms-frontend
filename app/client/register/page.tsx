"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "../../lib/api";

export default function ClientRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullname: "", phone: "", email: "", password: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (form.password !== confirmPassword) {
      setMessage("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(apiUrl("/marketplace/customers/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Erreur inscription client.");
      const query = new URLSearchParams();
      if (payload.verification?.target_type) query.set("type", payload.verification.target_type);
      if (payload.verification?.target_value) query.set("target", payload.verification.target_value);
      if (payload.user?.id) query.set("user_id", String(payload.user.id));
      router.push(`/verification-required?${query.toString()}`);
    } catch (error: any) {
      setMessage(error?.message || "Erreur inscription client.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4 text-black">
      <form onSubmit={submit} className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <h1 className="text-3xl font-black">Créer un compte client</h1>
        <p className="mt-2 text-gray-500">Compte particulier pour commander sur Triangle Marketplace.</p>
        {message && <div className="mt-4 rounded-xl bg-red-50 p-3 font-bold text-red-700">{message}</div>}
        <div className="mt-5 grid gap-3">
          <input required className="rounded-xl border p-3" placeholder="Nom complet" value={form.fullname} onChange={(e) => setForm({ ...form, fullname: e.target.value })} />
          <input required className="rounded-xl border p-3" placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="rounded-xl border p-3" placeholder="Email optionnel" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input required className="rounded-xl border p-3" type="password" placeholder="Mot de passe" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input required className="rounded-xl border p-3" type="password" placeholder="Confirmer mot de passe" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <button disabled={loading} className="mt-5 w-full rounded-xl bg-yellow-500 p-3 font-black text-black">
          {loading ? "Création..." : "Créer mon compte client"}
        </button>
        <div className="mt-4 flex justify-between text-sm font-bold">
          <Link href="/client/login">Déjà client ? Connexion</Link>
          <Link href="/marketplace">Voir le marketplace</Link>
        </div>
      </form>
    </main>
  );
}
