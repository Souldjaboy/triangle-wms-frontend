"use client";

import { useEffect, useState } from "react";
import { formatFCFA } from "../../lib/format";

export default function PosPaiementsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<any>(null);

  const isAdmin =
    user?.is_super_admin === true ||
    ["admin", "super_admin"].includes(String(user?.role || "").toLowerCase());

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const loadPayments = async () => {
    const response = await fetch("/api/payments", { headers: headers() });
    const data = await response.json().catch(() => []);
    setPayments(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setUser(JSON.parse(saved));
    loadPayments();
  }, []);

  const statusLabel = (status: string) => {
    if (status === "paid" || status === "payé") return "payé";
    if (status === "failed" || status === "échoué") return "échoué";
    if (status === "cancelled" || status === "annulé") return "annulé";
    if (status === "pending" || status === "en attente") return "en attente";
    return status || "en attente";
  };

  const confirmPayment = async (payment: any, status: "paid" | "failed") => {
    const response = await fetch(
      status === "paid"
        ? "/api/payments/sandbox/success"
        : "/api/payments/sandbox/fail",
      {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        transaction_id: payment.id,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(
      response.ok
        ? `Paiement ${status} : ${payment.provider_reference || payment.id}`
        : data.error || "Erreur confirmation paiement."
    );
    loadPayments();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 pt-20 text-black md:p-8 md:pt-20">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">Paiements POS</h1>
          <p className="text-gray-500">
            Suivi sandbox/provider des paiements carte, mobile money, virement et crédit.
          </p>
        </div>
        <a href="/pos" className="rounded-xl bg-black px-5 py-3 font-bold text-white">
          Retour caisse
        </a>
      </div>

      {message && (
        <div className="mb-5 rounded-xl bg-yellow-100 p-4 font-bold">
          {message}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full text-left">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="p-4">Vente</th>
              <th>Fournisseur</th>
              <th>Méthode</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Référence</th>
              <th>Téléphone</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t">
                <td className="p-4 font-bold">{payment.sale_number || payment.sale_id || "-"}</td>
                <td>{payment.provider_key || "-"}</td>
                <td>{payment.payment_method || payment.provider_key || "-"}</td>
                <td>{formatFCFA(payment.amount)}</td>
                <td>
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-bold">
                    {statusLabel(payment.status)}
                  </span>
                </td>
                <td className="font-mono text-sm">
                  {payment.provider_reference || payment.external_reference || "-"}
                </td>
                <td>{payment.phone_number || "-"}</td>
                <td>
                  {payment.created_at
                    ? new Date(payment.created_at).toLocaleString("fr-FR")
                    : "-"}
                </td>
                <td className="space-x-2">
                  {isAdmin && !["paid", "payé"].includes(payment.status) && (
                    <button
                      onClick={() => confirmPayment(payment, "paid")}
                      className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white"
                    >
                      Simuler réussi
                    </button>
                  )}
                  {isAdmin && !["failed", "échoué"].includes(payment.status) && (
                    <button
                      onClick={() => confirmPayment(payment, "failed")}
                      className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white"
                    >
                      Simuler échoué
                    </button>
                  )}
                  {payment.sale_id && (
                    <a
                      href={`/pos/recus?sale=${payment.sale_id}`}
                      className="inline-block rounded-xl bg-yellow-500 px-4 py-2 font-bold text-black"
                    >
                      Reçu
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && (
          <p className="p-6 text-gray-500">Aucun paiement enregistré.</p>
        )}
      </div>
    </div>
  );
}
