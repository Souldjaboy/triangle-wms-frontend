"use client";

import { useEffect, useState } from "react";
import { authHeaders } from "../../lib/api";

const labels: Record<string, string> = {
  stock_faible: "Stock faible",
  rupture: "Rupture",
  prix_non_configure: "Prix non configuré",
  produit_bloque: "Produit bloqué",
  lot_expire: "Lot expiré",
  expire_7_jours: "Expire dans 7 jours",
  expire_30_jours: "Expire dans 30 jours",
  expire_90_jours: "Expire dans 90 jours",
};

export default function PosAlertesPage() {
  const [alerts, setAlerts] = useState<any[]>([]);

  const headers = () => authHeaders();

  const load = async () => {
    const response = await fetch("/api/pos/alerts", { headers: headers() });
    const data = await response.json().catch(() => []);
    setAlerts(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-black">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Alertes POS / Pharmacie</h1>
          <p className="text-gray-500">Stock, prix, produits bloqués et lots proches expiration.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="bg-white text-black px-5 py-3 rounded-xl font-bold">Actualiser</button>
          <a href="/pos" className="bg-black text-white px-5 py-3 rounded-xl font-bold">Retour caisse</a>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="p-4">Alerte</th>
              <th>Produit / lot</th>
              <th>Stock</th>
              <th>Expiration</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert, index) => {
              const code = alert.reference || alert.product_reference || alert.product_id || "";
              return (
                <tr key={`${alert.type}-${alert.id}-${index}`} className="border-t">
                  <td className="p-4 font-bold">{labels[alert.type] || alert.type}</td>
                  <td>{alert.name || alert.product_name || alert.lot_number || "-"}</td>
                  <td>{alert.stock ?? alert.quantity_remaining ?? "-"}</td>
                  <td>{alert.expiration_date || "-"}</td>
                  <td>
                    {code ? (
                      <a href={`/scan/product/${encodeURIComponent(code)}`} className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold inline-block">
                        Ouvrir
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {alerts.length === 0 && <p className="p-6 text-gray-500">Aucune alerte POS.</p>}
      </div>
    </div>
  );
}
