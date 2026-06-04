"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch } from "../../../lib/api";
import { formatFCFA } from "../../../lib/format";

export default function ClientOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");

  const load = () => {
    authFetch(`/marketplace/orders/${params.id}`)
      .then((response) => response.json())
      .then(setData)
      .catch(() => setData(null));
  };

  useEffect(() => {
    load();
  }, [params.id]);

  const receiveOrder = async () => {
    const response = await authFetch(`/marketplace/orders/${params.id}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await response.json().catch(() => ({}));
    setMessage(response.ok ? payload.message || "Réception créée." : payload.error || "Erreur réception.");
    if (response.ok) load();
  };

  if (!data?.order) return <div className="min-h-screen bg-gray-100 p-8 font-bold">Chargement commande...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <Link href="/client/orders" className="font-bold text-gray-600">Retour commandes</Link>
      {message && <div className="mt-4 rounded-xl bg-yellow-50 p-4 font-bold">{message}</div>}
      <div className="mt-5 rounded-2xl bg-white p-6 shadow">
        <h1 className="text-4xl font-black">{data.order.order_number}</h1>
        <p className="mt-2 text-gray-500">Statut : {data.order.status} - Paiement : {data.order.payment_status}</p>
        <p className="mt-4 text-3xl font-black text-green-700">{formatFCFA(data.order.total_amount)}</p>
        {String(data.order.order_type || "").toUpperCase() === "B2B" && data.order.stock_entry_created !== true && (
          <button onClick={receiveOrder} className="mt-5 rounded-xl bg-yellow-500 px-5 py-3 font-black text-black">
            Créer l'entrée stock après réception
          </button>
        )}
        <div className="mt-6 space-y-3">
          {(data.items || []).map((item: any) => (
            <div key={item.id} className="flex justify-between rounded-xl bg-gray-50 p-4">
              <span>{item.product_name}</span>
              <strong>{Number(item.quantity || 0).toLocaleString("fr-FR")} x {formatFCFA(item.unit_price)}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
