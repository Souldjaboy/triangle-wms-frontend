"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "../../lib/api";
import { formatFCFA } from "../../lib/format";

export default function VendorOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const load = async () => {
    const response = await authFetch("/marketplace/vendor/orders");
    setOrders(await response.json().catch(() => []));
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: number, payment_status: string, status = payment_status) => {
    const response = await authFetch(`/marketplace/vendor/orders/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, payment_status }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Commande mise à jour." : data.error || "Erreur statut commande.");
    load();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black">Commandes reçues</h1>
          <p className="text-gray-500">Validation paiement, stock, documents et comptabilité.</p>
        </div>
        <Link href="/vendor/products" className="rounded-xl bg-black px-5 py-3 font-bold text-white">Produits</Link>
      </div>
      {message && <div className="mb-5 rounded-xl bg-yellow-100 p-4 font-bold text-yellow-800">{message}</div>}
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="rounded-2xl bg-white p-5 shadow">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xl font-black">{order.order_number}</p>
                <p className="text-gray-500">{order.customer_name || order.customer_email} - {order.status} / {order.payment_status}</p>
              </div>
              <p className="text-2xl font-black text-green-700">{formatFCFA(order.total_amount)}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => updateStatus(order.id, "paid", "paid")} className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white">Confirmer payé</button>
              <button onClick={() => updateStatus(order.id, "pending", "processing")} className="rounded-xl bg-yellow-500 px-4 py-2 font-bold text-black">En préparation</button>
              <button onClick={() => updateStatus(order.id, "paid", "delivered")} className="rounded-xl bg-black px-4 py-2 font-bold text-white">Livré</button>
              <button onClick={() => updateStatus(order.id, "cancelled", "cancelled")} className="rounded-xl bg-red-100 px-4 py-2 font-bold text-red-700">Annuler</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
