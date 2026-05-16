"use client";

import { useState } from "react";

export default function RecherchePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);

    const response = await fetch(
      `http://localhost:5050/search?q=${encodeURIComponent(query)}`
    );

    const data = await response.json();

    setResults(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Recherche globale
      </h1>

      <p className="text-gray-500 mb-8">
        Rechercher un produit, une référence, un emplacement, un mouvement,
        un inventaire ou un document.
      </p>

      <div className="bg-white rounded-2xl shadow p-6 mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Exemple : CHAISE, REF1, W/EM2S-A, BR..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            className="flex-1 border p-4 rounded-xl text-black"
          />

          <button
            onClick={handleSearch}
            className="bg-yellow-500 text-black font-bold px-8 rounded-xl"
          >
            Rechercher
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-gray-500 font-bold">
          Recherche en cours...
        </p>
      )}

      {results && (
        <div className="space-y-8">
          <Summary results={results} />

          <ProductsSection data={results.products || []} />
          <LocationsSection data={results.locations || []} />
          <MovementsSection data={results.movements || []} />
          <InventoriesSection data={results.inventories || []} />
          <DocumentsSection data={results.documents || []} />
        </div>
      )}
    </div>
  );
}

function Summary({ results }: any) {
  return (
    <div className="grid grid-cols-5 gap-4">
      <Card title="Produits" value={results.totals?.products || 0} />
      <Card title="Emplacements" value={results.totals?.locations || 0} />
      <Card title="Mouvements" value={results.totals?.movements || 0} />
      <Card title="Inventaires" value={results.totals?.inventories || 0} />
      <Card title="Documents" value={results.totals?.documents || 0} />
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow">
      <p className="text-gray-500">{title}</p>
      <h2 className="text-3xl font-bold text-black">{value}</h2>
    </div>
  );
}

function SectionTitle({ title }: any) {
  return (
    <h2 className="text-2xl font-bold text-black mb-5">
      {title}
    </h2>
  );
}

function ProductsSection({ data }: any) {
  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <SectionTitle title="Produits / Stocks" />

      {data.length === 0 ? (
        <p className="text-gray-500">Aucun produit trouvé.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-3">Image</th>
              <th>Référence</th>
              <th>Produit</th>
              <th>Stock</th>
              <th>Entrepôt</th>
              <th>Emplacement</th>
              <th>Statut</th>
            </tr>
          </thead>

          <tbody>
            {data.map((product: any) => (
              <tr key={product.id} className="border-b">
                <td className="py-4">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-14 h-14 object-cover rounded-xl border"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-gray-200 rounded-xl flex items-center justify-center text-xs">
                      Image
                    </div>
                  )}
                </td>

                <td className="font-bold">{product.reference}</td>
                <td>{product.name}</td>
                <td className="font-bold">{product.stock}</td>
                <td>{product.warehouse}</td>
                <td className="text-blue-600 font-bold">
                  {product.location_code || product.emplacement_code || "-"}
                </td>
                <td>{product.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function LocationsSection({ data }: any) {
  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <SectionTitle title="Emplacements" />

      {data.length === 0 ? (
        <p className="text-gray-500">Aucun emplacement trouvé.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-3">Code</th>
              <th>Entrepôt</th>
              <th>Zone</th>
              <th>Rayon</th>
              <th>Étagère</th>
              <th>Statut</th>
            </tr>
          </thead>

          <tbody>
            {data.map((location: any) => (
              <tr key={location.id} className="border-b">
                <td className="py-4 font-bold text-blue-600">
                  {location.emplacement_code}
                </td>
                <td>{location.warehouse_code}</td>
                <td>{location.zone}</td>
                <td>{location.rayon}</td>
                <td>{location.etagere}</td>
                <td>{location.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MovementsSection({ data }: any) {
  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <SectionTitle title="Mouvements de stock" />

      {data.length === 0 ? (
        <p className="text-gray-500">Aucun mouvement trouvé.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-3">Type</th>
              <th>Produit</th>
              <th>Quantité</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Statut</th>
              <th>Date</th>
            </tr>
          </thead>

          <tbody>
            {data.map((movement: any) => (
              <tr key={movement.id} className="border-b">
                <td className="py-4 font-bold">{movement.type}</td>
                <td>
                  {movement.product_reference} - {movement.product_name}
                </td>
                <td>{movement.quantity}</td>
                <td>{movement.source_warehouse || "-"}</td>
                <td>{movement.destination_warehouse || "-"}</td>
                <td className="font-bold">{movement.status}</td>
                <td>
                  {movement.created_at
                    ? new Date(movement.created_at).toLocaleString("fr-FR")
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function InventoriesSection({ data }: any) {
  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <SectionTitle title="Historique inventaires" />

      {data.length === 0 ? (
        <p className="text-gray-500">Aucun inventaire trouvé.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-3">Produit</th>
              <th>Stock système</th>
              <th>Stock réel</th>
              <th>Écart</th>
              <th>Utilisateur</th>
              <th>Statut</th>
            </tr>
          </thead>

          <tbody>
            {data.map((inventory: any) => (
              <tr key={inventory.id} className="border-b">
                <td className="py-4 font-bold">
                  {inventory.product_reference} - {inventory.product_name}
                </td>
                <td>{inventory.system_stock}</td>
                <td>{inventory.real_stock}</td>
                <td className="font-bold">{inventory.difference}</td>
                <td>{inventory.user_name}</td>
                <td>{inventory.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DocumentsSection({ data }: any) {
  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <SectionTitle title="Documents" />

      {data.length === 0 ? (
        <p className="text-gray-500">Aucun document trouvé.</p>
      ) : (
        <div className="space-y-4">
          {data.map((doc: any) => (
            <div key={doc.id} className="border rounded-xl p-4">
              <p className="font-bold text-black">
                {doc.document_type} - {doc.document_number}
              </p>

              <p className="text-sm text-gray-500">
                Client/Fournisseur : {doc.client_name || "-"}
              </p>

              <p className="text-sm text-gray-500">
                Observation : {doc.observation || "-"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}