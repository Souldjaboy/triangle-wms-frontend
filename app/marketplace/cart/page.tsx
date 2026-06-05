"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch, getAuthToken } from "../../lib/api";
import { formatFCFA } from "../../lib/format";

export default function MarketplaceCartPage() {
  const [cart, setCart] = useState<any>({ items: [], total: 0 });
  const [message, setMessage] = useState("");

  const loadCart = async () => {
    const response = await authFetch("/marketplace/cart");
    const data = await response.json().catch(() => ({ items: [], total: 0 }));
    setCart(data);
  };

  useEffect(() => {
    if (!getAuthToken()) {
      window.location.href = "/client/login?redirect=/marketplace/cart";
      return;
    }
    loadCart();
  }, []);

  const removeItem = async (id: number) => {
    const response = await authFetch(`/marketplace/cart/items/${id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setCart(data);
    else setMessage(data.error || "Erreur suppression article.");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black">Panier Marketplace</h1>
          <p className="text-gray-500">Vos articles B2B/B2C avant commande.</p>
        </div>
        <Link href="/marketplace" className="rounded-xl bg-black px-5 py-3 font-bold text-white">Catalogue</Link>
      </div>
      {message && <div className="mb-5 rounded-xl bg-red-100 p-4 font-bold text-red-700">{message}</div>}
      <div className="space-y-4">
        {(cart.items || []).map((item: any) => (
          <div key={item.id} className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xl font-black">{item.title || item.product_name}</p>
              <p className="text-gray-500">{item.vendor_name || "Vendeur"} - Quantité {Number(item.quantity || 0).toLocaleString("fr-FR")}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-black text-green-700">{formatFCFA(item.total_price)}</p>
              <button onClick={() => removeItem(item.id)} className="rounded-xl bg-red-100 px-4 py-2 font-bold text-red-700">Retirer</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl bg-white p-6 text-right shadow">
        <p className="text-gray-500">Total panier</p>
        <p className="text-4xl font-black">{formatFCFA(cart.total)}</p>
        <Link href="/marketplace/checkout" className="mt-4 inline-block rounded-xl bg-yellow-500 px-6 py-4 font-black text-black">
          Commander
        </Link>
      </div>
    </div>
  );
}
