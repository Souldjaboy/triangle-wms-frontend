"use client";

import { Home } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const hiddenPathnames = [
  "/",
  "/dashboard",
  "/login",
  "/register",
  "/abonnement-expire",
];

export default function DashboardBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (!pathname || hiddenPathnames.includes(pathname)) return null;

  return (
    <button
      type="button"
      title="Tableau de bord"
      aria-label="Tableau de bord"
      onClick={() => router.push("/dashboard")}
      className="fixed bottom-5 left-5 z-[100] flex h-[50px] w-[50px] items-center justify-center rounded-full bg-yellow-500 text-black shadow-lg transition hover:scale-110 hover:shadow-2xl print:hidden"
    >
      <Home size={24} aria-hidden="true" />
    </button>
  );
}
