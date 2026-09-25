"use client";

/**
 * JOURS FÉRIÉS ET JOURS CHÔMÉS — le calendrier administratif.
 *
 * L'écran n'interprète rien. Il ne décide pas qu'un jour chômé est payé, ni
 * qu'une absence de pointage ce jour-là est excusable : il enregistre la
 * DÉCISION, telle qu'elle a été prise, et c'est le moteur de paie qui la lit.
 * Les valeurs proposées quand on choisit un type viennent du serveur, jamais
 * d'une liste écrite ici — ajouter un type demain sera une ligne de données.
 *
 * Ce que l'écran dit toujours, en clair : ce que la journée va coûter ou non,
 * qui elle concerne, et ce qui arrive à celui qui travaille quand même.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";
import { usePermissions } from "../lib/permissions";

type Type = {
  type_key: string; label: string; description: string;
  defaut_est_chome: boolean; defaut_est_paye: boolean; defaut_pointage_requis: boolean;
  defaut_impact_absence: string; defaut_impact_salaire: string; motif_obligatoire: boolean;
};
type Journee = {
  id: number; day_date: string; label: string; type_key: string; type_label: string;
  description: string; decision_reference: string;
  est_chome: boolean; est_paye: boolean; pointage_requis: boolean;
  impact_absence: string; impact_salaire: string; portee: string;
  traitement_si_travaille: string;
  compensation_montant: string | null; compensation_taux: string | null;
  compensation_type_key: string | null; compensation_note: string;
  status: string; created_by_name: string; created_at: string;
  updated_by_name: string; updated_at: string;
  sites: number[]; salaries: number[]; services: string[]; categories: string[];
};

const PORTEES: Record<string, string> = {
  ENTREPRISE: "Toute l'entreprise",
  SITE: "Un ou plusieurs sites",
  ENTREPOT: "Un ou plusieurs entrepôts",
  SERVICE: "Un ou plusieurs services",
  CATEGORIE: "Une ou plusieurs catégories",
  SALARIES: "Une sélection de salariés",
};
const IMPACTS_SALAIRE: Record<string, string> = {
  MAINTENU: "Salaire maintenu",
  RETENUE_JOUR: "Retenue d'un jour",
  AUCUN_EFFET: "Aucun effet sur le salaire",
};
const IMPACTS_ABSENCE: Record<string, string> = {
  AUCUNE: "Aucune absence comptée",
  NORMALE: "Absences comptées normalement",
};
const fcfa = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—"
    : `${Math.round(Number(v)).toLocaleString("fr-FR")} FCFA`;

const moisCourant = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function CalendrierPointagePage() {
  const { can } = usePermissions();
  const peutVoir = can("pointage.calendrier", "view");
  const peutCreer = can("pointage.calendrier", "create");
  const peutModifier = can("pointage.calendrier", "update");
  const peutRetirer = can("pointage.calendrier", "delete");

  const [types, setTypes] = useState<Type[]>([]);
  const [traitements, setTraitements] = useState<{ cle: string; label: string; besoin?: string }[]>([]);
  const [journees, setJournees] = useState<Journee[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [saisie, setSaisie] = useState<any>(null);
  const [auditDe, setAuditDe] = useState<{ id: number; lignes: any[] } | null>(null);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(async () => {
    const [rT, rJ] = await Promise.all([
      authFetch("/pointage/calendrier/types", { cache: "no-store" }),
      authFetch(`/pointage/calendrier?debut=${annee}-01-01&fin=${annee}-12-31`, { cache: "no-store" }),
    ]);
    const dT = await rT.json().catch(() => ({}));
    const dJ = await rJ.json().catch(() => ({}));
    if (rT.ok) { setTypes(dT.types || []); setTraitements(dT.traitements || []); }
    if (rJ.ok) setJournees(dJ.journees || []);
  }, [annee]);

  const [servicesServeur, setServicesServeur] = useState<string[]>([]);
  const [categoriesServeur, setCategoriesServeur] = useState<string[]>([]);

  /* Une seule lecture, gardée par la permission de CE module : qui peut
     déclarer une journée doit pouvoir en désigner le périmètre. */
  const chargerCibles = useCallback(async () => {
    const r = await authFetch("/pointage/calendrier/cibles", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return;
    setSites(Array.isArray(d.sites) ? d.sites : []);
    setSalaries(Array.isArray(d.salaries) ? d.salaries : []);
    setServicesServeur(Array.isArray(d.services) ? d.services : []);
    setCategoriesServeur(Array.isArray(d.categories) ? d.categories : []);
  }, []);

  useEffect(() => { if (peutVoir) { charger(); chargerCibles(); } }, [peutVoir, charger, chargerCibles]);

  const typeChoisi = useMemo(
    () => types.find((t) => t.type_key === saisie?.type_key) || null, [types, saisie?.type_key]);
  const traitementChoisi = useMemo(
    () => traitements.find((t) => t.cle === saisie?.traitement_si_travaille) || null,
    [traitements, saisie?.traitement_si_travaille]);

  /* Le serveur les a déjà dédupliqués ; on retombe sur les fiches si jamais il
     ne les renvoie pas. */
  const servicesConnus = useMemo(
    () => (servicesServeur.length ? servicesServeur
      : [...new Set(salaries.map((e: any) => String(e.service || "").trim()).filter(Boolean))].sort()),
    [servicesServeur, salaries]);
  const categoriesConnues = useMemo(
    () => (categoriesServeur.length ? categoriesServeur
      : [...new Set(salaries.map((e: any) => String(e.categorie || "").trim()).filter(Boolean))].sort()),
    [categoriesServeur, salaries]);

  const ouvrirCreation = () => {
    const premier = types[0];
    setSaisie({
      mode: "creation",
      day_date: "", label: "", type_key: premier?.type_key || "JOUR_FERIE",
      description: "", decision_reference: "",
      est_chome: premier?.defaut_est_chome ?? true,
      est_paye: premier?.defaut_est_paye ?? true,
      pointage_requis: premier?.defaut_pointage_requis ?? false,
      portee: "ENTREPRISE", cibles: [] as any[],
      traitement_si_travaille: "AUCUN", compensation_montant: "", compensation_taux: "",
      compensation_note: "", reason: "",
    });
    setMessage(""); setErreur("");
  };

  const ouvrirModification = (j: Journee) => {
    setSaisie({
      mode: "modification", id: j.id,
      day_date: String(j.day_date).slice(0, 10), label: j.label, type_key: j.type_key,
      description: j.description, decision_reference: j.decision_reference,
      est_chome: j.est_chome, est_paye: j.est_paye, pointage_requis: j.pointage_requis,
      portee: j.portee,
      cibles: j.portee === "SITE" || j.portee === "ENTREPOT" ? j.sites
        : j.portee === "SALARIES" ? j.salaries
        : j.portee === "SERVICE" ? j.services
        : j.portee === "CATEGORIE" ? j.categories : [],
      traitement_si_travaille: j.traitement_si_travaille,
      compensation_montant: j.compensation_montant ?? "",
      compensation_taux: j.compensation_taux ?? "",
      compensation_note: j.compensation_note, reason: "", correction_controlee: false,
    });
    setMessage(""); setErreur("");
  };

  /* Choisir un type repose les valeurs QUE LE SERVEUR propose pour ce type.
     C'est une proposition, pas une contrainte : chaque case reste réglable,
     parce que c'est la décision qui fait la règle, pas la catégorie. */
  const changerType = (cle: string) => {
    const t = types.find((x) => x.type_key === cle);
    setSaisie((s: any) => ({
      ...s, type_key: cle,
      est_chome: t?.defaut_est_chome ?? s.est_chome,
      est_paye: t?.defaut_est_paye ?? s.est_paye,
      pointage_requis: t?.defaut_pointage_requis ?? s.pointage_requis,
    }));
  };

  const envoyer = async () => {
    setOccupe(true); setMessage(""); setErreur("");
    try {
      const corps: any = {
        day_date: saisie.day_date, label: saisie.label.trim(), type_key: saisie.type_key,
        description: saisie.description.trim(),
        decision_reference: saisie.decision_reference.trim(),
        est_chome: saisie.est_chome, est_paye: saisie.est_paye,
        pointage_requis: saisie.pointage_requis,
        portee: saisie.portee, cibles: saisie.cibles,
        traitement_si_travaille: saisie.traitement_si_travaille,
        compensation_note: saisie.compensation_note.trim(),
      };
      if (saisie.compensation_montant !== "") corps.compensation_montant = Number(saisie.compensation_montant);
      if (saisie.compensation_taux !== "") corps.compensation_taux = Number(saisie.compensation_taux);
      if (saisie.mode === "modification") {
        corps.reason = saisie.reason.trim();
        if (saisie.correction_controlee) corps.correction_controlee = true;
      }
      const r = await authFetch(
        saisie.mode === "creation" ? "/pointage/calendrier" : `/pointage/calendrier/${saisie.id}`,
        { method: saisie.mode === "creation" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErreur(d.error || "Enregistrement impossible.");
        /* Le serveur demande une correction contrôlée : on l'offre au lieu de
           laisser l'utilisateur deviner ce qu'il doit faire. */
        if (d.code === "RETROACTIVE_CORRECTION_REQUIRED") {
          setSaisie((s: any) => ({ ...s, correction_requise: true }));
        }
        return;
      }
      setMessage(d.message || "Enregistré.");
      setSaisie(null);
      await charger();
    } finally { setOccupe(false); }
  };

  const retirer = async (j: Journee) => {
    const motif = window.prompt(
      `Retirer « ${j.label} » du ${String(j.day_date).slice(0, 10)} ?\nMotif (10 caractères minimum) :`, "");
    if (!motif || motif.trim().length < 10) return;
    setOccupe(true); setMessage(""); setErreur("");
    try {
      let r = await authFetch(`/pointage/calendrier/${j.id}/desactiver`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: motif.trim() }) });
      let d = await r.json().catch(() => ({}));
      if (!r.ok && d.code === "RETROACTIVE_CORRECTION_REQUIRED") {
        if (!window.confirm(`${d.error}\n\nConfirmer une correction contrôlée ?`)) { setErreur(d.error); return; }
        const motifLong = window.prompt("Motif circonstancié (20 caractères minimum) :", motif.trim());
        if (!motifLong || motifLong.trim().length < 20) { setErreur("Correction annulée."); return; }
        r = await authFetch(`/pointage/calendrier/${j.id}/desactiver`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: motifLong.trim(), correction_controlee: true }) });
        d = await r.json().catch(() => ({}));
      }
      if (!r.ok) { setErreur(d.error || "Retrait impossible."); return; }
      setMessage(d.message || "Journée retirée.");
      await charger();
    } finally { setOccupe(false); }
  };

  const voirAudit = async (j: Journee) => {
    const r = await authFetch(`/pointage/calendrier/${j.id}/audit`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    setAuditDe({ id: j.id, lignes: Array.isArray(d.audit) ? d.audit : [] });
  };

  if (!peutVoir) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-6">
          <h1 className="text-2xl font-black">Jours fériés et jours chômés</h1>
          <p className="mt-3 text-slate-600">
            Vous n'avez pas accès au calendrier des jours fériés et chômés.
          </p>
        </div>
      </main>
    );
  }

  const besoinCible = saisie && saisie.portee !== "ENTREPRISE";

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-6xl rounded-2xl bg-white p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Jours fériés et jours chômés</h1>
          <p className="text-sm text-slate-600">
            Une journée déclarée ici n'est jamais comptée comme une absence injustifiée.
            Le traitement en paie est celui que vous enregistrez — le logiciel ne l'invente pas.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-sm font-bold text-slate-700">
            Année
            <input type="number" value={annee} onChange={(e) => setAnnee(e.target.value)}
              className="ml-2 w-24 rounded-xl border-2 border-slate-300 p-2 font-black" />
          </label>
          {peutCreer && (
            <button onClick={ouvrirCreation} disabled={occupe || !types.length}
              className="min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white disabled:opacity-40">
              + Ajouter une journée spéciale
            </button>
          )}
        </div>
      </header>

      {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 font-bold text-emerald-900">{message}</p>}
      {erreur && <p className="mt-4 rounded-xl bg-red-50 p-3 font-bold text-red-900">{erreur}</p>}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-2">Date</th><th className="p-2">Libellé</th>
              <th className="p-2">Type</th><th className="p-2">Traitement</th>
              <th className="p-2">Portée</th>
              <th className="p-2">Si le salarié travaille</th>
              <th className="p-2">État</th><th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {journees.map((j) => (
              <tr key={j.id} className={`border-t ${j.status === "INACTIF" ? "opacity-50" : ""}`}>
                <td className="p-2 font-black">{String(j.day_date).slice(0, 10)}</td>
                <td className="p-2">
                  <span className="font-bold">{j.label}</span>
                  {j.decision_reference && (
                    <span className="block text-xs text-slate-500">Réf. {j.decision_reference}</span>
                  )}
                  {j.description && <span className="block text-xs text-slate-500">{j.description}</span>}
                </td>
                <td className="p-2">{j.type_label}</td>
                <td className="p-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                    j.est_chome && j.est_paye ? "bg-blue-100 text-blue-900"
                      : j.est_chome ? "bg-orange-100 text-orange-900"
                      : "bg-slate-200 text-slate-700"}`}>
                    {j.est_chome ? (j.est_paye ? "Chômé et payé" : "Chômé, non payé") : "Travaillé"}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {IMPACTS_ABSENCE[j.impact_absence] || j.impact_absence}
                    {" · "}{IMPACTS_SALAIRE[j.impact_salaire] || j.impact_salaire}
                  </span>
                  <span className="block text-xs text-slate-500">
                    Pointage {j.pointage_requis ? "obligatoire" : "non requis"}
                  </span>
                </td>
                <td className="p-2">
                  {PORTEES[j.portee] || j.portee}
                  {j.portee !== "ENTREPRISE" && (
                    <span className="block text-xs text-slate-500">
                      {[...(j.sites || []).map((id) => sites.find((s: any) => s.id === id)?.name || `site ${id}`),
                        ...(j.services || []), ...(j.categories || []),
                        ...(j.salaries || []).map((id) => salaries.find((e: any) => e.id === id)?.full_name || `n° ${id}`),
                      ].join(", ") || "aucune cible"}
                    </span>
                  )}
                </td>
                <td className="p-2 text-xs">
                  {traitements.find((t) => t.cle === j.traitement_si_travaille)?.label || j.traitement_si_travaille}
                  {Number(j.compensation_montant) > 0 && (
                    <span className="block font-bold">{fcfa(j.compensation_montant)}</span>
                  )}
                  {Number(j.compensation_taux) > 0 && (
                    <span className="block font-bold">taux × {j.compensation_taux}</span>
                  )}
                </td>
                <td className="p-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    j.status === "ACTIF" ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-600"}`}>
                    {j.status === "ACTIF" ? "Active" : "Retirée"}
                  </span>
                  <span className="block text-xs text-slate-500">par {j.created_by_name || "—"}</span>
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-2">
                    {peutModifier && j.status === "ACTIF" && (
                      <button onClick={() => ouvrirModification(j)} disabled={occupe}
                        className="rounded-lg border-2 border-slate-300 px-3 py-1 text-xs font-bold">
                        Modifier
                      </button>
                    )}
                    {peutRetirer && j.status === "ACTIF" && (
                      <button onClick={() => retirer(j)} disabled={occupe}
                        className="rounded-lg border-2 border-red-300 px-3 py-1 text-xs font-bold text-red-700">
                        Retirer
                      </button>
                    )}
                    <button onClick={() => voirAudit(j)}
                      className="rounded-lg border-2 border-slate-300 px-3 py-1 text-xs font-bold">
                      Historique
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!journees.length && (
              <tr><td colSpan={8} className="p-6 text-center text-slate-500">
                Aucune journée spéciale enregistrée pour {annee}.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── FENÊTRE : DÉCLARER OU CORRIGER UNE JOURNÉE ── */}
      {saisie && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5">
            <h2 className="text-xl font-black">
              {saisie.mode === "creation" ? "Ajouter une journée spéciale" : "Corriger une journée"}
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">
                Date
                <input type="date" value={saisie.day_date}
                  onChange={(e) => setSaisie({ ...saisie, day_date: e.target.value })}
                  className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3 font-black" />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Libellé
                <input value={saisie.label} placeholder="Fête de l'Indépendance"
                  onChange={(e) => setSaisie({ ...saisie, label: e.target.value })}
                  className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3" />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Type
                <select value={saisie.type_key} onChange={(e) => changerType(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3 font-bold">
                  {types.map((t) => <option key={t.type_key} value={t.type_key}>{t.label}</option>)}
                </select>
                {typeChoisi?.description && (
                  <span className="mt-1 block text-xs font-normal text-slate-500">{typeChoisi.description}</span>
                )}
              </label>
              <label className="text-sm font-bold text-slate-700">
                Portée
                <select value={saisie.portee}
                  onChange={(e) => setSaisie({ ...saisie, portee: e.target.value, cibles: [] })}
                  className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3 font-bold">
                  {Object.entries(PORTEES).map(([c, l]) => <option key={c} value={c}>{l}</option>)}
                </select>
              </label>
            </div>

            {besoinCible && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-700">
                  Qui est concerné ?
                  <span className="ml-1 font-normal text-slate-500">
                    Les autres continuent de travailler normalement.
                  </span>
                </p>
                {(saisie.portee === "SITE" || saisie.portee === "ENTREPOT") && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sites
                      .filter((s: any) => saisie.portee !== "ENTREPOT" || s.site_type === "WAREHOUSE")
                      .map((s: any) => (
                        <label key={s.id} className="flex items-center gap-2 rounded-lg border-2 border-slate-200 px-3 py-2 text-sm">
                          <input type="checkbox" checked={saisie.cibles.includes(s.id)}
                            onChange={(e) => setSaisie({
                              ...saisie,
                              cibles: e.target.checked
                                ? [...saisie.cibles, s.id]
                                : saisie.cibles.filter((x: any) => x !== s.id) })} />
                          {s.name}
                        </label>
                      ))}
                    {!sites.length && <p className="text-sm text-slate-500">Aucun site à proposer.</p>}
                  </div>
                )}
                {saisie.portee === "SALARIES" && (
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    {salaries.map((e: any) => (
                      <label key={e.id} className="flex items-center gap-2 py-1 text-sm">
                        <input type="checkbox" checked={saisie.cibles.includes(e.id)}
                          onChange={(ev) => setSaisie({
                            ...saisie,
                            cibles: ev.target.checked
                              ? [...saisie.cibles, e.id]
                              : saisie.cibles.filter((x: any) => x !== e.id) })} />
                        {e.full_name}
                      </label>
                    ))}
                  </div>
                )}
                {(saisie.portee === "SERVICE" || saisie.portee === "CATEGORIE") && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(saisie.portee === "SERVICE" ? servicesConnus : categoriesConnues).map((v) => (
                      <label key={v} className="flex items-center gap-2 rounded-lg border-2 border-slate-200 px-3 py-2 text-sm">
                        <input type="checkbox" checked={saisie.cibles.includes(v)}
                          onChange={(e) => setSaisie({
                            ...saisie,
                            cibles: e.target.checked
                              ? [...saisie.cibles, v]
                              : saisie.cibles.filter((x: any) => x !== v) })} />
                        {v}
                      </label>
                    ))}
                    {!(saisie.portee === "SERVICE" ? servicesConnus : categoriesConnues).length && (
                      <p className="text-sm text-slate-500">
                        Aucun {saisie.portee === "SERVICE" ? "service" : "catégorie"} n'est renseigné sur les fiches.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                ["est_chome", "Journée chômée"],
                ["est_paye", "Journée payée"],
                ["pointage_requis", "Pointage obligatoire"],
              ].map(([cle, libelle]) => (
                <label key={cle} className="flex items-center justify-between rounded-xl border-2 border-slate-200 p-3 text-sm font-bold">
                  {libelle}
                  <input type="checkbox" checked={Boolean(saisie[cle as string])}
                    onChange={(e) => setSaisie({ ...saisie, [cle as string]: e.target.checked })} />
                </label>
              ))}
            </div>
            {/* Ce que la décision va produire, dit avant d'enregistrer. */}
            <p className="mt-2 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-900">
              {saisie.est_chome && saisie.est_paye
                && "Aucune absence ne sera comptée et le salaire sera maintenu. Aucun pointage ne sera inventé."}
              {saisie.est_chome && !saisie.est_paye
                && "Aucune absence injustifiée ne sera comptée, mais une retenue d'un jour s'appliquera — présentée séparément des absences sur le bulletin."}
              {!saisie.est_chome
                && "La journée reste travaillée : les absences et les retards suivent les règles normales."}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">
                Traitement si le salarié travaille
                <select value={saisie.traitement_si_travaille}
                  onChange={(e) => setSaisie({ ...saisie, traitement_si_travaille: e.target.value })}
                  className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3 font-bold">
                  {traitements.map((t) => <option key={t.cle} value={t.cle}>{t.label}</option>)}
                </select>
              </label>
              {(traitementChoisi?.besoin === "montant" || traitementChoisi?.besoin === "montant_ou_taux") && (
                <label className="text-sm font-bold text-slate-700">
                  Montant de la prime (FCFA)
                  <input type="number" min={0} value={saisie.compensation_montant}
                    onChange={(e) => setSaisie({ ...saisie, compensation_montant: e.target.value })}
                    className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3 font-black" />
                </label>
              )}
              {(traitementChoisi?.besoin === "taux" || traitementChoisi?.besoin === "taux_horaire"
                || traitementChoisi?.besoin === "montant_ou_taux") && (
                <label className="text-sm font-bold text-slate-700">
                  {traitementChoisi?.besoin === "taux_horaire" ? "Taux horaire (FCFA)" : "Coefficient du taux journalier"}
                  <input type="number" min={0} step="0.01" value={saisie.compensation_taux}
                    onChange={(e) => setSaisie({ ...saisie, compensation_taux: e.target.value })}
                    className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3 font-black" />
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Aucun pourcentage par défaut : sans valeur, aucune compensation n'est calculée.
                  </span>
                </label>
              )}
            </div>

            <label className="mt-3 block text-sm font-bold text-slate-700">
              Motif / référence de la décision
              {typeChoisi?.motif_obligatoire && <span className="text-red-600"> — obligatoire</span>}
              <textarea value={saisie.description} rows={2}
                placeholder="Journée chômée décidée par la Direction — note de service n° …"
                onChange={(e) => setSaisie({ ...saisie, description: e.target.value })}
                className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3" />
            </label>
            <label className="mt-2 block text-sm font-bold text-slate-700">
              Référence du texte ou de la décision
              <input value={saisie.decision_reference} placeholder="Arrêté n° … / Note de service n° …"
                onChange={(e) => setSaisie({ ...saisie, decision_reference: e.target.value })}
                className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3" />
            </label>

            {saisie.mode === "modification" && (
              <>
                <label className="mt-3 block text-sm font-bold text-slate-700">
                  Motif de la modification (10 caractères minimum)
                  <input value={saisie.reason}
                    onChange={(e) => setSaisie({ ...saisie, reason: e.target.value })}
                    className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3" />
                </label>
                {saisie.correction_requise && (
                  <label className="mt-2 flex items-start gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                    <input type="checkbox" checked={Boolean(saisie.correction_controlee)}
                      onChange={(e) => setSaisie({ ...saisie, correction_controlee: e.target.checked })} />
                    <span>
                      Correction contrôlée : la paie de cette période est déjà engagée.
                      Ce changement modifiera un net déjà annoncé, et sera tracé comme
                      correction rétroactive. Motif circonstancié exigé (20 caractères).
                    </span>
                  </label>
                )}
              </>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={envoyer} disabled={occupe || !saisie.day_date || saisie.label.trim().length < 3}
                className="min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white disabled:opacity-40">
                Enregistrer
              </button>
              <button onClick={() => setSaisie(null)} disabled={occupe}
                className="min-h-12 rounded-xl border-2 border-slate-300 px-5 font-black">
                Annuler
              </button>
            </div>
            {erreur && <p className="mt-3 rounded-xl bg-red-50 p-3 font-bold text-red-900">{erreur}</p>}
          </div>
        </div>
      )}

      {/* ── FENÊTRE : HISTORIQUE ── */}
      {auditDe && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5">
            <h2 className="text-xl font-black">Historique de la journée</h2>
            <p className="text-sm text-slate-600">
              Qui, quand, ce qui a changé et pourquoi. Rien n'est effacé, même quand la
              décision est défaite.
            </p>
            <ul className="mt-4 space-y-3">
              {auditDe.lignes.map((a) => (
                <li key={a.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="font-black">
                    {a.action} · {new Date(a.le).toLocaleString("fr-FR")}
                  </p>
                  <p className="text-slate-700">par {a.par_nom || "—"}</p>
                  {a.motif && <p className="mt-1 text-slate-700">Motif : {a.motif}</p>}
                  {a.paie_concernee && (
                    <p className="mt-1 text-xs text-slate-500">Paie au moment du geste : {a.paie_concernee}</p>
                  )}
                  {a.avant && a.apres && (
                    <p className="mt-1 text-xs text-slate-500">
                      {["label", "est_chome", "est_paye", "pointage_requis", "impact_salaire", "portee", "status"]
                        .filter((c) => String(a.avant[c]) !== String(a.apres[c]))
                        .map((c) => `${c} : ${a.avant[c]} → ${a.apres[c]}`)
                        .join(" · ") || "aucun champ de traitement modifié"}
                    </p>
                  )}
                </li>
              ))}
              {!auditDe.lignes.length && <li className="text-slate-500">Aucun mouvement enregistré.</li>}
            </ul>
            <button onClick={() => setAuditDe(null)}
              className="mt-5 min-h-12 rounded-xl border-2 border-slate-300 px-5 font-black">
              Fermer
            </button>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}
