"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "../../lib/api";
import { formatFCFA } from "../../lib/format";

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
          <p className="text-gray-500">Historique marketplace client et B2B.</p>
        </div>
        <Link href="/marketplace" className="rounded-xl bg-black px-5 py-3 font-bold text-white">Marketplace</Link>
      </div>
      <div className="space-y-4">
        {orders.map((order) => (
          <Link key={order.id} href={`/client/orders/${order.id}`} className="block rounded-2xl bg-white p-5 shadow">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xl font-black">{order.order_number}</p>
                <p className="text-gray-500">{order.vendor_name || "Vendeur"} - {order.status}</p>
              </div>
              <p className="text-2xl font-black text-green-700">{formatFCFA(order.total_amount)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
