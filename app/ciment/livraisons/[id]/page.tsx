"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import PrintableCompanyHeader from "../../../components/PrintableCompanyHeader";

/**
 * P3 — BON DE LIVRAISON CIMENT, page A4 imprimable.
 *
 * AUCUN prix, AUCUN montant : un BL n'est pas un document commercial.
 * Lecture seule — le BL est créé par la validation de la vente, ouvrir ou
 * imprimer cette page ne peut pas en produire un second.
 */

type Delivery = {
  id: number; delivery_number: string; delivery_date: string | null;
  destination: string | null; tonnage_delivered: string | null;
  truck: string | null; driver_name: string | null;
  tonnage_voucher_number: string | null; status: string | null;
  received_by_name: string | null; delivered_by_name: string | null;
  notes: string | null;
  sale_number: string | null; customer_name: string | null;
  customer_address: string | null; cement_type: string | null; strength: string | null;
};
type Company = Record<string, unknown>;

/* Date « AAAA-MM-JJ » affichée telle quelle — pas de reconversion UTC. */
const fdate = (d: string | null) => {
  if (!d) return "";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
};
const num = (v: string | number | null) =>
  v == null || v === "" ? "0" : Number(v).toLocaleString("fr-FR");

export default function BonLivraisonCimentPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const search = useSearchParams();
  const [d, setD] = useState<Delivery | null>(null);
  const [company, setCompany] = useState<Company>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await authFetch(`/cement/deliveries/${id}`);
    if (r.ok) {
      const data = await r.json();
      setD(data.delivery || data);
    } else setError(r.status === 404 ? "Bon de livraison introuvable." : "Erreur de chargement.");
    const c = await authFetch("/company-settings/current");
    if (c.ok) setCompany(await c.json());
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  /* Arrivée via « Imprimer » d'une liste (?print=1) : on déclenche l'impression
     une fois le document rendu. Aucune écriture serveur n'est faite. */
  useEffect(() => {
    if (!d || search?.get("print") !== "1") return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [d, search]);

  if (error) return <div className="p-8 font-semibold text-red-700">{error}</div>;
  if (!d) return <div className="p-8 text-gray-600">Chargement du bon de livraison…</div>;

  const designation = `Ciment${d.cement_type ? ` ${d.cement_type}` : ""}${d.strength ? ` ${d.strength}` : ""}`;

  return (
    <div className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4 print:hidden">
        <Link href="/ciment/livraisons" className="font-bold text-blue-700">← Livraisons ciment</Link>
        <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">
          Imprimer
        </button>
      </div>

      <div className="doc-sheet mx-auto w-[210mm] min-h-[297mm] bg-white p-[14mm] text-black shadow print:w-auto print:min-h-0 print:p-0 print:shadow-none">
        <PrintableCompanyHeader
          company={company}
          documentTitle="Bon de livraison"
          documentNumber={`N° ${d.delivery_number}`}
          documentDate={fdate(d.delivery_date) ? `Date : ${fdate(d.delivery_date)}` : undefined}
        />

        <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <p><span className="font-bold">Client :</span> {d.customer_name || "—"}</p>
          <p><span className="font-bold">Site / Destination :</span> {d.destination || "—"}</p>
          <p><span className="font-bold">Référence vente :</span> {d.sale_number || "—"}</p>
          {d.tonnage_voucher_number && (
            <p><span className="font-bold">Bon de tonnage :</span> {d.tonnage_voucher_number}</p>
          )}
          {d.truck && <p><span className="font-bold">Camion :</span> {d.truck}</p>}
          {d.driver_name && <p><span className="font-bold">Chauffeur :</span> {d.driver_name}</p>}
        </section>

        {/* Aucune colonne de prix ni de montant : ce n'est pas un document commercial. */}
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y-2 border-black">
              <th className="p-2 text-left">Désignation</th>
              <th className="p-2 text-right w-40">Quantité livrée</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-300">
              <td className="p-2">{designation}</td>
              <td className="p-2 text-right font-bold">{num(d.tonnage_delivered)} tonne(s)</td>
            </tr>
          </tbody>
        </table>

        {d.notes && <p className="mt-4 text-sm"><span className="font-bold">Observation :</span> {d.notes}</p>}

        {/* Intitulés AU-DESSUS des lignes de signature. */}
        <section className="signature-zone mt-14 grid grid-cols-2 gap-16 text-sm">
          <div>
            <p className="border-b border-black pb-1 text-center font-black">LIVRÉ PAR</p>
            <p className="mt-3">Nom : <span className="font-semibold">{d.delivered_by_name || "____________________"}</span></p>
            <div className="h-24" />
          </div>
          <div>
            <p className="border-b border-black pb-1 text-center font-black">CLIENT / RÉCEPTION</p>
            <p className="mt-3">Nom : <span className="font-semibold">{d.received_by_name || "____________________"}</span></p>
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
