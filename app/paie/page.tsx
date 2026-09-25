"use client";

/**
 * PAIE — du pointage validé au bon signé.
 *
 * L'écran suit le chemin réel, dans l'ordre, et n'affiche à chaque étape que
 * ce qui est possible MAINTENANT. Le comptable ne voit pas un bouton
 * « valider » grisé qu'il pourrait croire à lui : il ne le voit pas du tout.
 * Le backend refuse de toute façon, mais un bouton visible qu'on ne peut pas
 * presser est une promesse qu'on ne tient pas.
 *
 * Les termes sont ceux qu'emploient les gens : « En attente du directeur »,
 * « Autorisé au paiement », « À payer ».
 */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";
import { usePermissions } from "../lib/permissions";

type Periode = {
  id: number; code: string; debut: string; fin: string; status: string;
  validee_par: string | null; paies: number; reopen_reason: string;
  /* Exception d'absences : portée par la période, jamais globale. */
  absences_non_retenues?: boolean;
  absences_non_retenues_motif?: string;
};
type Ligne = {
  id: number; employee_id: number; employee_name: string;
  monthly_salary: string | null; daily_rate: string | null;
  expected_days: number; attended_days: number; absence_days: number;
  late_minutes: number; absence_deduction: string; advance_deduction: string;
  absence_deduction_annulee?: string; advance_deduction_externe?: string;
  primes_total?: string; heures_sup_total?: string; heures_sup_heures?: string;
  retenues_autres_total?: string; non_remunere?: boolean; net_corrige_manuellement?: boolean;
  adjustments: string; net_salary: string | null; status: string;
  payment_method: string | null; payment_reference: string;
};
type Paie = { id: number; status: string; net_amount: string; period_month: string; period_id: number | null };

const STATUTS_PERIODE: Record<string, { texte: string; classe: string }> = {
  OUVERTE:               { texte: "Ouverte",                 classe: "bg-slate-200 text-slate-800" },
  EN_REVISION_POINTAGE:  { texte: "Pointage à contrôler",     classe: "bg-amber-100 text-amber-900" },
  POINTAGE_VALIDE:       { texte: "Pointage validé",          classe: "bg-blue-100 text-blue-900" },
  PAIE_PREPAREE:         { texte: "Paie préparée",            classe: "bg-blue-100 text-blue-900" },
  EN_ATTENTE_DIRECTION:  { texte: "En attente du directeur",  classe: "bg-amber-100 text-amber-900" },
  VALIDEE_DIRECTION:     { texte: "Validée par la direction", classe: "bg-emerald-100 text-emerald-900" },
  AUTORISEE_AU_PAIEMENT: { texte: "Autorisé au paiement",     classe: "bg-emerald-100 text-emerald-900" },
  PAYEE:                 { texte: "Payée",                    classe: "bg-emerald-600 text-white" },
  CLOTUREE:              { texte: "Clôturée",                 classe: "bg-slate-900 text-white" },
  ANNULEE:               { texte: "Annulée",                  classe: "bg-red-100 text-red-900" },
};

const STATUTS_PAIE: Record<string, string> = {
  DRAFT: "Brouillon",
  EN_ATTENTE_DIRECTION: "En attente du directeur",
  CORRECTION_DEMANDEE: "Correction demandée",
  REFUSEE: "Refusée par la direction",
  VALIDEE_DIRECTION: "Validée",
  AUTORISEE_AU_PAIEMENT: "Autorisé au paiement",
  PARTIALLY_PAID: "Partiellement payée",
  PAID: "Payée",
  CANCELLED: "Annulée",
};

const fcfa = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—"
    : `${Math.round(Number(v)).toLocaleString("fr-FR")} FCFA`;

function moisCourant() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PaiePage() {
  const { can } = usePermissions();
  const peutPreparer = can("paie", "prepare");
  const peutSoumettre = can("paie", "submit");
  const peutValider = can("paie", "validate");
  const peutAjuster = can("paie", "adjust");
  const peutPayer = can("paie", "pay");
  const peutImprimer = can("paie", "print");
  const peutValiderPointage = can("pointage.periode", "validate");
  const peutOuvrir = can("pointage.periode", "create");
  const peutCloturer = can("pointage.periode", "close");
  const peutRouvrir = can("pointage.periode", "reopen");

  const [periodes, setPeriodes] = useState<Periode[]>([]);
  const [code, setCode] = useState(moisCourant());
  const [paie, setPaie] = useState<Paie | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [comptes, setComptes] = useState<{ banques: any[]; caisses: any[] }>({ banques: [], caisses: [] });
  /* Qui a soumis, et ce que le serveur autorise. On n'en déduit rien
     localement : l'écran reprend la décision du backend, pour que le bouton
     affiché soit exactement celui qui marchera. */
  /* Le catalogue vient du serveur : ajouter un type de prime demain ne
     demandera pas de toucher à cet écran. */
  const [typesElement, setTypesElement] = useState<any[]>([]);
  const [elements, setElements] = useState<any[]>([]);
  const [saisie, setSaisie] = useState<any>(null);
  const [detailDe, setDetailDe] = useState<number | null>(null);
  const [demande, setDemande] = useState<any>(null);
  const [droits, setDroits] = useState<any>({});
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  const periode = useMemo(() => periodes.find((p) => p.code === code) || null, [periodes, code]);

  const chargerPeriodes = useCallback(async () => {
    const r = await authFetch("/paie/periodes", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setPeriodes(Array.isArray(d.periodes) ? d.periodes : []);
  }, []);

  const chargerPaie = useCallback(async () => {
    /* Cette lecture reste sur l'ancienne route : elle sert aussi à relire les
       paies mensuelles enregistrées avant les périodes, et l'ancrage
       `period_month` de la paie d'une période porte bien son mois. */
    const r = await authFetch(`/attendance-v2/payroll?month=${code}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setPaie(null); setLignes([]); setDemande(null); setDroits({}); return; }
    setPaie(d.run || null);
    setLignes(Array.isArray(d.items) ? d.items : []);
    setDemande(d.demande || null);
    setDroits(d.droits || {});
  }, [code]);

  const chargerElements = useCallback(async () => {
    const [rt, re] = await Promise.all([
      authFetch("/paie/elements/types", { cache: "no-store" }).catch(() => null),
      authFetch(`/paie/periodes/${code}/elements`, { cache: "no-store" }).catch(() => null),
    ]);
    if (rt && rt.ok) setTypesElement((await rt.json().catch(() => ({}))).types || []);
    if (re && re.ok) setElements((await re.json().catch(() => ({}))).elements || []);
  }, [code]);

  const chargerComptes = useCallback(async () => {
    const [rb, rc] = await Promise.all([
      authFetch("/accounting/banks", { cache: "no-store" }).catch(() => null),
      authFetch("/caisses", { cache: "no-store" }).catch(() => null),
    ]);
    const banques = rb && rb.ok ? await rb.json().catch(() => []) : [];
    const caisses = rc && rc.ok ? await rc.json().catch(() => []) : [];
    setComptes({
      banques: Array.isArray(banques) ? banques : (banques?.banks || banques?.banques || []),
      caisses: Array.isArray(caisses) ? caisses : (caisses?.caisses || []),
    });
  }, []);

  useEffect(() => { chargerPeriodes(); chargerComptes(); }, [chargerPeriodes, chargerComptes]);
  useEffect(() => { chargerPaie(); chargerElements(); }, [chargerPaie, chargerElements]);

  const agir = async (chemin: string, corps?: unknown, methode = "POST") => {
    setOccupe(true); setMessage(""); setErreur("");
    try {
      const r = await authFetch(chemin, {
        method: methode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps ?? {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || "Opération refusée."); return null; }
      setMessage(d.message || "Enregistré.");
      await Promise.all([chargerPeriodes(), chargerPaie(), chargerElements()]);
      return d;
    } finally { setOccupe(false); }
  };

  /* Les éléments d'un salarié, pour le détail dépliable et pour le bulletin. */
  const elementsDe = (employeeId: number) =>
    elements.filter((e) => Number(e.employee_id) === Number(employeeId) && e.status === "ACTIF");

  const enregistrerElement = async () => {
    if (!saisie) return;
    const type = typesElement.find((t) => t.type_key === saisie.type_key);
    if (!type) return;
    const corps: any = {
      employee_id: saisie.employee_id, type_key: saisie.type_key,
      reason: String(saisie.reason || "").trim(),
      label: String(saisie.label || "").trim(),
    };
    if (type.uses_quantity) {
      corps.quantity = Number(saisie.quantity);
      corps.unit_amount = Number(saisie.unit_amount);
    } else {
      corps.amount = Number(saisie.amount);
    }
    const d = await agir(`/paie/periodes/${code}/elements`, corps);
    if (d) setSaisie(null);
  };

  const annulerElement = async (element: any) => {
    const motif = window.prompt(
      `Annuler « ${element.type_label} » de ${fcfa(element.amount)} ? Motif (5 caractères minimum) :`
    );
    if (!motif || motif.trim().length < 5) return;
    await agir(`/paie/elements/${element.id}/annuler`, { reason: motif.trim() });
  };

  const decider = async (decision: "VALIDEE" | "REFUSEE" | "CORRECTION_DEMANDEE") => {
    if (!paie) return;
    const invite = decision === "VALIDEE"
      ? "Observation (facultative) :"
      : decision === "REFUSEE"
        ? "Motif du refus (obligatoire) :"
        : "Ce qui doit être corrigé (obligatoire) :";
    const motif = window.prompt(invite) ?? "";
    if (decision !== "VALIDEE" && motif.trim().length < 3) return;
    await agir(`/paie/runs/${paie.id}/decision`, { decision, reason: motif.trim() });
  };

  const ajuster = async (ligne: Ligne) => {
    const saisi = window.prompt(
      `Nouveau net pour ${ligne.employee_name} (actuel : ${fcfa(ligne.net_salary)}) :`,
      String(Math.round(Number(ligne.net_salary || 0))));
    if (saisi === null) return;
    const montant = Number(saisi);
    if (!Number.isFinite(montant) || montant < 0) { setErreur("Montant invalide."); return; }
    const motif = window.prompt("Motif de la correction (obligatoire) :") ?? "";
    if (motif.trim().length < 5) return;
    await agir(`/paie/lignes/${ligne.id}/ajuster`, { net_salary: montant, reason: motif.trim() });
  };

  const payer = async (ligne: Ligne) => {
    const banques = comptes.banques, caisses = comptes.caisses;
    const choix = window.prompt(
      `Payer ${ligne.employee_name} — ${fcfa(ligne.net_salary)}\n\n` +
      `Tapez « caisse » ou « banque » :`, caisses.length ? "caisse" : "banque");
    if (!choix) return;
    const parCaisse = /caisse/i.test(choix);
    const liste = parCaisse ? caisses : banques;
    if (!liste.length) { setErreur(parCaisse ? "Aucune caisse ouverte." : "Aucune banque enregistrée."); return; }

    const nomDe = (c: any) => c.nom_caisse || c.bank_name || `#${c.id}`;
    const invite = liste.map((c: any, i: number) => `${i + 1}. ${nomDe(c)}`).join("\n");
    const rang = Number(window.prompt(`Quel compte ?\n\n${invite}`, "1"));
    const compte = liste[rang - 1];
    if (!compte) return;
    const reference = window.prompt("Référence du paiement (facultative) :") ?? "";

    await agir(`/attendance-v2/payroll-items/${ligne.id}/pay`, {
      payment_method: parCaisse ? "CASHBOX" : "BANK",
      caisse_id: parCaisse ? compte.id : undefined,
      bank_id: parCaisse ? undefined : compte.id,
      payment_reference: reference,
    });
  };

  const voirBon = async (ligne: Ligne) => {
    setOccupe(true); setMessage(""); setErreur("");
    try {
      await authFetch(`/paie/lignes/${ligne.id}/bon`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const r = await authFetch(`/paie/lignes/${ligne.id}/bon`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || "Bon indisponible."); return; }
      imprimerBon(d.bon);
    } finally { setOccupe(false); }
  };

  const statutPeriode = periode ? (STATUTS_PERIODE[periode.status] || { texte: periode.status, classe: "bg-slate-200" }) : null;
  const bloquees = lignes.filter((l) => l.status === "BLOCKED").length;
  const aPayer = lignes.filter((l) => l.status === "TO_PAY").length;
  const autorise = paie?.status === "AUTORISEE_AU_PAIEMENT"
    || paie?.status === "PARTIALLY_PAID" || paie?.status === "PAID";

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header>
          <h1 className="text-3xl font-black md:text-4xl">Paie</h1>
        <div className="mt-4 flex flex-wrap gap-3 print:hidden">
          <a
            href="/rapports/pointage"
            className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-700"
          >
            Historique des présences
          </a>

          <a
            href="/rapports/pointage"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-900 hover:bg-slate-50"
          >
            Voir / Imprimer les pointages
          </a>
        </div>
          <p className="mt-2 text-slate-600">
            La période va du 25 d’un mois au 24 du suivant. Le paiement n’est possible
            qu’après validation de la direction.
          </p>
        </header>

        {(message || erreur) && (
          <div className={`mt-5 rounded-xl p-4 font-bold ${
            erreur ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
            {erreur || message}
          </div>
        )}

        {/* ── LA PÉRIODE ── */}
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Période de paie</span>
              <input type="month" className="min-h-12 rounded-xl border p-3"
                value={code} onChange={(e) => setCode(e.target.value)} />
            </label>

            {periode ? (
              <div>
                <span className={`inline-block rounded-lg px-3 py-2 text-sm font-black ${statutPeriode!.classe}`}>
                  {statutPeriode!.texte}
                </span>
                <p className="mt-1 text-sm text-slate-600">
                  du {periode.debut} au {periode.fin}
                  {periode.validee_par ? ` · pointage validé par ${periode.validee_par}` : ""}
                </p>
              </div>
            ) : (
              peutOuvrir && (
                <button disabled={occupe} onClick={() => agir(`/paie/periodes/${code}/ouvrir`)}
                  className="min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white disabled:opacity-40">
                  Ouvrir cette période
                </button>
              )
            )}
          </div>

          {periode && (
            <div className="mt-4 flex flex-wrap gap-3">
              {peutValiderPointage && ["OUVERTE", "EN_REVISION_POINTAGE"].includes(periode.status) && (
                <button disabled={occupe} onClick={() => agir(`/paie/periodes/${code}/valider-pointage`)}
                  className="min-h-12 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-40">
                  Valider le pointage
                </button>
              )}
              {peutCloturer && periode.status === "PAYEE" && (
                <button disabled={occupe} onClick={() => agir(`/paie/periodes/${code}/cloturer`)}
                  className="min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white disabled:opacity-40">
                  Clôturer la période
                </button>
              )}
              {peutRouvrir && ["CLOTUREE", "POINTAGE_VALIDE", "PAIE_PREPAREE"].includes(periode.status) && (
                <button disabled={occupe} onClick={async () => {
                  const motif = window.prompt("Motif de la réouverture (obligatoire) :") ?? "";
                  if (motif.trim().length < 3) return;
                  await agir(`/paie/periodes/${code}/rouvrir`, { reason: motif.trim() });
                }}
                  className="min-h-12 rounded-xl bg-slate-200 px-5 font-black disabled:opacity-40">
                  Rouvrir pour correction
                </button>
              )}
            </div>
          )}
        </section>

        {/* ── LA PAIE ── */}
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Bulletins de la période</h2>
              {paie && (
                <p className="mt-1 text-sm text-slate-600">
                  {STATUTS_PAIE[paie.status] || paie.status} · net total {fcfa(paie.net_amount)}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {/* La préparation passe par la PÉRIODE, pas par le mois civil :
                  l'ancienne route calculait du 1er au 31 alors que l'écran
                  annonce du 25 au 24, et laissait la paie sans période — donc
                  payable sans validation de la Direction. */}
              {peutPreparer && (!paie || ["DRAFT", "CORRECTION_DEMANDEE", "REFUSEE"].includes(paie.status)) && (
                <button disabled={occupe || !periode}
                  onClick={() => agir(`/paie/periodes/${code}/preparer`)}
                  title={!periode ? "Ouvrez d'abord la période." : ""}
                  className="min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white disabled:opacity-40">
                  {paie ? "Recalculer la paie" : "Préparer la paie"}
                </button>
              )}
              {/* Un mois où le pointage a été défaillant ne doit pas coûter aux
                  salariés ce qu'ils n'ont pas manqué. La décision porte sur
                  CETTE période seulement ; les absences restent enregistrées. */}
              {droits.est_super_admin && periode && (
                <button disabled={occupe}
                  onClick={async () => {
                    if (periode.absences_non_retenues) {
                      if (!window.confirm(`Rétablir la retenue des absences sur ${code} ? Les absences réduiront à nouveau le salaire.`)) return;
                      await agir(`/paie/periodes/${code}/exception-absences`, { actif: false });
                      return;
                    }
                    const motif = window.prompt(
                      "Motif de l'exception (10 caractères minimum) — il restera attaché à la période :",
                      "Régularisation exceptionnelle " + code + " — incidents du système de pointage — décision direction"
                    );
                    if (!motif || motif.trim().length < 10) return;
                    await agir(`/paie/periodes/${code}/exception-absences`, { actif: true, reason: motif.trim() });
                  }}
                  className={`min-h-12 rounded-xl px-5 font-black ${periode.absences_non_retenues
                    ? "border-2 border-amber-500 text-amber-800" : "border-2 border-slate-400 text-slate-800"}`}>
                  {periode.absences_non_retenues ? "Rétablir la retenue des absences" : "Ne pas retenir les absences"}
                </button>
              )}
              {peutSoumettre && paie && ["DRAFT", "CORRECTION_DEMANDEE", "REFUSEE"].includes(paie.status) && (
                <button disabled={occupe || bloquees > 0} onClick={() => agir(`/paie/runs/${paie.id}/soumettre`)}
                  className="min-h-12 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-40"
                  title={bloquees ? "Des salaires n'ont pas de montant calculable." : ""}>
                  Soumettre à la direction
                </button>
              )}
              {/* Retirer sa propre soumission n'est pas décider : c'est
                  renoncer. L'auteur reste bloqué sans ce bouton, puisque la
                  Direction ne peut pas trancher s'il est seul habilité. */}
              {droits.peut_retirer_sa_soumission && paie?.status === "EN_ATTENTE_DIRECTION" && (
                <button disabled={occupe}
                  onClick={async () => {
                    const motif = window.prompt("Motif du retrait (facultatif) :") ?? "";
                    await agir(`/paie/runs/${paie.id}/retirer-soumission`, { reason: motif.trim() });
                  }}
                  className="min-h-12 rounded-xl border-2 border-slate-400 px-5 font-black text-slate-800">
                  Retirer ma soumission
                </button>
              )}
              {peutValider && droits.peut_decider && paie?.status === "EN_ATTENTE_DIRECTION" && (
                <>
                  <button disabled={occupe} onClick={() => decider("VALIDEE")}
                    className="min-h-12 rounded-xl bg-emerald-600 px-5 font-black text-white disabled:opacity-40">
                    Autoriser le paiement
                  </button>
                  <button disabled={occupe} onClick={() => decider("CORRECTION_DEMANDEE")}
                    className="min-h-12 rounded-xl bg-amber-500 px-5 font-black text-black disabled:opacity-40">
                    Demander une correction
                  </button>
                  <button disabled={occupe} onClick={() => decider("REFUSEE")}
                    className="min-h-12 rounded-xl bg-red-600 px-5 font-black text-white disabled:opacity-40">
                    Refuser
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Dire pourquoi les boutons de décision manquent vaut mieux que de
              les afficher et de laisser le serveur refuser après le clic. */}
          {paie?.status === "EN_ATTENTE_DIRECTION" && peutValider && !droits.peut_decider && (
            <p className="mt-4 rounded-xl bg-amber-100 p-3 font-bold text-amber-900">
              Vous avez soumis cette paie : la validation revient à quelqu'un d'autre.
              Vous pouvez retirer votre soumission pour la corriger.
            </p>
          )}
          {paie?.status === "EN_ATTENTE_DIRECTION" && droits.est_super_admin && droits.est_auteur_de_la_soumission && (
            <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-900">
              Vous avez soumis cette paie et vous êtes super administrateur : vous pouvez
              la valider vous-même. L'opération sera tracée comme auto-validation.
            </p>
          )}
          {demande && paie?.status === "EN_ATTENTE_DIRECTION" && (
            <p className="mt-2 text-sm text-slate-600">
              Soumise par <b>{demande.submitted_by_name || "—"}</b> pour {fcfa(demande.amount_submitted)}.
            </p>
          )}
          {/* ── FENÊTRE : AJOUTER UN ÉLÉMENT DE PAIE ──
          Une prime ne se crée plus en réécrivant le net. Elle est rattachée au
          salarié et à la période, et un recalcul la relit au lieu de la perdre. */}
      {saisie && (() => {
        const type = typesElement.find((t) => t.type_key === saisie.type_key);
        const calcule = type?.uses_quantity
          ? Number(saisie.quantity || 0) * Number(saisie.unit_amount || 0)
          : Number(saisie.amount || 0);
        const pret = Boolean(type)
          && String(saisie.reason || "").trim().length >= 5
          && (!type?.requires_label || String(saisie.label || "").trim().length >= 3)
          && calcule > 0;
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
            <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="text-xl font-black">Ajouter un élément de paie</h3>
              <p className="mb-4 text-sm text-slate-600">
                {saisie.employee_name} — période {code}. L’élément survivra aux recalculs.
              </p>

              <label className="block">
                <span className="text-sm font-bold">Type</span>
                <select value={saisie.type_key} className="mt-1 w-full rounded-lg border p-3"
                  onChange={(e) => setSaisie({ ...saisie, type_key: e.target.value })}>
                  {typesElement.map((t) => (
                    <option key={t.type_key} value={t.type_key}>
                      {t.label}{Number(t.sign) < 0 ? " (retenue)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {type?.uses_quantity ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-sm font-bold">Nombre d’heures</span>
                    <input type="number" min="0" step="0.5" className="mt-1 w-full rounded-lg border p-3"
                      value={saisie.quantity}
                      onChange={(e) => setSaisie({ ...saisie, quantity: e.target.value })}/>
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold">Taux horaire (FCFA)</span>
                    <input type="number" min="0" className="mt-1 w-full rounded-lg border p-3"
                      value={saisie.unit_amount}
                      onChange={(e) => setSaisie({ ...saisie, unit_amount: e.target.value })}/>
                  </label>
                </div>
              ) : (
                <label className="mt-3 block">
                  <span className="text-sm font-bold">Montant (FCFA)</span>
                  <input type="number" min="0" className="mt-1 w-full rounded-lg border p-3"
                    value={saisie.amount}
                    onChange={(e) => setSaisie({ ...saisie, amount: e.target.value })}/>
                </label>
              )}

              {type?.requires_label && (
                <label className="mt-3 block">
                  <span className="text-sm font-bold">Description *</span>
                  <input className="mt-1 w-full rounded-lg border p-3"
                    placeholder="Sans elle, la ligne ne dit rien à qui la relit"
                    value={saisie.label}
                    onChange={(e) => setSaisie({ ...saisie, label: e.target.value })}/>
                </label>
              )}

              <label className="mt-3 block">
                <span className="text-sm font-bold">Motif * (5 caractères minimum)</span>
                <input className="mt-1 w-full rounded-lg border p-3"
                  value={saisie.reason}
                  onChange={(e) => setSaisie({ ...saisie, reason: e.target.value })}/>
              </label>

              {/* Le montant est calculé par le serveur ; on l'affiche ici pour
                  qu'il n'y ait pas de surprise après validation. */}
              <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm font-bold">
                {type?.uses_quantity
                  ? `${Number(saisie.quantity || 0)} h × ${fcfa(saisie.unit_amount || 0)} = ${fcfa(calcule)}`
                  : `Montant : ${fcfa(calcule)}`}
                {Number(type?.sign) < 0 && " — retiré du net"}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" disabled={occupe || !pret} onClick={enregistrerElement}
                  className="min-h-12 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-40">
                  {occupe ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button type="button" onClick={() => setSaisie(null)}
                  className="min-h-12 rounded-xl border-2 px-5 font-black">Annuler</button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Recalculez ensuite la paie de la période pour que l’élément apparaisse sur le bulletin.
              </p>
            </div>
          </div>
        );
      })()}

      {periode?.absences_non_retenues && (
            <div className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-black">
                Exception : les absences de {code} ne réduisent pas le salaire.
              </p>
              <p className="mt-1">{periode.absences_non_retenues_motif}</p>
              <p className="mt-1 text-xs">
                Les absences restent comptées et visibles ci-dessous. Recalculez la paie après
                tout changement d'exception. La période suivante retient ses absences normalement.
              </p>
            </div>
          )}
          {bloquees > 0 && (
            <p className="mt-4 rounded-xl bg-amber-100 p-3 font-bold text-amber-900">
              {bloquees} salaire(s) sans montant calculable : renseignez leur salaire mensuel
              avant de soumettre.
            </p>
          )}
          {paie && !autorise && aPayer > 0 && (
            <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
              Le paiement s’ouvrira lorsque la direction aura validé cette paie.
            </p>
          )}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="p-3">Employé</th>
                  <th className="p-3">Jours</th>
                  <th className="p-3">Salaire</th>
                  <th className="p-3">Retenue absence</th>
                  <th className="p-3">Non retenu</th>
                  <th className="p-3">Primes</th>
                  <th className="p-3">Heures sup.</th>
                  <th className="p-3">Autres retenues</th>
                  <th className="p-3">Avance retenue</th>
                  <th className="p-3">Net</th>
                  <th className="p-3">État</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <Fragment key={l.id}>
                  <tr className="border-t align-top">
                    <td className="p-3 font-bold">{l.employee_name}</td>
                    <td className="p-3 text-sm">
                      {l.attended_days}/{l.expected_days}
                      {l.absence_days > 0 && (
                        <span className="block text-xs text-red-600">{l.absence_days} absence(s)</span>
                      )}
                      {l.late_minutes > 0 && (
                        <span className="block text-xs text-amber-700">{l.late_minutes} min de retard</span>
                      )}
                    </td>
                    <td className="p-3">{fcfa(l.monthly_salary)}</td>
                    <td className="p-3">{fcfa(l.absence_deduction)}</td>
                    {/* Ce que l'exception a épargné au salarié. Zéro en mois
                        normal : la colonne ne dit quelque chose que lorsqu'il y
                        a quelque chose à dire. */}
                    <td className="p-3 text-amber-800">
                      {Number(l.absence_deduction_annulee || 0) > 0 ? fcfa(l.absence_deduction_annulee!) : "—"}
                    </td>
                    <td className="p-3 text-emerald-800">
                      {Number(l.primes_total || 0) ? "+" + fcfa(l.primes_total!) : "—"}
                    </td>
                    <td className="p-3 text-emerald-800">
                      {Number(l.heures_sup_total || 0) ? (
                        <>+{fcfa(l.heures_sup_total!)}
                          <span className="block text-xs font-normal text-slate-500">
                            {Number(l.heures_sup_heures || 0)} h
                          </span>
                        </>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-red-700">
                      {Number(l.retenues_autres_total || 0) ? "−" + fcfa(l.retenues_autres_total!) : "—"}
                    </td>
                    <td className="p-3">{Number(l.advance_deduction) ? fcfa(l.advance_deduction) : "—"}</td>
                    <td className="p-3 font-black">
                      {fcfa(l.net_salary)}
                      {l.non_remunere && (
                        <span className="block text-xs font-normal text-slate-500">non rémunéré</span>
                      )}
                      {l.net_corrige_manuellement && (
                        <span className="block text-xs font-normal text-amber-700">corrigé à la main</span>
                      )}
                      {/* « Ne jamais afficher uniquement un net inexpliqué » :
                          le détail de chaque composante est à un clic. */}
                      <button type="button"
                        onClick={() => setDetailDe(detailDe === l.id ? null : l.id)}
                        className="mt-1 block text-xs font-bold text-blue-700 underline">
                        {detailDe === l.id ? "Masquer le détail" : "Voir le détail"}
                      </button>
                    </td>
                    <td className="p-3 text-sm font-bold">
                      {l.status === "PAID" ? "Payé" : l.status === "BLOCKED" ? "Bloqué" : "À payer"}
                      {l.payment_reference && (
                        <span className="block text-xs font-normal text-slate-500">{l.payment_reference}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {peutAjuster && l.status !== "PAID" && (
                          <button disabled={occupe}
                            onClick={() => setSaisie({
                              employee_id: l.employee_id, employee_name: l.employee_name,
                              type_key: typesElement[0]?.type_key || "", reason: "", label: "",
                              quantity: "", unit_amount: "", amount: "",
                            })}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">
                            + Élément de paie
                          </button>
                        )}
                        {/* La correction directe du net reste possible, mais elle
                            n'est plus le geste évident : elle ne survit pas à un
                            recalcul, et l'écran le dit. */}
                        {peutAjuster && l.status !== "PAID" && (
                          <button disabled={occupe} onClick={() => ajuster(l)}
                            title="Exceptionnel : une correction du net ne survit pas à un recalcul."
                            className="rounded-lg border-2 border-amber-500 px-3 py-2 text-sm font-black text-amber-800 disabled:opacity-40">
                            Corriger le net
                          </button>
                        )}
                        {peutPayer && autorise && l.status === "TO_PAY" && (
                          <button disabled={occupe} onClick={() => payer(l)}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">
                            Payer
                          </button>
                        )}
                        {peutImprimer && l.status === "PAID" && (
                          <button disabled={occupe} onClick={() => voirBon(l)}
                            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-black text-white disabled:opacity-40">
                            Bon de paiement
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {detailDe === l.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={12} className="p-4">
                        {/* La formule, écrite. Chaque franc du net vient d'une
                            ligne nommée : c'est la seule façon d'expliquer un
                            bulletin sans avoir à refaire le calcul de tête. */}
                        <div className="max-w-xl text-sm">
                          <div className="flex justify-between py-1">
                            <span>Salaire de base</span>
                            <b>{fcfa(l.monthly_salary)}</b>
                          </div>
                          {elementsDe(l.employee_id).map((e) => (
                            <div key={e.id} className="flex items-start justify-between gap-3 border-t py-1">
                              <span>
                                {e.type_label}{e.label ? ` — ${e.label}` : ""}
                                {e.uses_quantity && (
                                  <span className="block text-xs text-slate-500">
                                    {Number(e.quantity)} h × {fcfa(e.unit_amount)} = {fcfa(e.amount)}
                                  </span>
                                )}
                                <span className="block text-xs text-slate-500">
                                  {e.reason} — {e.created_by_name}
                                </span>
                              </span>
                              <span className="whitespace-nowrap">
                                <b className={Number(e.sign) < 0 ? "text-red-700" : "text-emerald-800"}>
                                  {Number(e.sign) < 0 ? "−" : "+"}{fcfa(e.amount)}
                                </b>
                                {peutAjuster && l.status !== "PAID" && (
                                  <button type="button" onClick={() => annulerElement(e)}
                                    className="ml-3 text-xs font-bold text-red-700 underline">
                                    annuler
                                  </button>
                                )}
                              </span>
                            </div>
                          ))}
                          {Number(l.adjustments || 0) !== 0 && (
                            <div className="flex justify-between border-t py-1">
                              <span>Ajustement de pointage</span>
                              <b>{Number(l.adjustments) > 0 ? "+" : ""}{fcfa(l.adjustments)}</b>
                            </div>
                          )}
                          <div className="flex justify-between border-t py-1">
                            <span>Retenue d’absence
                              {Number(l.absence_deduction_annulee || 0) > 0 && (
                                <span className="block text-xs text-amber-700">
                                  {fcfa(l.absence_deduction_annulee!)} non retenus (exception de la période)
                                </span>
                              )}
                            </span>
                            <b className="text-red-700">−{fcfa(l.absence_deduction)}</b>
                          </div>
                          <div className="flex justify-between border-t py-1">
                            <span>Retenue d’avance
                              {Number(l.advance_deduction_externe || 0) > 0 && (
                                <span className="block text-xs text-slate-500">
                                  dont {fcfa(l.advance_deduction_externe!)} déjà enregistrés hors paie
                                </span>
                              )}
                            </span>
                            <b className="text-red-700">−{fcfa(l.advance_deduction)}</b>
                          </div>
                          <div className="mt-1 flex justify-between border-t-2 border-slate-900 py-2 text-base">
                            <span className="font-black">NET À PAYER</span>
                            <b className="font-black">{fcfa(l.net_salary)}</b>
                          </div>
                          {l.net_corrige_manuellement && (
                            <p className="mt-2 rounded-lg bg-amber-100 p-2 text-xs text-amber-900">
                              Ce net a été corrigé à la main. La correction ne survivra pas à un
                              recalcul : préférez un élément de paie, ou corrigez le salaire sur la fiche.
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
                {lignes.length === 0 && (
                  <tr><td colSpan={8} className="p-6 text-center text-slate-500">
                    Aucun bulletin pour cette période.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * Le bon s'imprime depuis son `payload` FIGÉ, pas depuis les lignes de
 * l'écran : un bon signé doit dire ce qu'il disait le jour de la signature,
 * même si le salaire a changé depuis.
 */
function imprimerBon(bon: any) {
  if (!bon?.payload) return;
  const p = bon.payload;
  const ligne = (libelle: string, valeur: unknown) =>
    `<tr><td style="padding:6px 0;color:#475569">${libelle}</td>
         <td style="padding:6px 0;text-align:right;font-weight:700">${valeur ?? "—"}</td></tr>`;
  const argent = (v: unknown) =>
    v === null || v === undefined ? "—" : `${Math.round(Number(v)).toLocaleString("fr-FR")} FCFA`;

  const fenetre = window.open("", "_blank", "width=800,height=900");
  if (!fenetre) return;
  fenetre.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <title>Bon de paiement ${bon.voucher_number}</title>
    <style>
      body{font-family:system-ui,sans-serif;color:#0f172a;margin:0;padding:32px}
      .cadre{max-width:640px;margin:0 auto;border:2px solid #0f172a;border-radius:12px;padding:28px}
      h1{margin:0;font-size:20px} table{width:100%;border-collapse:collapse;margin-top:16px}
      .net{border-top:2px solid #0f172a;margin-top:12px;padding-top:12px;
           display:flex;justify-content:space-between;font-size:20px;font-weight:900}
      .signatures{display:flex;gap:32px;margin-top:48px}
      .signature{flex:1;border-top:1px solid #94a3b8;padding-top:6px;font-size:12px;color:#475569}
      @media print{body{padding:0}}
    </style></head><body><div class="cadre">
      <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#64748b">${p.societe || ""}</p>
      <h1>Bon de paiement de salaire</h1>
      <p style="margin:4px 0 0;font-family:monospace;font-weight:700">${bon.voucher_number}</p>
      <table>
        ${ligne("Employé", p.employe)}
        ${ligne("Période", p.periode?.code ? `${p.periode.code} (du ${p.periode.du} au ${p.periode.au})` : (p.periode?.mois || "—"))}
        ${ligne("Salaire de base", argent(p.salaire_de_base))}
        ${ligne("Jours attendus", p.jours_attendus)}
        ${ligne("Jours travaillés", p.jours_travailles)}
        ${ligne("Retenue pour absence", argent(p.retenue_absence))}
        ${ligne("Ajustements", argent(p.ajustements))}
        ${ligne("Mode de paiement", p.mode || "—")}
        ${ligne("Compte", p.compte || "—")}
        ${ligne("Référence", p.reference || "—")}
        ${ligne("Payé le", p.paye_le ? new Date(p.paye_le).toLocaleString("fr-FR") : "—")}
      </table>
      <div class="net"><span>Net payé</span><span>${argent(p.net_paye)}</span></div>
      <div class="signatures">
        <div class="signature">Le comptable</div>
        <div class="signature">Le directeur</div>
        <div class="signature">L'employé</div>
      </div>
      <p style="margin-top:24px;font-size:11px;color:#94a3b8">
        Émis le ${new Date(bon.issued_at).toLocaleString("fr-FR")} par ${bon.issued_by_name || "—"}
        · impression n° ${bon.print_count}
      </p>
    </div>
    <script>window.onload=function(){window.print()}</script>
    </body></html>`);
  fenetre.document.close();
}
