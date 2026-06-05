import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Globe2, LockKeyhole, MapPin } from "lucide-react";
import { absoluteUrl, seoBusiness } from "../lib/seo";

export const metadata: Metadata = {
  title: "À propos",
  description:
    "À propos de Triangle WMS Pro, solution de gestion de stock, caisse POS, marketplace et logistique développée pour les entreprises au Mali et en Afrique.",
  alternates: { canonical: "/a-propos" },
  openGraph: {
    title: "À propos de Triangle WMS Pro",
    description: "Une plateforme SaaS pour aider les PME africaines à gérer stock, ventes, caisse, documents et marketplace.",
    url: absoluteUrl("/a-propos"),
  },
};

const values = [
  { icon: MapPin, title: "Ancré au Mali", text: "Une solution pensée pour les réalités des PME à Bamako, au Mali et en Afrique de l’Ouest." },
  { icon: LockKeyhole, title: "Données séparées", text: "Chaque entreprise garde ses produits, utilisateurs, documents, commandes et stocks isolés." },
  { icon: Globe2, title: "Ouvert au commerce", text: "Les entreprises peuvent publier volontairement leurs produits et services sur une marketplace." },
  { icon: CheckCircle2, title: "Simple à utiliser", text: "Des interfaces en français simple pour équipes terrain, caissiers, admins et direction." },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gray-100 text-black">
      <section className="relative overflow-hidden bg-black px-4 py-16 text-white md:px-8">
        <img
          src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1800&q=80"
          alt="Équipe professionnelle utilisant Triangle WMS Pro"
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="relative mx-auto max-w-6xl">
          <p className="font-black uppercase text-yellow-400">{seoBusiness.companyName}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black md:text-6xl">
            Une plateforme de gestion conçue pour les entreprises africaines.
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-white/75">
            Triangle WMS Pro aide les entreprises à mieux gérer stocks, ventes, caisse, documents, pointage, marketplace et opérations quotidiennes.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-12 md:grid-cols-2 md:px-8 xl:grid-cols-4">
        {values.map((value) => {
          const Icon = value.icon;
          return (
            <article key={value.title} className="rounded-2xl bg-white p-6 shadow">
              <Icon className="text-yellow-700" size={28} />
              <h2 className="mt-4 text-xl font-black">{value.title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">{value.text}</p>
            </article>
          );
        })}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 md:px-8">
        <div className="rounded-3xl bg-white p-8 shadow md:p-10">
          <h2 className="text-3xl font-black">Notre mission</h2>
          <p className="mt-4 max-w-4xl leading-7 text-gray-600">
            Rendre la gestion professionnelle accessible aux pharmacies, boutiques, restaurants, hôtels, entrepôts, quincailleries, laboratoires, transporteurs et entreprises de services. Triangle WMS Pro réunit WMS, POS, marketplace et outils de suivi dans une seule application web.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/solutions" className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-black">Voir les solutions</Link>
            <Link href="/contact" className="rounded-xl bg-black px-5 py-3 font-black text-white">Nous contacter</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
