"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Factory,
  Users,
  ReceiptText,
  Truck,
  FileText,
  BarChart3,
  AlertTriangle,
  Tags,
} from "lucide-react";
import { authFetch } from "../lib/api";

const money = (value: any) =>
  new Intl.NumberFormat("fr-FR").format(Number(value || 0)) + " FCFA";

export default function SandDashboardPage() {
  const [prices, setPrices] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    authFetch("/sand/prices")
      .then(async (r) => {
        const data = await r.json().catch(() => []);
        if (!r.ok) throw new Error(data?.error || "Chargement impossible");
        setPrices(Array.isArray(data) ? data : []);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="min-h-screen bg-neutral-100 p-4 text-neutral-950 md:p-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8 rounded-3xl bg-neutral-950 p-7 text-white shadow-xl">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white p-4 text-black">
              <Factory size={32} />
            </div>

            <div>
              <div className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-400">
                FAT & MAT
              </div>

              <h1 className="text-3xl font-black">
                Vente de Sable
              </h1>

              <p className="mt-1 text-neutral-400">
                Gestion commerciale du sable indépendante du stock Triangle.
              </p>
            </div>
          </div>
        </div>

        <section className="mb-8 rounded-3xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <Tags />
            <h2 className="text-xl font-black">Tarif actuel</h2>
          </div>

          {error ? (
            <div className="rounded-xl bg-red-50 p-4 text-red-700">
              {error}
            </div>
          ) : prices.length === 0 ? (
            <p>Aucun tarif enregistré.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {prices.map((p) => (
                <div key={p.id} className="rounded-2xl border p-5">
                  <div className="text-sm text-gray-500">
                    {p.destination}
                  </div>

                  <div className="mt-2 text-2xl font-black">
                    {p.quantity_reference} m³
                  </div>

                  <div className="text-xl font-bold">
                    {money(p.price)}
                  </div>

                  <div className="mt-2 text-sm text-gray-500">
                    Prix indicatif par m³ : {money(p.unit_price_m3)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card
            href="/sable/tarifs"
            icon={<Tags />}
            title="Tarifs"
            description="Prix du sable et destinations"
          />

          <Card
            href="/sable/clients"
            icon={<Users />}
            title="Clients"
            description="Entreprises et particuliers"
          />

          <Card
            href="/sable/ventes"
            icon={<ReceiptText />}
            title="Ventes"
            description="Journal des ventes"
          />

          <Card
            href="/sable/livraisons"
            icon={<Truck />}
            title="Bons de livraison"
            description="Livraisons effectuées"
          />

          <Card
            href="/sable/factures"
            icon={<FileText />}
            title="Factures"
            description="Factures clients"
          />

          <Card
            href="/sable/proformas"
            icon={<FileText />}
            title="Proformas"
            description="Offres commerciales"
          />

          <Card
            href="/sable/impayes"
            icon={<AlertTriangle />}
            title="Impayés"
            description="État des factures à recouvrer"
          />

          <Card
            href="/sable/rapports"
            icon={<BarChart3 />}
            title="Rapports"
            description="CA, m³ vendus et statistiques"
          />
        </div>
      </div>
    </main>
  );
}

function Card({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="mb-4">{icon}</div>
      <div className="text-lg font-black">{title}</div>
      <div className="mt-1 text-sm text-gray-500">{description}</div>
    </Link>
  );
}
