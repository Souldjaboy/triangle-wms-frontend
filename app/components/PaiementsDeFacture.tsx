"use client";

/**
 * LES PAIEMENTS D'UNE FACTURE, ET D'OÙ ILS VIENNENT.
 *
 * Panneau commun aux deux produits. Il répond à la question qu'on se pose en
 * rapprochant les comptes : « qu'est-ce qui a été encaissé sur cette facture,
 * et est-ce que tout y appartient vraiment ? »
 *
 * Un paiement venu d'une autre facture le dit, avec son origine et le motif
 * du déplacement. Un paiement contrepassé est barré, pas effacé : l'argent
 * est ressorti, mais l'encaissement a bien eu lieu et doit rester lisible.
 */

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../lib/api";
import ReaffecterPaiement from "./ReaffecterPaiement";

type VenuDe = {
  from_invoice_number: string; from_customer: string;
  reason: string; created_by_name: string; created_at: string;
};
type Paiement = {
  id: number; payment_number: string; payment_date: string; amount: string;
  payment_method: string | null; reference: string | null;
  contrepasse: boolean; venu_de: VenuDe | null;
  reallocation_count: number;
};
type Facture = {
  id: number; numero: string; client: string; statut: string;
  montant: number; paye: number; restant: number;
};

const money = (v: unknown) =>
  `${new Intl.NumberFormat("fr-FR").format(Number(v || 0))} FCFA`;
const fdate = (d: string | null) => {
  if (!d) return "—";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d).slice(0, 10);
};

export default function PaiementsDeFacture({
  produit, factureId, onFerme, onChange, peutReaffecter = false,
}: {
  produit: "sable" | "ciment";
  factureId: number;
  onFerme: () => void;
  onChange?: (message: string) => void;
  peutReaffecter?: boolean;
}) {
  const [facture, setFacture] = useState<Facture | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [chargement, setChargement] = useState(true);
  const [aReaffecter, setAReaffecter] = useState<Paiement | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    const r = await authFetch(`/invoices/${produit}/${factureId}/paiements`);
    const d = await r.json().catch(() => null);
    if (r.ok && d) { setFacture(d.facture); setPaiements(d.paiements || []); setErreur(""); }
    else setErreur(d?.error || "Lecture impossible.");
    setChargement(false);
  }, [produit, factureId]);

  useEffect(() => { charger(); }, [charger]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      role="dialog" aria-modal="true" aria-label="Paiements de la facture">
      <div className="my-8 w-full max-w-3xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b p-4">
          <div>
            <h2 className="font-semibold font-mono">{facture?.numero || "…"}</h2>
            {facture && (
              <p className="mt-1 text-sm text-gray-600">
                {facture.client || "—"} · {money(facture.montant)} · payé {money(facture.paye)} ·
                restant <strong>{money(facture.restant)}</strong>
              </p>
            )}
          </div>
          <button onClick={onFerme} aria-label="Fermer"
            className="px-2 text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
        </div>

        {message && (
          <div className="border-b bg-green-50 p-3 text-sm text-green-900">{message}</div>
        )}
        {erreur && (
          <div className="border-b bg-red-50 p-3 text-sm text-red-900">{erreur}</div>
        )}

        <div className="overflow-x-auto p-4">
          {chargement && <p className="text-sm text-gray-500">Chargement…</p>}
          {!chargement && !paiements.length && (
            <p className="text-sm text-gray-500">Aucun encaissement sur cette facture.</p>
          )}
          {!!paiements.length && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2">Paiement</th><th className="p-2">Date</th>
                  <th className="p-2">Moyen</th>
                  <th className="p-2 text-right">Montant</th>
                  <th className="p-2">Provenance</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {paiements.map((p) => (
                  <tr key={p.id} className="border-t align-top">
                    <td className={`p-2 font-mono ${p.contrepasse ? "text-gray-400 line-through" : ""}`}>
                      {p.payment_number}
                    </td>
                    <td className="p-2">{fdate(p.payment_date)}</td>
                    <td className="p-2">
                      {p.payment_method || "—"}
                      {p.reference && <span className="block text-xs text-gray-500">{p.reference}</span>}
                    </td>
                    <td className={`p-2 text-right font-medium ${p.contrepasse ? "text-gray-400 line-through" : ""}`}>
                      {money(p.amount)}
                    </td>
                    <td className="p-2 text-xs">
                      {p.contrepasse && (
                        <span className="text-gray-600">Annulé — l&apos;argent est ressorti</span>
                      )}
                      {!p.contrepasse && p.venu_de && (
                        <span className="text-blue-800">
                          Venu de <span className="font-mono">{p.venu_de.from_invoice_number}</span>
                          <span className="block text-gray-600">
                            {p.venu_de.reason} — {p.venu_de.created_by_name}
                          </span>
                        </span>
                      )}
                      {!p.contrepasse && !p.venu_de && (
                        <span className="text-gray-500">Encaissé sur cette facture</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {!p.contrepasse && peutReaffecter && (
                        <button onClick={() => setAReaffecter(p)}
                          className="rounded bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800">
                          Réaffecter
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {aReaffecter && facture && (
        <ReaffecterPaiement
          produit={produit}
          paiement={aReaffecter}
          factureActuelle={{ numero: facture.numero, client: facture.client }}
          onFerme={() => setAReaffecter(null)}
          onFait={(m) => { setMessage(m); onChange?.(m); charger(); }}
        />
      )}
    </div>
  );
}
