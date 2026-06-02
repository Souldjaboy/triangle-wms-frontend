"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "../lib/api";
import InstallPWAButton from "../../components/InstallPWAButton";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: any) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(apiUrl("/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erreur connexion");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      const isSuperAdmin =
        data.user?.is_super_admin === true ||
        data.user?.is_super_admin === "true" ||
        data.user?.is_super_admin === 1 ||
        String(data.user?.role || "").toLowerCase() === "super_admin";

      document.cookie = `triangle_token=${encodeURIComponent(data.token)}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `triangle_super_admin=${isSuperAdmin ? "true" : "false"}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `triangle_subscription_status=${encodeURIComponent(data.user?.subscription_status || "")}; path=/; max-age=86400; SameSite=Lax`;

      const subscriptionStatus = String(data.user?.subscription_status || "").toLowerCase();
      if (
        !isSuperAdmin &&
        ["expired", "expiré", "expire", "suspended", "suspendu", "inactive", "inactif"].includes(subscriptionStatus)
      ) {
        router.push("/abonnement-expire");
        return;
      }

      router.push("/dashboard");
    } catch (error) {
      console.error(error);
      setError("Erreur serveur");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 md:p-8">
      <div className="bg-white shadow-2xl rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 max-w-6xl w-full">
        <div className="bg-black text-white p-8 md:p-12 flex flex-col justify-center">
          <h1 className="text-5xl font-bold mb-5">
            Triangle WMS Pro
          </h1>

          <p className="text-gray-300 text-lg">
            Gestion professionnelle des stocks, entrepôts, inventaires,
            documents logistiques et abonnements SaaS.
          </p>

          <div className="mt-10">
            <div className="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center text-5xl">
              👤
            </div>

            <p className="mt-5 text-gray-400">
              Connectez-vous pour accéder à votre espace sécurisé.
            </p>
          </div>
        </div>

        <div className="p-8 md:p-12 flex flex-col justify-center">
          <h2 className="text-4xl font-bold text-black mb-8">
            Connexion
          </h2>

          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded-xl mb-5 font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-black font-bold mb-2">
                Email
              </label>

              <input
                type="email"
                placeholder="Votre email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border p-4 rounded-xl text-black"
                required
              />
            </div>

            <div>
              <label className="block text-black font-bold mb-2">
                Mot de passe
              </label>

              <input
                type="password"
                placeholder="Votre mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border p-4 rounded-xl text-black"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>

          <p className="text-gray-500 text-sm mt-5 text-center">
            Pas encore de compte ?{" "}
            <a href="/register" className="text-blue-600 font-bold">
              Créer une entreprise
            </a>
          </p>

          <a
            href="/register"
            className="mt-4 block w-full bg-black text-white text-center font-bold py-4 rounded-xl"
          >
            Créer une entreprise
          </a>

          <div className="mt-4 flex justify-center">
            <InstallPWAButton />
          </div>
        </div>
      </div>
    </div>
  );
}
