"use client";

import { useEffect, useState } from "react";

export default function PosVentesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const fetchSales = async () => {
    const response = await fetch("/api/pos/sales", { headers: headers() });
    const data = await response.json().catch(() => []);
    setSales(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const cancelSale = async (id: number) => {
    const reason = prompt("Motif d’annulation", "");
    if (reason === null) return;

    const response = await fetch(`/api/pos/sales/${id}/cancel`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ reason }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Vente annulée et stock restauré." : data.error || "Erreur annulation.");
    fetchSales();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-black">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-4xl font-bold">Ventes POS</h1>
          <p className="text-gray-500">Historique des ventes et annulations.</p>
        </div>
        <a href="/pos" className="bg-black text-white px-5 py-3 rounded-xl font-bold">Retour caisse</a>
      </div>
      {message && <div className="bg-yellow-100 p-4 rounded-xl mb-4 font-bold">{message}</div>}
      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="p-4">Numéro</th>
              <th>Total</th>
              <th>Paiement</th>
              <th>Statut</th>
              <th>Caissier</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-t">
                <td className="p-4 font-bold">{sale.sale_number}</td>
                <td>{Number(sale.total_amount || 0).toLocaleString()} FCFA</td>
                <td>{sale.payment_method} ({sale.payment_status})</td>
                <td>{sale.status}</td>
                <td>{sale.created_by_name || "-"}</td>
                <td>{sale.created_at ? new Date(sale.created_at).toLocaleString("fr-FR") : "-"}</td>
                <td className="space-x-2">
                  <a href={`/pos/recus?sale=${sale.id}`} className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold inline-block">Reçu</a>
                  {sale.status !== "annulée" && (
                    <button onClick={() => cancelSale(sale.id)} className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold">Annuler</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sales.length === 0 && <p className="p-6 text-gray-500">Aucune vente.</p>}
      </div>
    </div>
  );
}
