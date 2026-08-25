"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../lib/api";
import { afficherDate, FUSEAU } from "../lib/dates";

/**
 * MODIFIER LA DATE ET L'HEURE D'UN DOCUMENT.
 *
 * Un bon peut être imprimé plusieurs jours après l'opération qu'il décrit.
 * Cet écran sert à dire ce que le document doit AFFICHER — jamais à réécrire
 * ce que la base a ENREGISTRÉ.
 *
 * Les quatre dates sont montrées côte à côte, parce que les confondre est
 * exactement l'erreur que ce chantier corrige :
 *   création technique   ce que la base a vu — lecture seule, toujours ;
 *   date effective       ce qui s'est passé au magasin ;
 *   date du document     ce que lit le destinataire ;
 *   dernière impression  quand le bon est sorti.
 */

type DateLocale = { iso: string; date: string; time: string; affichage: string };
type Vue = {
  id: number;
  document_number: string;
  document_type: string;
  revision: number;
  print_count: number;
  fuseau: string;
  dates: {
    creation_technique: DateLocale | null;
    operation_effective: DateLocale | null;
    document_affiche: DateLocale | null;
    derniere_impression: DateLocale | null;
  };
  source_date_affichee: "document" | "operation" | "creation";
  date_metier_confirmee: boolean;
  deja_imprime: boolean;
  revisions?: number;
  mouvement: { id: number; type: string } | null;
};

const MOTIFS = [
  "Impression différée",
  "Régularisation d'un document Excel",
  "Correction de date de mouvement",
  "Erreur de saisie",
];

const CHAMP = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base";

export default function DateDocumentEditor({
  documentId, ouvert, onFermer, onEnregistre,
}: {
  documentId: number;
  ouvert: boolean;
  onFermer: () => void;
  onEnregistre?: (vue: Vue) => void;
}) {
  const [vue, setVue] = useState<Vue | null>(null);
  const [chargement, setChargement] = useState(true);
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    setChargement(true); setErreur("");
    const r = await authFetch(`/documents/${documentId}/dates`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErreur(d?.error || "Lecture impossible."); setChargement(false); return; }
    setVue(d);
    /* On prérenseigne avec ce que le document affiche aujourd'hui : corriger
       une date, c'est le plus souvent en ajuster l'heure. */
    setDate(d.dates?.document_affiche?.date || "");
    setHeure(d.dates?.document_affiche?.time || "");
    setChargement(false);
  }, [documentId]);

  useEffect(() => { if (ouvert) charger(); }, [ouvert, charger]);

  if (!ouvert) return null;

  /* Le motif n'est réclamé que lorsqu'il sert : sur un bon déjà diffusé, ou
     sur une date déjà corrigée. Le backend applique la même règle — c'est lui
     qui refuse, celui-ci ne fait que l'annoncer. */
  const motifObligatoire = Boolean(vue?.deja_imprime) || Number(vue?.revision || 1) > 1;
  const pretAEnregistrer = Boolean(date && heure) && (!motifObligatoire || motif.trim().length > 0);

  const enregistrer = async () => {
    setBusy(true); setErreur("");
    const r = await authFetch(`/documents/${documentId}/dates`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, time: heure, reason: motif.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErreur(d?.error || "Enregistrement impossible.");
    setVue(d); setMotif("");
    onEnregistre?.(d);
  };

  const retablir = async () => {
    setBusy(true); setErreur("");
    const r = await authFetch(`/documents/${documentId}/dates/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: motif.trim() || "Rétablissement de la date d'origine" }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErreur(d?.error || "Rétablissement impossible.");
    setVue(d);
    setDate(d.dates?.document_affiche?.date || "");
    setHeure(d.dates?.document_affiche?.time || "");
    onEnregistre?.(d);
  };

  const apercu = date && heure
    ? afficherDate(`${date}T${heure}:00Z`)
    : vue?.dates.document_affiche?.affichage || "—";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
         role="dialog" aria-modal="true" aria-label="Modifier la date et l'heure du document">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Modifier la date et l&apos;heure du document</h2>
            <p className="text-xs text-gray-500">
              {vue?.document_type} {vue?.document_number} · fuseau {vue?.fuseau || FUSEAU}
            </p>
          </div>
          <button onClick={onFermer} className="rounded-lg px-3 py-1 text-sm font-bold text-gray-500 hover:bg-gray-100">
            Fermer
          </button>
        </div>

        {chargement ? (
          <p className="mt-6 text-sm text-gray-500">Chargement…</p>
        ) : !vue ? (
          <p className="mt-6 text-sm text-red-700">{erreur || "Document introuvable."}</p>
        ) : (
          <>
            {/* Les quatre dates, pour qu'aucune ne se fasse passer pour une autre. */}
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-gray-50 p-3">
                <dt className="text-xs font-bold uppercase text-gray-500">Création en base — lecture seule</dt>
                <dd className="text-sm text-gray-900">{vue.dates.creation_technique?.affichage || "—"}</dd>
                <p className="mt-1 text-xs text-gray-500">Ce que la base a enregistré. Jamais modifiable.</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <dt className="text-xs font-bold uppercase text-gray-500">Opération effectuée le</dt>
                <dd className="text-sm text-gray-900">{vue.dates.operation_effective?.affichage || "—"}</dd>
                <p className="mt-1 text-xs text-gray-500">La date du terrain.</p>
              </div>
              <div className="rounded-xl bg-indigo-50 p-3">
                <dt className="text-xs font-bold uppercase text-indigo-700">Affiché sur le document</dt>
                <dd className="text-sm font-bold text-indigo-900">{vue.dates.document_affiche?.affichage || "—"}</dd>
                {!vue.date_metier_confirmee && (
                  <p className="mt-1 text-xs text-indigo-800">
                    Aucune date métier n&apos;a encore été confirmée : le bon affiche sa date de création.
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <dt className="text-xs font-bold uppercase text-gray-500">Dernière impression</dt>
                <dd className="text-sm text-gray-900">{vue.dates.derniere_impression?.affichage || "Jamais imprimé"}</dd>
                <p className="mt-1 text-xs text-gray-500">
                  {vue.print_count} impression(s) · révision {vue.revision}
                </p>
              </div>
            </dl>

            {vue.deja_imprime && (
              <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Ce document a déjà été imprimé. La correction reste possible, mais elle crée une
                nouvelle révision et l&apos;ancienne date est conservée dans l&apos;historique.
              </p>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-gray-700">
                Date de l&apos;opération
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={CHAMP} />
              </label>
              <label className="block text-xs font-bold text-gray-700">
                Heure
                <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={CHAMP} />
              </label>
            </div>

            <div className="mt-3">
              <label className="block text-xs font-bold text-gray-700">
                Motif de modification {motifObligatoire && <span className="text-red-600">— obligatoire</span>}
                <input value={motif} onChange={(e) => setMotif(e.target.value)}
                       list="motifs-document" placeholder="Pourquoi cette date change-t-elle ?"
                       className={CHAMP} />
              </label>
              <datalist id="motifs-document">
                {MOTIFS.map((m) => <option key={m} value={m} />)}
              </datalist>
            </div>

            {/* Aperçu : ce que le destinataire lira, avant d'engager quoi que ce soit. */}
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs font-bold uppercase text-gray-500">Aperçu avant impression</p>
              <p className="mt-1 text-base font-bold text-gray-900">{apercu}</p>
              <p className="text-xs text-gray-500">tel qu&apos;il apparaîtra en haut du bon</p>
            </div>

            {erreur && (
              <p className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800">
                {erreur}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={enregistrer} disabled={busy || !pretAEnregistrer}
                      className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40 sm:flex-none">
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button onClick={onFermer} disabled={busy}
                      className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700">
                Annuler
              </button>
              <button onClick={retablir} disabled={busy || vue.source_date_affichee === "creation"}
                      className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700 disabled:opacity-40">
                Rétablir la date d&apos;origine
              </button>
            </div>
            {!pretAEnregistrer && motifObligatoire && !motif.trim() && (
              <p className="mt-2 text-xs text-gray-500">
                Indiquez un motif pour pouvoir enregistrer.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
