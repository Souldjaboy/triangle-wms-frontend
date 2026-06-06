"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "../../lib/api";
import { formatFCFA } from "../../lib/format";

const orderStatusLabels: Record<string, string> = {
  pending: "En attente",
  pending_payment: "En attente",
  confirmed: "Acceptée",
  accepted: "Acceptée",
  paid: "Paiement confirmé",
  preparing: "En préparation",
  ready: "Prête",
  shipped: "Expédiée",
  delivered: "Livrée",
  closed: "Clôturée",
  completed: "Clôturée",
  cancelled: "Annulée",
  canceled: "Annulée",
  rejected: "Refusée",
  refused: "Refusée",
  received: "Clôturée",
};

function statusLabel(value: string) {
  const raw = String(value || "En attente").trim();
  const key = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return orderStatusLabels[key] || raw;
}

export default function ClientOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    authFetch("/marketplace/orders/my")
      .then((response) => response.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black">Mes commandes</h1>
          <p className="text-gray-500">Historique des commandes.</p>
        </div>
        <Link href="/marketplace" className="rounded-xl bg-black px-5 py-3 font-bold text-white">Marketplace</Link>
      </div>
      <div className="space-y-4">
        {orders.map((order) => (
          <Link key={order.id} href={`/client/orders/${order.id}`} className="block rounded-2xl bg-white p-5 shadow">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xl font-black">{order.order_number}</p>
                <p className="text-gray-500">{order.vendor_name || "Vendeur"} - {statusLabel(order.status)}</p>
                <p className="text-sm font-bold text-gray-500">
                  Payé : {formatFCFA(order.amount_paid)} · Reste : {formatFCFA(order.amount_due ?? Math.max(Number(order.total_amount || 0) - Number(order.amount_paid || 0), 0))}
                </p>
              </div>
              <p className="text-2xl font-black text-green-700">{formatFCFA(order.total_amount)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
