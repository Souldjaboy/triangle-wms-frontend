"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import { usePermissions } from "../../../lib/permissions";
import PrintableCompanyHeader from "../../../components/PrintableCompanyHeader";
import { amountInWordsFCFA } from "../../../lib/number-to-french";

/**
 * P4-C — PROFORMA SABLE, page A4 imprimable.
 *
 * Même présentation commerciale que la facture : ni statut financier, ni
 * montant payé, ni reste, ni signature client. Le bouton « Valider » n'apparaît
 * qu'avec la permission sand.validate — miroir exact du backend.
 */

type Line = { id: number; description: string; quantity: string; unit: string | null; unit_price: string; line_total: string };
type Proforma = {
  id: number; proforma_number: string; proforma_date: string | null;
  valid_until: string | null; destination: string | null; status: string;
  customer_name: string | null; customer_address: string | null;
  subtotal: string; discount: string; tax_amount: string; total_amount: string;
  notes: string | null;
};
type Pricing = { quantity_reference: number; reference_price: number | null; label: string };
type Company = Record<string, unknown>;

const fdate = (d: string | null) => {
  if (!d) return "";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
};
const money = (v: string | number | null) =>
  v == null || v === "" ? "0" : Number(v).toLocaleString("fr-FR");
const qty = (v: string | number | null) =>
  Number(v || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export default function ProformaSablePage() {
  const params = useParams();
  const id = String(params?.id || "");
  const search = useSearchParams();
  const { can } = usePermissions();
  const [doc, setDoc] = useState<Proforma | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [company, setCompany] = useState<Company>({});
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await authFetch(`/sand/proformas/${id}`);
    if (r.ok) { const d = await r.json(); setDoc(d.proforma); setLines(d.lines || []); setPricing(d.pricing); }
    else setError(r.status === 404 ? "Proforma introuvable." : "Erreur de chargement.");
    const c = await authFetch("/company-settings/current");
    if (c.ok) setCompany(await c.json());
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  useEffect(() => {
    if (!doc || search?.get("print") !== "1") return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [doc, search]);

  const validate = async () => {
    const r = await authFetch(`/sand/proformas/${id}/validate`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? "✅ Proforma validée." : d?.error || "Erreur.");
    await load();
  };

  if (error) return <div className="p-8 font-semibold text-red-700">{error}</div>;
  if (!doc) return <div className="p-8 text-gray-600">Chargement de la proforma…</div>;

  const total = Number(doc.total_amount || 0);
  const totalQty = lines.reduce((s, l) => s + Number(l.quantity || 0), 0);

  return (
    <div className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-4 print:hidden">
        <Link href="/sable/proformas" className="font-bold text-blue-700">← Proformas sable</Link>
        <div className="flex items-center gap-2">
          {msg && <span className="text-sm font-semibold text-blue-700">{msg}</span>}
          {doc.status === "BROUILLON" && can("sand", "validate") && (
            <button onClick={validate} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
              Valider la proforma
            </button>
          )}
          <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">
            Imprimer
          </button>
        </div>
      </div>

      <div className="doc-sheet mx-auto w-[210mm] min-h-[297mm] bg-white p-[14mm] text-black shadow print:w-auto print:min-h-0 print:p-0 print:shadow-none">
        <PrintableCompanyHeader
          company={{ ...company, email: undefined }}
          documentTitle="Facture proforma"
          documentNumber={`N° ${doc.proforma_number}`}
          documentDate={fdate(doc.proforma_date) ? `Date : ${fdate(doc.proforma_date)}` : undefined}
        />

        <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <p><span className="font-bold">Client :</span> {doc.customer_name || "—"}</p>
          <p><span className="font-bold">Site :</span> {doc.destination || "—"}</p>
          {doc.customer_address && <p><span className="font-bold">Adresse :</span> {doc.customer_address}</p>}
          {doc.valid_until && <p><span className="font-bold">Valable jusqu&apos;au :</span> {fdate(doc.valid_until)}</p>}
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
            {lines.length === 0 ? (
              <tr className="border-b border-gray-300"><td className="p-2" colSpan={4}>Sable</td></tr>
            ) : lines.map((l) => (
              <tr key={l.id} className="border-b border-gray-300">
                <td className="p-2">{l.description || "Sable"}</td>
                <td className="p-2 text-right">{qty(l.quantity)} m³</td>
                {/* Palier commercial, jamais le prix au m³. */}
                <td className="p-2 text-right">{money(pricing?.reference_price ?? null)}</td>
                <td className="p-2 text-right">{money(l.line_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-y-2 border-black">
              <td className="p-2 font-black">TOTAL</td>
              <td className="p-2 text-right font-black">{qty(totalQty)} m³</td>
              <td />
              <td className="p-2 text-right text-lg font-black">{money(total)} FCFA</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-5 text-sm">
          Arrêtée la présente facture proforma à la somme de :{" "}
          <span className="font-bold">{amountInWordsFCFA(total)}</span>
        </p>

        {doc.notes && <p className="mt-4 text-sm"><span className="font-bold">Observation :</span> {doc.notes}</p>}

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
