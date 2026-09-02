"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AttendanceScanRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/pointage"); }, [router]);
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-center">
    <div className="rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-black">Ouverture du pointage sécurisé…</h1>
      <p className="mt-2 text-slate-600">Le scanner individuel est remplacé par la sélection des employés autorisés pour chaque site.</p>
    </div>
  </main>;
}
