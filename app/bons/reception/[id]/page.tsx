"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import { usePermissions } from "../../../lib/permissions";

/**
 * PHASES 1-3 (suite) — BON DE RÉCEPTION A4 imprimable.
 * Noir et blanc, une seule colonne, zone de signatures uniquement sur la
 * DERNIÈRE page (CSS print). Les blocs « Signature / Cachet » sont remplacés par
 * RÉCEPTIONNÉ PAR et LIVRÉ PAR. Le bouton Imprimer n'apparaît qu'avec la
 * permission stock.document.print ; l'impression n'affecte jamais le stock.
 */

type DocRow = {
  id: number; doc_number: string; doc_type: string; status: string;
  received_by_name: string | null; received_by_function: string | null;
  received_at_date: string | null; received_at_time: string | null;
  delivered_by_name: string | null; delivered_by_function: string | null;
  delivered_at_date: string | null; delivered_at_time: string | null;
  validated_by: number | null; validated_at: string | null; print_count: number;
};
type Line = {
  id: number; line_no: number; product_reference: string | null; product_name: string;
  unit: string | null; quantity_requested: string; quantity_received: string;
  unit_price: string | null; observation: string | null; movement_id: number | null;
};
type Req = {
  reference: string; request_type: string; supplier_name: string | null;
  target_warehouse: string | null; source_warehouse: string | null;
  requested_at: string; lines: Line[];
};
type Company = { company_name?: string; logo_url?: string; address?: string; phone?: string };

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "");
const money = (v: string | number | null) =>
  v == null || v === "" ? "" : Number(v).toLocaleString("fr-FR");

export default function BonReceptionPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { can } = usePermissions();
  const [doc, setDoc] = useState<DocRow | null>(null);
  const [req, setReq] = useState<Req | null>(null);
  const [company, setCompany] = useState<Company>({});
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await authFetch(`/stock-documents/${id}`);
    if (r.ok) { const d = await r.json(); setDoc(d.document); setReq(d.request); }
    const c = await authFetch("/company-settings/current");
    if (c.ok) setCompany(await c.json());
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  const doPrint = async () => {
    setMsg("");
    const res = await authFetch(`/stock-documents/${id}/print`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setMsg(d?.error || "Impression non autorisée."); return; }
    await load();
    window.print();
  };

  const validate = async () => {
    const res = await authFetch(`/stock-documents/${id}/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? "✅ Document validé." : d?.error || "Erreur.");
    await load();
  };

  if (!doc || !req) return <div className="p-8 text-gray-600">Chargement du bon…</div>;

  const isDraft = doc.status === "BROUILLON";
  const isCancelled = doc.status === "ANNULE";
  const received = (req.lines || []).filter((l) => Number(l.quantity_received) > 0);
  const total = received.reduce((s, l) => s + Number(l.quantity_received) * Number(l.unit_price || 0), 0);
  const title = doc.doc_type === "sortie" ? "BON DE SORTIE" : doc.doc_type === "transfert" ? "BON DE TRANSFERT" : "BON DE RÉCEPTION";

  return (
    <div className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      {/* Barre d'actions — masquée à l'impression */}
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-4 print:hidden">
        <Link href="/demandes-stock" className="font-bold text-blue-700">← Demandes stock</Link>
        <div className="flex flex-wrap items-center gap-2">
          {msg && <span className="text-sm font-semibold text-red-700">{msg}</span>}
          <span className="text-xs text-gray-600">{doc.print_count} impression(s)</span>
          {isDraft && can("stock", "validate") && (
            <button onClick={validate} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Valider le document</button>
          )}
          {can("stock.document.print", "validate") && (
            <button onClick={doPrint} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">
              {doc.print_count > 0 ? "Réimprimer" : "Imprimer"}
            </button>
          )}
        </div>
      </div>

      {/* Feuille A4 */}
      <div className="relative mx-auto w-[210mm] min-h-[297mm] bg-white p-[14mm] text-black shadow print:w-auto print:min-h-0 print:p-0 print:shadow-none">
        {/* Filigrane BROUILLON */}
        {(isDraft || isCancelled) && (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rotate-[-30deg] text-[64px] font-black tracking-widest text-black/10">
              {isCancelled ? "ANNULÉ" : "BROUILLON / NON VALIDÉ"}
            </span>
          </div>
        )}

        {/* En-tête */}
        <header className="flex items-start justify-between border-b-2 border-black pb-3">
          <div className="flex items-start gap-3">
            {company.logo_url ? (
              <img src={company.logo_url} alt="Logo" className="h-16 w-16 object-contain" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center border border-black text-xl font-black">
                {(company.company_name || "T").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-lg font-black uppercase">{company.company_name || "TRIANGLE WMS PRO"}</p>
              {company.address && <p className="text-xs">{company.address}</p>}
              {company.phone && <p className="text-xs">Tél. : {company.phone}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-black tracking-wide">{title}</p>
            <p className="text-sm font-bold">N° {doc.doc_number}</p>
            <p className="text-xs">Date : {fmtDate(doc.received_at_date) || fmtDate(req.requested_at)}</p>
            <p className={`mt-1 inline-block border px-2 py-0.5 text-xs font-black ${isDraft ? "border-black" : "border-black bg-black text-white"}`}>
              {doc.status}
            </p>
          </div>
        </header>

        {/* Références */}
        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p><span className="font-bold">Fournisseur / Client :</span> {req.supplier_name || "—"}</p>
          <p><span className="font-bold">N° demande :</span> {req.reference}</p>
          <p><span className="font-bold">Entrepôt :</span> {req.target_warehouse || req.source_warehouse || "—"}</p>
          <p><span className="font-bold">Créé par :</span> {doc.received_by_name || "—"}</p>
          {doc.validated_at && (
            <p className="col-span-2"><span className="font-bold">Validé par :</span> {doc.received_by_name || "—"} le {new Date(doc.validated_at).toLocaleString("fr-FR")}</p>
          )}
        </section>

        {/* Produits */}
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-black">
              <th className="p-1 text-left w-8">#</th>
              <th className="p-1 text-left">Référence</th>
              <th className="p-1 text-left">Désignation</th>
              <th className="p-1 text-right w-20">Qté</th>
              <th className="p-1 text-left w-14">Unité</th>
              <th className="p-1 text-right w-24">P.U.</th>
              <th className="p-1 text-right w-28">Total</th>
              <th className="p-1 text-left w-24">N° mvt</th>
            </tr>
          </thead>
          <tbody>
            {received.map((l) => (
              <tr key={l.id} className="border-b border-gray-300">
                <td className="p-1">{l.line_no}</td>
                <td className="p-1">{l.product_reference || "—"}</td>
                <td className="p-1">{l.product_name}{l.observation ? ` — ${l.observation}` : ""}</td>
                <td className="p-1 text-right font-bold">{Number(l.quantity_received)}</td>
                <td className="p-1">{l.unit || ""}</td>
                <td className="p-1 text-right">{money(l.unit_price)}</td>
                <td className="p-1 text-right">{l.unit_price ? money(Number(l.quantity_received) * Number(l.unit_price)) : ""}</td>
                <td className="p-1">{l.movement_id || ""}</td>
              </tr>
            ))}
          </tbody>
          {total > 0 && (
            <tfoot>
              <tr className="border-t-2 border-black">
                <td colSpan={6} className="p-1 text-right font-black">TOTAL</td>
                <td className="p-1 text-right font-black">{money(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Signatures — uniquement sur la DERNIÈRE page */}
        <section className="signature-zone mt-10 grid grid-cols-2 gap-10 text-sm">
          <div>
            <p className="mb-2 border-b border-black pb-1 font-black">RÉCEPTIONNÉ PAR</p>
            <p className="mb-2">Nom : <span className="font-semibold">{doc.received_by_name || "____________________"}</span></p>
            <p className="mb-2">Fonction : <span className="font-semibold">{doc.received_by_function || "____________________"}</span></p>
            <p className="mb-2">Date : <span className="font-semibold">{fmtDate(doc.received_at_date) || "____________________"}</span></p>
            <p className="mb-2">Heure : <span className="font-semibold">{doc.received_at_time || "____________________"}</span></p>
            <p className="mt-6">Signature :</p>
            <div className="mt-8 border-b border-black" />
          </div>
          <div>
            <p className="mb-2 border-b border-black pb-1 font-black">LIVRÉ PAR</p>
            <p className="mb-2">Nom : <span className="font-semibold">{doc.delivered_by_name || "____________________"}</span></p>
            <p className="mb-2">Fonction / Entreprise : <span className="font-semibold">{doc.delivered_by_function || "____________________"}</span></p>
            <p className="mb-2">Date : <span className="font-semibold">{fmtDate(doc.delivered_at_date) || "____________________"}</span></p>
            <p className="mb-2">Heure : <span className="font-semibold">{doc.delivered_at_time || "____________________"}</span></p>
            <p className="mt-6">Signature :</p>
            <div className="mt-8 border-b border-black" />
          </div>
        </section>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: #fff; }
          /* La zone de signatures ne se coupe pas et reste en fin de document. */
          .signature-zone { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
