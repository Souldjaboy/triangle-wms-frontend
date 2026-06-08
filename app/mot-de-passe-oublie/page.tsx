"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { apiUrl } from "../lib/api";

function MotDePasseOublieContent() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") || "";
  const initialAccountType = searchParams.get("type") || "enterprise";
  const [accountType, setAccountType] = useState(initialAccountType === "client" ? "client" : "enterprise");
  const [identifier, setIdentifier] = useState("");
  const [token, setToken] = useState(initialToken);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const hasResetAccess = useMemo(() => Boolean(token || code.trim()), [token, code]);

  const requestReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(apiUrl("/password-reset/request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          account_type: accountType,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Erreur demande réinitialisation.");
      setMessage(data.message || "Si ce compte existe, un code de réinitialisation a été envoyé.");
    } catch (error: any) {
      setError(error?.message || "Erreur serveur.");
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(apiUrl("/password-reset/confirm"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token || undefined,
          code: code || undefined,
          identifier,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Erreur confirmation réinitialisation.");
      setMessage(data.message || "Mot de passe réinitialisé. Vous pouvez vous connecter.");
      setCode("");
      setToken("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      setError(error?.message || "Erreur serveur.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <section className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid lg:grid-cols-2">
        <div className="bg-black p-8 text-white md:p-10">
          <p className="font-black text-yellow-400">Triangle WMS Pro</p>
          <h1 className="mt-4 text-4xl font-black">Réinitialiser le mot de passe</h1>
          <p className="mt-4 text-white/75">
            Recevez un code sécurisé par email. Si le SMS ou WhatsApp est configuré, le téléphone pourra aussi être utilisé.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-white/80">
            <p className="rounded-xl bg-white/10 p-4">Le code expire après 15 minutes.</p>
            <p className="rounded-xl bg-white/10 p-4">Les anciens codes sont invalidés automatiquement.</p>
            <p className="rounded-xl bg-white/10 p-4">Aucun mot de passe n’est envoyé par email.</p>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {message && <div className="mb-4 rounded-xl bg-green-100 p-4 font-bold text-green-700">{message}</div>}
          {error && <div className="mb-4 rounded-xl bg-red-100 p-4 font-bold text-red-700">{error}</div>}

          <form onSubmit={requestReset} className="grid gap-4">
            <h2 className="text-2xl font-black">1. Demander un code</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`cursor-pointer rounded-xl border p-4 font-bold ${accountType === "enterprise" ? "border-yellow-500 bg-yellow-50" : ""}`}>
                <input
                  type="radio"
                  className="mr-2"
                  checked={accountType === "enterprise"}
                  onChange={() => setAccountType("enterprise")}
                />
                Compte entreprise
              </label>
              <label className={`cursor-pointer rounded-xl border p-4 font-bold ${accountType === "client" ? "border-yellow-500 bg-yellow-50" : ""}`}>
                <input
                  type="radio"
                  className="mr-2"
                  checked={accountType === "client"}
                  onChange={() => setAccountType("client")}
                />
                Compte client
              </label>
            </div>
            <input
              className="rounded-xl border p-4"
              placeholder="Email ou téléphone"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
            />
            <button disabled={loading} className="rounded-xl bg-yellow-500 py-4 font-black text-black disabled:opacity-50">
              {loading ? "Envoi..." : "Envoyer le code"}
            </button>
          </form>

          <form onSubmit={confirmReset} className="mt-8 grid gap-4 border-t pt-6">
            <h2 className="text-2xl font-black">2. Créer un nouveau mot de passe</h2>
            {!token && (
              <input
                className="rounded-xl border p-4"
                placeholder="Code reçu"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
              />
            )}
            {token && <div className="rounded-xl bg-yellow-50 p-4 font-bold text-yellow-800">Lien sécurisé détecté.</div>}
            <input
              type="password"
              className="rounded-xl border p-4"
              placeholder="Nouveau mot de passe"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <input
              type="password"
              className="rounded-xl border p-4"
              placeholder="Confirmer le nouveau mot de passe"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            <button disabled={loading || !hasResetAccess} className="rounded-xl bg-black py-4 font-black text-white disabled:opacity-50">
              {loading ? "Validation..." : "Réinitialiser"}
            </button>
          </form>

          <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold">
            <Link href="/login" className="text-yellow-700">Connexion entreprise</Link>
            <Link href="/client/login" className="text-yellow-700">Connexion client</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function MotDePasseOubliePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gray-100 p-8 font-bold text-black">Chargement...</main>}>
      <MotDePasseOublieContent />
    </Suspense>
  );
}
