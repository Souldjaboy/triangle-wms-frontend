"use client";

import { useEffect, useState } from "react";
import { formatFCFA } from "../../lib/format";

export default function PosVentesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [caisses, setCaisses] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    date_from: "",
    date_to: "",
    payment_method: "",
    status: "",
    product: "",
    cashier: "",
    cash_register_id: "",
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
    const [salesResponse, summaryResponse] = await Promise.all([
      fetch(`/api/pos/sales?${params.toString()}`, { headers: headers() }),
      fetch(`/api/pos/sales-summary?${params.toString()}`, { headers: headers() }),
    ]);
    const data = await salesResponse.json().catch(() => []);
    const summaryData = await summaryResponse.json().catch(() => null);
    setSales(Array.isArray(data) ? data : []);
    setSummary(summaryData || null);
  };

  const fetchCaisses = async () => {
    const response = await fetch("/api/pos/caisses", { headers: headers() });
    const data = await response.json().catch(() => []);
    setCaisses(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchSales();
    fetchCaisses();
  }, []);

  const exportCsv = () => {
    const rows = [
      ["Numéro", "Total", "Paiement", "Statut", "Caissier", "Client", "Caisse", "Date"],
      ...sales.map((sale) => [
        sale.sale_number,
        sale.total_amount,
        sale.payment_method,
        sale.status,
        sale.created_by_name || "",
        sale.customer_name || "",
        sale.nom_caisse || sale.cash_register_id || "",
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

  const totals = summary?.totals || {};
  const totalSalesCount = Number(totals.nombre_ventes || 0);
  const totalSalesAmount = Number(totals.total_vendu || 0);
  const totalCollected = Number(totals.total_encaisse || 0);
  const totalCredit = Number(totals.total_credit || 0);
  const totalCancelled = Number(totals.total_annule || 0);
  const averageSale = Number(totals.montant_moyen || 0);

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
      <div className="bg-white rounded-2xl shadow p-4 mb-5 grid grid-cols-1 md:grid-cols-4 xl:grid-cols-9 gap-3 print:hidden">
        <input value={filters.q} onChange={(e) => updateFilter("q", e.target.value)} placeholder="Vente ou client..." className="border p-3 rounded-xl" />
        <input value={filters.product} onChange={(e) => updateFilter("product", e.target.value)} placeholder="Produit..." className="border p-3 rounded-xl" />
        <input value={filters.cashier} onChange={(e) => updateFilter("cashier", e.target.value)} placeholder="Utilisateur / caissier..." className="border p-3 rounded-xl" />
        <select value={filters.cash_register_id} onChange={(e) => updateFilter("cash_register_id", e.target.value)} className="border p-3 rounded-xl">
          <option value="">Toutes caisses</option>
          {caisses.map((caisse) => (
            <option key={caisse.id} value={caisse.id}>{caisse.nom_caisse}</option>
          ))}
        </select>
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
              <th>Caisse</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-t">
                <td className="p-4 font-bold">{sale.sale_number}</td>
              <td>{formatFCFA(sale.total_amount)}</td>
                <td>{sale.payment_method} ({sale.payment_status})</td>
                <td>{sale.status}</td>
                <td>{sale.created_by_name || "-"}</td>
                <td>{sale.customer_name || "-"}</td>
                <td>{sale.nom_caisse || sale.cash_register_id || "-"}</td>
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

      <div className="bg-black text-white rounded-2xl p-6 mt-6">
        <h2 className="text-2xl font-bold mb-4">
          Résumé des ventes
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-gray-300">Nombre de ventes</p>
            <p className="text-3xl font-bold">
              {totalSalesCount}
            </p>
          </div>

          <div>
            <p className="text-gray-300">Total vendu</p>
            <p className="text-3xl font-bold text-yellow-400">
              {formatFCFA(totalSalesAmount)}
            </p>
          </div>

          <div>
            <p className="text-gray-300">Total encaissé</p>
            <p className="text-3xl font-bold text-green-400">
              {formatFCFA(totalCollected)}
            </p>
          </div>

          <div>
            <p className="text-gray-300">Total crédit</p>
            <p className="text-3xl font-bold text-orange-300">
              {formatFCFA(totalCredit)}
            </p>
          </div>

          <div>
            <p className="text-gray-300">Total annulé</p>
            <p className="text-3xl font-bold text-red-300">
              {formatFCFA(totalCancelled)}
            </p>
          </div>

          <div>
            <p className="text-gray-300">Montant moyen</p>
            <p className="text-3xl font-bold text-green-400">
              {formatFCFA(averageSale)}
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-700 pt-5">
          <h3 className="mb-3 text-xl font-bold">Total par caisse</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(summary?.by_caisse || []).map((row: any) => (
              <div key={`${row.caisse_id}-${row.nom_caisse}`} className="rounded-xl bg-white/10 p-4">
                <p className="text-gray-300">{row.nom_caisse || "Sans caisse"}</p>
                <p className="text-2xl font-bold text-yellow-400">{formatFCFA(row.total_vendu)}</p>
                <p className="text-sm text-gray-300">{row.nombre_ventes || 0} vente(s)</p>
              </div>
            ))}
            {(summary?.by_caisse || []).length === 0 && (
              <p className="text-gray-300">Aucune vente par caisse sur cette période.</p>
            )}
          </div>
        </div>
      </div>

      </div>
    </div>
  );
}
