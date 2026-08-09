"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import PrintableCompanyHeader from "../../../components/PrintableCompanyHeader";

export default function SandDeliveryPrintPage() {
  const params = useParams();
  const id = params?.id;

  const [delivery, setDelivery] = useState<any>(null);
  const [sale, setSale] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [deliveryRes, salesRes, companyRes] = await Promise.all([
          authFetch("/sand/deliveries"),
          authFetch("/sand/sales"),
          authFetch("/company-settings/current"),
        ]);

        const deliveries = await deliveryRes.json().catch(() => []);
        const sales = await salesRes.json().catch(() => []);
        const companyData = await companyRes.json().catch(() => ({}));

        const bl = Array.isArray(deliveries)
          ? deliveries.find((x: any) => String(x.id) === String(id))
          : null;

        const matchingSale =
          bl && Array.isArray(sales)
            ? sales.find((x: any) => String(x.id) === String(bl.sale_id))
            : null;

        setDelivery(bl || null);
        setSale(matchingSale || null);
        setCompany(companyData || {});
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) return <div className="p-10 font-bold">Chargement du BL...</div>;

  if (!delivery) {
    return <div className="p-10 font-bold text-red-600">Bon de livraison introuvable.</div>;
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex justify-between print:hidden">
          <Link href="/sable/livraisons" className="font-bold">
            ← Retour
          </Link>

          <button
            onClick={() => window.print()}
            className="rounded-xl bg-black px-5 py-3 font-bold text-white"
          >
            Imprimer le BL
          </button>
        </div>

        <section className="bg-white p-8 shadow print:p-4 print:shadow-none">
          <PrintableCompanyHeader
            company={company}
            documentTitle="BON DE LIVRAISON"
            documentNumber={delivery.delivery_number}
            documentDate={
              delivery.delivery_date
                ? new Date(delivery.delivery_date).toLocaleDateString("fr-FR")
                : ""
            }
          />

          <section className="mt-8 grid grid-cols-2 gap-4">
            <p><b>Client :</b> {sale?.customer_name || "-"}</p>
            <p><b>Destination :</b> {delivery.destination || "-"}</p>
            <p><b>Téléphone :</b> {sale?.customer_phone || "-"}</p>
            <p><b>Référence vente :</b> {sale?.sale_number || "-"}</p>
          </section>

          <table className="mt-8 w-full border-collapse">
            <thead>
              <tr className="border-y-2 border-black bg-gray-100">
                <th className="p-3 text-left">Produit</th>
                <th className="p-3">Quantité</th>
                <th className="p-3">Camion</th>
                <th className="p-3">Chauffeur</th>
              </tr>
            </thead>

            <tbody>
              <tr className="border-b">
                <td className="p-3">{sale?.product_name || "Sable"}</td>
                <td className="p-3 text-center">
                  {Number(delivery.quantity_m3 || 0).toLocaleString("fr-FR")} m³
                </td>
                <td className="p-3 text-center">{delivery.truck || "-"}</td>
                <td className="p-3 text-center">{delivery.driver_name || "-"}</td>
              </tr>
            </tbody>
          </table>

          <section className="mt-8 space-y-2">
            {delivery.voucher_number && (
              <p><b>Référence bon :</b> {delivery.voucher_number}</p>
            )}

            <p><b>Livré par :</b> {delivery.delivered_by || "-"}</p>
          </section>

          <footer className="mt-20 grid grid-cols-3 gap-10 text-center">
            <div className="border-t border-black pt-2">Livré par</div>
            <div className="border-t border-black pt-2">Chauffeur</div>
            <div className="border-t border-black pt-2">Client / Réception</div>
          </footer>
        </section>
      </div>
    </main>
  );
}
