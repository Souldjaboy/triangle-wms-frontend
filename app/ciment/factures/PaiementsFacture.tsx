"use client";

/**
 * LES PAIEMENTS D'UNE FACTURE CIMENT, ET COMMENT EN DÉFAIRE UN.
 *
 * Annuler un paiement n'efface rien : le paiement d'origine reste à l'écran,
 * barré, avec le motif de son annulation et le nom de qui l'a décidée. La
 * facture redevient due du montant exact.
 *
 * Et surtout : contrepasser n'est PAS rembourser. L'écriture est défaite, mais
 * l'argent du client n'est pas revenu tant que personne ne l'a constaté. Le
 * panneau le dit en toutes lettres, et garde la ligne « remboursement dû »
 * visible jusqu'à ce que la référence du virement soit saisie.
 */

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../../lib/api";

const money = (v: any) => new Intl.NumberFormat("fr-FR").format(Number(v || 0)) + " FCFA";
const fdate = (d: string | null) => {
  if (!d) return "—";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
};

type Paiement = {
  id: number; payment_number: string; payment_date: string; amount: string;
  payment_method: string; reference: string | null; bank_name: string | null;
  contrepasse: boolean; reversal_id: number | null; reversal_reason: string | null;
  reversed_at: string | null; reversed_by_name: string | null;
  refund_pending: boolean | null; refunded_at: string | null; refund_reference: string | null;
};

export default function PaiementsFacture({
  invoice, onClose, onChanged, peutContrepasser, peutConstaterRemboursement,
}: {
  invoice: any;
  onClose: () => void;
  onChanged: (message: string) => void;
  peutContrepasser: boolean;
  peutConstaterRemboursement: boolean;
}) {
  const [data, setData] = useState<any>(null);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [aAnnuler, setAAnnuler] = useState<Paiement | null>(null);
  const [motif, setMotif] = useState("");
  const [aRembourser, setARembourser] = useState<Paiement | null>(null);
  const [reference, setReference] = useState("");

  const charger = useCallback(async () => {
    const r = await authFetch(`/cement/invoices/${invoice.id}/payments`);
    const d = await r.json().catch(() => null);
    if (r.ok) setData(d); else setErreur(d?.error || "Lecture impossible.");
  }, [invoice.id]);
  useEffect(() => { charger(); }, [charger]);

  const annuler = async () => {
    if (!aAnnuler) return;
    setErreur("");
    if (motif.trim().length < 10) {
      return setErreur("Le motif doit faire au moins 10 caractères : il restera attaché au paiement.");
    }
    setEnCours(true);
    const r = await authFetch(`/cement/payments/${aAnnuler.id}/reverse`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: motif.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    setEnCours(false);
    if (r.ok) {
      setAAnnuler(null); setMotif("");
      await charger();
      onChanged(d.message || "Paiement annulé.");
    } else { setErreur(d.error || "Annulation impossible."); }
  };

  const constater = async () => {
    if (!aRembourser?.reversal_id) return;
    setErreur("");
    if (reference.trim().length < 3) {
      return setErreur("Indiquez la référence du remboursement (virement, reçu, numéro de chèque).");
    }
    setEnCours(true);
    const r = await authFetch(`/cement/reversals/${aRembourser.reversal_id}/refunded`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: reference.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    setEnCours(false);
    if (r.ok) {
      setARembourser(null); setReference("");
      await charger();
      onChanged(d.message || "Remboursement constaté.");
    } else { setErreur(d.error || "Enregistrement impossible."); }
  };

  const paiements: Paiement[] = data?.paiements || [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">Paiements de {invoice.invoice_number}</h2>
            <p className="text-sm text-gray-600">
              {invoice.customer_name} · {money(invoice.total_amount)} au total
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg bg-gray-100 px-4 py-2 font-bold text-gray-700">
            Fermer
          </button>
        </div>

        {erreur && <p className="mt-4 rounded-lg bg-red-50 p-3 font-bold text-red-800">{erreur}</p>}

        {data && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-bold text-gray-500">Encaissé</p>
              <p className="text-xl font-black">{money(data.total_encaisse)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-bold text-gray-500">Annulé</p>
              <p className="text-xl font-black">{money(data.total_contrepasse)}</p>
            </div>
            {/* La ligne que l'on oublie : de l'argent reste dû au client. */}
            <div className={`rounded-xl p-4 ${Number(data.remboursements_dus) > 0 ? "bg-amber-50" : "bg-gray-50"}`}>
              <p className="text-xs font-bold text-gray-500">À rembourser au client</p>
              <p className="text-xl font-black">{money(data.remboursements_dus)}</p>
            </div>
          </div>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-gray-100 text-gray-600">
              <tr>{["Numéro", "Date", "Moyen", "Montant", "État", ""].map((h) => (
                <th key={h} className="p-3">{h}</th>))}</tr>
            </thead>
            <tbody>
              {paiements.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-gray-500">Aucun paiement enregistré.</td></tr>
              ) : paiements.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className={`p-3 font-mono ${p.contrepasse ? "text-gray-400 line-through" : ""}`}>
                    {p.payment_number}
                  </td>
                  <td className="p-3">{fdate(p.payment_date)}</td>
                  <td className="p-3">
                    {p.bank_name || (p.payment_method === "especes" ? "Espèces" : p.payment_method)}
                    {p.reference && <span className="block text-xs text-gray-500">{p.reference}</span>}
                  </td>
                  <td className={`p-3 text-right font-bold ${p.contrepasse ? "text-gray-400 line-through" : ""}`}>
                    {money(p.amount)}
                  </td>
                  <td className="p-3">
                    {!p.contrepasse ? (
                      <span className="rounded bg-green-100 px-2 py-1 text-xs font-bold text-green-800">Encaissé</span>
                    ) : (
                      <div className="space-y-1">
                        <span className="rounded bg-gray-200 px-2 py-1 text-xs font-bold text-gray-700">Annulé</span>
                        <p className="text-xs text-gray-600">{p.reversal_reason}</p>
                        <p className="text-xs text-gray-400">
                          par {p.reversed_by_name} le {fdate(p.reversed_at)}
                        </p>
                        {p.refund_pending ? (
                          <p className="text-xs font-bold text-amber-700">
                            Remboursement non effectué
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500">
                            Remboursé — réf. {p.refund_reference}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {!p.contrepasse && peutContrepasser && (
                      <button onClick={() => { setAAnnuler(p); setMotif(""); setErreur(""); }}
                              className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
                        Annuler le paiement
                      </button>
                    )}
                    {p.contrepasse && p.refund_pending && peutConstaterRemboursement && (
                      <button onClick={() => { setARembourser(p); setReference(""); setErreur(""); }}
                              className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">
                        Constater le remboursement
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Confirmer l'annulation ──────────────────────────────────── */}
        {aAnnuler && (
          <div className="mt-6 rounded-xl border-2 border-red-200 p-5">
            <h3 className="text-lg font-black">Annuler le paiement {aAnnuler.payment_number}</h3>
            <p className="mt-2 text-sm text-gray-700">
              La facture {invoice.invoice_number} redeviendra due de {money(aAnnuler.amount)}
              {aAnnuler.bank_name
                ? <> et l&apos;argent ressortira de <b>{aAnnuler.bank_name}</b>.</>
                : <> et l&apos;argent ressortira de la trésorerie.</>}
            </p>

            {/* Ce que l'on confond, et qui fait attendre un virement qui ne
                viendra pas tout seul. */}
            <div className="mt-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-bold">Ceci annule l&apos;écriture, pas le virement.</p>
              <p className="mt-1">
                Le paiement d&apos;origine reste conservé et lisible. Si le client a
                réellement versé cet argent, il faudra le lui rendre : la ligne
                « à rembourser » restera affichée jusqu&apos;à ce que vous constatiez
                le remboursement.
              </p>
            </div>

            <label className="mt-4 flex flex-col gap-1">
              <span className="text-sm font-bold text-gray-600">
                Motif de l&apos;annulation (10 caractères minimum)
              </span>
              <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2}
                        className="w-full rounded-lg border p-3"
                        placeholder="Virement rejeté par la banque du client, provision insuffisante" />
            </label>

            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => { setAAnnuler(null); setErreur(""); }}
                      className="rounded-lg bg-gray-100 px-4 py-3 font-bold text-gray-700">Revenir</button>
              <button onClick={annuler} disabled={enCours || motif.trim().length < 10}
                      className="rounded-lg bg-red-600 px-4 py-3 font-black text-white disabled:opacity-50">
                {enCours ? "Annulation…" : "Confirmer l'annulation"}
              </button>
            </div>
          </div>
        )}

        {/* ── Constater le remboursement ──────────────────────────────── */}
        {aRembourser && (
          <div className="mt-6 rounded-xl border-2 border-amber-200 p-5">
            <h3 className="text-lg font-black">
              Constater le remboursement de {money(aRembourser.amount)}
            </h3>
            <p className="mt-2 text-sm text-gray-700">
              À enregistrer une fois l&apos;argent réellement renvoyé au client.
              <b> Aucun nouveau mouvement comptable ne sera écrit</b> : l&apos;argent est
              sorti des comptes au moment de l&apos;annulation.
            </p>
            <label className="mt-4 flex flex-col gap-1">
              <span className="text-sm font-bold text-gray-600">
                Référence du remboursement (virement, reçu, chèque)
              </span>
              <input value={reference} onChange={(e) => setReference(e.target.value)}
                     className="w-full rounded-lg border p-3" placeholder="VIR-REMB-8842" />
            </label>
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => { setARembourser(null); setErreur(""); }}
                      className="rounded-lg bg-gray-100 px-4 py-3 font-bold text-gray-700">Revenir</button>
              <button onClick={constater} disabled={enCours || reference.trim().length < 3}
                      className="rounded-lg bg-amber-600 px-4 py-3 font-black text-white disabled:opacity-50">
                {enCours ? "Enregistrement…" : "Confirmer le remboursement"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
