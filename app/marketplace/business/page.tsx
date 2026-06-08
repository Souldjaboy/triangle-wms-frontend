"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "../../lib/api";
import { formatFCFA } from "../../lib/format";

export default function MarketplaceBusinessPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  const currentCompanyId = () => {
    if (typeof window === "undefined") return 0;
    const activeCompanyId = Number(localStorage.getItem("active_company_id") || 0);
    if (activeCompanyId) return activeCompanyId;
    const user = JSON.parse(localStorage.getItem("business_user") || localStorage.getItem("user") || "{}");
    return Number(user?.company_id || 0);
  };

  const load = async (value = query) => {
    const response = await authFetch(`/marketplace/business?q=${encodeURIComponent(value)}`);
    const data = await response.json().catch(() => []);
    setProducts(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
  }, []);

  const addToCart = async (product: any) => {
    if (product.is_own_product || Number(product.vendor_company_id || product.company_id || 0) === currentCompanyId()) {
      setMessage("C’est votre produit. Vous pouvez le gérer dans Mes produits publiés.");
      return;
    }
    const response = await authFetch("/marketplace/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplace_product_id: product.id, quantity: 1 }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Produit ajouté au panier entreprise." : data.error || "Erreur ajout panier.");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-black">Marketplace entreprises</h1>
          <p className="text-gray-500">Acheter chez d'autres entreprises et contrôler clairement vos propres publications.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/marketplace/cart" className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black">Panier</Link>
          <Link href="/marketplace/orders" className="rounded-xl bg-white px-5 py-3 font-bold text-black">Commandes envoyées</Link>
        </div>
      </div>
      {message && <div className="mb-5 rounded-xl bg-yellow-100 p-4 font-bold text-yellow-800">{message}</div>}
      <input
        className="mb-6 w-full rounded-2xl border bg-white p-4 shadow"
        placeholder="Rechercher un produit entreprise"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          load(e.target.value);
        }}
      />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {products.map((product) => (
          <article key={product.id} className="rounded-2xl bg-white p-5 shadow">
            <p className={`text-sm font-bold ${product.is_own_product ? "text-yellow-700" : "text-gray-500"}`}>
              {product.is_own_product ? "Mon produit" : `Publié par : ${product.vendor_name || "Entreprise"}`}
            </p>
            <h2 className="mt-1 text-xl font-black">{product.title}</h2>
            <p className="mt-2 text-sm text-gray-500">{product.category || product.reference}</p>
            <p className="mt-3 text-2xl font-black text-green-700">{formatFCFA(product.price)}</p>
            <p className="text-sm text-gray-500">Disponible : {Number(product.display_stock || 0).toLocaleString("fr-FR")}</p>
            {product.is_own_product ? (
              <Link href="/vendor/products" className="mt-4 block w-full rounded-xl bg-black px-4 py-3 text-center font-black text-white">
                Gérer ce produit
              </Link>
            ) : (
              <button onClick={() => addToCart(product)} className="mt-4 w-full rounded-xl bg-yellow-500 px-4 py-3 font-black text-black">
                Ajouter au panier entreprise
              </button>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
