"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "../lib/api";
import { productConfig } from "../lib/product-config";
import InstallPWAButton from "../../components/InstallPWAButton";
import WhatsAppSupportButton from "../../components/WhatsAppSupportButton";
import SocialAuthButtons from "../../components/SocialAuthButtons";

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
        if (data.code === "verification_required") {
          const query = new URLSearchParams();
          if (data.target_type) query.set("type", data.target_type);
          if (data.target_value) query.set("target", data.target_value);
          if (data.user_id) query.set("user_id", String(data.user_id));
          router.push(`/verification-required?${query.toString()}`);
          return;
        }

        if (data.code === "subscription_expired" || data.redirect === "/abonnement-expire") {
          router.push("/abonnement-expire");
          return;
        }

        setError(data.error || "Erreur connexion");
        setLoading(false);
        return;
      }

      if (String(data.user?.role || "").toLowerCase() === "customer") {
        setError("Ce compte est un compte client. Utilisez la connexion client.");
        setLoading(false);
        return;
      }

      localStorage.removeItem("client_token");
      localStorage.removeItem("client_user");
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("business_token", data.token);
      localStorage.setItem("business_user", JSON.stringify(data.user));

      const isSuperAdmin =
        data.user?.is_super_admin === true ||
        data.user?.is_super_admin === "true" ||
        data.user?.is_super_admin === 1 ||
        String(data.user?.role || "").toLowerCase() === "super_admin";

      if (isSuperAdmin) localStorage.setItem("admin_token", data.token);
      else localStorage.removeItem("admin_token");

      document.cookie = "triangle_client_token=; path=/; max-age=0";
      document.cookie = `triangle_token=${encodeURIComponent(data.token)}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `triangle_business_token=${encodeURIComponent(data.token)}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `triangle_super_admin=${isSuperAdmin ? "true" : "false"}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `triangle_subscription_status=${encodeURIComponent(data.user?.subscription_status || "")}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `triangle_modules=${encodeURIComponent(JSON.stringify(data.user?.modules || {}))}; path=/; max-age=86400; SameSite=Lax`;

      const subscriptionStatus = String(data.user?.subscription_status || "").toLowerCase();
      if (
        !isSuperAdmin &&
        ["expired", "expiré", "expire", "suspended", "suspendu", "inactive", "inactif"].includes(subscriptionStatus)
      ) {
        router.push("/abonnement-expire");
        return;
      }

      router.push(isSuperAdmin ? "/super-admin" : "/dashboard");
    } catch (error) {
      console.error(error);
      setError("Erreur serveur");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 md:p-8">
      <div className="bg-white shadow-2xl rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 max-w-6xl w-full">
        <div className="relative bg-black text-white p-8 md:p-12 flex flex-col justify-between overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-40 bg-yellow-500/20" />
          <div className="relative">
            <div className="flex items-center gap-4">
              <img
                src={productConfig.logoUrl}
                alt={productConfig.name}
                className="h-16 w-16 rounded-2xl bg-yellow-500 p-3"
              />
              <div>
                <h1 className="text-4xl font-bold">{productConfig.name}</h1>
                <p className="text-sm font-bold uppercase tracking-wide text-yellow-400">
                  ERP / WMS intelligent
                </p>
              </div>
            </div>

            <h2 className="mt-10 text-3xl font-bold leading-tight md:text-5xl">
              {productConfig.slogan}
            </h2>

            <p className="mt-5 text-lg text-gray-300">
              Stocks, ventes, achats, paiements, rapports, pointage et intelligence
              artificielle réunis dans une solution unique.
            </p>
          </div>

          <div className="relative mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              "Gestion des stocks",
              "Gestion des ventes",
              "Multi-entrepôts",
              "Rapports intelligents",
              "Assistant IA intégré",
            ].map((item) => (
              <div key={item} className="rounded-xl bg-white/10 p-3 font-bold">
                {item}
              </div>
            ))}
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
                Email ou téléphone
              </label>

              <input
                type="text"
                placeholder="Votre email ou téléphone"
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

          <button
            type="button"
            onClick={() => router.push("/mot-de-passe-oublie?type=enterprise")}
            className="mt-4 w-full text-center text-sm font-bold text-gray-600 hover:text-black"
          >
            Mot de passe oublié
          </button>

          <SocialAuthButtons mode="login" />

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

          <div className="mt-4 flex justify-center">
            <WhatsAppSupportButton className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
