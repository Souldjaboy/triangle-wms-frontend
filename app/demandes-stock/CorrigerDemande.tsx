"use client";

/**
 * CORRIGER UNE DEMANDE, SANS RIEN EFFACER.
 *
 * Trois gestes, et l'écran ne propose que celui qui a un sens pour l'état de
 * la demande. Proposer les trois et refuser deux d'entre eux au clic serait
 * une façon détournée de faire deviner la règle.
 *
 *   DÉVALIDER        une demande validée dont aucun stock n'a bougé
 *   CONTRE-PASSER    une réception : chaque mouvement reçoit son inverse
 *   ANNULER          contre-passer, puis clore la demande
 *
 * Le motif est obligatoire et il reste attaché à la demande. Dix caractères :
 * « erreur » n'explique rien six mois plus tard.
 *
 * Ce que l'écran dit AVANT de valider : ce qui va bouger, et ce qui ne sera
 * pas effacé. On ne demande pas de confirmer quelque chose qu'on n'a pas
 * décrit.
 */

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../lib/api";

type Demande = {
  id: number; reference: string; status: string; request_type: string;
  lines_count?: number; corrections_count?: number;
};

type Correction = {
  id: number; action: string; reason: string;
  status_before: string | null; status_after: string | null;
  lines_affected: number; quantity_reversed: string | number;
  acted_by_name: string; acted_at: string; auteur: string | null;
  details: any;
};

const SANS_EFFET = ["BROUILLON", "EN_ATTENTE", "VALIDEE", "REFUSEE"];
const AVEC_STOCK = ["PARTIELLEMENT_RECUE", "RECUE"];

const fdate = (d: string | null) => {
  if (!d) return "—";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? String(d).slice(0, 10)
    : x.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
};

const LIBELLE_ACTION: Record<string, string> = {
  MODIFICATION: "Modification",
  DEVALIDATION: "Validation reprise",
  CONTREPASSATION: "Réception contre-passée",
  ANNULATION: "Demande annulée",
};

export default function CorrigerDemande({
  demande, onClose, onChanged, peutDevalider, peutContrepasser,
}: {
  demande: Demande;
  onClose: () => void;
  onChanged: (message: string) => void;
  peutDevalider: boolean;
  peutContrepasser: boolean;
}) {
  const [historique, setHistorique] = useState<Correction[]>([]);
  const [geste, setGeste] = useState<"devalider" | "contrepasser" | "annuler" | null>(null);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    const r = await authFetch(`/stock-requests/${demande.id}/corrections`);
    const d = await r.json().catch(() => null);
    if (r.ok) setHistorique(d?.corrections || []);
    else setErreur(d?.error || "Historique illisible.");
  }, [demande.id]);
  useEffect(() => { charger(); }, [charger]);

  const aDeplaceDuStock = AVEC_STOCK.includes(demande.status);
  const estValidee = demande.status === "VALIDEE";

  /* On ne propose que ce qui a un sens ici et maintenant. */
  const gestes = [
    estValidee && peutDevalider && {
      cle: "devalider" as const,
      titre: "Reprendre la validation",
      sous: "La demande repasse EN ATTENTE. Aucun stock n'a bougé, il n'y a rien à défaire.",
      bouton: "Reprendre la validation",
      couleur: "bg-amber-600",
    },
    aDeplaceDuStock && peutContrepasser && {
      cle: "contrepasser" as const,
      titre: "Contre-passer la réception",
      sous: "Chaque mouvement reçoit son inverse et la demande redevient VALIDÉE. "
          + "Les mouvements d'origine sont conservés, marqués annulés.",
      bouton: "Contre-passer",
      couleur: "bg-red-600",
    },
    aDeplaceDuStock && peutContrepasser && {
      cle: "annuler" as const,
      titre: "Contre-passer et annuler",
      sous: "Même chose, puis la demande est close. Pour une demande qui n'aurait "
          + "jamais dû exister.",
      bouton: "Contre-passer et annuler",
      couleur: "bg-red-700",
    },
  ].filter(Boolean) as Array<{ cle: "devalider" | "contrepasser" | "annuler"; titre: string; sous: string; bouton: string; couleur: string }>;

  const envoyer = async () => {
    if (!geste) return;
    setErreur("");
    if (motif.trim().length < 10) {
      return setErreur("Le motif doit faire au moins 10 caractères : il restera attaché à la demande.");
    }
    setEnCours(true);
    const chemin = geste === "devalider" ? "devalider" : "contrepasser";
    const r = await authFetch(`/stock-requests/${demande.id}/${chemin}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motif: motif.trim(), ...(geste === "annuler" ? { annuler: true } : {}) }),
    });
    const d = await r.json().catch(() => ({}));
    setEnCours(false);
    if (r.ok) {
      setGeste(null); setMotif("");
      await charger();
      onChanged(d.message || "Correction enregistrée.");
    } else { setErreur(d.error || "Correction impossible."); }
  };

  const choisi = gestes.find((g) => g.cle === geste);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-gray-900">Corriger {demande.reference}</h2>
            <p className="text-sm text-gray-600">
              {demande.request_type} · état actuel : <b>{demande.status.replace(/_/g, " ")}</b>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg bg-gray-100 px-4 py-2 font-bold text-gray-700">
            Fermer
          </button>
        </div>

        {erreur && <p className="mt-4 rounded-lg bg-red-50 p-3 font-bold text-red-800">{erreur}</p>}

        {/* ── Ce qu'on peut faire, et seulement cela ───────────────────── */}
        {!geste && (
          <div className="mt-5 space-y-3">
            {gestes.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                <p className="font-bold">Aucune correction possible sur cette demande.</p>
                <p className="mt-1">
                  {SANS_EFFET.includes(demande.status) && !estValidee
                    ? "Elle n'a encore rien produit : modifiez-la directement."
                    : demande.status === "ANNULEE"
                      ? "Elle est déjà annulée."
                      : "Votre rôle ne permet pas de défaire cette opération. Le droit de "
                        + "contre-passer est distinct de celui de réceptionner."}
                </p>
              </div>
            ) : gestes.map((g) => (
              <button key={g.cle} onClick={() => { setGeste(g.cle); setMotif(""); setErreur(""); }}
                      className="block w-full rounded-xl border-2 border-gray-200 p-4 text-left hover:border-gray-400">
                <p className="font-black text-gray-900">{g.titre}</p>
                <p className="mt-1 text-sm text-gray-600">{g.sous}</p>
              </button>
            ))}

            {demande.request_type === "inventaire" && aDeplaceDuStock && (
              <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-bold">Un inventaire ne se contre-passe pas.</p>
                <p className="mt-1">
                  Il a fixé le stock à une valeur comptée, il ne l'a ni augmenté ni
                  diminué d'une quantité connue. L'inverser supposerait de connaître
                  le stock d'avant, que rien ne garantit encore exact aujourd'hui.
                  Faites un nouvel inventaire.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── La confirmation, avec son motif ──────────────────────────── */}
        {choisi && (
          <div className="mt-5 rounded-xl border-2 border-red-200 p-5">
            <h3 className="text-lg font-black text-gray-900">{choisi.titre}</h3>
            <p className="mt-2 text-sm text-gray-700">{choisi.sous}</p>

            <div className="mt-3 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
              <p className="font-bold">Rien ne sera effacé.</p>
              <p className="mt-1">
                Les mouvements de stock d'origine restent en base, marqués annulés
                avec votre motif. Le stock n'est jamais réécrit directement : il
                bouge par des mouvements inverses, comme il avait bougé à la
                réception.
              </p>
            </div>

            <label className="mt-4 flex flex-col gap-1">
              <span className="text-sm font-bold text-gray-700">
                Motif (10 caractères minimum) — il restera attaché à la demande
              </span>
              <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3}
                        className="w-full rounded-lg border border-gray-300 p-3 text-gray-900"
                        placeholder="Conteneur livré au mauvais entrepôt, réception saisie à tort" />
              <span className="text-xs text-gray-500">{motif.trim().length} / 10</span>
            </label>

            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => { setGeste(null); setErreur(""); }}
                      className="rounded-lg bg-gray-100 px-4 py-3 font-bold text-gray-700">
                Revenir
              </button>
              <button onClick={envoyer} disabled={enCours || motif.trim().length < 10}
                      className={`rounded-lg px-4 py-3 font-black text-white disabled:opacity-50 ${choisi.couleur}`}>
                {enCours ? "En cours…" : choisi.bouton}
              </button>
            </div>
          </div>
        )}

        {/* ── L'historique : qui a défait quoi, quand, pourquoi ────────── */}
        <div className="mt-6">
          <h3 className="text-lg font-black text-gray-900">
            Historique des corrections {historique.length > 0 && `(${historique.length})`}
          </h3>
          {historique.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Aucune correction sur cette demande.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {historique.map((c) => (
                <li key={c.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold text-gray-900">
                      {LIBELLE_ACTION[c.action] || c.action}
                    </span>
                    <span className="text-xs text-gray-500">
                      {c.auteur || c.acted_by_name} · {fdate(c.acted_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{c.reason}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {c.status_before} → {c.status_after}
                    {Number(c.lines_affected) > 0 && ` · ${c.lines_affected} ligne(s)`}
                    {Number(c.quantity_reversed) > 0 && ` · ${Number(c.quantity_reversed)} unité(s)`}
                  </p>
                  {/* Le détail mouvement par mouvement : c'est lui qui permet de
                      relier une ligne de stock à la décision qui l'a produite. */}
                  {Array.isArray(c.details?.mouvements) && c.details.mouvements.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-bold text-gray-600">
                        Voir les {c.details.mouvements.length} mouvement(s)
                      </summary>
                      <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                        {c.details.mouvements.map((m: any, i: number) => (
                          <li key={i}>
                            {m.produit} · {m.quantite} · mouvement {m.mouvement_origine ?? "?"} →
                            inverse {m.mouvement_inverse}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {c.details?.champs && Object.keys(c.details.champs).length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
                      {Object.entries(c.details.champs).map(([cle, v]: [string, any]) => (
                        <li key={cle}>{v.libelle} : « {String(v.avant)} » → « {String(v.apres)} »</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
