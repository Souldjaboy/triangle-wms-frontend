"use client";

import { useEffect, useState } from "react";

export default function PosRecusPage() {
  const [sales, setSales] = useState<any[]>([]);

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  useEffect(() => {
    fetch("/api/pos/sales", { headers: headers() })
      .then((response) => response.json())
      .then((data) => setSales(Array.isArray(data) ? data : []))
      .catch(() => setSales([]));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-black">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h1 className="text-4xl font-bold">Reçus POS</h1>
          <p className="text-gray-500">Impression et consultation des reçus.</p>
        </div>
        <button onClick={() => window.print()} className="bg-black text-white px-5 py-3 rounded-xl font-bold">Imprimer / PDF</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sales.map((sale) => (
          <div key={sale.id} className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-2xl font-bold">{sale.sale_number}</h2>
            <p>Date : {sale.created_at ? new Date(sale.created_at).toLocaleString("fr-FR") : "-"}</p>
            <p>Caissier : {sale.created_by_name || "-"}</p>
            <p>Paiement : {sale.payment_method} ({sale.payment_status})</p>
            <p className="text-2xl font-bold mt-3">{Number(sale.total_amount || 0).toLocaleString()} FCFA</p>
            <button onClick={() => window.print()} className="mt-4 bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold print:hidden">Imprimer reçu</button>
          </div>
        ))}
      </div>
      {sales.length === 0 && <p className="text-gray-500">Aucun reçu.</p>}
    </div>
  );
}
