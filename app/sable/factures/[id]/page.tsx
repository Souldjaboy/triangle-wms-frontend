"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import PrintableCompanyHeader from "../../../components/PrintableCompanyHeader";
import { amountInWordsFCFA } from "../../../lib/number-to-french";

/**
 * P4-A — FACTURE SABLE, page A4 imprimable.
 *
 * Document COMMERCIAL : ni statut financier, ni montant payé, ni reste à payer
 * (cela relève de l'état des impayés). Lecture seule, aucun POST.
 *
 * Tarif : le prix est un PALIER (10 m³ = 170 000 F). Le backend calcule au m³
 * (17 000) mais la colonne du document affiche le palier — jamais 17 000.
 * L'identité affichée est celle de l'entreprise ACTIVE : aucun texte FAT & MAT
 * codé en dur, aucune dépendance à un identifiant d'entreprise.
 */

type Invoice = {
  id: number; invoice_number: string; invoice_date: string | null;
  operation_reference: string | null; destination: string | null;
  sale_destination: string | null; total_amount: string;
  sale_number: string | null; quantity_m3: string | null;
  client_name: string | null; client_address: string | null;
  sale_notes: string | null; notes: string | null;
};
type Pricing = { quantity_reference: number; reference_price: number | null; label: string };
type Company = Record<string, unknown>;

/* « AAAA-MM-JJ » affiché tel quel : pas de reconversion UTC. */
const fdate = (d: string | null) => {
  if (!d) return "";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
};
const money = (v: string | number | null) =>
  v == null || v === "" ? "0" : Number(v).toLocaleString("fr-FR");
/* Quantité : on n'affiche les décimales que si elles existent (25,5 / 20). */
const qty = (v: string | number | null) => {
  const n = Number(v || 0);
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
};

export default function FactureSablePage() {
  const params = useParams();
  const id = String(params?.id || "");
  const search = useSearchParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [company, setCompany] = useState<Company>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await authFetch(`/sand/invoices/${id}`);
    if (r.ok) { const d = await r.json(); setInvoice(d.invoice); setPricing(d.pricing); }
    else setError(r.status === 404 ? "Facture introuvable." : "Erreur de chargement.");
    const c = await authFetch("/company-settings/current");
    if (c.ok) setCompany(await c.json());
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  useEffect(() => {
    if (!invoice || search?.get("print") !== "1") return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [invoice, search]);

  if (error) return <div className="p-8 font-semibold text-red-700">{error}</div>;
  if (!invoice) return <div className="p-8 text-gray-600">Chargement de la facture…</div>;

  const total = Number(invoice.total_amount || 0);
  const site = invoice.sale_destination || invoice.destination || "—";
  const observation = invoice.notes || invoice.sale_notes || "";

  return (
    <div className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4 print:hidden">
        <Link href="/sable/factures" className="font-bold text-blue-700">← Factures sable</Link>
        <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">
          Imprimer
        </button>
      </div>

      <div className="doc-sheet mx-auto w-[210mm] min-h-[297mm] bg-white p-[14mm] text-black shadow print:w-auto print:min-h-0 print:p-0 print:shadow-none">
        {/* Identité de l'entreprise active — l'e-mail n'est pas transmis : il ne
            doit pas figurer sur une facture. */}
        <PrintableCompanyHeader
          company={{ ...company, email: undefined }}
          documentTitle="Facture"
          documentNumber={`N° ${invoice.invoice_number}`}
          documentDate={fdate(invoice.invoice_date) ? `Date : ${fdate(invoice.invoice_date)}` : undefined}
        />

        <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <p><span className="font-bold">Client :</span> {invoice.client_name || "—"}</p>
          <p><span className="font-bold">Site :</span> {site}</p>
          {invoice.client_address && (
            <p><span className="font-bold">Adresse :</span> {invoice.client_address}</p>
          )}
          <p>
            <span className="font-bold">Référence opération :</span>{" "}
            {invoice.operation_reference || invoice.sale_number || "—"}
          </p>
        </section>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-black">
              <th className="p-2 text-left">Désignation</th>
              <th className="p-2 text-right w-32">Quantité m³</th>
              <th className="p-2 text-right w-36">{pricing?.label || "Prix 10 m³"}</th>
              <th className="p-2 text-right w-40">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-300">
              <td className="p-2">Sable</td>
              <td className="p-2 text-right">{qty(invoice.quantity_m3)} m³</td>
              {/* Palier commercial, jamais le prix au m³. */}
              <td className="p-2 text-right">{money(pricing?.reference_price ?? null)}</td>
              <td className="p-2 text-right">{money(total)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-y-2 border-black">
              <td className="p-2 font-black" colSpan={3}>TOTAL</td>
              <td className="p-2 text-right text-lg font-black">{money(total)} FCFA</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-5 text-sm">
          Arrêtée la présente facture à la somme de :{" "}
          <span className="font-bold">{amountInWordsFCFA(total)}</span>
        </p>

        {observation && (
          <p className="mt-4 text-sm"><span className="font-bold">Observation :</span> {observation}</p>
        )}

        {/* DIRECTION au-dessus de la ligne, puis espace tampon. Pas de signature client. */}
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
          .doc-sheet tr { break-inside: avoid; page-break-inside: avoid; }
          .signature-zone { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
