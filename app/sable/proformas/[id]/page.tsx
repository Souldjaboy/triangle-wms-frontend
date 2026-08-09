"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import PrintableCompanyHeader from "../../../components/PrintableCompanyHeader";
import { amountInWordsFCFA } from "../../../lib/number-to-french";

const money = (v: any) =>
  new Intl.NumberFormat("fr-FR").format(Number(v || 0)) + " FCFA";

export default function SandProformaPrintPage() {
  const params = useParams();
  const id = params?.id;

  const [doc, setDoc] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {

        const [proformaRes, companyRes] =
          await Promise.all([
            authFetch("/sand/proformas"),
            authFetch("/company-settings/current"),
          ]);

        const rows =
          await proformaRes.json().catch(() => []);

        const companyData =
          await companyRes.json().catch(() => ({}));

        const p = Array.isArray(rows)
          ? rows.find(
              (x: any) =>
                String(x.id) === String(id)
            )
          : null;

        setDoc(p || null);
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
        Chargement de la proforma...
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="p-10 font-bold text-red-600">
        Proforma introuvable.
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
            href="/sable/proformas"
            className="font-bold"
          >
            ← Retour
          </Link>

          <button
            onClick={() => window.print()}
            className="rounded-xl bg-black px-5 py-3 font-bold text-white"
          >
            Imprimer la proforma
          </button>

        </div>


        <section className="bg-white p-8 shadow print:p-4 print:shadow-none">

          <PrintableCompanyHeader
            company={company}
            documentTitle="FACTURE PROFORMA"
            documentNumber={doc.proforma_number}
            documentDate={
              doc.proforma_date
                ? new Date(
                    doc.proforma_date
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
                {doc.customer_name || "-"}
              </div>

              <div>
                {doc.customer_phone || ""}
              </div>

              <div>
                {doc.customer_address || ""}
              </div>

            </div>


            <div className="text-right">

              <div>
                <b>Destination :</b>{" "}
                {doc.destination || "-"}
              </div>

              {doc.valid_until && (
                <div>
                  <b>Valable jusqu'au :</b>{" "}
                  {new Date(
                    doc.valid_until
                  ).toLocaleDateString("fr-FR")}
                </div>
              )}

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
                  Vente de sable
                  {doc.destination
                    ? ` - ${doc.destination}`
                    : ""}
                </td>

                <td className="p-3 text-right">
                  {doc.quantity_m3
                    ? `${doc.quantity_m3} m³`
                    : "-"}
                </td>

                <td className="p-3 text-right">
                  {doc.unit_price
                    ? money(doc.unit_price)
                    : "-"}
                </td>

                <td className="p-3 text-right font-bold">
                  {money(doc.total_amount)}
                </td>

              </tr>

            </tbody>

          </table>


          <div className="mt-8 ml-auto max-w-sm">

            <div className="flex justify-between border-t-2 border-black pt-4 text-xl font-black">

              <span>
                Total Proforma
              </span>

              <span>
                {money(doc.total_amount)}
              </span>

            </div>

          </div>


          {/* MONTANT EN LETTRES */}

          <section className="mt-10 rounded-lg border-2 border-black p-4">

            <p className="font-bold">
              Arrêtée la présente facture proforma à la somme de :
            </p>

            <p className="mt-2 text-lg font-black">
              {amountInWordsFCFA(
                Number(doc.total_amount || 0)
              )}
            </p>

          </section>


          {doc.notes && (

            <div className="mt-8">

              <b>Observation :</b>{" "}
              {doc.notes}

            </div>

          )}


          <footer className="mt-16 grid grid-cols-2 gap-12">

            <div className="border-t border-black pt-2 text-center">
              Bon pour accord client
            </div>

            <div className="border-t border-black pt-2 text-center font-bold">
              {companyName}
            </div>

          </footer>

        </section>

      </div>

    </main>
  );
}
