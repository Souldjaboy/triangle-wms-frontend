"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
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


  function documentUrl() {
    if (typeof window === "undefined") return "";
    return window.location.href.split("?")[0];
  }

  function documentLabel() {
    const anyDoc:any = d;

    return (
      anyDoc?.delivery_number ||
      "Document"
    );
  }

  function enregistrerPDF() {
    /*
     * Le navigateur ouvre son moteur PDF natif.
     * Chrome / Edge / Safari :
     * Imprimer -> Enregistrer au format PDF.
     */
    window.print();
  }

  function partagerWhatsApp() {
    const texte =
      `Bonjour,\n\nVeuillez trouver le document ${documentLabel()} :\n${documentUrl()}`;

    window.open(
      `https://wa.me/?text=${encodeURIComponent(texte)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function partagerEmail() {
    const sujet =
      `${documentLabel()} - Triangle WMS`;

    const corps =
      `Bonjour,\n\nVeuillez trouver le document ${documentLabel()} à cette adresse :\n\n${documentUrl()}\n\nCordialement.`;

    window.location.href =
      `mailto:?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
  }

  async function partagerDocument() {
    const data = {
      title: documentLabel(),
      text: `Document ${documentLabel()}`,
      url: documentUrl()
    };

    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }

      await navigator.clipboard.writeText(documentUrl());
      alert("Lien du document copié.");
    } catch (e:any) {
      if (e?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(documentUrl());
          alert("Lien du document copié.");
        } catch {}
      }
    }
  }

  if (error) return <div className="p-8 font-semibold text-red-700">{error}</div>;
  if (!d) return <div className="p-8 text-gray-600">Chargement du bon de livraison…</div>;
  const estAnnule = Boolean(d.cancelled_at);

  return (
    <div className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4 print:hidden">
        <Link href="/sable/livraisons" className="font-bold text-blue-700">← Livraisons sable</Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={enregistrerPDF}
            className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white"
          >
            ⬇️ Télécharger PDF
          </button>

          <button
            type="button"
            onClick={partagerWhatsApp}
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white"
          >
            WhatsApp
          </button>

          <button
            type="button"
            onClick={partagerEmail}
            className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-bold text-white"
          >
            E-mail
          </button>

          <button
            type="button"
            onClick={partagerDocument}
            className="rounded-lg border-2 border-slate-800 px-3 py-2 text-sm font-bold text-slate-900"
          >
            Partager
          </button>
        </div>

        <button
          onClick={() => { window.print(); declarerImpression(); }}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          Imprimer
        </button>
      </div>

      {estAnnule && (
        <div className="mx-auto mb-4 w-[210mm] max-w-full rounded-xl bg-red-50 p-4 text-sm text-red-900 print:hidden">
          <p className="font-black">Ce bon de livraison est ANNULÉ.</p>
          {d.cancellation_reason && <p>Motif : {d.cancellation_reason}</p>}
          {d.cancelled_by_name && <p>Par : {d.cancelled_by_name}</p>}
          {d.cancelled_at && <p>Le : {fdate(d.cancelled_at)}</p>}
          {d.replaced_by_delivery_id && <p>Remplacé par le BL n° {d.replaced_by_delivery_id}.</p>}
        </div>
      )}

      <div className="doc-sheet relative mx-auto w-[210mm] min-h-[297mm] bg-white p-[14mm] text-black shadow print:shadow-none">
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
        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {

          html,
          body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          /*
           * IMPORTANT :
           * conserver réellement les fonds noirs,
           * couleurs, bordures et images comme à l'écran.
           */
          html,
          body,
          body * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /*
           * Une seule vraie feuille A4.
           * Aucun recalcul automatique de largeur par Chrome.
           */
          .doc-sheet {
            width: 210mm !important;
            min-width: 210mm !important;
            max-width: 210mm !important;

            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;

            margin: 0 !important;
            padding: 14mm !important;

            box-sizing: border-box !important;
            overflow: hidden !important;

            page-break-before: avoid !important;
            page-break-after: avoid !important;
            break-before: avoid-page !important;
            break-after: avoid-page !important;

            box-shadow: none !important;

            transform: none !important;
          }

          /*
           * L'enveloppe générale ne doit pas générer
           * quelques pixels supplémentaires qui créent
           * une deuxième page blanche.
           */
          body > div,
          #__next,
          main {
            margin: 0 !important;
            padding: 0 !important;
          }

          .doc-sheet table,
          .doc-sheet thead,
          .doc-sheet tbody,
          .doc-sheet tfoot,
          .doc-sheet tr,
          .doc-sheet td,
          .doc-sheet th {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .signature-zone {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /*
           * Tous les boutons/navigation restent invisibles.
           */
          .print\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
