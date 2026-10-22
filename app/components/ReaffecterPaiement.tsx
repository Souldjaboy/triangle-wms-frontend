"use client";

/**
 * DÉPLACER UN PAIEMENT VERS LA BONNE FACTURE.
 *
 * Un composant pour les DEUX produits : sable et ciment. La même erreur se
 * corrige du même geste, et deux écrans jumeaux auraient fini par diverger.
 *
 * CE QUE CETTE FENÊTRE DOIT RENDRE ÉVIDENT.
 *
 * 1. QUE L'ARGENT NE BOUGE PAS. Rien n'est réencaissé, rien ne ressort des
 *    comptes : seule l'imputation change. C'est écrit, pas sous-entendu —
 *    sans cela on croit avoir enregistré un second encaissement.
 *
 * 2. CE QUE CELA FAIT AUX DEUX FACTURES. Avant de confirmer, on voit ce que
 *    la facture d'origine redevient due, et ce que la facture visée reçoit.
 *
 * 3. QUAND CE N'EST PAS LE BON GESTE. Si l'argent doit ressortir ou revenir
 *    au client, il faut contrepasser, pas réaffecter. La fenêtre le dit.
 *
 * Le trop-perçu n'est pas interdit — cela arrive — mais il se décide : la
 * case se coche, et la décision reste dans l'historique.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";

type Cible = {
  id: number; numero: string; date: string | null; client: string;
  montant: number; paye: number; restant: number; statut: string;
  depassement: number;
};

const money = (v: unknown) =>
  `${new Intl.NumberFormat("fr-FR").format(Number(v || 0))} FCFA`;
const fdate = (d: string | null) => {
  if (!d) return "—";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d).slice(0, 10);
};

const MOTIF_MINIMUM = 10;

export default function ReaffecterPaiement({
  produit, paiement, factureActuelle, onFerme, onFait,
}: {
  /** « sable » ou « ciment » — la clé d'URL. */
  produit: "sable" | "ciment";
  paiement: { id: number; payment_number: string; amount: string | number; payment_date?: string | null };
  factureActuelle: { numero: string; client?: string };
  onFerme: () => void;
  onFait: (message: string) => void;
}) {
  const [cibles, setCibles] = useState<Cible[]>([]);
  const [recherche, setRecherche] = useState("");
  const [choisie, setChoisie] = useState<Cible | null>(null);
  const [motif, setMotif] = useState("");
  const [accepteDepassement, setAccepteDepassement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    const p = new URLSearchParams();
    if (recherche.trim()) p.set("q", recherche.trim());
    const r = await authFetch(`/payments/${produit}/${paiement.id}/cibles?${p.toString()}`);
    const d = await r.json().catch(() => null);
    if (r.ok && d) { setCibles(d.factures || []); setErreur(""); }
    else { setCibles([]); setErreur(d?.error || "Lecture des factures impossible."); }
    setChargement(false);
  }, [produit, paiement.id, recherche]);

  useEffect(() => { charger(); }, [charger]);
  /* Un changement de cible remet la décision de trop-perçu à zéro : la case
     cochée pour une facture ne vaut pas pour une autre. */
  useEffect(() => { setAccepteDepassement(false); }, [choisie?.id]);

  const montant = Number(paiement.amount || 0);
  const depassement = choisie ? Number(choisie.depassement || 0) : 0;
  const pret = useMemo(
    () => !!choisie && motif.trim().length >= MOTIF_MINIMUM && (depassement === 0 || accepteDepassement),
    [choisie, motif, depassement, accepteDepassement]);

  const deplacer = async () => {
    if (!choisie || !pret) return;
    setEnCours(true); setErreur("");
    const r = await authFetch(`/payments/${produit}/${paiement.id}/reaffecter`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vers_facture: choisie.id, motif: motif.trim(),
        accepter_depassement: accepteDepassement,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setEnCours(false);
    if (r.ok) {
      onFait(`Paiement ${paiement.payment_number} porté sur la facture ${choisie.numero}. Aucun encaissement nouveau n'a été enregistré.`);
      onFerme();
    } else {
      setErreur(d.error || "Réaffectation impossible.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog" aria-modal="true" aria-label={`Réaffecter le paiement ${paiement.payment_number}`}>
      <div className="my-8 w-full max-w-3xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b p-4">
          <div>
            <h2 className="font-semibold">Porter ce paiement sur une autre facture</h2>
            <p className="mt-1 text-sm text-gray-600">
              <span className="font-mono">{paiement.payment_number}</span> — {money(montant)}
              {paiement.payment_date ? ` du ${fdate(paiement.payment_date)}` : ""}
            </p>
          </div>
          <button onClick={onFerme} aria-label="Fermer"
            className="px-2 text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
        </div>

        {/* Ce que ce geste fait, et ce qu'il ne fait pas. */}
        <div className="border-b bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium">L&apos;argent ne bouge pas.</p>
          <p className="mt-1">
            Il a déjà été encaissé le {fdate(paiement.payment_date || null)} : seule son
            imputation change. Aucune écriture de trésorerie ne sera créée, et aucun
            second encaissement ne sera enregistré.
          </p>
          <p className="mt-2 text-blue-800">
            Si l&apos;argent doit au contraire ressortir des comptes ou revenir au client,
            ce n&apos;est pas ce geste : il faut annuler le paiement.
          </p>
        </div>

        <div className="p-4">
          <p className="mb-3 text-sm text-gray-700">
            Actuellement imputé à <span className="font-mono font-medium">{factureActuelle.numero}</span>
            {factureActuelle.client ? ` — ${factureActuelle.client}` : ""}.
          </p>

          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-gray-600">Chercher la bonne facture</span>
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
              placeholder="Numéro de facture ou nom du client"
              className="w-full rounded border px-2 py-1.5" />
          </label>

          {erreur && (
            <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">{erreur}</div>
          )}

          {chargement && <p className="text-sm text-gray-500">Chargement…</p>}
          {!chargement && !cibles.length && (
            <p className="text-sm text-gray-500">Aucune autre facture ne correspond.</p>
          )}

          {!!cibles.length && (
            <div className="max-h-72 overflow-y-auto rounded border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left">
                  <tr>
                    <th className="w-8 p-2"></th>
                    <th className="p-2">Facture</th>
                    <th className="p-2">Client</th>
                    <th className="p-2 text-right">Restant dû</th>
                    <th className="p-2">Après le déplacement</th>
                  </tr>
                </thead>
                <tbody>
                  {cibles.map((f) => (
                    <tr key={f.id}
                      className={`cursor-pointer border-t ${choisie?.id === f.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
                      onClick={() => setChoisie(f)}>
                      <td className="p-2">
                        <input type="radio" name="cible" checked={choisie?.id === f.id}
                          onChange={() => setChoisie(f)}
                          aria-label={`Porter sur ${f.numero}`} />
                      </td>
                      <td className="p-2 font-mono">{f.numero}</td>
                      <td className="p-2">{f.client || "—"}</td>
                      <td className="p-2 text-right">{money(f.restant)}</td>
                      <td className="p-2 text-xs">
                        {f.depassement > 0 ? (
                          <span className="text-amber-800">
                            trop-perçu de {money(f.depassement)}
                          </span>
                        ) : (
                          <span className="text-gray-600">
                            resterait {money(Math.max(f.restant - montant, 0))}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {choisie && (
            <div className="mt-4 rounded border bg-gray-50 p-3 text-sm">
              <p className="mb-2 font-medium">Ce qui va changer</p>
              <ul className="space-y-1 text-gray-800">
                <li>
                  <span className="font-mono">{factureActuelle.numero}</span> redeviendra
                  due de {money(montant)}.
                </li>
                <li>
                  <span className="font-mono">{choisie.numero}</span> recevra {money(montant)}
                  {depassement > 0
                    ? ` et se trouvera en trop-perçu de ${money(depassement)}.`
                    : `, il lui restera ${money(Math.max(choisie.restant - montant, 0))}.`}
                </li>
              </ul>

              {depassement > 0 && (
                <label className="mt-3 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2">
                  <input type="checkbox" checked={accepteDepassement}
                    onChange={(e) => setAccepteDepassement(e.target.checked)}
                    className="mt-0.5" />
                  <span className="text-amber-900">
                    J&apos;accepte que la facture {choisie.numero} soit en trop-perçu
                    de {money(depassement)}. Cette décision restera dans l&apos;historique.
                  </span>
                </label>
              )}

              <label className="mt-3 block">
                <span className="mb-1 block text-gray-700">
                  Motif ({MOTIF_MINIMUM} caractères minimum) — il restera attaché aux deux factures
                </span>
                <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2}
                  className="w-full rounded border px-2 py-1.5" />
                <span className={`text-xs ${motif.trim().length >= MOTIF_MINIMUM ? "text-green-700" : "text-gray-500"}`}>
                  {motif.trim().length} / {MOTIF_MINIMUM}
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t p-4">
          <button onClick={onFerme} className="rounded border px-4 py-2 text-sm hover:bg-gray-50">
            Retour
          </button>
          <button onClick={deplacer} disabled={!pret || enCours}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
            {enCours ? "…" : "Porter sur cette facture"}
          </button>
        </div>
      </div>
    </div>
  );
}
