"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Beaker,
  BookOpen,
  Building2,
  Car,
  Hotel,
  Package,
  Search,
  ShoppingBag,
  Store,
  Truck,
  Utensils,
  Warehouse,
  Wrench,
} from "lucide-react";
import { productConfig } from "./lib/product-config";

const publicActions = [
  { href: "/marketplace", title: "Marketplace", description: "Voir les produits et services publiés.", primary: true },
  { href: "/installer-application", title: "Installer l’application", description: "Android, iPhone, iPad, Windows et Mac." },
  { href: "/solutions", title: "Solutions", description: "Stock, caisse, logistique et marketplace." },
  { href: "/client/register", title: "Créer un compte client", description: "Acheter comme particulier." },
  { href: "/client/login", title: "Connexion client", description: "Accéder au panier et aux commandes." },
  { href: "/login", title: "Connexion entreprise", description: "Accéder à Triangle WMS Pro." },
  { href: "/register", title: "Créer une entreprise", description: "Démarrer un espace WMS SaaS." },
  { href: "/client/laboratoires", title: "Laboratoires", description: "Trouver un laboratoire et prendre rendez-vous.", primary: true },
  { href: "/resultats-laboratoire", title: "Résultats laboratoire", description: "Consulter un résultat avec un code sécurisé." },
  { href: "/contact", title: "Contact", description: "Parler avec l’équipe." },
];

const categories = [
  { title: "Laboratoires", href: "/marketplace?category=Santé%20%2F%20Laboratoire", icon: Beaker, image: "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80" },
  { title: "Restaurants", href: "/marketplace?category=Restaurants", icon: Utensils, image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80" },
  { title: "Hôtels", href: "/marketplace?category=Hôtels", icon: Hotel, image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80" },
  { title: "Automobiles", href: "/marketplace?category=Automobiles", icon: Car, image: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80" },
  { title: "Immobilier", href: "/marketplace?category=Immobilier", icon: Building2, image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80" },
  { title: "Pharmacies", href: "/marketplace?category=Pharmacie", icon: Package, image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80" },
  { title: "Quincailleries", href: "/marketplace?category=Matériaux%20construction", icon: Wrench, image: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80" },
  { title: "Boutiques", href: "/marketplace?category=Produits", icon: Store, image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80" },
  { title: "Entrepôts", href: "/marketplace?category=Produits", icon: Warehouse, image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80" },
  { title: "Services", href: "/marketplace?category=Services", icon: ShoppingBag, image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=800&q=80" },
  { title: "Écoles / formations", href: "/marketplace?category=Services", icon: BookOpen, image: "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=800&q=80" },
  { title: "Logistique / transport", href: "/marketplace?category=Services", icon: Truck, image: "https://images.unsplash.com/photo-1494412651409-8963ce7935a7?auto=format&fit=crop&w=800&q=80" },
];

export default function PublicHomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const visibleActions = publicActions.filter((action) => productConfig.publicHomeActions.includes(action.href));
  const showMarketplaceContent = productConfig.marketplaceEnabled || productConfig.product === "malilink";
  const heroImage =
    productConfig.product === "hafiya"
      ? "https://images.unsplash.com/photo-1582807103971-b5b7c089af8f?auto=format&fit=crop&w=1800&q=80"
      : productConfig.product === "malilink"
        ? "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1800&q=80"
        : "https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&w=1800&q=80";

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (productConfig.product === "hafiya") {
      router.push(`/client/laboratoires${params.toString() ? `?${params.toString()}` : ""}`);
      return;
    }
    router.push(`${productConfig.marketplaceEnabled ? "/marketplace" : "/login"}${params.toString() && productConfig.marketplaceEnabled ? `?${params.toString()}` : ""}`);
  };

  return (
    <main className="min-h-screen bg-gray-100 text-black">
      <section className="relative overflow-hidden bg-black px-4 py-12 text-white md:px-8">
        <img
          src={heroImage}
          alt={productConfig.name}
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-sm font-black uppercase tracking-wide text-yellow-400">{productConfig.name}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black md:text-6xl">
            {productConfig.product === "malilink"
              ? "Marketplace multi-vendeurs et SaaS pour entreprises africaines."
              : productConfig.product === "hafiya"
                ? "Laboratoire, analyses, rendez-vous et résultats en ligne."
                : "Gestion interne des stocks, caisses, documents et opérations Triangle."}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/80">
            {productConfig.slogan}
          </p>
          <form onSubmit={submitSearch} className="mt-8 flex max-w-2xl gap-3 rounded-2xl bg-white p-2 text-black shadow-2xl">
            <Search className="ml-3 mt-3 text-gray-400" />
            <input
              className="flex-1 bg-transparent p-3 outline-none"
              placeholder="Rechercher produits, hôtels, laboratoires..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-black transition hover:scale-105">
              Chercher
            </button>
          </form>
        </div>

        <div className="relative mx-auto mt-10 grid max-w-6xl gap-4 md:grid-cols-3 xl:grid-cols-6">
          {visibleActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`rounded-2xl p-5 shadow transition duration-200 hover:-translate-y-1 hover:shadow-xl ${
                action.primary ? "bg-yellow-500 text-black" : "bg-white text-black"
              }`}
            >
              {action.href === "/marketplace" ? <ShoppingBag className="mb-3" /> : <Store className="mb-3" />}
              <p className="text-xl font-black">{action.title}</p>
              <p className="mt-2 text-sm opacity-75">{action.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {showMarketplaceContent && <section className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-black">Catégories populaires</h2>
            <p className="text-gray-500">Une porte d’entrée simple vers les produits et services publiés.</p>
          </div>
          <Link href="/marketplace" className="font-black text-yellow-700">Voir tout le Marketplace</Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} href={item.href} className="group overflow-hidden rounded-2xl bg-white shadow transition duration-200 hover:-translate-y-1 hover:shadow-xl">
                <div className="relative h-36">
                  <img src={item.image} alt={item.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  <div className="absolute left-4 top-4 rounded-full bg-white p-3 text-yellow-700 shadow">
                    <Icon size={22} />
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-lg font-black">{item.title}</p>
                  <p className="mt-1 text-sm text-gray-500">Explorer</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>}

      <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-12 md:grid-cols-3 md:px-8">
        <article className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-2xl font-black">
            {productConfig.product === "malilink" ? "Marketplace multi-vendeurs" : productConfig.product === "hafiya" ? "Analyses et rendez-vous" : "Gestion de stock et entrepôt"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            {productConfig.product === "malilink"
              ? "Connectez vendeurs, clients, commandes, paiements et services dans une même application."
              : productConfig.product === "hafiya"
                ? "Publiez vos analyses, recevez les demandes de rendez-vous et gérez les résultats."
                : "Suivez vos produits, stocks, emplacements, mouvements, inventaires, QR codes et alertes de rupture dans une application simple."}
          </p>
          <Link href="/solutions" className="mt-5 inline-block font-black text-yellow-700">Découvrir les solutions</Link>
        </article>
        <article className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-2xl font-black">{productConfig.product === "hafiya" ? "Résultats sécurisés" : "Caisse POS et ventes"}</h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            {productConfig.product === "hafiya"
              ? "Les patients peuvent consulter leurs résultats avec un code sécurisé, sans accéder aux données internes."
              : "Encaissez, imprimez les reçus, suivez les caisses et connectez les ventes au stock pour boutiques, pharmacies et restaurants."}
          </p>
          <Link href="/services" className="mt-5 inline-block font-black text-yellow-700">Voir les services</Link>
        </article>
        <article className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-2xl font-black">{productConfig.product === "triangle" ? "Usage interne" : "Marketplace entreprise"}</h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            {productConfig.product === "triangle"
              ? "Triangle WMS Pro reste centré sur les opérations internes Triangle Logistics et masque les modules publics."
              : "Publiez volontairement vos produits et services pour vendre aux clients ou aux autres entreprises, sans exposer vos données internes."}
          </p>
          <Link href={productConfig.marketplaceEnabled ? "/marketplace" : "/login"} className="mt-5 inline-block font-black text-yellow-700">
            {productConfig.marketplaceEnabled ? "Ouvrir la marketplace" : "Accéder à l’espace"}
          </Link>
        </article>
      </section>
    </main>
  );
}
