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

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";
import { usePermissions } from "../lib/permissions";

type Periode = {
  id: number; code: string; debut: string; fin: string; status: string;
  validee_par: string | null; paies: number; reopen_reason: string;
};
type Ligne = {
  id: number; employee_id: number; employee_name: string;
  monthly_salary: string | null; daily_rate: string | null;
  expected_days: number; attended_days: number; absence_days: number;
  late_minutes: number; absence_deduction: string; advance_deduction: string;
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
    if (!r.ok) { setPaie(null); setLignes([]); return; }
    setPaie(d.run || null);
    setLignes(Array.isArray(d.items) ? d.items : []);
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
  useEffect(() => { chargerPaie(); }, [chargerPaie]);

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
      await Promise.all([chargerPeriodes(), chargerPaie()]);
      return d;
    } finally { setOccupe(false); }
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
              {peutSoumettre && paie && ["DRAFT", "CORRECTION_DEMANDEE", "REFUSEE"].includes(paie.status) && (
                <button disabled={occupe || bloquees > 0} onClick={() => agir(`/paie/runs/${paie.id}/soumettre`)}
                  className="min-h-12 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-40"
                  title={bloquees ? "Des salaires n'ont pas de montant calculable." : ""}>
                  Soumettre à la direction
                </button>
              )}
              {peutValider && paie?.status === "EN_ATTENTE_DIRECTION" && (
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
                  <th className="p-3">Avance retenue</th>
                  <th className="p-3">Net</th>
                  <th className="p-3">État</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id} className="border-t align-top">
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
                    <td className="p-3">{Number(l.advance_deduction) ? fcfa(l.advance_deduction) : "—"}</td>
                    <td className="p-3 font-black">{fcfa(l.net_salary)}</td>
                    <td className="p-3 text-sm font-bold">
                      {l.status === "PAID" ? "Payé" : l.status === "BLOCKED" ? "Bloqué" : "À payer"}
                      {l.payment_reference && (
                        <span className="block text-xs font-normal text-slate-500">{l.payment_reference}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {peutAjuster && l.status !== "PAID" && (
                          <button disabled={occupe} onClick={() => ajuster(l)}
                            className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-black text-black disabled:opacity-40">
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
