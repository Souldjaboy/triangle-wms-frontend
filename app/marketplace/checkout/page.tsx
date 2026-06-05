"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch, getAuthToken } from "../../lib/api";

export default function MarketplaceCheckoutPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    delivery_address: "",
    payment_method: "Espèces",
    notes: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!getAuthToken()) {
      window.location.href = "/client/login?redirect=/marketplace/checkout";
    }
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await authFetch("/marketplace/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || "Erreur création commande.");
      return;
    }
    router.push("/client/orders");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <h1 className="mb-6 text-4xl font-black">Validation commande</h1>
      {message && <div className="mb-5 rounded-xl bg-red-100 p-4 font-bold text-red-700">{message}</div>}
      <form onSubmit={submit} className="mx-auto grid max-w-3xl grid-cols-1 gap-4 rounded-2xl bg-white p-6 shadow">
        <input className="rounded-xl border p-4" placeholder="Nom client" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
        <input className="rounded-xl border p-4" placeholder="Email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
        <input className="rounded-xl border p-4" placeholder="Téléphone" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
        <textarea className="rounded-xl border p-4" placeholder="Adresse de livraison" value={form.delivery_address} onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} />
        <select className="rounded-xl border p-4" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
          {["Espèces", "Virement", "Orange Money", "Moov Money", "Wave", "Carte bancaire", "Crédit client"].map((method) => <option key={method}>{method}</option>)}
        </select>
        <textarea className="rounded-xl border p-4" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button className="rounded-xl bg-yellow-500 py-4 font-black text-black">Créer la commande</button>
      </form>
    </div>
  );
}
