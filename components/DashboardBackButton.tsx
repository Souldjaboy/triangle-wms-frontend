"use client";

import { Home } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const hiddenPathnames = [
  "/",
  "/dashboard",
  "/login",
  "/register",
  "/client/login",
  "/client/register",
  "/client/dashboard",
  "/abonnement-expire",
];

export default function DashboardBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (!pathname || hiddenPathnames.includes(pathname)) return null;

  const goHome = () => {
    let user: any = null;
    try {
      const raw = localStorage.getItem("client_user") || localStorage.getItem("user");
      user = raw ? JSON.parse(raw) : null;
    } catch {
      user = null;
    }

    const role = String(user?.role || "").toLowerCase();
    const isSuperAdmin =
      user?.is_super_admin === true ||
      user?.is_super_admin === "true" ||
      user?.is_super_admin === 1 ||
      role === "super_admin";

    if (role === "customer") router.push("/client/dashboard");
    else if (isSuperAdmin) router.push("/super-admin");
    else if (localStorage.getItem("business_token") || localStorage.getItem("token")) router.push("/dashboard");
    else router.push("/");
  };

  return (
    <button
      type="button"
      title="Accueil"
      aria-label="Accueil"
      onClick={goHome}
      className="fixed bottom-5 left-5 z-[100] flex h-[50px] w-[50px] items-center justify-center rounded-full bg-yellow-500 text-black shadow-lg transition hover:scale-110 hover:shadow-2xl print:hidden"
    >
      <Home size={24} aria-hidden="true" />
    </button>
  );
}
