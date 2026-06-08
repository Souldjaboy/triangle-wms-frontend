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
      localStorage.removeItem("business_token");
      localStorage.removeItem("business_user");
      localStorage.removeItem("admin_token");
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("client_token", data.token);
      localStorage.setItem("client_user", JSON.stringify(data.user));
      document.cookie = "triangle_business_token=; path=/; max-age=0";
      document.cookie = `triangle_token=${encodeURIComponent(data.token)}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `triangle_client_token=${encodeURIComponent(data.token)}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = "triangle_role=customer; path=/; max-age=86400; SameSite=Lax";
      const redirect =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirect")
          : "";
      router.push(redirect || "/client/dashboard");
    } catch (error: any) {
      setError(error?.message || "Erreur connexion client.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-gray-100 text-black lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-black lg:block">
        <img
          src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80"
          alt="Client marketplace"
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="font-black text-yellow-400">Triangle Marketplace</p>
          <h1 className="mt-3 text-5xl font-black">Acheter simplement, suivre clairement.</h1>
          <p className="mt-4 max-w-md text-white/75">Connectez-vous pour retrouver votre panier, vos commandes et vos reçus.</p>
        </div>
      </section>
      <section className="flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <h1 className="text-3xl font-black">Connexion client</h1>
        <p className="mt-2 text-gray-500">Accès au panier, aux commandes, reçus et suivi Marketplace.</p>
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
          <Link href="/mot-de-passe-oublie?type=client">Mot de passe oublié</Link>
          <Link href="/login">Connexion entreprise</Link>
        </div>
      </form>
      </section>
    </main>
  );
}
