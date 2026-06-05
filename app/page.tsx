"use client";

import Link from "next/link";

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

export default function PublicHomePage() {
  return (
    <main className="min-h-screen bg-gray-100 text-black">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-12 md:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-wide text-yellow-600">Triangle WMS Pro</p>
          <h1 className="mt-3 text-4xl font-black md:text-6xl">
            WMS, POS et Marketplace pour entreprises et clients.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-gray-600">
            Les entreprises gèrent leurs stocks et publient volontairement leurs articles. Les clients particuliers achètent depuis un compte séparé.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {publicActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`rounded-2xl p-5 shadow transition hover:-translate-y-1 hover:shadow-xl ${
                action.primary ? "bg-yellow-500 text-black" : "bg-white text-black"
              }`}
            >
              <p className="text-xl font-black">{action.title}</p>
              <p className="mt-2 text-sm opacity-75">{action.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
