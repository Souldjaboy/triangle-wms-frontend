"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useState } from "react";

export default function PosProduitsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [query, setQuery] = useState("");

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const search = async (value: string) => {
    const response = await fetch(`/api/pos/products/search?q=${encodeURIComponent(value)}`, {
      headers: headers(),
    });
    const data = await response.json().catch(() => []);
    setProducts(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    search("");
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-black">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h1 className="text-4xl font-bold">Produits POS</h1>
          <p className="text-gray-500">Étiquettes QR / code interne imprimables.</p>
        </div>
        <button onClick={() => window.print()} className="bg-black text-white px-5 py-3 rounded-xl font-bold">Imprimer étiquettes</button>
      </div>
      <input value={query} onChange={(e) => { setQuery(e.target.value); search(e.target.value); }} placeholder="Chercher produit..." className="border p-4 rounded-xl w-full mb-6 print:hidden" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product.id} className="bg-white rounded-2xl shadow p-5 text-center break-inside-avoid">
            <QRCodeCanvas value={product.barcode || product.reference || String(product.id)} size={128} />
            <h2 className="font-bold mt-3">{product.name}</h2>
            <p className="text-sm">{product.reference}</p>
            <p className="text-xl font-bold text-yellow-600">{Number(product.sale_price || 0).toLocaleString()} FCFA</p>
            <p className="text-xs text-gray-500">Lot : {product.lot_number || "-"} | Exp : {product.expiration_date || "-"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
