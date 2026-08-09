"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "../../lib/api";
import { ArrowLeft, BarChart3 } from "lucide-react";

const money = (v: any) =>
  new Intl.NumberFormat("fr-FR").format(Number(v || 0)) + " FCFA";

export default function CementReportsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    authFetch("/cement/reports/summary")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const t = data?.totals || {};

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/ciment"
          className="mb-3 inline-flex items-center gap-2 text-sm text-gray-600"
        >
          <ArrowLeft size={16} /> Retour au module ciment
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <BarChart3 size={32} />
          <div>
            <h1 className="text-3xl font-bold">Rapports Ciment</h1>
            <p className="text-gray-500">
              Résumé commercial et financier.
            </p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card title="Nombre de ventes" value={t.sales_count || 0} />
          <Card title="Tonnage vendu" value={`${t.tonnage || 0} T`} />
          <Card title="Chiffre d'affaires" value={money(t.revenue)} />
          <Card title="Reste à encaisser" value={money(t.remaining)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">
              Ventes par destination
            </h2>

            {(data?.destinations || []).map((r: any) => (
              <div
                key={r.destination}
                className="flex justify-between border-b py-3"
              >
                <div>
                  <div className="font-semibold">{r.destination}</div>
                  <div className="text-sm text-gray-500">
                    {r.tonnage} T · {r.sales_count} vente(s)
                  </div>
                </div>
                <div className="font-semibold">{money(r.amount)}</div>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">
              Ventes par client
            </h2>

            {(data?.customers || []).map((r: any, i: number) => (
              <div
                key={`${r.customer_name}-${i}`}
                className="flex justify-between border-b py-3"
              >
                <div>
                  <div className="font-semibold">{r.customer_name}</div>
                  <div className="text-sm text-gray-500">
                    {r.tonnage} T · {r.sales_count} vente(s)
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-semibold">{money(r.amount)}</div>
                  <div className="text-sm text-gray-500">
                    Impayé : {money(r.remaining)}
                  </div>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
