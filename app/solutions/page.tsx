import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  Car,
  CheckCircle2,
  Hotel,
  Package,
  Pill,
  ShoppingBag,
  Store,
  Truck,
  Utensils,
  Warehouse,
  Wrench,
} from "lucide-react";
import { absoluteUrl, seoBusiness } from "../lib/seo";

export const metadata: Metadata = {
  title: "Solutions de gestion au Mali",
  description:
    "Solutions Triangle WMS Pro pour gestion de stock, caisse POS, pharmacie, restaurant, hôtel, quincaillerie, boutique, entrepôt, transport et marketplace au Mali.",
  alternates: { canonical: "/solutions" },
  openGraph: {
    title: "Solutions Triangle WMS Pro au Mali",
    description:
      "Logiciel de gestion de stock, caisse, marketplace, logistique et multi-entreprise pour PME au Mali et en Afrique.",
    url: absoluteUrl("/solutions"),
  },
};

const solutions = [
  {
    icon: Warehouse,
    title: "Logiciel de gestion de stock au Mali",
    text: "Suivez vos produits, références, quantités, emplacements, alertes de rupture et mouvements de stock depuis une seule plateforme.",
  },
  {
    icon: Store,
    title: "Logiciel de caisse au Mali",
    text: "Encaissez les ventes, imprimez les reçus, suivez les caisses, les paiements et les rapports de vente par caissier.",
  },
  {
    icon: Pill,
    title: "Logiciel pour pharmacie",
    text: "Gérez les prix, lots, dates d’expiration, ruptures, ventes POS et alertes pour les produits sensibles.",
  },
  {
    icon: Utensils,
    title: "Logiciel pour restaurant",
    text: "Organisez les plats, commandes, tables, paiements, reçus et suivi des ventes pour restaurants et snacks.",
  },
  {
    icon: Hotel,
    title: "Logiciel pour hôtel",
    text: "Suivez chambres, réservations, clients, paiements et documents pour hôtels et résidences.",
  },
  {
    icon: Wrench,
    title: "Logiciel pour quincaillerie",
    text: "Contrôlez les références, matériaux, entrées, sorties, ventes, achats et stocks minimums.",
  },
  {
    icon: ShoppingBag,
    title: "Logiciel pour boutique",
    text: "Vendez plus vite avec une caisse simple, un catalogue clair, des reçus et une vue fiable sur le stock.",
  },
  {
    icon: Package,
    title: "Logiciel pour entrepôt",
    text: "Gérez les entrepôts, rayons, cases, niveaux, bins, QR codes et inventaires avec traçabilité.",
  },
  {
    icon: Truck,
    title: "Logiciel pour transport et logistique",
    text: "Centralisez documents, clients, commandes, suivis et opérations logistiques pour entreprises africaines.",
  },
  {
    icon: Building2,
    title: "Marketplace pour entreprises au Mali",
    text: "Publiez volontairement vos produits et services pour vendre aux clients et aux autres entreprises.",
  },
  {
    icon: CheckCircle2,
    title: "Gestion multi-entreprise",
    text: "Chaque entreprise voit uniquement ses données. Le super admin garde une vue globale sécurisée.",
  },
  {
    icon: Car,
    title: "Vente en ligne pour entreprises africaines",
    text: "Produits, automobile, immobilier, restaurants, hôtels, laboratoires et services peuvent être publiés dans une marketplace moderne.",
  },
];

export default function SolutionsPage() {
  return (
    <main className="min-h-screen bg-gray-100 text-black">
      <section className="relative overflow-hidden bg-black px-4 py-16 text-white md:px-8">
        <img
          src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1800&q=80"
          alt="Gestion d’entrepôt et stock au Mali avec Triangle WMS Pro"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="relative mx-auto max-w-6xl">
          <p className="font-black uppercase text-yellow-400">{seoBusiness.appName}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black md:text-6xl">
            Solutions de gestion pour PME au Mali et en Afrique.
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-white/80">
            Stock, caisse POS, marketplace, entrepôt, pharmacie, restaurant, hôtel, transport et services dans une plateforme simple.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-black shadow transition hover:scale-105">
              Créer une entreprise
            </Link>
            <Link href="/contact" className="rounded-xl bg-white px-5 py-3 font-black text-black shadow transition hover:scale-105">
              Contacter l’équipe
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-12 md:grid-cols-2 md:px-8 xl:grid-cols-3">
        {solutions.map((solution) => {
          const Icon = solution.icon;
          return (
            <article key={solution.title} className="rounded-2xl bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-xl">
              <div className="mb-4 inline-flex rounded-full bg-yellow-100 p-3 text-yellow-700">
                <Icon size={24} />
              </div>
              <h2 className="text-xl font-black">{solution.title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">{solution.text}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
