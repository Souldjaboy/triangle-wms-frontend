"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authFetch } from "../../lib/api";
import { formatFCFA } from "../../lib/format";

const emptyForm = { product_id: "", title: "", description: "", category: "", price: "", image_url: "" };

export default function VendorProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [sourceProducts, setSourceProducts] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  const load = async () => {
    const [publishedRes, productsRes] = await Promise.all([
      authFetch("/marketplace/vendor/products"),
      authFetch("/products"),
    ]);
    setProducts(await publishedRes.json().catch(() => []));
    setSourceProducts(await productsRes.json().catch(() => []));
  };

  useEffect(() => {
    load();
  }, []);

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await authFetch("/marketplace/vendor/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, product_id: Number(form.product_id), price: Number(form.price || 0) }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Produit publié." : data.error || "Erreur publication.");
    if (response.ok) {
      setForm(emptyForm);
      load();
    }
  };

  const disableProduct = async (id: number) => {
    await authFetch(`/marketplace/vendor/products/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black">Produits marketplace</h1>
          <p className="text-gray-500">Publier un produit existant de votre stock.</p>
        </div>
        <Link href="/vendor/orders" className="rounded-xl bg-black px-5 py-3 font-bold text-white">Commandes</Link>
      </div>
      {message && <div className="mb-5 rounded-xl bg-yellow-100 p-4 font-bold text-yellow-800">{message}</div>}
      <form onSubmit={publish} className="mb-8 grid grid-cols-1 gap-3 rounded-2xl bg-white p-5 shadow md:grid-cols-3">
        <select required className="rounded-xl border p-3" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
          <option value="">Choisir produit stock</option>
          {sourceProducts.map((product) => (
            <option key={product.id} value={product.id}>{product.reference} - {product.name} - stock {product.stock}</option>
          ))}
        </select>
        <input className="rounded-xl border p-3" placeholder="Titre marketplace" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className="rounded-xl border p-3" placeholder="Prix" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <input className="rounded-xl border p-3" placeholder="Catégorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <input className="rounded-xl border p-3" placeholder="Image URL" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
        <button className="rounded-xl bg-yellow-500 p-3 font-black">Publier</button>
        <textarea className="rounded-xl border p-3 md:col-span-3" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </form>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <div key={product.id} className="rounded-2xl bg-white p-5 shadow">
            <p className="text-xl font-black">{product.title}</p>
            <p className="text-gray-500">{product.reference || product.product_name}</p>
            <p className="mt-2 text-2xl font-black text-green-700">{formatFCFA(product.price)}</p>
            <p className="text-sm text-gray-500">Statut : {product.status}</p>
            <button onClick={() => disableProduct(product.id)} className="mt-4 rounded-xl bg-red-100 px-4 py-2 font-bold text-red-700">Désactiver</button>
          </div>
        ))}
      </div>
    </div>
  );
}
