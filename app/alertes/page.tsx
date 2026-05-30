"use client";

import { useEffect, useState } from "react";

export default function AlertesPage() {
  const [alerts, setAlerts] = useState<any>(null);

  const fetchAlerts = async () => {
    const response = await fetch("/api/alerts", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
    });
    const data = await response.json();
    setAlerts(data);
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  if (!alerts) {
    return <div className="p-8 text-black">Chargement des alertes...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Alertes
      </h1>

      <p className="text-gray-500 mb-8">
        Surveillance automatique des stocks et validations.
      </p>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Stock faible</p>
          <h2 className="text-3xl font-bold text-yellow-600">
            {alerts.totals.stock_faible}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Ruptures</p>
          <h2 className="text-3xl font-bold text-red-600">
            {alerts.totals.rupture_stock}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">En attente</p>
          <h2 className="text-3xl font-bold text-blue-600">
            {alerts.totals.validations_en_attente}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Refusés</p>
          <h2 className="text-3xl font-bold text-gray-600">
            {alerts.totals.mouvements_refuses}
          </h2>
        </div>
      </div>

      <Section title="Produits en stock faible" data={alerts.stock_faible} actionType="product" />
      <Section title="Produits en rupture" data={alerts.rupture_stock} actionType="product" />
      <Section title="Validations en attente" data={alerts.validations_en_attente} actionType="movement" />
      <Section title="Mouvements refusés" data={alerts.mouvements_refuses} actionType="movement" />
    </div>
  );
}

function Section({ title, data, actionType }: any) {
  return (
    <div className="bg-white rounded-2xl shadow p-6 mb-8">
      <h2 className="text-2xl font-bold text-black mb-5">
        {title}
      </h2>

      {data.length === 0 ? (
        <p className="text-gray-500">Aucune alerte.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-3">Référence</th>
              <th>Produit</th>
              <th>Stock / Quantité</th>
              <th>Entrepôt</th>
              <th>Emplacement</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item: any, index: number) => (
              <tr key={index} className="border-b">
                <td className="py-4 font-bold">
                  {item.reference || item.product_reference || "-"}
                </td>

                <td>{item.name || item.product_name || "-"}</td>

                <td>
                  {item.stock !== undefined
                    ? item.stock
                    : item.quantity || "-"}
                </td>

                <td>{item.warehouse || "-"}</td>

                <td>{item.location_code || "-"}</td>

                <td className="font-bold">
                  {item.status || "-"}
                </td>

                <td>
                  <a
                    href={
                      actionType === "movement"
                        ? `/stocks?movement=${item.id || ""}`
                        : `/stocks?product=${encodeURIComponent(
                            item.reference || item.product_reference || ""
                          )}`
                    }
                    className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold inline-block"
                  >
                    Ouvrir
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
