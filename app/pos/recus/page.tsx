"use client";

import { useEffect, useState } from "react";

export default function PosRecusPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  useEffect(() => {
    fetch("/api/pos/sales", { headers: headers() })
      .then((response) => response.json())
      .then((data) => setSales(Array.isArray(data) ? data : []))
      .catch(() => setSales([]));
  }, []);

  const printSaleReceipt = async (saleId: number) => {
    const response = await fetch(`/api/pos/sales/${saleId}`, { headers: headers() });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error || "Erreur lecture reçu.");
      return;
    }

    const receipt = data.receipt || {};
    const sale = data.sale || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const receiptWindow = window.open("", "_blank", "width=420,height=720");
    if (!receiptWindow) return;

    receiptWindow.document.write(`
      <html>
        <head>
          <title>${receipt.receipt_number || sale.sale_number}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 12px; }
            .receipt { max-width: 300px; margin: 0 auto; }
            h1 { font-size: 18px; text-align: center; margin: 0 0 8px; }
            p { margin: 4px 0; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
            th, td { border-bottom: 1px dashed #999; padding: 5px 0; text-align: left; }
            .right { text-align: right; }
            .total { font-size: 16px; font-weight: 700; text-align: right; margin-top: 10px; }
            @page { size: 80mm auto; margin: 4mm; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <h1>TRIANGLE WMS PRO</h1>
            <p>Reçu : ${receipt.receipt_number || "-"}</p>
            <p>Vente : ${sale.sale_number || "-"}</p>
            <p>Date : ${sale.created_at ? new Date(sale.created_at).toLocaleString("fr-FR") : "-"}</p>
            <p>Caissier : ${sale.created_by_name || "-"}</p>
            <p>Client : ${sale.customer_name || "-"}</p>
            <table>
              <thead><tr><th>Produit</th><th>Qté</th><th class="right">Total</th></tr></thead>
              <tbody>
                ${items.map((item: any) => `<tr><td>${item.product_name}</td><td>${item.quantity}</td><td class="right">${Number(item.total_price || 0).toLocaleString()} FCFA</td></tr>`).join("")}
              </tbody>
            </table>
            <p class="right">Remise : ${Number(sale.discount_amount || 0).toLocaleString()} FCFA</p>
            <p class="right">TVA : ${Number(sale.tax_amount || 0).toLocaleString()} FCFA</p>
            <p class="total">Total : ${Number(sale.total_amount || 0).toLocaleString()} FCFA</p>
            <p>Paiement : ${sale.payment_method || "-"} (${sale.payment_status || "-"})</p>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-black">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h1 className="text-4xl font-bold">Reçus POS</h1>
          <p className="text-gray-500">Impression et consultation des reçus.</p>
        </div>
        <a href="/pos" className="bg-black text-white px-5 py-3 rounded-xl font-bold">Retour caisse</a>
      </div>
      {message && <div className="bg-red-100 text-red-700 p-4 rounded-xl mb-5 font-bold">{message}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sales.map((sale) => (
          <div key={sale.id} className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-2xl font-bold">{sale.sale_number}</h2>
            <p>Date : {sale.created_at ? new Date(sale.created_at).toLocaleString("fr-FR") : "-"}</p>
            <p>Caissier : {sale.created_by_name || "-"}</p>
            <p>Paiement : {sale.payment_method} ({sale.payment_status})</p>
            <p className="text-2xl font-bold mt-3">{Number(sale.total_amount || 0).toLocaleString()} FCFA</p>
            <button onClick={() => printSaleReceipt(sale.id)} className="mt-4 bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold print:hidden">Imprimer ce reçu</button>
          </div>
        ))}
      </div>
      {sales.length === 0 && <p className="text-gray-500">Aucun reçu.</p>}
    </div>
  );
}
