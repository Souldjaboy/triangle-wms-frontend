"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "../../lib/api";
import { formatFCFA } from "../../lib/format";

const statusOrder = [
  "En attente",
  "Acceptée",
  "Paiement confirmé",
  "En préparation",
  "Prête",
  "Expédiée",
  "Livrée",
  "Clôturée",
  "Annulée",
  "Refusée",
];

const statusAliases: Record<string, string> = {
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

function normalizeStatus(value: string) {
  const raw = String(value || "En attente").trim();
  const key = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return statusAliases[key] || raw;
}

function isAtLeast(current: string, target: string) {
  const currentIndex = statusOrder.indexOf(normalizeStatus(current));
  const targetIndex = statusOrder.indexOf(target);
  return currentIndex >= targetIndex && currentIndex !== -1 && targetIndex !== -1;
}

function isFinal(status: string) {
  return ["Clôturée", "Annulée", "Refusée"].includes(normalizeStatus(status));
}

export default function VendorOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  const load = async () => {
    const response = await authFetch("/marketplace/vendor/orders");
    setOrders(await response.json().catch(() => []));
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: number, payment_status: string, status = payment_status, vendor_message = "") => {
    if (busyOrderId) return;
    setBusyOrderId(id);
    const response = await authFetch(`/marketplace/vendor/orders/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, payment_status, vendor_message }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Commande mise à jour." : data.error || "Erreur statut commande.");
    await load();
    setBusyOrderId(null);
  };

  const addPayment = async (order: any) => {
    if (busyOrderId) return;
    const amountText = window.prompt("Montant du paiement reçu");
    const amount = Number(String(amountText || "").replace(/\s/g, "").replace(",", "."));
    if (!amount || amount <= 0) return;
    setBusyOrderId(order.id);
    const response = await authFetch(`/marketplace/vendor/orders/${order.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        method: order.payment_method || "Espèces",
        notes: "Paiement enregistré depuis commandes reçues",
      }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? data.message || "Paiement enregistré." : data.error || "Erreur paiement.");
    await load();
    setBusyOrderId(null);
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
                <p className="text-gray-500">
                  {order.customer_name || order.customer_email} - {normalizeStatus(order.status)} / {order.payment_status || "En attente"}
                </p>
                <p className="text-sm text-gray-500">
                  {order.delivery_method || "Retrait sur place"} - {order.delivery_city || order.delivery_address || "Adresse non renseignée"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-green-700">{formatFCFA(order.total_amount)}</p>
                <p className="text-sm font-bold text-gray-500">Payé : {formatFCFA(order.amount_paid)}</p>
                <p className="text-sm font-bold text-red-600">Reste : {formatFCFA(order.amount_due ?? Math.max(Number(order.total_amount || 0) - Number(order.amount_paid || 0), 0))}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={busyOrderId === order.id || isAtLeast(order.status, "Acceptée") || isFinal(order.status)} onClick={() => updateStatus(order.id, order.payment_status || "En attente", "Acceptée", "Commande acceptée par le vendeur.")} className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Accepter</button>
              <button disabled={busyOrderId === order.id || isFinal(order.status)} onClick={() => updateStatus(order.id, order.payment_status || "En attente", "Refusée", "Commande refusée par le vendeur.")} className="rounded-xl bg-red-100 px-4 py-2 font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40">Refuser</button>
              <button disabled={busyOrderId === order.id || isFinal(order.status)} onClick={() => addPayment(order)} className="rounded-xl bg-white px-4 py-2 font-bold text-black shadow disabled:cursor-not-allowed disabled:opacity-40">Ajouter un paiement</button>
              <button disabled={busyOrderId === order.id || Number(order.amount_due ?? Math.max(Number(order.total_amount || 0) - Number(order.amount_paid || 0), 0)) > 0 || isAtLeast(order.status, "Paiement confirmé") || isFinal(order.status)} onClick={() => updateStatus(order.id, "Payé", "Paiement confirmé", "Paiement confirmé par le vendeur.")} className="rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Confirmer paiement</button>
              <button disabled={busyOrderId === order.id || !isAtLeast(order.status, "Paiement confirmé") || isAtLeast(order.status, "En préparation") || isFinal(order.status)} onClick={() => updateStatus(order.id, order.payment_status || "En attente", "En préparation", "Commande en préparation.")} className="rounded-xl bg-yellow-500 px-4 py-2 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">Préparation</button>
              <button disabled={busyOrderId === order.id || !isAtLeast(order.status, "En préparation") || isAtLeast(order.status, "Prête") || isFinal(order.status)} onClick={() => updateStatus(order.id, order.payment_status || "En attente", "Prête", "Commande prête.")} className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Prêt</button>
              <button disabled={busyOrderId === order.id || !isAtLeast(order.status, "Prête") || isAtLeast(order.status, "Expédiée") || isFinal(order.status)} onClick={() => updateStatus(order.id, order.payment_status || "En attente", "Expédiée", "Commande expédiée.")} className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Expédié</button>
              <button disabled={busyOrderId === order.id || !isAtLeast(order.status, "Expédiée") || isFinal(order.status)} onClick={() => updateStatus(order.id, "Payé", "Livrée", "Commande livrée et clôturée.")} className="rounded-xl bg-black px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Livré</button>
              <button disabled={busyOrderId === order.id || isFinal(order.status)} onClick={() => updateStatus(order.id, "Annulé", "Annulée", "Commande annulée.")} className="rounded-xl bg-gray-200 px-4 py-2 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">Annuler</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
