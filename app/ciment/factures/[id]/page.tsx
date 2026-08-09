"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import PrintableCompanyHeader from "../../../components/PrintableCompanyHeader";
import { amountInWordsFCFA } from "../../../lib/number-to-french";

/**
 * P3 — FACTURE CIMENT, page A4 imprimable.
 *
 * Lecture seule : la facture a déjà été créée par la validation de la vente.
 * Cette page ne fait AUCUN POST — l'ouvrir ou l'imprimer ne peut pas produire
 * un second document.
 */

type Invoice = {
  id: number; invoice_number: string; invoice_date: string | null;
  due_date: string | null; operation_reference: string | null;
  destination: string | null; sale_destination: string | null;
  total_amount: string; sale_number: string | null;
  customer_name: string | null; customer_full_name: string | null;
  customer_address: string | null; customer_nif: string | null;
  cement_type: string | null; strength: string | null;
  tonnage: string | null; unit_price: string | null;
  transport_total: string | null; discount: string | null; tax_amount: string | null;
};
type Company = Record<string, unknown>;

/* Une date « AAAA-MM-JJ » est affichée telle quelle : la reconvertir via
   new Date() la ferait repasser par UTC et afficher la veille. */
const fdate = (d: string | null) => {
  if (!d) return "";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
};
const fcfa = (v: string | number | null) =>
  v == null || v === "" ? "0" : Number(v).toLocaleString("fr-FR");

export default function FactureCimentPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const search = useSearchParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<Company>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await authFetch(`/cement/invoices/${id}`);
    if (r.ok) setInvoice((await r.json()).invoice);
    else setError(r.status === 404 ? "Facture introuvable." : "Erreur de chargement.");
    const c = await authFetch("/company-settings/current");
    if (c.ok) setCompany(await c.json());
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  /* Arrivée via « Imprimer » d'une liste (?print=1) : on déclenche l'impression
     une fois le document rendu. Aucune écriture serveur n'est faite. */
  useEffect(() => {
    if (!invoice || search?.get("print") !== "1") return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [invoice, search]);

  if (error) return <div className="p-8 font-semibold text-red-700">{error}</div>;
  if (!invoice) return <div className="p-8 text-gray-600">Chargement de la facture…</div>;

  const tonnage = Number(invoice.tonnage || 0);
  const unitPrice = Number(invoice.unit_price || 0);
  const subtotal = tonnage * unitPrice;
  const transport = Number(invoice.transport_total || 0);
  const discount = Number(invoice.discount || 0);
  const tax = Number(invoice.tax_amount || 0);
  const total = Number(invoice.total_amount || 0);
  const designation = `Vente de ciment${invoice.cement_type ? ` ${invoice.cement_type}` : ""}${invoice.strength ? ` ${invoice.strength}` : ""}`;
  const site = invoice.destination || invoice.sale_destination || "—";

  return (
    <div className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      {/* Barre d'actions — jamais imprimée */}
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4 print:hidden">
        <Link href="/ciment/factures" className="font-bold text-blue-700">← Factures ciment</Link>
        <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">
          Imprimer
        </button>
      </div>

      <div className="doc-sheet mx-auto w-[210mm] min-h-[297mm] bg-white p-[14mm] text-black shadow print:w-auto print:min-h-0 print:p-0 print:shadow-none">
        <PrintableCompanyHeader
          company={company}
          documentTitle="Facture"
          documentNumber={`N° ${invoice.invoice_number}`}
          documentDate={fdate(invoice.invoice_date) ? `Date : ${fdate(invoice.invoice_date)}` : undefined}
        />

        <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <p><span className="font-bold">Client :</span> {invoice.customer_full_name || invoice.customer_name || "—"}</p>
          <p><span className="font-bold">Site / Destination :</span> {site}</p>
          {invoice.customer_address && <p><span className="font-bold">Adresse :</span> {invoice.customer_address}</p>}
          <p><span className="font-bold">Référence opération :</span> {invoice.operation_reference || invoice.sale_number || "—"}</p>
          {invoice.customer_nif && <p><span className="font-bold">NIF :</span> {invoice.customer_nif}</p>}
        </section>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-black">
              <th className="p-2 text-left">Désignation</th>
              <th className="p-2 text-right w-28">Quantité</th>
              <th className="p-2 text-right w-32">Prix / tonne</th>
              <th className="p-2 text-right w-36">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-300">
              <td className="p-2">{designation}</td>
              <td className="p-2 text-right">{fcfa(tonnage)} t</td>
              <td className="p-2 text-right">{fcfa(unitPrice)}</td>
              <td className="p-2 text-right">{fcfa(subtotal)}</td>
            </tr>
            {transport > 0 && (
              <tr className="border-b border-gray-300">
                <td className="p-2">Transport</td>
                <td className="p-2 text-right">—</td>
                <td className="p-2 text-right">—</td>
                <td className="p-2 text-right">{fcfa(transport)}</td>
              </tr>
            )}
            {discount > 0 && (
              <tr className="border-b border-gray-300">
                <td className="p-2" colSpan={3}>Remise</td>
                <td className="p-2 text-right">− {fcfa(discount)}</td>
              </tr>
            )}
            {tax > 0 && (
              <tr className="border-b border-gray-300">
                <td className="p-2" colSpan={3}>Taxe</td>
                <td className="p-2 text-right">{fcfa(tax)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-y-2 border-black">
              <td className="p-2 font-black" colSpan={3}>TOTAL</td>
              <td className="p-2 text-right text-lg font-black">{fcfa(total)} FCFA</td>
            </tr>
          </tfoot>
        </table>

        {/* Mention légale obligatoire */}
        <p className="mt-5 text-sm">
          Arrêtée la présente facture à la somme de :{" "}
          <span className="font-bold">{amountInWordsFCFA(total)}</span>
        </p>

        {/* Direction : intitulé AU-DESSUS de l'espace de signature. */}
        <section className="signature-zone mt-12 flex justify-end text-sm">
          <div className="w-64">
            <p className="border-b border-black pb-1 text-center font-black">DIRECTION</p>
            <div className="h-28" />
          </div>
        </section>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: #fff; }
          /* Ni le tableau ni la zone de signature ne doivent être coupés. */
          .doc-sheet table { break-inside: auto; }
          .doc-sheet tr { break-inside: avoid; page-break-inside: avoid; }
          .signature-zone { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
