"use client";

import { useMemo, useState } from "react";

type SearchResults = {
  products?: any[];
  stockMovements?: any[];
  movements?: any[];
  inventories?: any[];
  documents?: any[];
  sales?: any[];
  receipts?: any[];
  partners?: any[];
  locations?: any[];
  users?: any[];
  totals?: Record<string, number>;
};

const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";

export default function RecherchePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const movements = results?.stockMovements || results?.movements || [];

  const hasResults = useMemo(() => {
    if (!results) return false;
    return [
      results.products,
      movements,
      results.inventories,
      results.documents,
      results.sales,
      results.receipts,
      results.partners,
      results.locations,
      results.users
    ].some((section) => (section || []).length > 0);
  }, [results, movements]);

  const handleSearch = async () => {
    const value = query.trim();
    if (!value) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/global-search?q=${encodeURIComponent(value)}`,
        {
          headers: {
            Authorization: `Bearer ${getToken()}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Erreur recherche globale");
      }

      setResults(data);
    } catch (searchError: any) {
      setError(searchError?.message || "Erreur recherche globale");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <h1 className="text-3xl md:text-4xl font-bold text-black mb-2">
        Recherche globale
      </h1>

      <p className="text-gray-500 mb-8">
        Rechercher un produit, une référence, un code-barres, un emplacement,
        un mouvement, une vente, un reçu, un document ou un inventaire.
      </p>

      <div className="bg-white rounded-2xl shadow p-4 md:p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Exemple : J3, Ref J3, reçu, vente, emplacement..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            className="flex-1 border p-4 rounded-xl text-black"
          />

          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-yellow-500 text-black font-bold px-8 py-4 rounded-xl disabled:opacity-60"
          >
            {loading ? "Recherche..." : "Rechercher"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">
          {error}
        </div>
      )}

      {results && (
        <div className="space-y-8">
          <Summary results={results} movements={movements} />

          {!hasResults && (
            <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-500 font-semibold">
              Aucun résultat trouvé
            </div>
          )}

          <ProductsSection data={results.products || []} />
          <LocationsSection data={results.locations || []} />
          <MovementsSection data={movements} />
          <InventoriesSection data={results.inventories || []} />
          <SalesSection data={results.sales || []} />
          <ReceiptsSection data={results.receipts || []} />
          <PartnersSection data={results.partners || []} />
          <DocumentsSection data={results.documents || []} />
          <UsersSection data={results.users || []} />
        </div>
      )}
    </div>
  );
}

function Summary({ results, movements }: any) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
      <Card title="Produits" value={results.totals?.products || 0} />
      <Card title="Emplacements" value={results.totals?.locations || 0} />
      <Card title="Mouvements" value={results.totals?.stockMovements || movements.length || 0} />
      <Card title="Inventaires" value={results.totals?.inventories || 0} />
      <Card title="Ventes" value={results.totals?.sales || 0} />
      <Card title="Reçus" value={results.totals?.receipts || 0} />
      <Card title="Partenaires" value={results.totals?.partners || 0} />
      <Card title="Documents" value={results.totals?.documents || 0} />
      <Card title="Utilisateurs" value={results.totals?.users || 0} />
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow">
      <p className="text-gray-500 text-sm">{title}</p>
      <h2 className="text-2xl font-bold text-black">{value}</h2>
    </div>
  );
}

function SectionShell({ title, data, empty, children }: any) {
  if (!data || data.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow p-4 md:p-6 overflow-x-auto">
      <h2 className="text-2xl font-bold text-black mb-5">{title}</h2>
      {data.length === 0 ? <p className="text-gray-500">{empty}</p> : children}
    </div>
  );
}

function ProductsSection({ data }: any) {
  return (
    <SectionShell title="Produits / Stocks" data={data}>
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-3">Image</th>
            <th>Référence</th>
            <th>Produit</th>
            <th>Stock</th>
            <th>Entrepôt</th>
            <th>Emplacement</th>
            <th>Code-barres</th>
          </tr>
        </thead>
        <tbody>
          {data.map((product: any) => (
            <tr key={product.id} className="border-b">
              <td className="py-4">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-14 h-14 object-cover rounded-xl border" />
                ) : (
                  <div className="w-14 h-14 bg-gray-200 rounded-xl flex items-center justify-center text-xs">Image</div>
                )}
              </td>
              <td className="font-bold">{product.reference || "-"}</td>
              <td>{product.name || "-"}</td>
              <td className="font-bold">{product.stock ?? 0}</td>
              <td>{product.warehouse || "-"}</td>
              <td className="text-blue-600 font-bold">{product.location_code || product.emplacement_code || "-"}</td>
              <td>{product.barcode || product.sku || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionShell>
  );
}

function LocationsSection({ data }: any) {
  return (
    <SectionShell title="Emplacements" data={data}>
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-3">Code</th>
            <th>Entrepôt</th>
            <th>Rayon</th>
            <th>Case</th>
            <th>Niveau</th>
            <th>Bin</th>
            <th>Produit</th>
          </tr>
        </thead>
        <tbody>
          {data.map((location: any) => (
            <tr key={location.id} className="border-b">
              <td className="py-4 font-bold text-blue-600">{location.emplacement_code || "-"}</td>
              <td>{location.warehouse_name || location.warehouse_code || "-"}</td>
              <td>{location.rayon_code || location.rayon || "-"}</td>
              <td>{location.case_code || "-"}</td>
              <td>{location.level_code || location.etagere || "-"}</td>
              <td>{location.bin_code || "-"}</td>
              <td>{location.product_name || location.product_reference || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionShell>
  );
}

function MovementsSection({ data }: any) {
  return (
    <SectionShell title="Mouvements de stock" data={data}>
      <table className="w-full min-w-[860px] text-left">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-3">Type</th>
            <th>Produit</th>
            <th>Quantité</th>
            <th>Source</th>
            <th>Destination</th>
            <th>Statut</th>
            <th>Utilisateur</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {data.map((movement: any) => (
            <tr key={movement.id} className="border-b">
              <td className="py-4 font-bold">{movement.type}</td>
              <td>{movement.product_reference} - {movement.product_name}</td>
              <td>{movement.quantity}</td>
              <td>{movement.source_warehouse || movement.location_code || "-"}</td>
              <td>{movement.destination_warehouse || "-"}</td>
              <td className="font-bold">{movement.status}</td>
              <td>{movement.created_by_name || "-"}</td>
              <td>{movement.created_at ? new Date(movement.created_at).toLocaleString("fr-FR") : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionShell>
  );
}

function InventoriesSection({ data }: any) {
  return (
    <SectionShell title="Historique inventaires" data={data}>
      <table className="w-full min-w-[760px] text-left">
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
              <td className="py-4 font-bold">{inventory.product_reference} - {inventory.product_name}</td>
              <td>{inventory.system_stock}</td>
              <td>{inventory.real_stock}</td>
              <td className="font-bold">{inventory.difference}</td>
              <td>{inventory.user_name}</td>
              <td>{inventory.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionShell>
  );
}

function SalesSection({ data }: any) {
  return (
    <SectionShell title="Ventes POS" data={data}>
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-3">Vente</th>
            <th>Client</th>
            <th>Total</th>
            <th>Paiement</th>
            <th>Statut</th>
            <th>Caissier</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {data.map((sale: any) => (
            <tr key={sale.id} className="border-b">
              <td className="py-4 font-bold">{sale.sale_number}</td>
              <td>{sale.customer_name || "-"}</td>
              <td>{Number(sale.total_amount || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA</td>
              <td>{sale.payment_method || "-"}</td>
              <td>{sale.payment_status || sale.status || "-"}</td>
              <td>{sale.created_by_name || "-"}</td>
              <td>{sale.created_at ? new Date(sale.created_at).toLocaleString("fr-FR") : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionShell>
  );
}

function ReceiptsSection({ data }: any) {
  return (
    <SectionShell title="Reçus" data={data}>
      <table className="w-full min-w-[680px] text-left">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-3">Reçu</th>
            <th>Total</th>
            <th>Paiement</th>
            <th>Statut</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {data.map((receipt: any) => (
            <tr key={receipt.id} className="border-b">
              <td className="py-4 font-bold">{receipt.receipt_number}</td>
              <td>{Number(receipt.total_amount || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA</td>
              <td>{receipt.payment_method || "-"}</td>
              <td>{receipt.payment_status || receipt.status || "-"}</td>
              <td>{receipt.created_at ? new Date(receipt.created_at).toLocaleString("fr-FR") : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionShell>
  );
}

function PartnersSection({ data }: any) {
  return (
    <SectionShell title="Partenaires" data={data}>
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-3">Type</th>
            <th>Nom</th>
            <th>Téléphone</th>
            <th>Email</th>
            <th>Ville</th>
            <th>Contact</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {data.map((partner: any) => (
            <tr key={partner.id} className="border-b">
              <td className="py-4 font-bold">{partner.type || "-"}</td>
              <td>
                <a href={`/partenaires/${partner.id}`} className="font-bold text-blue-600">
                  {partner.name || "-"}
                </a>
              </td>
              <td>{partner.phone || "-"}</td>
              <td>{partner.email || "-"}</td>
              <td>{partner.city || "-"}</td>
              <td>{partner.contact_person || "-"}</td>
              <td>{partner.status || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionShell>
  );
}

function DocumentsSection({ data }: any) {
  return (
    <SectionShell title="Documents" data={data}>
      <div className="space-y-4">
        {data.map((doc: any) => (
          <div key={doc.id} className="border rounded-xl p-4">
            <p className="font-bold text-black">{doc.document_type} - {doc.document_number}</p>
            <p className="text-sm text-gray-500">Client/Fournisseur : {doc.client_name || "-"}</p>
            <p className="text-sm text-gray-500">Observation : {doc.observation || "-"}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function UsersSection({ data }: any) {
  return (
    <SectionShell title="Utilisateurs" data={data}>
      <table className="w-full min-w-[680px] text-left">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-3">Nom</th>
            <th>Email</th>
            <th>Rôle</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {data.map((user: any) => (
            <tr key={user.id} className="border-b">
              <td className="py-4 font-bold">{user.fullname || "-"}</td>
              <td>{user.email || "-"}</td>
              <td>{user.role || "-"}</td>
              <td>{user.is_active === false ? "Inactif" : "Actif"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionShell>
  );
}
