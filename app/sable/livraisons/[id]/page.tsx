"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import { telechargerPdfBon, partagerPdfBon, envoyerBonParWhatsApp } from "../../../lib/bon-livraison-pdf";
import PrintableCompanyHeader from "../../../components/PrintableCompanyHeader";

/**
 * P4-B — BON DE LIVRAISON SABLE, page A4 imprimable.
 *
 * AUCUN prix, AUCUN montant, AUCUN statut financier : un BL n'est pas un
 * document commercial. Le téléphone du client n'est pas imprimé.
 * Lecture seule — le BL est créé par la validation de la vente.
 */

type Delivery = {
  id: number; delivery_number: string; delivery_date: string | null;
  destination: string | null; quantity_m3: string | null;
  received_by: string | null; delivered_by: string | null;
  notes: string | null; voucher_number: string | null;
  sale_number: string | null; customer_name: string | null;
  customer_address: string | null; product_name: string | null;
  cancelled_at?: string | null; cancelled_by_name?: string | null;
  cancellation_reason?: string | null; replaced_by_delivery_id?: number | null;
};
type Company = Record<string, unknown>;

const fdate = (d: string | null) => {
  if (!d) return "";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
};
const qty = (v: string | number | null) =>
  Number(v || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export default function BonLivraisonSablePage() {
  const params = useParams();
  const id = String(params?.id || "");
  const search = useSearchParams();
  const [d, setD] = useState<Delivery | null>(null);
  const [company, setCompany] = useState<Company>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await authFetch(`/sand/deliveries/${id}`);
    if (r.ok) setD((await r.json()).delivery);
    else setError(r.status === 404 ? "Bon de livraison introuvable." : "Erreur de chargement.");
    const c = await authFetch("/company-settings/current");
    if (c.ok) setCompany(await c.json());
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  const declarerImpression = useCallback(() => {
    authFetch(`/sand/deliveries/${id}/printed`, { method: "POST" }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!d || search?.get("print") !== "1") return;
    const t = setTimeout(() => { window.print(); declarerImpression(); }, 300);
    return () => clearTimeout(t);
  }, [d, search, declarerImpression]);

  const [pdfEnCours, setPdfEnCours] = useState(false);
  const [messagePdf, setMessagePdf] = useState("");

  const telechargerPdf = async () => {
    setPdfEnCours(true); setMessagePdf("");
    try {
      const nom = await telechargerPdfBon("sable", id as string);
      setMessagePdf(`PDF téléchargé : ${nom}`);
    } catch (e) {
      setMessagePdf(e instanceof Error ? e.message : "Le PDF n’a pas pu être produit.");
    } finally { setPdfEnCours(false); }
  };

  const partager = async () => {
    setPdfEnCours(true); setMessagePdf("");
    try {
      const r = await partagerPdfBon("sable", id as string,
        { titre: `Bon de livraison ${d?.delivery_number || ""}`.trim() });
      if (r.mode === "partage") setMessagePdf(`Bon partagé : ${r.nom}`);
      else if (r.mode === "telecharge") setMessagePdf(r.raison);
    } catch (e) {
      setMessagePdf(e instanceof Error ? e.message : "Le partage a échoué.");
    } finally { setPdfEnCours(false); }
  };

  const partagerWhatsApp = async () => {
    setPdfEnCours(true); setMessagePdf("");
    try {
      const r = await envoyerBonParWhatsApp("sable", id as string, d?.delivery_number || "");
      if (r.mode === "partage") setMessagePdf("Bon transmis à l’application choisie.");
      else if (r.mode === "telecharge") setMessagePdf(r.raison);
    } catch (e) {
      setMessagePdf(e instanceof Error ? e.message : "Le partage a échoué.");
    } finally { setPdfEnCours(false); }
  };

  if (error) return <div className="p-8 font-semibold text-red-700">{error}</div>;
  if (!d) return <div className="p-8 text-gray-600">Chargement du bon de livraison…</div>;
  const estAnnule = Boolean(d.cancelled_at);

  return (
    <div className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-4 print:hidden">
        <Link href="/sable/livraisons" className="font-bold text-blue-700">← Livraisons sable</Link>
        <div className="flex flex-wrap gap-2">
          {/* Imprimer ouvre la boîte d'impression ; Télécharger dépose un
              fichier. Deux gestes, deux boutons — et le même PDF que celui
              qu'un client recevra par WhatsApp ou par email. */}
          <button
            onClick={() => { window.print(); declarerImpression(); }}
            className="min-h-[44px] rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"
          >
            Imprimer
          </button>
          <button onClick={telechargerPdf} disabled={pdfEnCours}
            className="min-h-[44px] rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {pdfEnCours ? "PDF en cours…" : "Télécharger PDF"}
          </button>
          <button onClick={partagerWhatsApp} disabled={pdfEnCours}
            className="min-h-[44px] rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            WhatsApp
          </button>
          <button onClick={partager} disabled={pdfEnCours}
            className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            Partager
          </button>
        </div>
      </div>

      {messagePdf && (
        <div className="mx-auto mb-4 w-[210mm] max-w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 print:hidden">
          {messagePdf}
        </div>
      )}

      {estAnnule && (
        <div className="mx-auto mb-4 w-[210mm] max-w-full rounded-xl bg-red-50 p-4 text-sm text-red-900 print:hidden">
          <p className="font-black">Ce bon de livraison est ANNULÉ.</p>
          {d.cancellation_reason && <p>Motif : {d.cancellation_reason}</p>}
          {d.cancelled_by_name && <p>Par : {d.cancelled_by_name}</p>}
          {d.cancelled_at && <p>Le : {fdate(d.cancelled_at)}</p>}
          {d.replaced_by_delivery_id && <p>Remplacé par le BL n° {d.replaced_by_delivery_id}.</p>}
        </div>
      )}

      <div className="doc-sheet relative mx-auto w-[210mm] min-h-[297mm] bg-white p-[14mm] text-black shadow print:w-auto print:min-h-0 print:p-0 print:shadow-none">
        {estAnnule && (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
            <span className="rotate-[-30deg] select-none text-[110px] font-black tracking-widest text-red-600/25 print:text-red-600/35">
              ANNULÉ
            </span>
          </div>
        )}
        <PrintableCompanyHeader
          company={{ ...company, email: undefined }}
          documentTitle="Bon de livraison"
          documentNumber={`N° ${d.delivery_number}`}
          documentDate={fdate(d.delivery_date) ? `Date : ${fdate(d.delivery_date)}` : undefined}
        />

        <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <p><span className="font-bold">Client :</span> {d.customer_name || "—"}</p>
          <p><span className="font-bold">Site :</span> {d.destination || "—"}</p>
          <p><span className="font-bold">Référence vente :</span> {d.sale_number || "—"}</p>
          {d.voucher_number && (
            <p><span className="font-bold">N° bon :</span> {d.voucher_number}</p>
          )}
        </section>

        {/* Deux colonnes seulement : ni prix, ni montant, ni total. */}
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-black">
              <th className="p-2 text-left">Désignation</th>
              <th className="p-2 text-right w-44">Quantité m³</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-300">
              <td className="p-2">Sable</td>
              <td className="p-2 text-right font-bold">{qty(d.quantity_m3)} m³</td>
            </tr>
          </tbody>
        </table>

        {d.notes && <p className="mt-4 text-sm"><span className="font-bold">Observation :</span> {d.notes}</p>}

        {/* Intitulés au-dessus des lignes ; pas de « Date : » ni « Signature : ». */}
        <section className="signature-zone mt-14 grid grid-cols-2 gap-16 text-sm">
          <div>
            <p className="border-b border-black pb-1 text-center font-black">LIVRÉ PAR</p>
            <p className="mt-3">Nom : <span className="font-semibold">{d.delivered_by || "____________________"}</span></p>
            <div className="h-24" />
          </div>
          <div>
            <p className="border-b border-black pb-1 text-center font-black">CLIENT / RÉCEPTION</p>
            <p className="mt-3">Nom : <span className="font-semibold">{d.received_by || d.customer_name || "____________________"}</span></p>
            <div className="h-24" />
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
