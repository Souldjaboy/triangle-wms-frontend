"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProductScanPage() {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const params = useParams<{ code?: string }>();
  const code = decodeURIComponent(String(params?.code || ""));

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMessage("");

      const response = await fetch(`/api/scan/resolve/${encodeURIComponent(code)}`, {
        headers: headers(),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.type !== "product") {
        setMessage(data.error || "Produit introuvable ou accès refusé.");
        setDetails(null);
      } else {
        setDetails(data);
      }

      setLoading(false);
    };

    if (code) {
      load();
    } else {
      setLoading(false);
      setMessage("Produit introuvable : code QR vide.");
    }
  }, [code]);

  if (loading) {
    return <div className="min-h-screen bg-gray-100 p-8 text-black">Chargement produit...</div>;
  }

  if (message) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 text-black">
        <a href="/pos" className="inline-block mb-5 bg-black text-white px-5 py-3 rounded-xl font-bold">Retour caisse</a>
        <div className="bg-red-100 text-red-700 p-5 rounded-2xl font-bold">{message}</div>
      </div>
    );
  }

  const product = details?.product || {};
  const batches = Array.isArray(details?.batches) ? details.batches : [];
  const movements = Array.isArray(details?.movements) ? details.movements : [];
  const alerts = Array.isArray(details?.alerts) ? details.alerts : [];

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-black">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">{product.name}</h1>
          <p className="text-gray-500">{product.reference} | Fiche ouverte depuis QR Triangle WMS</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/pos" className="bg-yellow-500 text-black px-5 py-3 rounded-xl font-bold">Vendre</a>
          <a href="/pos/produits" className="bg-white text-black px-5 py-3 rounded-xl font-bold">Étiquettes</a>
          <a href="/stocks" className="bg-black text-white px-5 py-3 rounded-xl font-bold">Stock</a>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="bg-red-100 text-red-700 p-4 rounded-2xl mb-5 font-bold">
          {alerts.map((alert: any) => alert.type).join(", ")}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl shadow p-5 lg:col-span-2">
          <h2 className="text-2xl font-bold mb-4">Informations produit</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <p><strong>Prix vente :</strong> {Number(product.sale_price || 0).toLocaleString()} FCFA</p>
            <p><strong>Prix pharmacie :</strong> {Number(product.pharmacy_price || 0).toLocaleString()} FCFA</p>
            <p><strong>Stock :</strong> {Number(product.stock || 0).toLocaleString()}</p>
            <p><strong>Stock minimum :</strong> {Number(product.minimum_stock || 0).toLocaleString()}</p>
            <p><strong>Emplacement :</strong> {product.emplacement_code || product.location_code || "-"}</p>
            <p><strong>Entrepôt :</strong> {product.warehouse_code || product.warehouse || "-"}</p>
            <p><strong>Rayon :</strong> {product.rayon_code || "-"}</p>
            <p><strong>Case / niveau / bin :</strong> {[product.case_code, product.level_code, product.bin_code].filter(Boolean).join(" / ") || "-"}</p>
            <p><strong>Lot :</strong> {product.lot_number || "-"}</p>
            <p><strong>Expiration :</strong> {product.expiration_date || "-"}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-2xl font-bold mb-4">Actions</h2>
          <div className="grid gap-3">
            <a href={`/pos?scan=${encodeURIComponent(product.reference || code)}`} className="bg-yellow-500 text-black px-4 py-3 rounded-xl font-bold text-center">Ajouter au panier</a>
            <a href={`/stocks?product=${encodeURIComponent(product.reference || code)}`} className="bg-white border px-4 py-3 rounded-xl font-bold text-center">Mouvements stock</a>
            <a href={`/inventaires?product=${encodeURIComponent(product.reference || code)}`} className="bg-white border px-4 py-3 rounded-xl font-bold text-center">Inventaire</a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <div className="bg-white rounded-2xl shadow p-5 overflow-x-auto">
          <h2 className="text-2xl font-bold mb-4">Lots</h2>
          <table className="w-full text-left">
            <thead className="bg-gray-100"><tr><th className="p-3">Lot</th><th>Stock</th><th>Expiration</th><th>Statut</th></tr></thead>
            <tbody>
              {batches.map((batch: any) => (
                <tr key={batch.id} className="border-t">
                  <td className="p-3 font-bold">{batch.lot_number}</td>
                  <td>{batch.quantity_remaining}</td>
                  <td>{batch.expiration_date || "-"}</td>
                  <td>{batch.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {batches.length === 0 && <p className="text-gray-500">Aucun lot enregistré.</p>}
        </div>

        <div className="bg-white rounded-2xl shadow p-5 overflow-x-auto">
          <h2 className="text-2xl font-bold mb-4">Historique</h2>
          <table className="w-full text-left">
            <thead className="bg-gray-100"><tr><th className="p-3">Type</th><th>Qté</th><th>Statut</th><th>Date</th></tr></thead>
            <tbody>
              {movements.map((movement: any) => (
                <tr key={movement.id} className="border-t">
                  <td className="p-3 font-bold">{movement.type}</td>
                  <td>{movement.quantity}</td>
                  <td>{movement.status}</td>
                  <td>{movement.created_at ? new Date(movement.created_at).toLocaleString("fr-FR") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {movements.length === 0 && <p className="text-gray-500">Aucun mouvement.</p>}
        </div>
      </div>
    </div>
  );
}
