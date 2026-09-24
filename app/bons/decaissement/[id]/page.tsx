"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import PrintableCompanyHeader from "../../../components/PrintableCompanyHeader";

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
  lines?: RequestLine[];
};

type RequestLine = {
  id: number;
  line_no: number;
  category: string | null;
  label: string;
  quantity: string | number | null;
  unit_price: string | number | null;
  amount: string | number;
};

type Receipt = {
  id: number;
  receipt_type?: "FILE" | "PENDING" | "DECLARATION";
  amount: string;
  label: string | null;
  supplier_name?: string | null;
  declaration_text?: string | null;
  review_status: string;
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
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [voucher, setVoucher] = useState("");
  const [company, setCompany] = useState<Company>({});

  const load = useCallback(async () => {
    const r = await authFetch(`/disbursements/${id}/details`);
    if (r.ok) {
      const d = await r.json();
      setReq(d.request);
      setRefunds(d.refunds || []);
      setReceipts(d.receipts || []);
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

        <PrintableCompanyHeader
          company={company}
          documentTitle="BON DE DÉCAISSEMENT"
          documentNumber={
            voucher
              ? `N° ${voucher}`
              : `Demande : ${req.request_number}`
          }
          documentDate={`Date : ${
            fdate(req.disbursed_at) ||
            fdate(req.created_at)
          }`}
        />

        <section className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p><span className="font-bold">Demandeur :</span> {req.requester_name || "—"}</p>
          <p><span className="font-bold">Bénéficiaire :</span> {beneficiary}</p>
          <p className="col-span-2"><span className="font-bold">Motif :</span> {req.reason}</p>
          <p><span className="font-bold">Catégorie :</span> {req.category || "—"}</p>
          <p><span className="font-bold">Mode de paiement :</span> {payLabel(req.payment_method)}</p>
        </section>

        {req.lines && req.lines.length > 0 && (
          <section className="mt-5">
            <p className="mb-2 text-sm font-black uppercase">
              Détail de la demande
            </p>

            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-y-2 border-black bg-gray-100">
                  <th className="p-2 text-left">N°</th>
                  <th className="p-2 text-left">Libellé</th>
                  <th className="p-2 text-right">Qté</th>
                  <th className="p-2 text-right">Prix unitaire</th>
                  <th className="p-2 text-right">Montant</th>
                </tr>
              </thead>

              <tbody>
                {req.lines.map((line) => (
                  <tr
                    key={line.id || line.line_no}
                    className="border-b border-gray-300"
                  >
                    <td className="p-2">
                      {line.line_no}
                    </td>

                    <td className="p-2">
                      <span className="font-bold">
                        {line.label}
                      </span>

                      {line.category && (
                        <span className="block text-[10px] text-gray-500">
                          {line.category}
                        </span>
                      )}
                    </td>

                    <td className="p-2 text-right">
                      {line.quantity ?? "—"}
                    </td>

                    <td className="p-2 text-right">
                      {line.unit_price != null
                        ? fcfa(line.unit_price)
                        : "—"}
                    </td>

                    <td className="p-2 text-right font-bold">
                      {fcfa(line.amount)}
                    </td>
                  </tr>
                ))}

                <tr className="border-b-2 border-black">
                  <td
                    colSpan={4}
                    className="p-2 text-right font-black"
                  >
                    TOTAL
                  </td>

                  <td className="p-2 text-right font-black">
                    {fcfa(req.amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

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

        {receipts
          .filter(
            (r) =>
              r.receipt_type === "DECLARATION" &&
              r.review_status !== "REFUSE"
          )
          .map((r) => (
            <section
              key={r.id}
              className="mt-5 break-inside-avoid border-2 border-black p-4 text-sm"
            >
              <p className="text-center font-black uppercase">
                Déclaration justificative — absence de reçu
              </p>

              <p className="mt-3">
                Je soussigné(e),{" "}
                <span className="font-bold">
                  {r.supplier_name || "________________________"}
                </span>
                , confirme avoir reçu / utilisé la somme de{" "}
                <span className="font-bold">
                  {fcfa(r.amount)}
                </span>{" "}
                dans le cadre de l'opération suivante :
              </p>

              {r.label && (
                <p className="mt-2">
                  <span className="font-bold">Objet :</span>{" "}
                  {r.label}
                </p>
              )}

              <p className="mt-2 whitespace-pre-wrap">
                {r.declaration_text}
              </p>

              <div className="mt-8 grid grid-cols-2 gap-10">
                <div>
                  <p className="border-b border-black pb-1 font-bold">
                    Personne / fournisseur
                  </p>
                  <p className="mt-2 text-xs">
                    Nom : {r.supplier_name || "________________"}
                  </p>
                  <div className="h-16" />
                  <p className="text-xs">Signature</p>
                </div>

                <div>
                  <p className="border-b border-black pb-1 font-bold">
                    Comptable
                  </p>
                  <p className="mt-2 text-xs">
                    Nom : {req.disbursed_by_name || "________________"}
                  </p>
                  <div className="h-16" />
                  <p className="text-xs">Signature / cachet</p>
                </div>
              </div>
            </section>
          ))}

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
