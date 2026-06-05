"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, FileText, LogOut, PackageCheck, ShoppingCart, User, TestTube2 } from "lucide-react";

export default function ClientDashboardPage() {
  const router = useRouter();
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "triangle_token=; path=/; max-age=0";
    router.push("/marketplace");
  };
  const cards = [
    { href: "/marketplace", label: "Marketplace", icon: ShoppingCart, tone: "bg-black text-white" },
    { href: "/marketplace/cart", label: "Mon panier", icon: ShoppingCart, tone: "bg-white text-black" },
    { href: "/client/orders", label: "Mes commandes", icon: PackageCheck, tone: "bg-yellow-500 text-black" },
    { href: "/client/profile", label: "Mon profil", icon: User, tone: "bg-white text-black" },
    { href: "/client/laboratoire/resultats", label: "Résultats laboratoire", icon: TestTube2, tone: "bg-white text-black" },
    { href: "/client/laboratoire/rendez-vous", label: "Mes rendez-vous", icon: CalendarDays, tone: "bg-white text-black" },
    { href: "/documents", label: "Reçus / factures", icon: FileText, tone: "bg-white text-black" },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="rounded-3xl bg-black p-6 text-white shadow">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-bold text-yellow-400">Triangle Marketplace</p>
            <h1 className="mt-2 text-4xl font-black">Espace client</h1>
            <p className="mt-2 text-white/70">Commandes, panier, factures, résultats laboratoire et profil.</p>
          </div>
          <button onClick={logout} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-bold text-white">
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className={`rounded-2xl p-6 font-black shadow ${card.tone}`}>
              <Icon className="mb-4" />
              {card.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
