"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Factory,
  Plus,
  ReceiptText,
  Truck,
  Users,
  MapPin,
  FileText,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { authFetch } from "../lib/api";
import { usePermissions } from "../lib/permissions";

const money = (value: any) =>
  new Intl.NumberFormat("fr-FR").format(Number(value || 0)) + " FCFA";

export default function CementDashboardPage() {
  const { can } = usePermissions();
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    authFetch("/cement/dashboard", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "Erreur chargement module ciment.");
        setStats(data);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (!can("cement", "view")) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 text-black">
        <div className="rounded-xl bg-red-100 p-4 font-bold text-red-700">
          Accès refusé au module Vente de ciment.
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black md:p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black">
            <Factory className="text-yellow-500" />
            Vente de ciment
          </h1>
          <p className="mt-1 text-gray-600">
            Gestion indépendante des ventes de ciment, tarifs, clients, BL, factures et impayés.
          </p>
        </div>

        {can("cement", "create") && (
          <Link
            href="/ciment/ventes/nouvelle"
            className="flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black"
          >
            <Plus size={20} />
            Nouvelle vente
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-100 p-4 font-bold text-red-700">
          {error}
        </div>
      )}

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="CA aujourd'hui" value={money(stats?.ca_today)} icon={<ReceiptText />} />
        <Card title="CA du mois" value={money(stats?.ca_month)} icon={<BarChart3 />} />
        <Card title="Tonnage du mois" value={`${Number(stats?.tonnage_month || 0).toLocaleString("fr-FR")} t`} icon={<Truck />} />
        <Card title="Total impayés" value={money(stats?.total_unpaid)} icon={<AlertTriangle />} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ModuleLink href="/ciment/ventes/nouvelle" title="Nouvelle vente" description="Créer une vente à partir du tonnage et de la destination." icon={<Plus />} />
        <ModuleLink href="/ciment/ventes" title="Ventes" description="Consulter et rechercher les opérations de vente." icon={<ReceiptText />} />
        <ModuleLink href="/ciment/tarifs" title="Tarifs" description="Prix du ciment et transport par destination." icon={<MapPin />} />
        <ModuleLink href="/ciment/clients" title="Clients" description="Entreprises et clients acheteurs de ciment." icon={<Users />} />
        <ModuleLink href="/ciment/factures" title="Factures" description="Factures, paiements et reste à payer." icon={<FileText />} />
        <ModuleLink href="/ciment/impayes" title="État des impayés" description="État imprimable des factures non réglées." icon={<AlertTriangle />} />
        <ModuleLink href="/ciment/livraisons" title="Bons de livraison" description="Consulter et imprimer les BL." icon={<Truck />} />
        <ModuleLink href="/ciment/proformas" title="Proformas" description="Créer des proformas multi-lignes." icon={<FileText />} />
        <ModuleLink href="/ciment/rapports" title="Rapports" description="Statistiques, journaux et exports." icon={<BarChart3 />} />
      </section>
    </main>
  );
}

function Card({ title, value, icon }: any) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 text-yellow-600">{icon}</div>
      <div className="text-sm font-semibold text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

function ModuleLink({ href, title, description, icon }: any) {
  return (
    <Link
      href={href}
      className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
    >
      <div className="mb-3 text-yellow-600">{icon}</div>
      <h2 className="text-lg font-black">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </Link>
  );
}
