"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import WhatsAppSupportButton from "../../components/WhatsAppSupportButton";

function VerificationRequiredContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") || "email";
  const target = searchParams.get("target") || "";
  const userId = searchParams.get("user_id") || "";
  const page = type === "phone" ? "/verify-phone" : "/verify-email";
  const query = new URLSearchParams();
  if (target) query.set("target", target);
  if (userId) query.set("user_id", userId);

  return (
    <div className="rounded-3xl bg-white p-8 text-center shadow-2xl md:p-12">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500 text-3xl font-black">
        T
      </div>
      <h1 className="mb-4 text-3xl font-bold md:text-4xl">
        Vérification obligatoire
      </h1>
      <p className="mb-8 text-lg text-gray-600">
        Votre compte doit être vérifié avant d’accéder au tableau de bord.
      </p>
      <div className="flex flex-col justify-center gap-3 md:flex-row">
        <a
          href={`${page}?${query.toString()}`}
          className="rounded-xl bg-yellow-500 px-6 py-4 font-bold text-black"
        >
          Vérifier maintenant
        </a>
        <WhatsAppSupportButton />
        <a href="/login" className="rounded-xl border px-6 py-4 font-bold text-black">
          Retour connexion
        </a>
      </div>
    </div>
  );
}

export default function VerificationRequiredPage() {
  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mx-auto flex min-h-[80vh] max-w-3xl items-center justify-center">
        <Suspense fallback={<div className="font-bold">Chargement...</div>}>
          <VerificationRequiredContent />
        </Suspense>
      </div>
    </main>
  );
}
