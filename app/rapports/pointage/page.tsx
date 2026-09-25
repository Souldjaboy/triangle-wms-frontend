"use client";

/**
 * RAPPORTS DE POINTAGE — global et individuel, imprimables en A4.
 *
 * Chaque ligne dit d'où vient sa valeur : QR, manuel, régularisation ou
 * correction administrative. Un total contesté doit pouvoir être remonté
 * jusqu'à sa journée et jusqu'à son origine, sans avoir à ouvrir la base.
 *
 * Les durées sont en heures et minutes. 20 h 15 ne vaut pas 20,25 : la
 * conversion décimale est la première chose qui fait diverger un décompte
 * d'heures d'avec ce que le salarié a compté de son côté.
 */

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";

type Totaux = {
  jours_attendus: number; jours_travailles: number; absences: number;
  absences_justifiees: number; repos: number; feries: number; samedis_travailles: number;
  retards: number; minutes_retard: number; departs_anticipes: number;
  journees_incompletes: number; corrections: number; anomalies: number;
  duree_travaillee: string; retard_cumule: string;
  par_source: Record<string, number>;
  /* Les journées du calendrier administratif, chacune dans sa catégorie. */
  jours_chomes_payes?: number; jours_chomes_non_payes?: number;
  travail_jours_chomes?: number; repos_compensateurs?: number;
  /* Le BRUT, pour l'audit : il ne remplace pas l'officiel, il l'accompagne. */
  absences_brutes?: number; absences_neutralisees?: number;
  retards_bruts?: number; minutes_retard_brutes?: number; retards_neutralises?: number;
  regularisation?: {
    absences_neutralisees: boolean; retards_neutralises: boolean;
    motif_absences: string; motif_retards: string; mention: string;
  };
};
type LigneGlobale = {
  employee_id: number; matricule: number; nom: string; poste: string; site: string | null; totaux: Totaux;
};
type Journee = {
  jour: string; du: boolean; statut: string; source: string;
  heure_prevue: string | null; arrivee: string | null; depart: string | null;
  pause_debut: string | null; pause_fin: string | null;
  retard_minutes: number; duree_minutes: number; corrections: number; motif: string;
  du_brut?: boolean; statut_pointage?: string; categorie_journee?: string | null;
  jour_special?: { id: number; label: string; type: string; est_chome: boolean;
                   est_paye: boolean; traitement: string; motif: string } | null;
};

const STATUTS: Record<string, { texte: string; classe: string }> = {
  PRESENT:           { texte: "Présent",            classe: "bg-emerald-100 text-emerald-900" },
  LATE:              { texte: "En retard",          classe: "bg-amber-100 text-amber-900" },
  COMPLETED:         { texte: "Journée terminée",   classe: "bg-emerald-100 text-emerald-900" },
  ON_BREAK:          { texte: "En pause",           classe: "bg-blue-100 text-blue-900" },
  ABSENT:            { texte: "Absent",             classe: "bg-red-100 text-red-900" },
  ABSENCE_JUSTIFIEE: { texte: "Absence justifiée",  classe: "bg-slate-200 text-slate-700" },
  REPOS:             { texte: "Repos",              classe: "bg-slate-100 text-slate-500" },
  FERIE:             { texte: "Jour férié",         classe: "bg-blue-50 text-blue-800" },
  /* Une journée chômée n'est ni un repos, ni une absence : sa propre catégorie.
     La confondre avec un repos effacerait la décision ; la confondre avec une
     absence accuserait le salarié de ce qu'il n'a pas fait. */
  CHOME_PAYE:         { texte: "Jour chômé payé",     classe: "bg-blue-50 text-blue-800" },
  CHOME_NON_PAYE:     { texte: "Jour chômé non payé", classe: "bg-orange-100 text-orange-900" },
  TRAVAIL_JOUR_CHOME: { texte: "Travail un jour chômé", classe: "bg-violet-100 text-violet-900" },
};
const SOURCES: Record<string, string> = {
  QR: "Badge QR",
  MANUEL: "Saisie manuelle",
  WEB: "Saisie manuelle",
  regularisation: "Régularisation",
  correction_administrative: "Correction",
  calendrier: "Calendrier",
  horaire: "Horaire",
  aucune: "Aucun pointage",
};

function moisCourant() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const heure = (v: string | null) =>
  v ? new Date(v).toLocaleTimeString("fr-FR", { timeZone: "Africa/Bamako", hour: "2-digit", minute: "2-digit" }) : "—";

export default function RapportsPointagePage() {
  const { can } = usePermissions();
  const peutVoir = can("pointage", "view");

  const [periode, setPeriode] = useState(moisCourant());
  const [filtre, setFiltre] = useState("");
  const [global, setGlobal] = useState<{ entete: any; periode: any; employes: LigneGlobale[]; totaux_generaux: Totaux; effectif: number } | null>(null);
  const [individuel, setIndividuel] = useState<any>(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const chargerGlobal = useCallback(async () => {
    setChargement(true); setErreur("");
    try {
      const r = await authFetch(
        `/pointage/rapports/global?periode=${periode}${filtre ? `&statut=${filtre}` : ""}`,
        { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || "Rapport indisponible."); setGlobal(null); return; }
      setGlobal(d);
    } finally { setChargement(false); }
  }, [periode, filtre]);

  useEffect(() => { if (peutVoir) chargerGlobal(); }, [chargerGlobal, peutVoir]);

  const ouvrirIndividuel = async (employeeId: number) => {
    setErreur("");
    const r = await authFetch(`/pointage/rapports/employe/${employeeId}?periode=${periode}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErreur(d.error || "Rapport indisponible."); return; }
    setIndividuel(d);
  };

  if (!peutVoir) {
    return (
      <main className="min-h-screen bg-slate-100 p-4">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black">Rapports de pointage</h1>
          <p className="mt-3 text-slate-600">Vous n’avez pas accès aux rapports de pointage.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 md:p-8">
      <style>{`@media print {
        body { background:#fff }
        .sans-impression { display:none !important }
        .page { break-inside: avoid }
        table { font-size: 11px }
        @page { size: A4; margin: 12mm }
      }`}</style>

      <div className="mx-auto max-w-7xl">
        <header className="sans-impression">
          <h1 className="text-3xl font-black md:text-4xl">Rapports de pointage</h1>
          <p className="mt-2 text-slate-600">
            Les chiffres sont ceux qui seront retenus pour la paie. Chaque journée indique son origine.
          </p>
        </header>

        {erreur && <div className="sans-impression mt-5 rounded-xl bg-red-100 p-4 font-bold text-red-800">{erreur}</div>}

        <section className="sans-impression mt-6 flex flex-wrap items-end gap-4 rounded-2xl bg-white p-5 shadow-sm">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Période</span>
            <input type="month" className="min-h-12 rounded-xl border p-3"
              value={periode} onChange={(e) => setPeriode(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Ne montrer que</span>
            <select className="min-h-12 rounded-xl border p-3" value={filtre}
              onChange={(e) => setFiltre(e.target.value)}>
              <option value="">Tout le monde</option>
              <option value="LATE">Ceux qui ont des retards</option>
              <option value="ABSENT">Ceux qui ont des absences</option>
              <option value="ANOMALIE">Ceux qui ont des anomalies</option>
            </select>
          </label>
          <button onClick={() => window.print()}
            className="min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white">
            Imprimer
          </button>
          {individuel && (
            <button onClick={() => setIndividuel(null)}
              className="min-h-12 rounded-xl bg-slate-200 px-5 font-black">
              Revenir au rapport global
            </button>
          )}
        </section>

        {/* ── RAPPORT INDIVIDUEL ── */}
        {individuel && (
          <section className="page mt-6 rounded-2xl bg-white p-6 shadow-sm">
            <EnTete entete={individuel.entete} periode={individuel.periode}
              titre="Rapport individuel de pointage" />

            <div className="mt-4 rounded-xl bg-slate-100 p-4">
              <p className="text-xl font-black">{individuel.employe.nom}</p>
              <p className="text-sm text-slate-600">
                Matricule {individuel.employe.matricule} · {individuel.employe.poste}
                {individuel.employe.site ? ` · ${individuel.employe.site}` : ""}
              </p>
            </div>

            <Totalisation totaux={individuel.totaux} />

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-2">Jour</th><th className="p-2">Prévu</th>
                    <th className="p-2">Arrivée</th><th className="p-2">Pause</th>
                    <th className="p-2">Départ</th><th className="p-2">Retard</th>
                    <th className="p-2">Durée</th><th className="p-2">État</th>
                    <th className="p-2">Origine</th>
                  </tr>
                </thead>
                <tbody>
                  {(individuel.journees as Journee[]).map((j) => {
                    const s = STATUTS[j.statut] || { texte: j.statut, classe: "bg-slate-100" };
                    return (
                      <tr key={j.jour} className={`border-t ${j.du ? "" : "text-slate-400"}`}>
                        <td className="p-2 font-bold">{j.jour}</td>
                        <td className="p-2">{j.heure_prevue ? String(j.heure_prevue).slice(0, 5) : "—"}</td>
                        <td className="p-2">{heure(j.arrivee)}</td>
                        <td className="p-2">{heure(j.pause_debut)} / {heure(j.pause_fin)}</td>
                        <td className="p-2">{heure(j.depart)}</td>
                        <td className={`p-2 ${j.retard_minutes ? "font-black text-red-600" : ""}`}>
                          {j.retard_minutes ? `${j.retard_minutes} min` : "—"}
                        </td>
                        <td className="p-2">
                          {j.duree_minutes
                            ? `${Math.floor(j.duree_minutes / 60)} h ${String(j.duree_minutes % 60).padStart(2, "0")}`
                            : "—"}
                        </td>
                        <td className="p-2">
                          <span className={`rounded px-2 py-1 text-xs font-bold ${s.classe}`}>{s.texte}</span>
                        </td>
                        <td className="p-2 text-xs text-slate-500">
                          {SOURCES[j.source] || j.source}
                          {j.corrections > 0 && <span className="block">{j.corrections} correction(s)</span>}
                          {j.motif && <span className="block italic">{j.motif}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Signatures />
          </section>
        )}

        {/* ── RAPPORT GLOBAL ── */}
        {!individuel && global && (
          <section className="page mt-6 rounded-2xl bg-white p-6 shadow-sm">
            <EnTete entete={global.entete} periode={global.periode}
              titre="Rapport global de pointage" />

            <p className="mt-3 text-sm text-slate-600">
              {global.effectif} employé(s){filtre ? " correspondant au filtre choisi" : ""}
            </p>

            <Totalisation totaux={global.totaux_generaux} />

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-2">Employé</th><th className="p-2">Site</th>
                    <th className="p-2">Dus</th><th className="p-2">Travaillés</th>
                    <th className="p-2">Absences</th>
                    <th className="p-2">Chômés<br /><span className="text-xs font-normal">payés / non payés</span></th>
                    <th className="p-2">Retards</th>
                    <th className="p-2">Retard cumulé</th><th className="p-2">Durée</th>
                    <th className="p-2">Incomplètes</th><th className="p-2">QR / Manuel</th>
                    <th className="p-2 sans-impression">Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {global.employes.map((e) => (
                    <tr key={e.employee_id} className="border-t">
                      <td className="p-2"><span className="font-bold">{e.nom}</span>
                        <span className="block text-xs text-slate-500">{e.matricule} · {e.poste}</span></td>
                      <td className="p-2">{e.site || "—"}</td>
                      <td className="p-2">{e.totaux.jours_attendus}</td>
                      <td className="p-2 font-bold">{e.totaux.jours_travailles}</td>
                      <td className={`p-2 ${e.totaux.absences ? "font-black text-red-600" : ""}`}>
                        {e.totaux.absences}
                        {e.totaux.regularisation?.absences_neutralisees
                          && (e.totaux.absences_brutes ?? 0) > 0 ? (
                          <span className="block text-xs font-normal text-slate-500">
                            {e.totaux.absences_brutes} au brut
                          </span>
                        ) : null}
                      </td>
                      <td className="p-2">
                        {e.totaux.jours_chomes_payes ?? 0} / {e.totaux.jours_chomes_non_payes ?? 0}
                        {(e.totaux.travail_jours_chomes ?? 0) > 0 ? (
                          <span className="block text-xs text-violet-800">
                            {e.totaux.travail_jours_chomes} travaillé(s)
                          </span>
                        ) : null}
                      </td>
                      <td className={`p-2 ${e.totaux.retards ? "font-bold text-amber-700" : ""}`}>
                        {e.totaux.retards}
                      </td>
                      <td className="p-2">{e.totaux.retard_cumule}</td>
                      <td className="p-2">{e.totaux.duree_travaillee}</td>
                      <td className="p-2">{e.totaux.journees_incompletes || "—"}</td>
                      <td className="p-2 text-xs">
                        {e.totaux.par_source?.QR || 0} / {e.totaux.par_source?.MANUEL || 0}
                      </td>
                      <td className="p-2 sans-impression">
                        <button onClick={() => ouvrirIndividuel(e.employee_id)}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white">
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                  {global.employes.length === 0 && (
                    <tr><td colSpan={11} className="p-6 text-center text-slate-500">
                      Personne ne correspond à ce filtre sur cette période.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <Signatures />
          </section>
        )}

        {chargement && <p className="sans-impression mt-6 text-slate-500">Chargement…</p>}
      </div>
    </main>
  );
}

function EnTete({ entete, periode, titre }: { entete: any; periode: any; titre: string }) {
  return (
    <header className="border-b-2 border-slate-900 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {entete?.societe?.name || ""}
          </p>
          {entete?.societe?.address && (
            <p className="text-xs text-slate-500">{entete.societe.address}</p>
          )}
          {(entete?.societe?.phone || entete?.societe?.email) && (
            <p className="text-xs text-slate-500">
              {[entete.societe.phone, entete.societe.email].filter(Boolean).join(" · ")}
            </p>
          )}
          <h2 className="mt-2 text-2xl font-black">{titre}</h2>
          <p className="text-sm text-slate-600">
            Période {periode?.code} — du {periode?.debut} au {periode?.fin}
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>Imprimé le {entete?.imprime_le ? new Date(entete.imprime_le).toLocaleString("fr-FR") : "—"}</p>
          <p>par {entete?.imprime_par || "—"}</p>
        </div>
      </div>
    </header>
  );
}

function Totalisation({ totaux }: { totaux: Totaux }) {
  const r = totaux.regularisation;
  const cases: ([string, string | number] | [string, string | number, string])[] = [
    ["Jours attendus", totaux.jours_attendus],
    ["Jours travaillés", totaux.jours_travailles],
    /* Le chiffre OFFICIEL, et juste au-dessous ce que le brut disait. Les deux
       ensemble, jamais l'un à la place de l'autre : un document officiel qui
       annonce 110 absences pendant que la paie n'en retient aucune n'est pas
       une nuance, c'est une contradiction. */
    ["Absences", totaux.absences,
      r?.absences_neutralisees ? `${totaux.absences_brutes ?? 0} au pointage brut` : ""],
    ["Absences justifiées", totaux.absences_justifiees],
    ["Repos", totaux.repos],
    ["Jours fériés", totaux.feries],
    ["Jours chômés payés", totaux.jours_chomes_payes ?? 0],
    ["Jours chômés non payés", totaux.jours_chomes_non_payes ?? 0],
    ["Travail un jour chômé", totaux.travail_jours_chomes ?? 0,
      totaux.repos_compensateurs ? `dont ${totaux.repos_compensateurs} en repos compensateur` : ""],
    ["Samedis travaillés", totaux.samedis_travailles],
    ["Retards", totaux.retards,
      r?.retards_neutralises ? `${totaux.retards_bruts ?? 0} au pointage brut` : ""],
    ["Retard cumulé", totaux.retard_cumule],
    ["Durée travaillée", totaux.duree_travaillee],
    ["Départs anticipés", totaux.departs_anticipes],
    ["Journées incomplètes", totaux.journees_incompletes],
  ];
  return (
    <>
      {r?.mention && (
        <div className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-3">
          <p className="font-black text-amber-900">{r.mention}</p>
          {r.motif_absences && (
            <p className="mt-1 text-sm text-amber-800">Motif : {r.motif_absences}</p>
          )}
          <p className="mt-1 text-xs text-amber-700">
            Les pointages d'origine sont conservés intégralement : aucun n'a été supprimé,
            modifié ni créé. Les valeurs brutes restent disponibles pour l'audit.
          </p>
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {cases.map(([libelle, valeur, note]) => (
          <div key={libelle} className="rounded-xl bg-slate-100 p-3">
            <p className="text-xs text-slate-500">{libelle}</p>
            <p className="text-lg font-black">{valeur}</p>
            {note ? <p className="text-xs text-slate-500">{note}</p> : null}
          </div>
        ))}
      </div>
    </>
  );
}

function Signatures() {
  return (
    <div className="mt-10 flex flex-wrap gap-8">
      {["Le responsable du pointage", "Le comptable", "La direction"].map((r) => (
        <div key={r} className="min-w-[180px] flex-1 border-t border-slate-400 pt-2 text-xs text-slate-500">
          {r}
        </div>
      ))}
    </div>
  );
}
