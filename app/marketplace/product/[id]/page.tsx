"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiUrl, authFetch, getAuthToken } from "../../../lib/api";
import { formatFCFA } from "../../../lib/format";
import MarketplaceHeader from "../../MarketplaceHeader";

export default function MarketplaceProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(apiUrl(`/marketplace/products/${params.id}`))
      .then((response) => response.json())
      .then(setProduct)
      .catch(() => setProduct(null));
  }, [params.id]);

  const addToCart = async () => {
    if (!getAuthToken()) {
      router.push(`/client/login?redirect=/marketplace/product/${params.id}`);
      return;
    }
    const response = await authFetch("/marketplace/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplace_product_id: product.id, quantity: 1 }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      router.push(`/client/login?redirect=/marketplace/product/${params.id}`);
      return;
    }
    setMessage(response.ok ? "Produit ajouté au panier." : data.error || "Impossible d’ajouter ce produit au panier.");
  };

  if (!product) return <div className="min-h-screen bg-gray-100 p-8 font-bold">Chargement produit...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mb-6 rounded-2xl bg-black p-4 text-white">
        <MarketplaceHeader />
      </div>
      <Link href="/marketplace" className="font-bold text-gray-600">Retour marketplace</Link>
      {message && <div className="my-5 rounded-xl bg-yellow-100 p-4 font-bold text-yellow-800">{message}</div>}
      <div className="mt-5 grid grid-cols-1 gap-8 rounded-2xl bg-white p-6 shadow lg:grid-cols-2">
        {product.image_url ? (
          <img src={product.image_url} alt={product.title} className="h-96 w-full rounded-2xl object-cover" />
        ) : (
          <div className="flex h-96 items-center justify-center rounded-2xl bg-gray-100 font-bold text-gray-400">Image produit</div>
        )}
        <section>
          <p className="font-bold text-gray-500">{product.vendor_name || "Vendeur marketplace"}</p>
          <h1 className="mt-2 text-4xl font-black">{product.title}</h1>
          <p className="mt-4 text-gray-600">{product.description || "Aucune description."}</p>
          <p className="mt-6 text-4xl font-black text-green-700">{formatFCFA(product.price)}</p>
          <div className="mt-5 rounded-xl bg-gray-50 p-4">
            <p><strong>Référence :</strong> {product.reference || "-"}</p>
            <p><strong>Stock disponible :</strong> {Number(product.stock || product.available_stock || 0).toLocaleString("fr-FR")}</p>
            <p><strong>Entrepôt :</strong> {product.warehouse || "-"}</p>
            <p><strong>Emplacement :</strong> {product.location_code || "-"}</p>
          </div>
          <button onClick={addToCart} className="mt-6 w-full rounded-xl bg-yellow-500 py-4 font-black text-black">
            Ajouter au panier
          </button>
        </section>
      </div>
    </div>
  );
}
