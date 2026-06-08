"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, ShoppingCart, Store, User } from "lucide-react";

function readUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem("client_user") ||
      localStorage.getItem("business_user") ||
      localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function MarketplaceHeader() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(readUser());
  }, []);

  const role = String(user?.role || "").toLowerCase();
  const isCustomer = role === "customer";
  const isBusiness = Boolean(user) && !isCustomer;
  const displayName =
    user?.fullname ||
    user?.full_name ||
    user?.name ||
    user?.company_name ||
    user?.email ||
    "Mon compte";

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("client_token");
    localStorage.removeItem("client_user");
    localStorage.removeItem("business_token");
    localStorage.removeItem("business_user");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("active_company_id");
    document.cookie = "triangle_token=; path=/; max-age=0";
    document.cookie = "triangle_client_token=; path=/; max-age=0";
    document.cookie = "triangle_business_token=; path=/; max-age=0";
    document.cookie = "triangle_super_admin=; path=/; max-age=0";
    router.push("/marketplace");
    setUser(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!user && (
        <>
          <Link href="/client/login" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-black">
            <User size={18} /> Se connecter
          </Link>
          <Link href="/client/register" className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black">
            Créer un compte client
          </Link>
          <Link href="/marketplace/cart" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 font-bold text-white">
            <ShoppingCart size={18} /> Mon panier
          </Link>
        </>
      )}

      {isCustomer && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-black text-black">
            <User size={18} /> {displayName}
          </span>
          <Link href="/client/dashboard" className="rounded-xl bg-white/10 px-4 py-3 font-bold text-white">Accueil client</Link>
          <Link href="/marketplace" className="rounded-xl bg-white/10 px-4 py-3 font-bold text-white">Marketplace</Link>
          <Link href="/client/profile" className="rounded-xl bg-white/10 px-4 py-3 font-bold text-white">Mon profil</Link>
          <Link href="/client/orders" className="rounded-xl bg-white/10 px-4 py-3 font-bold text-white">Mes commandes</Link>
          <Link href="/marketplace/cart" className="rounded-xl bg-yellow-500 px-4 py-3 font-bold text-black">Mon panier</Link>
          <Link href="/client/laboratoire/rendez-vous" className="rounded-xl bg-white/10 px-4 py-3 font-bold text-white">Mes rendez-vous</Link>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-bold text-white">
            <LogOut size={18} /> Se déconnecter
          </button>
        </div>
      )}

      {isBusiness && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-black text-black">
            <Store size={18} /> {displayName}
          </span>
          <Link href="/marketplace" className="rounded-xl bg-white/10 px-4 py-3 font-bold text-white">Marketplace</Link>
          <Link href="/marketplace/orders" className="rounded-xl bg-white/10 px-4 py-3 font-bold text-white">Commandes envoyées</Link>
          <Link href="/vendor/orders" className="rounded-xl bg-yellow-500 px-4 py-3 font-bold text-black">Commandes reçues</Link>
          <Link href="/vendor/products" className="rounded-xl bg-white/10 px-4 py-3 font-bold text-white">Produits publiés</Link>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-bold text-white">
            <LogOut size={18} /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
