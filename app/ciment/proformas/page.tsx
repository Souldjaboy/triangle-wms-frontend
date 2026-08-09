"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "../../lib/api";
import { ArrowLeft, FileText, Plus } from "lucide-react";

const money = (v: any) =>
  new Intl.NumberFormat("fr-FR").format(Number(v || 0)) + " FCFA";

export default function CementProformasPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await authFetch("/cement/proformas");
      const data = await r.json();
      if (r.ok) setRows(Array.isArray(data) ? data : data.rows || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/ciment"
              className="mb-2 inline-flex items-center gap-2 text-sm text-gray-600"
            >
              <ArrowLeft size={16} /> Retour au module ciment
            </Link>

            <h1 className="text-3xl font-bold text-gray-900">
              Proformas Ciment
            </h1>
            <p className="text-gray-500">
              Gestion des devis et offres commerciales.
            </p>
          </div>

          <Link
            href="/ciment/proformas/nouvelle"
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 font-semibold text-white"
          >
            <Plus size={18} />
            Nouvelle proforma
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center">Chargement...</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto mb-3" size={42} />
              <h2 className="font-semibold">Aucune proforma</h2>
              <p className="text-gray-500">
                Les proformas créées apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-left">
                  <tr>
                    <th className="p-4">N° Proforma</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Destination</th>
                    <th className="p-4 text-right">Montant</th>
                    <th className="p-4">Statut</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-4 font-semibold">
                        {r.proforma_number}
                      </td>
                      <td className="p-4">
                        {r.proforma_date
                          ? new Date(r.proforma_date).toLocaleDateString("fr-FR")
                          : "-"}
                      </td>
                      <td className="p-4">{r.customer_name}</td>
                      <td className="p-4">{r.destination || "-"}</td>
                      <td className="p-4 text-right font-semibold">
                        {money(r.total_amount)}
                      </td>
                      <td className="p-4">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
