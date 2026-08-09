"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "../../lib/api";
import { ArrowLeft, Truck } from "lucide-react";

export default function CementDeliveriesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/cement/deliveries")
      .then((r) => r.json())
      .then((data) =>
        setRows(Array.isArray(data) ? data : data.rows || [])
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/ciment"
          className="mb-3 inline-flex items-center gap-2 text-sm text-gray-600"
        >
          <ArrowLeft size={16} /> Retour au module ciment
        </Link>

        <h1 className="text-3xl font-bold">Bons de livraison</h1>
        <p className="mb-6 text-gray-500">
          Suivi des livraisons de ciment.
        </p>

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center">Chargement...</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <Truck className="mx-auto mb-3" size={42} />
              <h2 className="font-semibold">Aucun bon de livraison</h2>
              <p className="text-gray-500">
                Les BL générés après validation des ventes apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-left">
                  <tr>
                    <th className="p-4">N° BL</th>
                    <th className="p-4">Vente</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Destination</th>
                    <th className="p-4">Tonnage</th>
                    <th className="p-4">Camion</th>
                    <th className="p-4">Chauffeur</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-4 font-semibold">
                        {r.delivery_number}
                      </td>
                      <td className="p-4">{r.sale_number}</td>
                      <td className="p-4">{r.customer_name}</td>
                      <td className="p-4">{r.destination || "-"}</td>
                      <td className="p-4">{r.tonnage || "-"} T</td>
                      <td className="p-4">{r.truck || "-"}</td>
                      <td className="p-4">{r.driver_name || "-"}</td>
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
