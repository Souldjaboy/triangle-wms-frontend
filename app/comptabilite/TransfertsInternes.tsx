"use client";

/**
 * TRANSFERTS INTERNES DE FONDS.
 *
 * L'écran existe surtout pour rendre visible ce qui était faux : déplacer de
 * l'argent entre deux comptes de la société ne change pas le total de ses
 * fonds. Le bandeau l'affiche avant et après, et le formulaire annonce les
 * deux soldes futurs avant d'envoyer quoi que ce soit.
 *
 * L'annulation est une CONTRE-PASSATION comptable : elle remet les soldes
 * comme avant dans l'application. Elle ne demande rien à la banque. L'écran
 * le dit en clair, parce que confondre les deux conduit à attendre un virement
 * qui n'arrivera jamais.
 */

import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";
import { formatFCFA } from "../lib/format";

type Compte = {
  kind: "BANQUE" | "CAISSE" | "TRESORERIE";
  id: number | null;
  libelle: string;
  solde: number;
  actif: boolean;
};

type Transfert = {
  id: number;
  reference: string;
  transfer_date: string;
  amount: string | number;
  source_kind: string; source_label: string;
  destination_kind: string; destination_label: string;
  status: "ACTIF" | "ANNULE";
  reason: string | null;
  auteur: string | null;
  annulateur: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
};

const cle = (c: { kind: string; id: number | null }) => `${c.kind}:${c.id ?? ""}`;
const depuisCle = (k: string) => {
  const [kind, id] = k.split(":");
  return { kind, id: id ? Number(id) : null };
};
const nature = (k: string) =>
  ({ BANQUE: "Banque", CAISSE: "Caisse", TRESORERIE: "Trésorerie" } as Record<string, string>)[k] || k;

export default function TransfertsInternes({
  peutDeplacer,
  peutAnnuler,
}: {
  peutDeplacer: boolean;
  peutAnnuler: boolean;
}) {
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [fondsTotaux, setFondsTotaux] = useState<number | null>(null);
  const [transferts, setTransferts] = useState<Transfert[]>([]);
  const [candidats, setCandidats] = useState<any[]>([]);
  const [avertissement, setAvertissement] = useState("");
  const [filtre, setFiltre] = useState<"" | "ACTIF" | "ANNULE">("");
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [voirCandidats, setVoirCandidats] = useState(false);

  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [motif, setMotif] = useState("");

  const [aAnnuler, setAAnnuler] = useState<Transfert | null>(null);
  const [motifAnnulation, setMotifAnnulation] = useState("");

  const charger = async () => {
    setChargement(true);
    const [rC, rT, rCand] = await Promise.all([
      authFetch("/comptabilite/transferts-internes/comptes"),
      authFetch(`/comptabilite/transferts-internes${filtre ? `?statut=${filtre}` : ""}`),
      authFetch("/comptabilite/transferts-internes/candidats"),
    ]);
    const dC = await rC.json().catch(() => null);
    if (rC.ok && dC) {
      setComptes(dC.comptes || []);
      setFondsTotaux(Number(dC.fonds_totaux || 0));
    } else {
      setErreur(dC?.error || "Impossible de lire les comptes.");
    }
    const dT = await rT.json().catch(() => null);
    if (rT.ok && dT) setTransferts(dT.transferts || []);
    const dCand = await rCand.json().catch(() => null);
    if (rCand.ok && dCand) {
      setCandidats(dCand.candidats || []);
      setAvertissement(dCand.candidats?.length ? dCand.avertissement || "" : "");
    }
    setChargement(false);
  };

  useEffect(() => { charger(); }, [filtre]);

  const utilisables = useMemo(() => comptes.filter((c) => c.actif), [comptes]);
  const compteDe = (k: string) => comptes.find((c) => cle(c) === k) || null;
  const cSource = compteDe(source);
  const cDest = compteDe(destination);
  const somme = Math.round(Number(montant) || 0);

  /* Les deux soldes futurs, annoncés avant l'envoi. C'est ce qui permet de
     voir une erreur de saisie avant qu'elle ne touche un compte. */
  const apercu = cSource && cDest && somme > 0
    ? {
        source: cSource.solde - somme,
        destination: cDest.solde + somme,
        suffisant: cSource.solde >= somme,
      }
    : null;

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(""); setErreur("");
    if (!cSource || !cDest) return setErreur("Choisissez un compte de départ et un compte d'arrivée.");
    if (cle(cSource) === cle(cDest)) return setErreur("Le compte de départ et celui d'arrivée sont les mêmes.");
    if (!(somme > 0)) return setErreur("Le montant doit être supérieur à zéro.");
    if (motif.trim().length < 5) return setErreur("Indiquez un motif (5 caractères minimum).");

    setEnCours(true);
    const r = await authFetch("/comptabilite/transferts-internes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: depuisCle(source), destination: depuisCle(destination),
        montant: somme, date_operation: date, motif: motif.trim(),
      }),
    });
    const d = await r.json().catch(() => ({}));
    setEnCours(false);
    if (r.ok) {
      setMessage(d.message || "Transfert enregistré.");
      setMontant(""); setMotif("");
      await charger();
    } else {
      setErreur(d.error || "Transfert impossible.");
    }
  };

  const annuler = async () => {
    if (!aAnnuler) return;
    setMessage(""); setErreur("");
    if (motifAnnulation.trim().length < 10) {
      return setErreur("Le motif d'annulation doit faire au moins 10 caractères : il restera attaché au transfert.");
    }
    setEnCours(true);
    const r = await authFetch(`/comptabilite/transferts-internes/${aAnnuler.id}/annuler`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motif: motifAnnulation.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    setEnCours(false);
    if (r.ok) {
      setMessage(d.message || "Transfert annulé.");
      setAAnnuler(null); setMotifAnnulation("");
      await charger();
    } else {
      setErreur(d.error || "Annulation impossible.");
    }
  };

  if (chargement) {
    return <div className="rounded-lg bg-white p-8 font-bold shadow">Chargement des transferts…</div>;
  }

  return (
    <section className="space-y-6">
      {/* ── Ce que le transfert ne change pas ─────────────────────────────── */}
      <div className="rounded-lg bg-white p-5 shadow">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-gray-500">Total des fonds de l'entreprise</p>
            <p className="mt-1 text-3xl font-black">{formatFCFA(fondsTotaux || 0)}</p>
          </div>
          <p className="max-w-md text-sm text-gray-600">
            Un transfert interne déplace de l'argent d'un compte à un autre. Ce total ne
            change pas, et le transfert n'apparaît ni dans les recettes ni dans les
            dépenses.
          </p>
        </div>
      </div>

      {message && <div className="rounded-lg bg-green-50 p-4 font-bold text-green-800 shadow">{message}</div>}
      {erreur && <div className="rounded-lg bg-red-50 p-4 font-bold text-red-800 shadow">{erreur}</div>}

      {/* ── Déplacer ─────────────────────────────────────────────────────── */}
      {peutDeplacer && (
        <section className="rounded-lg bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-black">Déplacer des fonds</h2>
          <form onSubmit={envoyer} className="grid gap-4 md:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-bold text-gray-600">Compte de départ</span>
              <select value={source} onChange={(e) => setSource(e.target.value)}
                      className="w-full rounded-lg border p-3">
                <option value="">— choisir —</option>
                {utilisables.map((c) => (
                  <option key={cle(c)} value={cle(c)}>
                    {nature(c.kind)} · {c.libelle} — {formatFCFA(c.solde)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-bold text-gray-600">Compte d'arrivée</span>
              <select value={destination} onChange={(e) => setDestination(e.target.value)}
                      className="w-full rounded-lg border p-3">
                <option value="">— choisir —</option>
                {utilisables.filter((c) => cle(c) !== source).map((c) => (
                  <option key={cle(c)} value={cle(c)}>
                    {nature(c.kind)} · {c.libelle} — {formatFCFA(c.solde)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-bold text-gray-600">Montant (FCFA)</span>
              <input type="number" min={1} step={1} value={montant}
                     onChange={(e) => setMontant(e.target.value)}
                     placeholder="5000000" className="w-full rounded-lg border p-3" />
            </label>

            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-bold text-gray-600">Date de l'opération</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                     className="w-full rounded-lg border p-3" />
            </label>

            <label className="flex min-w-0 flex-col gap-1 md:col-span-2">
              <span className="text-sm font-bold text-gray-600">
                Motif — il restera attaché au transfert
              </span>
              <input value={motif} onChange={(e) => setMotif(e.target.value)}
                     placeholder="Approvisionnement de la caisse pour les décaissements du mois"
                     className="w-full rounded-lg border p-3" />
            </label>

            {/* Les deux soldes futurs, avant l'envoi. */}
            {apercu && (
              <div className={`md:col-span-2 rounded-lg p-4 ${apercu.suffisant ? "bg-gray-50" : "bg-red-50"}`}>
                {apercu.suffisant ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <p className="text-sm">
                      <span className="font-bold">{cSource!.libelle}</span><br />
                      {formatFCFA(cSource!.solde)} → <b>{formatFCFA(apercu.source)}</b>
                    </p>
                    <p className="text-sm">
                      <span className="font-bold">{cDest!.libelle}</span><br />
                      {formatFCFA(cDest!.solde)} → <b>{formatFCFA(apercu.destination)}</b>
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-bold">Total des fonds</span><br />
                      <b>{formatFCFA(fondsTotaux || 0)}</b> — inchangé
                    </p>
                  </div>
                ) : (
                  <p className="font-bold text-red-800">
                    {cSource!.libelle} ne porte que {formatFCFA(cSource!.solde)} :
                    il manque {formatFCFA(somme - cSource!.solde)}.
                  </p>
                )}
              </div>
            )}

            <div className="md:col-span-2">
              <button disabled={enCours || (apercu ? !apercu.suffisant : false)}
                      className="rounded-lg bg-yellow-500 px-5 py-3 font-black text-black disabled:opacity-50">
                {enCours ? "Enregistrement…" : "Déplacer les fonds"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── L'historique ─────────────────────────────────────────────────── */}
      <section className="rounded-lg bg-white p-5 shadow">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black">Transferts enregistrés</h2>
          <div className="flex gap-2">
            {([["", "Tous"], ["ACTIF", "Actifs"], ["ANNULE", "Annulés"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFiltre(v as any)}
                      className={`rounded-lg px-3 py-2 text-sm font-bold ${
                        filtre === v ? "bg-yellow-500 text-black" : "bg-gray-100 text-gray-700"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                {["Référence", "Date", "De", "Vers", "Montant", "Motif", "État", ""].map((h) => (
                  <th key={h} className="p-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transferts.length === 0 ? (
                <tr><td colSpan={8} className="p-4 text-gray-500">Aucun transfert.</td></tr>
              ) : transferts.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-3 font-mono text-sm">{t.reference}</td>
                  <td className="p-3">{new Date(t.transfer_date).toLocaleDateString("fr-FR")}</td>
                  <td className="p-3">{t.source_label}<br /><span className="text-xs text-gray-500">{nature(t.source_kind)}</span></td>
                  <td className="p-3">{t.destination_label}<br /><span className="text-xs text-gray-500">{nature(t.destination_kind)}</span></td>
                  <td className="p-3 font-bold">{formatFCFA(Number(t.amount))}</td>
                  <td className="p-3 text-sm text-gray-700">
                    {t.reason}
                    {t.status === "ANNULE" && t.cancel_reason && (
                      <><br /><span className="text-xs text-red-700">Annulé : {t.cancel_reason}</span></>
                    )}
                    {t.auteur && <><br /><span className="text-xs text-gray-500">par {t.auteur}</span></>}
                  </td>
                  <td className="p-3">
                    <span className={`rounded px-2 py-1 text-xs font-bold ${
                      t.status === "ACTIF" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                      {t.status === "ACTIF" ? "Actif" : "Annulé"}
                    </span>
                  </td>
                  <td className="p-3">
                    {peutAnnuler && t.status === "ACTIF" && (
                      <button onClick={() => { setAAnnuler(t); setMotifAnnulation(""); setErreur(""); }}
                              className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800">
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Les anciens mouvements : recensés, pas reclassés ─────────────── */}
      {candidats.length > 0 && (
        <section className="rounded-lg bg-amber-50 p-5 shadow">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <h2 className="text-xl font-black">Anciens mouvements à examiner</h2>
              <p className="mt-2 text-sm text-amber-900">{avertissement}</p>
            </div>
            <button onClick={() => setVoirCandidats((v) => !v)}
                    className="rounded-lg bg-white px-4 py-2 font-bold text-amber-900 shadow">
              {voirCandidats ? "Masquer" : `Voir les ${candidats.length}`}
            </button>
          </div>

          {voirCandidats && (
            <div className="mt-4 overflow-x-auto rounded-lg bg-white">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>{["Numéro", "Date", "Type", "Sens", "Montant", "Indice", "Description"].map((h) => (
                    <th key={h} className="p-3">{h}</th>))}</tr>
                </thead>
                <tbody>
                  {candidats.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-3 font-mono text-sm">{c.transaction_number}</td>
                      <td className="p-3">{c.operation_date ? new Date(c.operation_date).toLocaleDateString("fr-FR") : "—"}</td>
                      <td className="p-3 text-sm">{c.transaction_type}</td>
                      <td className="p-3 text-sm">{c.direction}</td>
                      <td className="p-3 font-bold">{formatFCFA(Number(c.amount))}</td>
                      <td className="p-3 text-sm">{c.indice}</td>
                      <td className="p-3 text-sm text-gray-600">{c.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-4 text-sm text-gray-600">
                Aucun de ces mouvements n'a été modifié. Les reclasser changerait des totaux
                déjà remis : chacun doit être examiné et régularisé séparément.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── La confirmation d'annulation ────────────────────────────────── */}
      {aAnnuler && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-xl font-black">Annuler le transfert {aAnnuler.reference}</h3>
            <p className="mt-3 text-sm text-gray-700">
              {formatFCFA(Number(aAnnuler.amount))} reviendront de{" "}
              <b>{aAnnuler.destination_label}</b> vers <b>{aAnnuler.source_label}</b>.
            </p>

            {/* Le point que l'on confond : une contre-passation n'est pas un
                virement. Personne ne doit attendre un mouvement bancaire. */}
            <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-bold">Ceci est une annulation comptable, pas un remboursement bancaire.</p>
              <p className="mt-1">
                Les soldes de l'application reviennent comme avant et les deux mouvements
                d'origine sont conservés, marqués annulés. Aucune instruction n'est envoyée
                à la banque : si de l'argent a réellement circulé, il faut le traiter à part.
              </p>
            </div>

            <label className="mt-4 flex flex-col gap-1">
              <span className="text-sm font-bold text-gray-600">
                Motif de l'annulation (10 caractères minimum)
              </span>
              <textarea value={motifAnnulation} onChange={(e) => setMotifAnnulation(e.target.value)}
                        rows={3} className="w-full rounded-lg border p-3"
                        placeholder="Transfert saisi sur le mauvais compte de destination" />
            </label>

            {erreur && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{erreur}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => { setAAnnuler(null); setErreur(""); }}
                      className="rounded-lg bg-gray-100 px-4 py-3 font-bold text-gray-700">
                Revenir
              </button>
              <button onClick={annuler} disabled={enCours || motifAnnulation.trim().length < 10}
                      className="rounded-lg bg-red-600 px-4 py-3 font-black text-white disabled:opacity-50">
                {enCours ? "Annulation…" : "Confirmer l'annulation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
