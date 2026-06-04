"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiUrl } from "../../../../../lib/api";
import { formatFCFA } from "../../../../../lib/format";

export default function RestaurantPublicTablePage() {
  const params = useParams<{ companyId: string; tableId: string }>();
  const [data, setData] = useState<any>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [customer, setCustomer] = useState({ customer_name: "", customer_phone: "" });
  const [message, setMessage] = useState("");

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0),
    [cart]
  );

  const load = async () => {
    const response = await fetch(apiUrl(`/restaurant/public/${params.companyId}/table/${params.tableId}`));
    const payload = await response.json().catch(() => ({}));
    setData(payload);
  };

  useEffect(() => {
    load();
  }, [params.companyId, params.tableId]);

  const add = (item: any) => {
    setCart((current) => {
      const existing = current.find((row) => row.id === item.id);
      if (existing) {
        return current.map((row) => row.id === item.id ? { ...row, quantity: Number(row.quantity || 1) + 1 } : row);
      }
      return [...current, { ...item, quantity: 1 }];
    });
  };

  const submit = async () => {
    setMessage("");
    const response = await fetch(apiUrl(`/restaurant/public/${params.companyId}/table/${params.tableId}/orders`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...customer,
        items: cart.map((item) => ({ menu_item_id: item.id, quantity: item.quantity })),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload?.error || "Erreur commande.");
      return;
    }
    setCart([]);
    setMessage(`Commande envoyée. Numéro ${payload.id}`);
  };

  const callServer = async () => {
    await fetch(apiUrl(`/restaurant/public/${params.companyId}/table/${params.tableId}/call`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Client demande un serveur" }),
    });
    setMessage("Serveur appelé.");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="rounded-2xl bg-black p-5 text-white shadow">
          <p className="text-sm font-bold text-yellow-400">Triangle WMS Restaurant</p>
          <h1 className="mt-2 text-3xl font-black">Table {data?.table?.table_number || params.tableId}</h1>
          <p className="text-gray-300">Choisissez vos plats, envoyez la commande ou appelez un serveur.</p>
        </header>

        {message && <div className="rounded-xl bg-yellow-50 p-4 font-bold">{message}</div>}

        <section className="grid gap-4 md:grid-cols-[1fr_340px]">
          <div className="grid gap-3">
            {(data?.menu || []).map((item: any) => (
              <button key={item.id} onClick={() => add(item)} className="rounded-2xl bg-white p-4 text-left shadow">
                <div className="flex justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black">{item.name}</h2>
                    <p className="text-sm text-gray-500">{item.description}</p>
                    <p className="mt-1 text-xs font-bold uppercase text-gray-400">{item.category}</p>
                  </div>
                  <p className="font-black text-yellow-600">{formatFCFA(item.price)}</p>
                </div>
              </button>
            ))}
          </div>

          <aside className="rounded-2xl bg-white p-4 shadow">
            <h2 className="text-xl font-black">Panier</h2>
            <div className="mt-3 space-y-2">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between border-b pb-2 text-sm">
                  <span>{item.name} x {item.quantity}</span>
                  <span className="font-bold">{formatFCFA(Number(item.price || 0) * Number(item.quantity || 1))}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-2xl font-black">{formatFCFA(total)}</p>
            <input
              className="mt-4 w-full rounded-xl border p-3"
              placeholder="Nom client"
              value={customer.customer_name}
              onChange={(e) => setCustomer({ ...customer, customer_name: e.target.value })}
            />
            <input
              className="mt-2 w-full rounded-xl border p-3"
              placeholder="Téléphone"
              value={customer.customer_phone}
              onChange={(e) => setCustomer({ ...customer, customer_phone: e.target.value })}
            />
            <button onClick={submit} disabled={cart.length === 0} className="mt-4 w-full rounded-xl bg-yellow-500 p-3 font-black text-black">
              Envoyer commande
            </button>
            <button onClick={callServer} className="mt-2 w-full rounded-xl bg-black p-3 font-black text-white">
              Appeler serveur
            </button>
          </aside>
        </section>
      </div>
    </main>
  );
}
