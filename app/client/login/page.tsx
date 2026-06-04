"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "../../lib/api";

export default function ClientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(apiUrl("/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Erreur connexion client.");
      if (String(data.user?.role || "").toLowerCase() !== "customer") {
        throw new Error("Ce compte n'est pas un compte client Marketplace.");
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      document.cookie = `triangle_token=${encodeURIComponent(data.token)}; path=/; max-age=86400; SameSite=Lax`;
      router.push("/client/dashboard");
    } catch (error: any) {
      setError(error?.message || "Erreur connexion client.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4 text-black">
      <form onSubmit={submit} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <h1 className="text-3xl font-black">Connexion client</h1>
        <p className="mt-2 text-gray-500">Accès panier, commandes, reçus et suivi Marketplace.</p>
        {error && <div className="mt-4 rounded-xl bg-red-50 p-3 font-bold text-red-700">{error}</div>}
        <div className="mt-5 grid gap-3">
          <input required className="rounded-xl border p-3" placeholder="Email ou téléphone" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input required className="rounded-xl border p-3" type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button disabled={loading} className="mt-5 w-full rounded-xl bg-yellow-500 p-3 font-black text-black">
          {loading ? "Connexion..." : "Se connecter"}
        </button>
        <div className="mt-4 flex justify-between text-sm font-bold">
          <Link href="/client/register">Créer un compte client</Link>
          <Link href="/login">Connexion entreprise</Link>
        </div>
      </form>
    </main>
  );
}
