"use client";

import Link from "next/link";
import { Beaker, Building2, Car, Hotel, Search, ShoppingBag, User, Utensils } from "lucide-react";

const publicActions = [
  {
    href: "/marketplace",
    title: "Marketplace",
    description: "Voir les produits et services publiés.",
    primary: true,
  },
  {
    href: "/client/register",
    title: "Créer un compte client",
    description: "Acheter comme particulier.",
  },
  {
    href: "/client/login",
    title: "Connexion client",
    description: "Accéder au panier et aux commandes.",
  },
  {
    href: "/login",
    title: "Connexion entreprise",
    description: "Accéder à Triangle WMS Pro.",
  },
  {
    href: "/register",
    title: "Créer une entreprise",
    description: "Démarrer un espace WMS SaaS.",
  },
];

const highlights = [
  { href: "/marketplace?category=Santé%20%2F%20Laboratoire", title: "Laboratoires", icon: Beaker },
  { href: "/marketplace?category=Restaurants", title: "Restaurants", icon: Utensils },
  { href: "/marketplace?category=Hôtels", title: "Hôtels", icon: Hotel },
  { href: "/marketplace?category=Automobiles", title: "Automobiles", icon: Car },
  { href: "/marketplace?category=Immobilier", title: "Immobilier", icon: Building2 },
];

export default function PublicHomePage() {
  return (
    <main className="min-h-screen bg-gray-100 text-black">
      <section className="bg-black px-4 py-12 text-white md:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-black uppercase tracking-wide text-yellow-600">Triangle WMS Pro</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black md:text-6xl">
            WMS, POS et Marketplace pour entreprises et clients.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/70">
            Les entreprises gèrent leurs stocks et publient volontairement leurs articles. Les clients particuliers achètent depuis un compte séparé.
          </p>
          <div className="mt-8 flex max-w-2xl gap-3 rounded-2xl bg-white p-2 text-black">
            <Search className="ml-3 mt-3 text-gray-400" />
            <input className="flex-1 bg-transparent p-3 outline-none" placeholder="Rechercher produits, hôtels, laboratoires..." readOnly />
            <Link href="/marketplace" className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-black">Chercher</Link>
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-4 md:grid-cols-5">
          {publicActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`rounded-2xl p-5 shadow transition hover:-translate-y-1 hover:shadow-xl ${
                action.primary ? "bg-yellow-500 text-black" : "bg-white text-black"
              }`}
            >
              {action.href === "/marketplace" ? <ShoppingBag className="mb-3" /> : <User className="mb-3" />}
              <p className="text-xl font-black">{action.title}</p>
              <p className="mt-2 text-sm opacity-75">{action.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <h2 className="text-3xl font-black">Catégories populaires</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-5">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="rounded-2xl bg-white p-5 shadow transition hover:-translate-y-1 hover:shadow-xl">
                <Icon className="mb-4 text-yellow-600" size={28} />
                <p className="font-black">{item.title}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
