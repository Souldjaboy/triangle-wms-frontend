"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";

/**
 * PHASE 4 — BON DE DÉCAISSEMENT A4 imprimable.
 * La réimpression n'exécute AUCUN décaissement : cette page ne fait que lire
 * la demande (aucun POST). Blocs REÇU PAR / REMIS PAR + validation Direction.
 */

type Req = {
  id: number; request_number: string; created_at: string; requester_name: string | null;
  beneficiary_name: string | null;
  reason: string; category: string | null; amount: string; amount_disbursed: string | null;
  payment_method: string | null; status: string;
  approved_by_name: string | null; approved_at: string | null; approval_comment: string | null;
  disbursed_by_name: string | null; disbursed_at: string | null; disbursement_comment: string | null;
  voucher_number: string | null;
};
type Refund = { id: number; amount: string };
type Company = { company_name?: string; logo_url?: string; address?: string; phone?: string };

const fcfa = (v: string | number | null) => (v == null || v === "" ? "—" : Number(v).toLocaleString("fr-FR") + " FCFA");
const fdate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "");
/* Le mode de paiement est stocké en clé technique (« especes ») : on l'affiche
   lisiblement sans figer une liste fermée. */
const PAY_LABELS: Record<string, string> = {
  especes: "Espèces", cheque: "Chèque", virement: "Virement",
  virement_bancaire: "Virement bancaire", mobile: "Mobile money",
  mobile_money: "Mobile Money", orange_money: "Orange Money", carte: "Carte bancaire",
};
const payLabel = (v: string | null) =>
  !v ? "—" : PAY_LABELS[v] || v.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/* Bloc officiel : intitulé, nom, puis espace libre pour tampon et signature. */
function SignBlock({ title, name }: { title: string; name: string | null }) {
  return (
    <div>
      <p className="mb-2 border-b border-black pb-1 font-black">{title}</p>
      <p>Nom : <span className="font-semibold">{name || "____________________"}</span></p>
      <div className="h-24" />
    </div>
  );
}

export default function BonDecaissementPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [req, setReq] = useState<Req | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [voucher, setVoucher] = useState("");
  const [company, setCompany] = useState<Company>({});

  const load = useCallback(async () => {
    const r = await authFetch(`/disbursements/${id}/details`);
    if (r.ok) {
      const d = await r.json();
      setReq(d.request); setRefunds(d.refunds || []);
      // Source de vérité : colonne voucher_number (plus d'extraction par regex).
      setVoucher(d.request?.voucher_number || "");
    }
    const c = await authFetch("/company-settings/current");
    if (c.ok) setCompany(await c.json());
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  if (!req) return <div className="p-8 text-gray-600">Chargement du bon…</div>;

  const notDisbursed = !Number(req.amount_disbursed);
  const totalRefunded = refunds.reduce((s, r) => s + Number(r.amount), 0);
  // Bénéficiaire figé à la demande (jamais le demandeur par défaut si renseigné).
  const beneficiary = req.beneficiary_name || req.requester_name || "—";

  return (
    <div className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4 print:hidden">
        <Link href="/decaissements" className="font-bold text-blue-700">← Décaissements</Link>
        <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Imprimer</button>
      </div>

      <div className="relative mx-auto w-[210mm] min-h-[297mm] bg-white p-[14mm] text-black shadow print:w-auto print:min-h-0 print:p-0 print:shadow-none">
        {notDisbursed && (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rotate-[-30deg] text-[60px] font-black tracking-widest text-black/10">NON DÉCAISSÉ</span>
          </div>
        )}

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
            <p className="text-xl font-black tracking-wide">BON DE DÉCAISSEMENT</p>
            {voucher && <p className="text-sm font-bold">N° {voucher}</p>}
            <p className="text-xs">Demande : {req.request_number}</p>
            <p className="text-xs">Date : {fdate(req.disbursed_at) || fdate(req.created_at)}</p>
            <p className="mt-1 inline-block border border-black px-2 py-0.5 text-xs font-black">{req.status.replace(/_/g, " ")}</p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p><span className="font-bold">Demandeur :</span> {req.requester_name || "—"}</p>
          <p><span className="font-bold">Bénéficiaire :</span> {beneficiary}</p>
          <p className="col-span-2"><span className="font-bold">Motif :</span> {req.reason}</p>
          <p><span className="font-bold">Catégorie :</span> {req.category || "—"}</p>
          <p><span className="font-bold">Mode de paiement :</span> {payLabel(req.payment_method)}</p>
        </section>

        <table className="mt-4 w-full border-collapse text-sm">
          <tbody>
            <tr className="border-y border-black">
              <td className="p-2 font-bold">Montant demandé</td>
              <td className="p-2 text-right">{fcfa(req.amount)}</td>
            </tr>
            <tr className="border-b border-gray-300">
              <td className="p-2 font-bold">Montant validé par la Direction</td>
              <td className="p-2 text-right">{fcfa(req.amount)}</td>
            </tr>
            <tr className="border-b-2 border-black">
              <td className="p-2 font-black">MONTANT DÉCAISSÉ</td>
              <td className="p-2 text-right text-lg font-black">{fcfa(req.amount_disbursed)}</td>
            </tr>
            {totalRefunded > 0 && (
              <tr className="border-b border-gray-300">
                <td className="p-2 font-bold">Remboursement du reliquat</td>
                <td className="p-2 text-right">{fcfa(totalRefunded)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {req.disbursement_comment && (
          <section className="mt-3 text-sm">
            <p className="text-xs">
              <span className="font-bold">Observation :</span> {req.disbursement_comment}
            </p>
          </section>
        )}

        {/* Blocs officiels : intitulé + nom, puis espace libre pour tampon et
            signature manuscrite. Ni « Date : » ni « Signature : » — les trois
            blocs tiennent sur une ligne pour rester sur une seule page A4. */}
        <section className="signature-zone mt-10 grid grid-cols-3 gap-8 text-sm">
          <SignBlock title="REÇU PAR (bénéficiaire)" name={beneficiary} />
          <SignBlock title="REMIS PAR (comptable)" name={req.disbursed_by_name} />
          <SignBlock title="VALIDÉ PAR LA DIRECTION" name={req.approved_by_name} />
        </section>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: #fff; }
          .signature-zone { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
