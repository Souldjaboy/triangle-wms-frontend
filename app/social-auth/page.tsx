"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SocialAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Connexion sociale en cours...");

  useEffect(() => {
    const payload = searchParams.get("payload") || "";
    if (!payload) {
      setMessage("Connexion sociale invalide.");
      return;
    }

    try {
      const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
      const paddedPayload =
        normalizedPayload + "=".repeat((4 - (normalizedPayload.length % 4)) % 4);
      const decoded = JSON.parse(decodeURIComponent(escape(atob(paddedPayload))));
      if (!decoded.token || !decoded.user) {
        setMessage("Réponse sociale incomplète.");
        return;
      }

      localStorage.setItem("token", decoded.token);
      localStorage.setItem("user", JSON.stringify(decoded.user));

      const isSuperAdmin =
        decoded.user?.is_super_admin === true ||
        decoded.user?.is_super_admin === "true" ||
        decoded.user?.is_super_admin === 1 ||
        String(decoded.user?.role || "").toLowerCase() === "super_admin";

      document.cookie = `triangle_token=${encodeURIComponent(decoded.token)}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `triangle_super_admin=${isSuperAdmin ? "true" : "false"}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `triangle_subscription_status=${encodeURIComponent(decoded.user?.subscription_status || "")}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `triangle_modules=${encodeURIComponent(JSON.stringify(decoded.user?.modules || {}))}; path=/; max-age=86400; SameSite=Lax`;

      router.push(isSuperAdmin ? "/super-admin" : "/dashboard");
    } catch (error) {
      console.error(error);
      setMessage("Impossible de terminer la connexion sociale.");
    }
  }, [router, searchParams]);

  return (
    <div className="rounded-3xl bg-white p-8 text-center font-bold text-black shadow-2xl">
      {message}
    </div>
  );
}

export default function SocialAuthPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Suspense fallback={<div className="font-bold text-black">Chargement...</div>}>
        <SocialAuthContent />
      </Suspense>
    </main>
  );
}
