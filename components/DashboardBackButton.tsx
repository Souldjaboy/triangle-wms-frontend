"use client";

import { Home } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { productConfig } from "../app/lib/product-config";

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
    const readJson = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    };

    const businessToken = localStorage.getItem("business_token") || localStorage.getItem("admin_token");
    const clientToken = localStorage.getItem("client_token");
    const legacyToken = localStorage.getItem("token");
    let user: any = null;

    if (businessToken) user = readJson("business_user") || readJson("user");
    else if (clientToken) user = readJson("client_user") || readJson("user");
    else if (legacyToken) user = readJson("user");

    if (!businessToken && !clientToken && !legacyToken) {
      router.push("/");
      return;
    }

    if (!user) {
      router.push("/login?message=Session%20introuvable");
      return;
    }

    try {
      const raw = localStorage.getItem("triangle_user");
      if (!user && raw) user = JSON.parse(raw);
    } catch {
      // Ignore ancienne donnée invalide.
    }

    const role = String(user?.role || "").toLowerCase();
    const isSuperAdmin =
      user?.is_super_admin === true ||
      user?.is_super_admin === "true" ||
      user?.is_super_admin === 1 ||
      role === "super_admin";

    if (productConfig.product === "triangle") {
      router.push(isSuperAdmin ? "/super-admin" : "/dashboard");
      return;
    }

    if (productConfig.product === "hafiya") {
      if (role === "customer") router.push("/client/laboratoires");
      else if (businessToken || legacyToken || isSuperAdmin) router.push("/laboratoire");
      else router.push("/login?message=Rôle%20inconnu");
      return;
    }

    if (role === "customer") router.push("/client/dashboard");
    else if (isSuperAdmin) router.push("/super-admin");
    else if (businessToken || legacyToken) router.push("/marketplace/business");
    else router.push("/login?message=Rôle%20inconnu");
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
