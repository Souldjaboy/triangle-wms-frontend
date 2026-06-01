"use client";

import { useEffect, useState } from "react";

export default function PosVentesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    date_from: "",
    date_to: "",
    payment_method: "",
    status: "",
  });

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const fetchSales = async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const response = await fetch(`/api/pos/sales?${params.toString()}`, { headers: headers() });
    const data = await response.json().catch(() => []);
    setSales(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const exportCsv = () => {
    const rows = [
      ["Numéro", "Total", "Paiement", "Statut", "Caissier", "Client", "Date"],
      ...sales.map((sale) => [
        sale.sale_number,
        sale.total_amount,
        sale.payment_method,
        sale.status,
        sale.created_by_name || "",
        sale.customer_name || "",
        sale.created_at || "",
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ventes-pos.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const updateFilter = (field: string, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

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
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-6">
        <div>
          <h1 className="text-4xl font-bold">Ventes POS</h1>
          <p className="text-gray-500">Historique des ventes et annulations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} className="bg-white text-black px-5 py-3 rounded-xl font-bold">Export Excel</button>
          <button onClick={() => window.print()} className="bg-white text-black px-5 py-3 rounded-xl font-bold">PDF / imprimer</button>
          <a href="/pos" className="bg-black text-white px-5 py-3 rounded-xl font-bold">Retour caisse</a>
        </div>
      </div>
      {message && <div className="bg-yellow-100 p-4 rounded-xl mb-4 font-bold">{message}</div>}
      <div className="bg-white rounded-2xl shadow p-4 mb-5 grid grid-cols-1 md:grid-cols-7 gap-3 print:hidden">
        <input value={filters.q} onChange={(e) => updateFilter("q", e.target.value)} placeholder="Vente, client, caissier..." className="border p-3 rounded-xl md:col-span-2" />
        <input type="date" value={filters.date_from} onChange={(e) => updateFilter("date_from", e.target.value)} className="border p-3 rounded-xl" />
        <input type="date" value={filters.date_to} onChange={(e) => updateFilter("date_to", e.target.value)} className="border p-3 rounded-xl" />
        <select value={filters.payment_method} onChange={(e) => updateFilter("payment_method", e.target.value)} className="border p-3 rounded-xl">
          <option value="">Tous paiements</option>
          <option>Espèces</option>
          <option>Carte bancaire</option>
          <option>Orange Money</option>
          <option>Moov Money</option>
          <option>Wave</option>
          <option>Virement</option>
        </select>
        <select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)} className="border p-3 rounded-xl">
          <option value="">Tous statuts</option>
          <option value="validée">Validée</option>
          <option value="en attente">En attente</option>
          <option value="annulée">Annulée</option>
        </select>
        <button onClick={fetchSales} className="bg-yellow-500 text-black px-5 py-3 rounded-xl font-bold">Filtrer</button>
      </div>
      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="p-4">Numéro</th>
              <th>Total</th>
              <th>Paiement</th>
              <th>Statut</th>
              <th>Caissier</th>
              <th>Client</th>
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
                <td>{sale.customer_name || "-"}</td>
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
