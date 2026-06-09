"use client";

import Link from "next/link";
import { Laptop, MessageCircle, MonitorDown, Smartphone, TabletSmartphone } from "lucide-react";
import InstallPWAButton from "../../components/InstallPWAButton";
import WhatsAppSupportButton from "../../components/WhatsAppSupportButton";
import { productConfig } from "../lib/product-config";

const productHost = productConfig.siteUrl.replace(/^https?:\/\//, "");

const steps = [
  {
    title: "Installer sur Android",
    icon: Smartphone,
    action: "Installer sur Android",
    items: [
      `Ouvrez ${productHost} avec Chrome.`,
      "Appuyez sur le menu ⋮ en haut à droite.",
      "Choisissez Ajouter à l’écran d’accueil ou Installer l’application.",
      `Ouvrez ${productConfig.name} depuis l’icône ajoutée sur le téléphone.`,
    ],
  },
  {
    title: "Installer sur iPhone",
    icon: Smartphone,
    action: "Installer sur iPhone",
    items: [
      `Ouvrez ${productHost} avec Safari.`,
      "Appuyez sur le bouton Partager.",
      "Choisissez Sur l’écran d’accueil.",
      `Validez Ajouter, puis ouvrez ${productConfig.name} depuis l’icône.`,
    ],
  },
  {
    title: "Installer sur iPad",
    icon: TabletSmartphone,
    action: "Installer sur iPad",
    items: [
      "Ouvrez le site avec Safari sur iPad.",
      "Appuyez sur Partager.",
      "Sélectionnez Sur l’écran d’accueil.",
      "L’application s’ouvre ensuite en plein écran comme une application tablette.",
    ],
  },
  {
    title: "Installer sur ordinateur",
    icon: Laptop,
    action: "Installer sur ordinateur",
    items: [
      "Ouvrez le site avec Chrome, Edge ou Brave.",
      "Cliquez sur l’icône Installer dans la barre d’adresse si elle apparaît.",
      `Sinon ouvrez le menu du navigateur puis Installer ${productConfig.name}.`,
      "L’application apparaît ensuite dans vos applications Windows ou Mac.",
    ],
  },
];

export const dynamic = "force-static";

export default function InstallerApplicationPage() {
  return (
    <main className="min-h-screen bg-gray-100 text-black">
      <section className="bg-black px-4 py-12 text-white md:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="font-black text-yellow-400">Application {productConfig.name}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black md:text-6xl">
            Installez {productConfig.name} sur téléphone, tablette ou ordinateur.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/75">
            Utilisez {productConfig.name} comme une application rapide, adaptée à votre téléphone, tablette et ordinateur.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <InstallPWAButton />
            <a href="#android" className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-black">Installer sur Android</a>
            <a href="#iphone" className="rounded-xl bg-white px-5 py-3 font-black text-black">Installer sur iPhone</a>
            <a href="#ordinateur" className="rounded-xl bg-white/10 px-5 py-3 font-black text-white">Installer sur ordinateur</a>
            <WhatsAppSupportButton className="rounded-xl bg-green-600 px-5 py-3 font-black text-white" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-10 md:grid-cols-2 md:px-8">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const anchor = index === 0 ? "android" : index === 1 ? "iphone" : index === 3 ? "ordinateur" : "ipad";
          return (
            <article key={step.title} id={anchor} className="rounded-2xl bg-white p-6 shadow">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-yellow-100 p-3 text-yellow-700">
                  <Icon size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black">{step.title}</h2>
                  <p className="text-sm font-bold text-gray-500">{step.action}</p>
                </div>
              </div>
              <ol className="mt-5 grid gap-3">
                {step.items.map((item, itemIndex) => (
                  <li key={item} className="flex gap-3 rounded-xl bg-gray-50 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-sm font-black text-white">
                      {itemIndex + 1}
                    </span>
                    <span className="text-sm leading-6 text-gray-700">{item}</span>
                  </li>
                ))}
              </ol>
            </article>
          );
        })}
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-12 md:grid-cols-3 md:px-8">
        <article className="rounded-2xl bg-white p-6 shadow">
          <MonitorDown className="text-yellow-600" />
          <h2 className="mt-3 text-xl font-black">Installation rapide</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            L’installation PWA ne change pas vos comptes. Client, entreprise et super admin gardent leurs connexions séparées.
          </p>
        </article>
        <article className="rounded-2xl bg-white p-6 shadow">
          <Smartphone className="text-yellow-600" />
          <h2 className="mt-3 text-xl font-black">Mobile et tablette</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Les pages importantes restent utilisables au doigt, avec les boutons essentiels visibles.
          </p>
        </article>
        <article className="rounded-2xl bg-white p-6 shadow">
          <MessageCircle className="text-yellow-600" />
          <h2 className="mt-3 text-xl font-black">Besoin d’aide ?</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Contactez le support pour l’installation sur iPhone, Android, ordinateur ou tablette.
          </p>
          <div className="mt-4">
            <WhatsAppSupportButton className="rounded-xl bg-green-600 px-5 py-3 font-black text-white" />
          </div>
        </article>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 md:px-8">
        <div className="rounded-2xl bg-black p-6 text-white shadow">
          <h2 className="text-2xl font-black">Après installation</h2>
          <p className="mt-3 text-white/70">
            Ouvrez l’icône Triangle WMS Pro, puis choisissez votre espace : Marketplace client, connexion entreprise ou super admin. Les données privées ne sont pas stockées dans le cache public.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/marketplace" className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-black">Ouvrir Marketplace</Link>
            <Link href="/login" className="rounded-xl bg-white px-5 py-3 font-black text-black">Connexion entreprise</Link>
            <Link href="/client/login" className="rounded-xl bg-white/10 px-5 py-3 font-black text-white">Connexion client</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
