"use client";

import { useEffect, useState } from "react";

export default function InventairesPage() {
  const [inventories, setInventories] = useState<any[]>([]);

  const fetchInventories = async () => {
    try {
      const response = await fetch("/api/inventory-history");
      const data = await response.json();

      setInventories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setInventories([]);
    }
  };

  useEffect(() => {
    fetchInventories();
  }, []);

  const getDifferenceColor = (difference: number) => {
    if (difference > 0) return "text-green-600";
    if (difference < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getStatusColor = (status: string) => {
    if (status === "Validé") return "text-green-600";
    if (status === "Refusé") return "text-red-600";
    return "text-yellow-600";
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Historique des inventaires
      </h1>

      <p className="text-gray-500 mb-8">
        Suivi des stocks théoriques, stocks réels et écarts constatés.
      </p>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold text-black mb-5">
          Liste des inventaires
        </h2>

        {inventories.length === 0 ? (
          <p className="text-gray-500">
            Aucun historique d’inventaire pour le moment.
          </p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-3">Produit</th>
                <th>Stock système</th>
                <th>Stock réel</th>
                <th>Écart</th>
                <th>Entrepôt</th>
                <th>Emplacement</th>
                <th>Utilisateur</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {inventories.map((inventory: any) => (
                <tr key={inventory.id} className="border-b">
                  <td className="py-4 font-bold">
                    {inventory.product_reference} - {inventory.product_name}
                  </td>

                  <td>{inventory.system_stock}</td>

                  <td>{inventory.real_stock}</td>

                  <td className={`font-bold ${getDifferenceColor(Number(inventory.difference))}`}>
                    {inventory.difference > 0 ? "+" : ""}
                    {inventory.difference}
                  </td>

                  <td>{inventory.warehouse}</td>

                  <td className="font-bold text-blue-600">
                    {inventory.location_code || "-"}
                  </td>

                  <td>
                    {inventory.user_name} ({inventory.user_role})
                  </td>

                  <td className={`font-bold ${getStatusColor(inventory.status)}`}>
                    {inventory.status}
                  </td>

                  <td>
                    {inventory.created_at
                      ? new Date(inventory.created_at).toLocaleString("fr-FR")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}