import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { absoluteUrl, seoBusiness } from "../lib/seo";

export const metadata: Metadata = {
  title: "Contact Bamako",
  description:
    "Contactez Triangle WMS Pro à ACI Bamako pour logiciel de gestion de stock, caisse POS, marketplace, logistique, pharmacie, restaurant, hôtel et entrepôt.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact Triangle WMS Pro à Bamako",
    description: "Contact commercial pour Triangle WMS Pro, logiciel de gestion pour entreprises au Mali.",
    url: absoluteUrl("/contact"),
  },
};

const phoneHref = seoBusiness.phone ? `tel:${seoBusiness.phone.replace(/\s+/g, "")}` : "#";
const emailHref = seoBusiness.email ? `mailto:${seoBusiness.email}` : "#";
const whatsappHref = seoBusiness.whatsapp ? `https://wa.me/${seoBusiness.whatsapp.replace(/[^\d]/g, "")}` : "#";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-gray-100 text-black">
      <section className="bg-black px-4 py-16 text-white md:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="font-black uppercase text-yellow-400">Contact</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black md:text-6xl">
            Parlons de votre gestion de stock, caisse ou marketplace.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/75">
            Triangle WMS Pro accompagne les entreprises à Bamako, au Mali et en Afrique pour digitaliser leurs opérations.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 md:grid-cols-2 md:px-8">
        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-2xl font-black">Coordonnées</h2>
          <div className="mt-6 space-y-4">
            <div className="flex gap-3">
              <MapPin className="mt-1 text-yellow-700" />
              <div>
                <p className="font-black">Adresse</p>
                <p className="text-gray-600">ACI, Bamako, Mali</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Phone className="mt-1 text-yellow-700" />
              <div>
                <p className="font-black">Téléphone</p>
                <p className="text-gray-600">{seoBusiness.phone || "À renseigner"}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Mail className="mt-1 text-yellow-700" />
              <div>
                <p className="font-black">Email</p>
                <p className="text-gray-600">{seoBusiness.email || "À renseigner"}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={phoneHref} className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-black">
              Appeler
            </Link>
            <Link href={whatsappHref} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-black text-white">
              <MessageCircle size={18} />
              WhatsApp
            </Link>
            <Link href={emailHref} className="rounded-xl bg-black px-5 py-3 font-black text-white">
              Envoyer un email
            </Link>
          </div>
        </div>

        <form className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-2xl font-black">Formulaire de contact</h2>
          <p className="mt-2 text-sm text-gray-500">
            Ce formulaire prépare votre message. L’envoi serveur pourra être relié au SMTP de production.
          </p>
          <div className="mt-6 grid gap-4">
            <input className="rounded-xl border p-4" placeholder="Nom complet" aria-label="Nom complet" />
            <input className="rounded-xl border p-4" placeholder="Téléphone" aria-label="Téléphone" />
            <input className="rounded-xl border p-4" placeholder="Email" aria-label="Email" type="email" />
            <select className="rounded-xl border p-4" aria-label="Sujet">
              <option>Gestion de stock</option>
              <option>Caisse POS</option>
              <option>Marketplace</option>
              <option>Logistique / transport</option>
              <option>Autre demande</option>
            </select>
            <textarea className="min-h-32 rounded-xl border p-4" placeholder="Votre message" aria-label="Votre message" />
            <Link
              href={emailHref}
              className="rounded-xl bg-yellow-500 px-5 py-4 text-center font-black text-black transition hover:scale-[1.01]"
            >
              Envoyer la demande
            </Link>
          </div>
        </form>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 md:px-8">
        <div className="overflow-hidden rounded-2xl bg-white shadow">
          <iframe
            title="Carte ACI Bamako"
            src="https://www.google.com/maps?q=ACI%20Bamako%20Mali&output=embed"
            className="h-80 w-full border-0"
            loading="lazy"
          />
        </div>
      </section>
    </main>
  );
}
