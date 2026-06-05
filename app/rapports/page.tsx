"use client";

import { useEffect, useState } from "react";

export default function RapportsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any>(null);
  const [activeReport, setActiveReport] = useState("produits");
  const [filters, setFilters] = useState({
    date: "",
    product: "",
    warehouse: "",
    user: "",
    observation: "",
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const fetchData = async () => {
    const productsRes = await fetch("/api/products", { headers: authHeaders() });
    const productsData = await productsRes.json();
    setProducts(Array.isArray(productsData) ? productsData : []);

    const movementsRes = await fetch("/api/stock-movements", {
      headers: authHeaders(),
    });
    const movementsData = await movementsRes.json();
    setMovements(Array.isArray(movementsData) ? movementsData : []);

    const alertsRes = await fetch("/api/alerts", { headers: authHeaders() });
    const alertsData = await alertsRes.json();
    setAlerts(alertsData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const sendEmail = async () => {
    const recipient = window.prompt("Email destinataire du rapport");
    if (!recipient) return;
    const html = document.querySelector(".print\\:bg-white")?.innerHTML || document.body.innerHTML;
    const response = await fetch("/api/reports/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        recipient_email: recipient,
        subject: `Rapport ${activeReport} Triangle WMS Pro`,
        html,
        message: filters.observation || `Rapport ${activeReport}`,
      }),
    });
    const data = await response.json().catch(() => ({}));
    alert(response.ok ? data.message || "Rapport envoyé." : data.error || "Erreur envoi email rapport.");
  };

  const filteredProducts = products.filter((product: any) => {
    return (
      (!filters.product ||
        `${product.reference} ${product.name}`
          .toLowerCase()
          .includes(filters.product.toLowerCase())) &&
      (!filters.warehouse ||
        String(product.warehouse || "")
          .toLowerCase()
          .includes(filters.warehouse.toLowerCase()))
    );
  });

  const filteredMovements = movements.filter((movement: any) => {
    return (
      (!filters.product ||
        `${movement.product_reference} ${movement.product_name}`
          .toLowerCase()
          .includes(filters.product.toLowerCase())) &&
      (!filters.warehouse ||
        `${movement.source_warehouse} ${movement.destination_warehouse}`
          .toLowerCase()
          .includes(filters.warehouse.toLowerCase())) &&
      (!filters.user ||
        `${movement.created_by_name} ${movement.created_by_role}`
          .toLowerCase()
          .includes(filters.user.toLowerCase())) &&
      (!filters.date ||
        String(movement.created_at || "").startsWith(filters.date))
    );
  });

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="flex justify-between items-center mb-8 print:hidden">
        <div>
          <h1 className="text-4xl font-bold text-black mb-2">
            Rapports
          </h1>

          <p className="text-gray-500">
            Rapports de stock, produits, mouvements et alertes.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={sendEmail}
            className="bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl"
          >
            Envoyer par email
          </button>

          <button
            onClick={handlePrint}
            className="bg-black text-white font-bold px-6 py-3 rounded-xl"
          >
            Imprimer / Exporter PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3 print:hidden">
        <input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} className="border p-3 rounded-xl text-black" />
        <input placeholder="Produit" value={filters.product} onChange={(e) => setFilters({ ...filters, product: e.target.value })} className="border p-3 rounded-xl text-black" />
        <input placeholder="Entrepôt" value={filters.warehouse} onChange={(e) => setFilters({ ...filters, warehouse: e.target.value })} className="border p-3 rounded-xl text-black" />
        <input placeholder="Utilisateur" value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })} className="border p-3 rounded-xl text-black" />
        <input placeholder="Observation avant impression" value={filters.observation} onChange={(e) => setFilters({ ...filters, observation: e.target.value })} className="border p-3 rounded-xl text-black" />
      </div>

      {filters.observation && (
        <div className="bg-white rounded-2xl shadow p-4 mb-6 text-black">
          <span className="font-bold">Observation :</span> {filters.observation}
        </div>
      )}

      <div className="flex gap-3 mb-8 print:hidden">
        {[
          { key: "produits", label: "Produits" },
          { key: "stocks", label: "Stocks" },
          { key: "mouvements", label: "Mouvements" },
          { key: "alertes", label: "Alertes" },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveReport(item.key)}
            className={`px-5 py-3 rounded-xl font-bold ${
              activeReport === item.key
                ? "bg-yellow-500 text-black"
                : "bg-white text-black"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeReport === "produits" && (
        <ReportCard title="Rapport Produits">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-3">Référence</th>
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Unité</th>
                <th>Stock</th>
                <th>Min</th>
                <th>Entrepôt</th>
                <th>Emplacement</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((product: any) => (
                <tr key={product.id} className="border-b">
                  <td className="py-4 font-bold">{product.reference}</td>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>{product.unit}</td>
                  <td>{product.stock}</td>
                  <td>{product.minimum_stock}</td>
                  <td>{product.warehouse}</td>
                  <td>{product.location_code || product.emplacement_code || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportCard>
      )}

      {activeReport === "stocks" && (
        <ReportCard title="Rapport Stocks">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-3">Produit</th>
                <th>Référence</th>
                <th>Quantité actuelle</th>
                <th>Stock minimum</th>
                <th>État</th>
                <th>Entrepôt</th>
                <th>Emplacement</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((product: any) => {
                const stock = Number(product.stock || 0);
                const minimum = Number(product.minimum_stock || 5);

                let etat = "Disponible";

                if (stock <= 0) etat = "Rupture";
                else if (stock <= minimum) etat = "Stock faible";

                return (
                  <tr key={product.id} className="border-b">
                    <td className="py-4 font-bold">{product.name}</td>
                    <td>{product.reference}</td>
                    <td>{stock}</td>
                    <td>{minimum}</td>
                    <td className="font-bold">{etat}</td>
                    <td>{product.warehouse}</td>
                    <td>{product.location_code || product.emplacement_code || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ReportCard>
      )}

      {activeReport === "mouvements" && (
        <ReportCard title="Rapport Mouvements">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-3">Type</th>
                <th>Produit</th>
                <th>Quantité</th>
                <th>Source</th>
                <th>Destination</th>
                <th>Motif</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {filteredMovements.map((movement: any) => (
                <tr key={movement.id} className="border-b">
                  <td className="py-4 font-bold">{movement.type}</td>
                  <td>
                    {movement.product_reference} - {movement.product_name}
                  </td>
                  <td>{movement.quantity}</td>
                  <td>{movement.source_warehouse}</td>
                  <td>{movement.destination_warehouse || "-"}</td>
                  <td>{movement.reason || "-"}</td>
                  <td className="font-bold">{movement.status}</td>
                  <td>
                    {movement.created_at
                      ? new Date(movement.created_at).toLocaleDateString("fr-FR")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ReportCard>
      )}

      {activeReport === "alertes" && (
        <ReportCard title="Rapport Alertes">
          {!alerts ? (
            <p className="text-gray-500">Chargement des alertes...</p>
          ) : (
            <div className="space-y-8">
              <AlertTable
                title="Stock faible"
                data={alerts.stock_faible || []}
              />

              <AlertTable
                title="Rupture stock"
                data={alerts.rupture_stock || []}
              />

              <AlertTable
                title="Validations en attente"
                data={alerts.validations_en_attente || []}
              />

              <AlertTable
                title="Mouvements refusés"
                data={alerts.mouvements_refuses || []}
              />
            </div>
          )}
        </ReportCard>
      )}
    </div>
  );
}

function ReportCard({ title, children }: any) {
  return (
    <div className="bg-white rounded-2xl shadow p-6 print:shadow-none">
      <h2 className="text-2xl font-bold text-black mb-5 print:text-center">
        {title}
      </h2>

      {children}
    </div>
  );
}

function AlertTable({ title, data }: any) {
  return (
    <div>
      <h3 className="text-xl font-bold text-black mb-3">
        {title}
      </h3>

      {data.length === 0 ? (
        <p className="text-gray-500">Aucune donnée.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-3">Référence</th>
              <th>Produit</th>
              <th>Quantité / Stock</th>
              <th>Entrepôt</th>
              <th>Statut</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item: any, index: number) => (
              <tr key={index} className="border-b">
                <td className="py-4 font-bold">
                  {item.reference || item.product_reference || "-"}
                </td>
                <td>{item.name || item.product_name || "-"}</td>
                <td>{item.stock ?? item.quantity ?? "-"}</td>
                <td>{item.warehouse || item.source_warehouse || "-"}</td>
                <td>{item.status || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
