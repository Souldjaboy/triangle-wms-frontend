"use client";

import {
  useEffect,
  useState,
} from "react";
import { usePermissions } from "../lib/permissions";
import { moduleForInternalUrl } from "../lib/route-access";

export default function NotificationOpenPage() {
  const { can, loading: permissionsLoading } = usePermissions();
  const [
    message,
    setMessage,
  ] =
    useState(
      "Ouverture de la notification…"
    );

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const rawTarget =
      params.get("target") ||
      "/notifications";

    const target =
      rawTarget.startsWith("/") &&
      !rawTarget.startsWith("//")
        ? rawTarget
        : "/notifications";

    const token =
      localStorage.getItem(
        "business_token"
      ) ||
      localStorage.getItem(
        "token"
      );

    const user =
      localStorage.getItem(
        "business_user"
      ) ||
      localStorage.getItem(
        "user"
      );

    if (
      token &&
      user
    ) {
      if (permissionsLoading) return;
      const requiredModule = moduleForInternalUrl(target);
      if (requiredModule && !can(requiredModule, "view")) {
        setMessage("Accès refusé : ce module n’est pas autorisé pour votre compte.");
        window.setTimeout(() => window.location.replace("/dashboard?access=denied"), 900);
        return;
      }
      window.location.replace(
        target
      );

      return;
    }

    setMessage(
      "Connexion requise pour consulter cette notification."
    );

    window.location.replace(
      "/login?redirect=" +
      encodeURIComponent(
        target
      )
    );
  }, [can, permissionsLoading]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">

      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">

        <div className="text-5xl">
          🔔
        </div>

        <h1 className="mt-4 text-xl font-black">
          Triangle WMS
        </h1>

        <p className="mt-3 text-slate-600">
          {message}
        </p>

      </div>

    </main>
  );
}
