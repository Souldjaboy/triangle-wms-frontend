"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import PrintableCompanyHeader from "../../../components/PrintableCompanyHeader";
import { amountInWordsFCFA } from "../../../lib/number-to-french";

const money = (v: any) =>
  new Intl.NumberFormat("fr-FR").format(Number(v || 0)) + " FCFA";

export default function SandInvoicePrintPage() {
  const params = useParams();
  const id = params?.id;

  const [invoice, setInvoice] = useState<any>(null);
  const [sale, setSale] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [invoiceRes, salesRes, companyRes] = await Promise.all([
          authFetch("/sand/invoices"),
          authFetch("/sand/sales"),
          authFetch("/company-settings/current"),
        ]);

        const invoices = await invoiceRes.json().catch(() => []);
        const sales = await salesRes.json().catch(() => []);
        const companyData = await companyRes.json().catch(() => ({}));

        const inv = Array.isArray(invoices)
          ? invoices.find((x: any) => String(x.id) === String(id))
          : null;

        const matchingSale =
          inv && Array.isArray(sales)
            ? sales.find(
                (x: any) => String(x.id) === String(inv.sale_id)
              )
            : null;

        setInvoice(inv || null);
        setSale(matchingSale || null);
        setCompany(companyData || {});
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) {
    return (
      <div className="p-10 font-bold">
        Chargement de la facture...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-10 font-bold text-red-600">
        Facture introuvable.
      </div>
    );
  }

  const companyName =
    company?.company_name ||
    company?.name ||
    "Entreprise";

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl">

        <div className="mb-4 flex justify-between print:hidden">
          <Link
            href="/sable/factures"
            className="font-bold"
          >
            ← Retour
          </Link>

          <button
            onClick={() => window.print()}
            className="rounded-xl bg-black px-5 py-3 font-bold text-white"
          >
            Imprimer la facture
          </button>
        </div>

        <section className="bg-white p-8 shadow print:p-4 print:shadow-none">

          <PrintableCompanyHeader
            company={company}
            documentTitle="FACTURE"
            documentNumber={invoice.invoice_number}
            documentDate={
              invoice.invoice_date
                ? new Date(
                    invoice.invoice_date
                  ).toLocaleDateString("fr-FR")
                : ""
            }
          />

          <section className="mt-8 grid grid-cols-2 gap-8">

            <div>
              <div className="text-xs font-bold uppercase text-gray-500">
                Client
              </div>

              <div className="mt-1 text-lg font-bold">
                {sale?.customer_name || "-"}
              </div>

              <div>
                {sale?.customer_phone || ""}
              </div>

              <div>
                {sale?.customer_address || ""}
              </div>
            </div>

            <div className="text-right">

              <div>
                <b>Référence opération :</b>{" "}
                {invoice.operation_reference || "-"}
              </div>

              <div>
                <b>Destination :</b>{" "}
                {invoice.destination ||
                  sale?.destination ||
                  "-"}
              </div>

              <div>
                <b>Statut :</b>{" "}
                {invoice.status || "-"}
              </div>

            </div>
          </section>

          <table className="mt-10 w-full border-collapse">

            <thead>
              <tr className="border-y-2 border-black bg-gray-100">

                <th className="p-3 text-left">
                  Désignation
                </th>

                <th className="p-3 text-right">
                  Quantité m³
                </th>

                <th className="p-3 text-right">
                  Prix unitaire
                </th>

                <th className="p-3 text-right">
                  Montant
                </th>

              </tr>
            </thead>

            <tbody>

              <tr className="border-b">

                <td className="p-3">
                  {sale?.product_name ||
                    "Vente de sable"}
                </td>

                <td className="p-3 text-right">
                  {sale?.quantity_m3 || 0} m³
                </td>

                <td className="p-3 text-right">
                  {money(sale?.unit_price)}
                </td>

                <td className="p-3 text-right font-bold">
                  {money(sale?.sand_subtotal)}
                </td>

              </tr>

              {Number(sale?.transport_total || 0) > 0 && (

                <tr className="border-b">

                  <td className="p-3">
                    Transport
                  </td>

                  <td className="p-3 text-right">
                    -
                  </td>

                  <td className="p-3 text-right">
                    {money(sale?.transport_total)}
                  </td>

                  <td className="p-3 text-right font-bold">
                    {money(sale?.transport_total)}
                  </td>

                </tr>

              )}

            </tbody>
          </table>

          <div className="mt-8 ml-auto max-w-sm space-y-2">

            <div className="flex justify-between">
              <span>Total facture</span>
              <b>{money(invoice.total_amount)}</b>
            </div>

            <div className="flex justify-between">
              <span>Montant payé</span>
              <b>{money(invoice.paid_amount)}</b>
            </div>

            <div className="flex justify-between border-t-2 border-black pt-3 text-xl font-black">
              <span>Reste à payer</span>
              <span>
                {money(invoice.remaining_amount)}
              </span>
            </div>

          </div>


          {/* MONTANT EN LETTRES */}

          <section className="mt-10 rounded-lg border-2 border-black p-4">

            <p className="font-bold">
              Arrêtée la présente facture à la somme de :
            </p>

            <p className="mt-2 text-lg font-black">
              {amountInWordsFCFA(
                Number(invoice.total_amount || 0)
              )}
            </p>

          </section>


          {invoice.notes && (
            <div className="mt-8">
              <b>Observation :</b>{" "}
              {invoice.notes}
            </div>
          )}


          <footer className="mt-16 grid grid-cols-2 gap-12">

            <div>
              <div className="border-t border-black pt-2 text-center">
                Signature client
              </div>
            </div>

            <div>
              <div className="border-t border-black pt-2 text-center font-bold">
                {companyName}
              </div>
            </div>

          </footer>

        </section>
      </div>
    </main>
  );
}
