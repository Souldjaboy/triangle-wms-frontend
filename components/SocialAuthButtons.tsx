"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "../app/lib/api";

type Props = {
  mode?: "login" | "register";
};

const providerLabels: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

export default function SocialAuthButtons({ mode = "login" }: Props) {
  const [providers, setProviders] = useState<any[]>([]);

  useEffect(() => {
    fetch(apiUrl("/auth/social/providers"))
      .then((response) => response.json())
      .then((data) => setProviders(Array.isArray(data.providers) ? data.providers : []))
      .catch(() => setProviders([]));
  }, []);

  const startAuth = (provider: any) => {
    if (provider.provider === "whatsapp") {
      window.location.href = "/verify-phone";
      return;
    }

    if (!provider.enabled) return;
    window.location.href = apiUrl(`/auth/social/${provider.provider}/start?mode=${mode}`);
  };

  return (
    <div className="mt-5 rounded-2xl border bg-gray-50 p-4">
      <p className="text-sm font-bold text-black">
        Connexion sécurisée avec votre compte social.
      </p>
      <p className="mt-1 text-xs text-gray-600">
        Triangle WMS Pro ne publiera jamais à votre place, ne lit pas vos messages
        privés et ne récupère jamais votre mot de passe social.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {providers
          .filter((provider) => {
            if (["instagram", "tiktok"].includes(provider.provider)) {
              return provider.enabled === true;
            }
            return true;
          })
          .map((provider) => (
          <button
            key={provider.provider}
            type="button"
            onClick={() => startAuth(provider)}
            disabled={!provider.enabled}
            className={`rounded-xl border px-4 py-3 text-sm font-bold ${
              provider.enabled
                ? "bg-white text-black hover:border-yellow-500"
                : "cursor-not-allowed bg-gray-100 text-gray-400"
            }`}
            title={
              provider.enabled
                ? `Continuer avec ${providerLabels[provider.provider] || provider.label}`
                : `${provider.label} non configuré`
            }
          >
            Continuer avec {providerLabels[provider.provider] || provider.label}
            {!provider.enabled && provider.provider !== "whatsapp" ? " (bientôt)" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}
