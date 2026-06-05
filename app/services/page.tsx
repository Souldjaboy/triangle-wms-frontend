import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, FileText, Landmark, QrCode, ShieldCheck, ShoppingCart, Smartphone, Users } from "lucide-react";
import { absoluteUrl } from "../lib/seo";

export const metadata: Metadata = {
  title: "Services logiciels pour entreprises",
  description:
    "Découvrez les services Triangle WMS Pro : gestion de stock, POS, marketplace, documents, QR codes, pointage, rapports, comptabilité et accompagnement PME.",
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Services Triangle WMS Pro",
    description: "Services logiciels pour gérer stock, caisse, marketplace, documents et opérations d’entreprise au Mali.",
    url: absoluteUrl("/services"),
  },
};

const services = [
  { icon: ShoppingCart, title: "Caisse POS", text: "Ventes, paiements, reçus, caisses et historique commercial." },
  { icon: QrCode, title: "QR codes et scanner", text: "Badges, produits, emplacements et consultations rapides par téléphone." },
  { icon: BarChart3, title: "Rapports", text: "Suivi des ventes, stocks, mouvements, pointage, alertes et documents." },
  { icon: FileText, title: "Documents", text: "Reçus, bons, factures, rapports imprimables et pièces liées aux opérations." },
  { icon: Landmark, title: "Comptabilité simple", text: "Banques, caisses, trésorerie, mouvements et demandes de décaissement." },
  { icon: Users, title: "Gestion utilisateurs", text: "Rôles, permissions, employés, clients, admins et super admin." },
  { icon: Smartphone, title: "Application PWA", text: "Accès mobile installable pour scanner, vendre et suivre les opérations." },
  { icon: ShieldCheck, title: "Sécurité SaaS", text: "Données séparées par entreprise, permissions et contrôle d’accès." },
];

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-gray-100 text-black">
      <section className="bg-white px-4 py-16 md:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="font-black uppercase text-yellow-700">Services</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black md:text-6xl">
            Des outils simples pour gérer l’activité quotidienne.
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-gray-600">
            Triangle WMS Pro accompagne les entreprises maliennes et africaines avec une solution web pour stock, caisse, marketplace, documents, pointage et rapports.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-10 md:grid-cols-2 md:px-8 xl:grid-cols-4">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <article key={service.title} className="rounded-2xl bg-white p-6 shadow">
              <Icon className="text-yellow-700" size={28} />
              <h2 className="mt-4 text-xl font-black">{service.title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">{service.text}</p>
            </article>
          );
        })}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 md:px-8">
        <div className="rounded-3xl bg-black p-8 text-white md:p-10">
          <h2 className="text-3xl font-black">Vous voulez digitaliser votre entreprise ?</h2>
          <p className="mt-3 max-w-2xl text-white/70">
            Commencez par créer votre espace entreprise ou contactez l’équipe Triangle WMS Pro à Bamako.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-black">Créer une entreprise</Link>
            <Link href="/contact" className="rounded-xl bg-white px-5 py-3 font-black text-black">Contact</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
