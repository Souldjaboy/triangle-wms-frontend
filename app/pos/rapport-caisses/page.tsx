"use client";

import { useEffect, useState } from "react";
import { formatFCFA } from "../../lib/format";

export default function RapportCaissesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [filters, setFilters] = useState({ date_from: "", date_to: "" });

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const loadReport = async () => {
    const params = new URLSearchParams();
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);

    const response = await fetch(`/api/pos/caisses/report?${params.toString()}`, {
      headers: headers(),
    });
    const data = await response.json().catch(() => []);
    setRows(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadReport();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">Rapport des caisses</h1>
          <p className="text-gray-500">Solde, ventes par moyen de paiement, crédits et annulations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="rounded-xl bg-white px-5 py-3 font-bold text-black">
            Imprimer
          </button>
          <a href="/pos/caisses" className="rounded-xl bg-white px-5 py-3 font-bold text-black">
            Gestion caisses
          </a>
          <a href="/pos" className="rounded-xl bg-black px-5 py-3 font-bold text-white">
            Retour caisse
          </a>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl bg-white p-5 shadow md:grid-cols-3 print:hidden">
        <input
          type="date"
          value={filters.date_from}
          onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
          className="rounded-xl border p-3"
        />
        <input
          type="date"
          value={filters.date_to}
          onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
          className="rounded-xl border p-3"
        />
        <button onClick={loadReport} className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black">
          Filtrer
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full min-w-[1100px] text-left">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="p-4">Caisse</th>
              <th>Statut</th>
              <th>Solde initial</th>
              <th>Ventes espèces</th>
              <th>Mobile money</th>
              <th>Carte</th>
              <th>Crédits</th>
              <th>Annulations</th>
              <th>Total encaissé</th>
              <th>Solde final</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-4 font-bold">{row.nom_caisse}</td>
                <td>{row.statut}</td>
                <td>{formatFCFA(row.solde_initial)}</td>
                <td>{formatFCFA(row.ventes_especes)}</td>
                <td>{formatFCFA(row.ventes_mobile_money)}</td>
                <td>{formatFCFA(row.ventes_carte)}</td>
                <td>{formatFCFA(row.credits)}</td>
                <td>{formatFCFA(row.annulations)}</td>
                <td className="font-bold text-green-700">{formatFCFA(row.total_encaisse)}</td>
                <td className="font-bold">{formatFCFA(row.solde_final)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-gray-500">Aucune donnée caisse.</p>}
      </div>
    </div>
  );
}
