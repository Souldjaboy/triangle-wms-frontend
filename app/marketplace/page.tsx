"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl, authFetch } from "../lib/api";
import { formatFCFA } from "../lib/format";

export default function MarketplacePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [vendor, setVendor] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [message, setMessage] = useState("");

  const loadProducts = async (value = query) => {
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    if (category) params.set("category", category);
    if (vendor) params.set("vendor_company_id", vendor);
    if (minPrice) params.set("min_price", minPrice);
    if (maxPrice) params.set("max_price", maxPrice);
    const response = await fetch(apiUrl(`/marketplace/products?${params.toString()}`));
    const data = await response.json().catch(() => []);
    setProducts(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadProducts();
  }, [category, vendor, minPrice, maxPrice]);

  const addToCart = async (product: any) => {
    const response = await authFetch("/marketplace/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplace_product_id: product.id, quantity: 1 }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Produit ajouté au panier." : data.error || "Erreur ajout panier.");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-black">Triangle Marketplace</h1>
          <p className="text-gray-500">Catalogue B2B/B2C relié au stock Triangle WMS Pro.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/marketplace/cart" className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black">Panier</Link>
          <Link href="/client/login" className="rounded-xl bg-white px-5 py-3 font-bold text-black">Connexion client</Link>
          <Link href="/client/register" className="rounded-xl bg-white px-5 py-3 font-bold text-black">Créer compte client</Link>
          <Link href="/marketplace/orders" className="rounded-xl bg-white px-5 py-3 font-bold text-black">Mes commandes</Link>
          <Link href="/marketplace/business" className="rounded-xl bg-black px-5 py-3 font-bold text-white">Achat B2B</Link>
          <Link href="/marketplace/vendor/products" className="rounded-xl bg-black px-5 py-3 font-bold text-white">Espace vendeur</Link>
        </div>
      </div>

      {message && <div className="mb-5 rounded-xl bg-yellow-100 p-4 font-bold text-yellow-800">{message}</div>}

      <div className="mb-6 grid gap-3 rounded-2xl bg-white p-4 shadow md:grid-cols-6">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            loadProducts(event.target.value);
          }}
          placeholder="Rechercher produit, référence, catégorie..."
          className="rounded-xl border p-4 md:col-span-2"
        />
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Catégorie" className="rounded-xl border p-4" />
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="ID entreprise" className="rounded-xl border p-4" />
        <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Prix min" className="rounded-xl border p-4" />
        <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Prix max" className="rounded-xl border p-4" />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {products.map((product) => (
          <article key={product.id} className="rounded-2xl bg-white p-5 shadow">
            {product.image_url ? (
              <img src={product.image_url} alt={product.title} className="mb-4 h-40 w-full rounded-xl object-cover" />
            ) : (
              <div className="mb-4 flex h-40 items-center justify-center rounded-xl bg-gray-100 font-bold text-gray-400">Image produit</div>
            )}
            <p className="text-sm font-bold text-gray-500">{product.vendor_name || "Vendeur"}</p>
            <h2 className="mt-1 text-xl font-black">{product.title}</h2>
            <p className="mt-2 text-sm text-gray-500">{product.category || product.reference || "-"}</p>
            <p className="mt-3 text-2xl font-black text-green-700">{formatFCFA(product.price)}</p>
            <p className="text-sm text-gray-500">Stock : {Number(product.display_stock || product.stock || 0).toLocaleString("fr-FR")}</p>
            <div className="mt-4 flex gap-2">
              <Link href={`/marketplace/product/${product.id}`} className="flex-1 rounded-xl bg-black px-4 py-3 text-center font-bold text-white">Voir</Link>
              <button onClick={() => addToCart(product)} className="flex-1 rounded-xl bg-yellow-500 px-4 py-3 font-bold text-black">Ajouter</button>
            </div>
          </article>
        ))}
      </div>

      {products.length === 0 && <div className="rounded-2xl bg-white p-8 text-center font-bold text-gray-500">Aucun produit publié.</div>}
    </div>
  );
}
