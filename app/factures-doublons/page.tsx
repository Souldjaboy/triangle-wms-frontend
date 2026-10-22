"use client";

/**
 * LES FACTURES QUI SE RESSEMBLENT.
 *
 * CE QUE CET ÉCRAN DOIT EMPÊCHER. Qu'on annule une série de factures
 * mensuelles parce qu'elles sont identiques. Un client qui loue au mois en
 * reçoit douze par an ; les « nettoyer » ferait disparaître onze créances.
 *
 * L'écran ne propose donc jamais de tout traiter d'un coup. Chaque paire se
 * regarde, avec les SIGNAUX qui ont conduit à la suggestion, et la suggestion
 * est présentée comme telle — un classement, pas une décision.
 *
 * TROIS GESTES, DE PLUS EN PLUS ENGAGEANTS.
 *
 *   Trancher       dire ce que sont ces deux factures. Rien n'est modifié ;
 *                  la paire cesse simplement de revenir dans la liste.
 *   Neutraliser    annuler le doublon et porter ses encaissements sur la
 *                  facture qui fait foi. Réservé à qui en a le droit.
 *   Rien           la paire reste à examiner. C'est une réponse valable.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";
import { usePermissions } from "../lib/permissions";

type Cote = {
  id: number; numero: string; date: string | null; montant: number;
  paye: number; restant: number; statut: string; vente_id: number | null;
  reference_operation: string; nb_paiements: number; encaisse: number;
};
type VerdictRendu = {
  verdict: string; verdict_reason: string; decided_by_name: string; decided_at: string;
  neutralized_at: string | null;
};
type Paire = {
  cle: string; a: Cote; b: Cote; client: string; montant: number;
  ecart_jours: number | null; signaux: string[]; suggestion: string;
  verdict_rendu: VerdictRendu | null;
};
type Examen = {
  id: number; product: string;
  invoice_a_id: number; invoice_b_id: number;
  invoice_a_number: string; invoice_b_number: string;
  client_name: string; amount: string; verdict: string; verdict_reason: string;
  decided_by_name: string; decided_at: string;
  kept_invoice_id: number | null; neutralized_invoice_id: number | null;
  neutralized_at: string | null; neutralized_by_name: string;
  payments_moved: number; amount_moved: string;
};

const PRODUITS = [
  { cle: "sable", libelle: "Sable", module: "sand" },
  { cle: "ciment", libelle: "Ciment", module: "cement" },
] as const;

const VERDICT_LIBELLE: Record<string, string> = {
  A_EXAMINER: "À examiner",
  DOUBLON_CONFIRME: "Doublon",
  RENOUVELLEMENT: "Renouvellement",
  FACTURES_DISTINCTES: "Factures distinctes",
};
const VERDICT_CLASSE: Record<string, string> = {
  A_EXAMINER: "bg-gray-200 text-gray-800",
  DOUBLON_CONFIRME: "bg-red-100 text-red-800",
  RENOUVELLEMENT: "bg-blue-100 text-blue-800",
  FACTURES_DISTINCTES: "bg-green-100 text-green-800",
};
const VERDICT_EXPLICATION: Record<string, string> = {
  DOUBLON_CONFIRME: "La même facture a été établie deux fois. L'une des deux devra être neutralisée.",
  RENOUVELLEMENT: "Deux échéances d'une prestation répétée. Les deux sont dues.",
  FACTURES_DISTINCTES: "Deux prestations différentes qui se ressemblent. Les deux sont dues.",
};

const money = (v: unknown) =>
  `${new Intl.NumberFormat("fr-FR").format(Number(v || 0))} FCFA`;
const fdate = (d: string | null) => {
  if (!d) return "—";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d).slice(0, 10);
};

export default function FacturesDoublonsPage() {
  const { can } = usePermissions();
  const [monte, setMonte] = useState(false);
  useEffect(() => { setMonte(true); }, []);

  const [produit, setProduit] = useState<"sable" | "ciment">("sable");
  const [paires, setPaires] = useState<Paire[]>([]);
  const [signaux, setSignaux] = useState<Record<string, string>>({});
  const [avertissement, setAvertissement] = useState("");
  const [examens, setExamens] = useState<Examen[]>([]);
  const [onglet, setOnglet] = useState<"suspects" | "decisions">("suspects");
  const [inclureTranchees, setInclureTranchees] = useState(false);

  const [aTrancher, setATrancher] = useState<Paire | null>(null);
  const [verdict, setVerdict] = useState("");
  const [motif, setMotif] = useState("");
  const [aNeutraliser, setANeutraliser] = useState<Examen | null>(null);
  const [conserver, setConserver] = useState<number | null>(null);
  const [motifN, setMotifN] = useState("");
  const [accepteDoublePaiement, setAccepteDoublePaiement] = useState(false);
  const [detailRefus, setDetailRefus] = useState<{ a: number; b: number } | null>(null);

  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [occupe, setOccupe] = useState(false);

  const moduleProduit = useMemo(
    () => PRODUITS.find((p) => p.cle === produit)?.module || "sand", [produit]);

  const charger = useCallback(async () => {
    setChargement(true);
    const [rp, re] = await Promise.all([
      authFetch(`/invoice-duplicates/${produit}?inclure_tranchees=${inclureTranchees ? 1 : 0}`),
      authFetch(`/invoice-duplicates/${produit}/examens`),
    ]);
    const dp = await rp.json().catch(() => null);
    if (rp.ok && dp) {
      setPaires(dp.paires || []); setSignaux(dp.signaux || {});
      setAvertissement(dp.avertissement || ""); setErreur("");
    } else {
      setPaires([]); setErreur(dp?.error || "Lecture impossible.");
    }
    const de = await re.json().catch(() => null);
    setExamens(re.ok && de ? de.examens || [] : []);
    setChargement(false);
  }, [produit, inclureTranchees]);

  useEffect(() => { if (monte) charger(); }, [monte, charger]);

  const trancher = async () => {
    if (!aTrancher || !verdict || motif.trim().length < 10) return;
    setOccupe(true); setErreur("");
    const r = await authFetch(`/invoice-duplicates/${produit}/trancher`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facture_a: aTrancher.a.id, facture_b: aTrancher.b.id,
        verdict, motif: motif.trim(),
      }),
    });
    const d = await r.json().catch(() => ({}));
    setOccupe(false);
    if (r.ok) {
      setMessage(d.message || "Verdict enregistré.");
      setATrancher(null); setVerdict(""); setMotif("");
      await charger();
    } else setErreur(d.error || "Enregistrement impossible.");
  };

  const neutraliser = async () => {
    if (!aNeutraliser || !conserver || motifN.trim().length < 10) return;
    setOccupe(true); setErreur(""); setDetailRefus(null);
    const r = await authFetch(`/invoice-duplicates/${aNeutraliser.id}/neutraliser`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conserver, motif: motifN.trim(),
        accepter_paiements_des_deux_cotes: accepteDoublePaiement,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setOccupe(false);
    if (r.ok) {
      setMessage(`${d.neutralisee?.numero} neutralisée au profit de ${d.conservee?.numero}. ${d.avertissement || ""}`);
      setANeutraliser(null); setConserver(null); setMotifN(""); setAccepteDoublePaiement(false);
      await charger();
    } else {
      setErreur(d.error || "Neutralisation impossible.");
      if (d.code === "PAIEMENTS_DES_DEUX_COTES") {
        setDetailRefus({ a: Number(d.paye_conservee || 0), b: Number(d.paye_doublon || 0) });
      }
    }
  };

  if (!monte) return null;

  if (!can(moduleProduit, "view")) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold mb-2">Factures en double</h1>
        <p className="text-gray-600">Vous n&apos;avez pas accès à ce registre.</p>
      </div>
    );
  }

  const aNeutraliserPossible = examens.filter(
    (e) => e.verdict === "DOUBLON_CONFIRME" && !e.neutralized_at);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full min-w-0 relative z-0">
      <header className="mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Factures qui se ressemblent</h1>
        <p className="mt-1 text-sm text-gray-600">
          Deux factures identiques ne sont pas forcément un doublon. Chaque paire
          se regarde une par une.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {PRODUITS.map((p) => (
          <button key={p.cle} onClick={() => setProduit(p.cle as "sable" | "ciment")}
            className={`rounded border px-4 py-2 text-sm ${
              produit === p.cle ? "border-gray-900 bg-gray-900 text-white" : "bg-white hover:bg-gray-50"
            }`}>
            {p.libelle}
          </button>
        ))}
      </div>

      {avertissement && (
        <div className="mb-4 rounded border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
          {avertissement}
        </div>
      )}
      {message && (
        <div className="mb-3 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-900">{message}</div>
      )}
      {erreur && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {erreur}
          {detailRefus && (
            <p className="mt-1">
              Encaissé sur la facture conservée : <strong>{money(detailRefus.a)}</strong> ·
              sur le doublon : <strong>{money(detailRefus.b)}</strong>.
            </p>
          )}
        </div>
      )}

      <div className="mb-4 flex gap-2 border-b">
        {([["suspects", `À examiner (${paires.filter((p) => !p.verdict_rendu).length})`],
           ["decisions", `Décisions (${examens.length})`]] as const).map(([cle, lib]) => (
          <button key={cle} onClick={() => setOnglet(cle as "suspects" | "decisions")}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              onglet === cle ? "border-gray-900 font-medium" : "border-transparent text-gray-600 hover:text-gray-900"
            }`}>{lib}</button>
        ))}
      </div>

      {chargement && <p className="text-sm text-gray-500">Chargement…</p>}

      {/* ══════════════════════════════════════════ LES SUSPECTS ══ */}
      {!chargement && onglet === "suspects" && (
        <div>
          <label className="mb-3 flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={inclureTranchees}
              onChange={(e) => setInclureTranchees(e.target.checked)} />
            Afficher aussi les paires déjà tranchées
          </label>

          {!paires.length && (
            <p className="text-sm text-gray-500">
              Aucune paire à examiner pour ce produit.
            </p>
          )}

          <div className="space-y-3">
            {paires.map((p) => (
              <div key={p.cle} className="rounded border bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                    VERDICT_CLASSE[p.suggestion] || VERDICT_CLASSE.A_EXAMINER}`}>
                    {VERDICT_LIBELLE[p.suggestion] || p.suggestion}
                  </span>
                  <span className="text-xs text-gray-500">suggestion — la décision vous revient</span>
                  <span className="text-sm text-gray-700">
                    {p.client || "client inconnu"} · {money(p.montant)}
                    {p.ecart_jours !== null && ` · ${p.ecart_jours} jour(s) d'écart`}
                  </span>
                  {p.verdict_rendu && (
                    <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                      VERDICT_CLASSE[p.verdict_rendu.verdict]}`}>
                      tranché : {VERDICT_LIBELLE[p.verdict_rendu.verdict]}
                    </span>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[p.a, p.b].map((c) => (
                    <div key={c.id} className="rounded border bg-gray-50 p-3 text-sm">
                      <p className="font-mono font-medium">{c.numero}</p>
                      <p className="text-gray-600">{fdate(c.date)} · {c.statut}</p>
                      <p className="text-gray-700">
                        {money(c.montant)} · encaissé {money(c.encaisse)}
                        {c.nb_paiements > 0 && ` (${c.nb_paiements} paiement(s))`}
                      </p>
                      {c.vente_id && <p className="text-xs text-gray-500">vente n° {c.vente_id}</p>}
                      {c.reference_operation && (
                        <p className="text-xs text-gray-500">réf. {c.reference_operation}</p>
                      )}
                    </div>
                  ))}
                </div>

                <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
                  {p.signaux.map((s) => (
                    <li key={s}>• {signaux[s] || s}</li>
                  ))}
                </ul>

                {!p.verdict_rendu && can(moduleProduit, "validate") && (
                  <button onClick={() => {
                    setATrancher(p); setVerdict(p.suggestion === "A_EXAMINER" ? "" : p.suggestion);
                    setMotif(""); setErreur("");
                  }}
                    className="mt-3 rounded bg-gray-900 px-3 py-1.5 text-sm text-white">
                    Trancher
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ LES DÉCISIONS ══ */}
      {!chargement && onglet === "decisions" && (
        <div className="space-y-2">
          {!examens.length && <p className="text-sm text-gray-500">Aucune décision enregistrée.</p>}
          {!!aNeutraliserPossible.length && (
            <p className="mb-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {aNeutraliserPossible.length} doublon(s) confirmé(s) attendent d&apos;être
              neutralisés. Tant qu&apos;ils ne le sont pas, les deux factures restent dues.
            </p>
          )}
          {examens.map((e) => (
            <div key={e.id} className="rounded border bg-white p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono">{e.invoice_a_number}</span>
                <span className="text-gray-400">et</span>
                <span className="font-mono">{e.invoice_b_number}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-bold ${VERDICT_CLASSE[e.verdict]}`}>
                  {VERDICT_LIBELLE[e.verdict] || e.verdict}
                </span>
                <span className="text-gray-600">{e.client_name} · {money(e.amount)}</span>
              </div>
              {VERDICT_EXPLICATION[e.verdict] && (
                <p className="mt-1 text-xs text-gray-600">{VERDICT_EXPLICATION[e.verdict]}</p>
              )}
              <p className="mt-1 text-sm text-gray-700">
                « {e.verdict_reason} » — {e.decided_by_name}, le {fdate(e.decided_at)}
              </p>
              {e.neutralized_at ? (
                <p className="mt-1 text-sm text-gray-700">
                  Neutralisée le {fdate(e.neutralized_at)} par {e.neutralized_by_name}.
                  {Number(e.payments_moved) > 0
                    ? ` ${e.payments_moved} encaissement(s) déplacé(s), ${money(e.amount_moved)}.`
                    : " Aucun encaissement à déplacer."}
                </p>
              ) : e.verdict === "DOUBLON_CONFIRME" && can(moduleProduit, "delete") ? (
                <button onClick={() => {
                  setANeutraliser(e); setConserver(null); setMotifN("");
                  setAccepteDoublePaiement(false); setErreur(""); setDetailRefus(null);
                }}
                  className="mt-2 rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
                  Neutraliser le doublon
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════ TRANCHER ══ */}
      {aTrancher && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          role="dialog" aria-modal="true" aria-label="Trancher sur la paire">
          <div className="my-8 w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="border-b p-4">
              <h2 className="font-semibold">
                {aTrancher.a.numero} et {aTrancher.b.numero} : que sont ces deux factures ?
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Rien ne sera modifié. Votre réponse évitera que cette paire revienne
                dans la liste.
              </p>
            </div>
            <div className="space-y-2 p-4 text-sm">
              {["DOUBLON_CONFIRME", "RENOUVELLEMENT", "FACTURES_DISTINCTES"].map((x) => (
                <label key={x} className={`flex cursor-pointer items-start gap-2 rounded border p-3 ${
                  verdict === x ? "border-gray-900 bg-gray-50" : "hover:bg-gray-50"}`}>
                  <input type="radio" name="verdict" checked={verdict === x}
                    onChange={() => setVerdict(x)} className="mt-1" />
                  <span>
                    <span className="font-medium">{VERDICT_LIBELLE[x]}</span>
                    <span className="block text-gray-600">{VERDICT_EXPLICATION[x]}</span>
                  </span>
                </label>
              ))}
              <label className="block pt-2">
                <span className="mb-1 block text-gray-700">
                  Motif (10 caractères minimum) — il évitera de rouvrir ce dossier
                </span>
                <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2}
                  className="w-full rounded border px-2 py-1.5" />
                <span className={`text-xs ${motif.trim().length >= 10 ? "text-green-700" : "text-gray-500"}`}>
                  {motif.trim().length} / 10
                </span>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <button onClick={() => { setATrancher(null); setVerdict(""); setMotif(""); }}
                className="rounded border px-4 py-2 text-sm hover:bg-gray-50">Retour</button>
              <button onClick={trancher} disabled={occupe || !verdict || motif.trim().length < 10}
                className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
                {occupe ? "…" : "Enregistrer le verdict"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ NEUTRALISER ══ */}
      {aNeutraliser && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          role="dialog" aria-modal="true" aria-label="Neutraliser le doublon">
          <div className="my-8 w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="border-b p-4">
              <h2 className="font-semibold">Laquelle fait foi ?</h2>
              <p className="mt-1 text-sm text-gray-600">
                L&apos;autre sera annulée, désignera celle-ci, et ses encaissements
                seront portés sur elle. Aucune écriture de trésorerie ne sera créée.
              </p>
            </div>
            <div className="space-y-2 p-4 text-sm">
              {[{ id: Number(aNeutraliser.invoice_a_id), numero: aNeutraliser.invoice_a_number },
                { id: Number(aNeutraliser.invoice_b_id), numero: aNeutraliser.invoice_b_number }].map((c) => (
                <label key={c.id} className={`flex cursor-pointer items-center gap-2 rounded border p-3 ${
                  conserver === c.id ? "border-gray-900 bg-gray-50" : "hover:bg-gray-50"}`}>
                  <input type="radio" name="conserver" checked={conserver === c.id}
                    onChange={() => setConserver(c.id)} />
                  <span className="font-mono">{c.numero}</span>
                  <span className="text-gray-600">est la facture qui fait foi</span>
                </label>
              ))}

              <label className="mt-3 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3">
                <input type="checkbox" checked={accepteDoublePaiement}
                  onChange={(e) => setAccepteDoublePaiement(e.target.checked)} className="mt-0.5" />
                <span className="text-amber-900">
                  Si les deux factures ont été réglées, le client a payé deux fois.
                  Je le confirme et j&apos;engage le remboursement. Le trop-perçu
                  restera visible sur la facture conservée.
                </span>
              </label>

              <label className="block pt-2">
                <span className="mb-1 block text-gray-700">Motif (10 caractères minimum)</span>
                <textarea value={motifN} onChange={(e) => setMotifN(e.target.value)} rows={2}
                  className="w-full rounded border px-2 py-1.5" />
                <span className={`text-xs ${motifN.trim().length >= 10 ? "text-green-700" : "text-gray-500"}`}>
                  {motifN.trim().length} / 10
                </span>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <button onClick={() => { setANeutraliser(null); setConserver(null); setMotifN(""); }}
                className="rounded border px-4 py-2 text-sm hover:bg-gray-50">Retour</button>
              <button onClick={neutraliser}
                disabled={occupe || !conserver || motifN.trim().length < 10}
                className="rounded bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50">
                {occupe ? "…" : "Neutraliser le doublon"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
