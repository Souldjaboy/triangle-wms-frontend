"use client";

/**
 * FISCALITÉ ET COTISATIONS.
 *
 * L'écran affiche d'abord ce qu'il NE SAIT PAS. Tant qu'aucune règle n'a été
 * vérifiée, un bandeau le dit, et les montants doivent être saisis à la main.
 * Un logiciel qui affiche un taux sans dire d'où il vient met un comptable en
 * position de déclarer un chiffre dont personne ne répond.
 *
 * Aucune pénalité n'est affichée non plus : le message convenu est repris tel
 * quel du serveur.
 */

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../lib/api";
import { usePermissions } from "../lib/permissions";

type Type = {
  id: number; code: string; name: string; explanation: string; category: string;
  authority: string; base_label: string; frequency: string;
  obligation_active: boolean; exemption_reason: string; regles_verifiees: number;
};
type Regle = {
  id: number; code: string; name: string; rate_percent: string | null; fixed_amount: string | null;
  effective_from: string; effective_to: string | null;
  source_reference: string; source_url: string; verified_at: string | null;
  verification_status: string; verifiee_par: string | null; notes: string;
};
type Declaration = {
  id: number; reference: string; code: string; name: string; period_code: string;
  due_date: string | null; base_amount: string; declared_amount: string;
  paid_amount: string; remaining_amount: string; status: string; en_retard: boolean;
};

const CATEGORIES: Record<string, string> = {
  impot: "Impôt", cotisation: "Cotisation", retenue: "Retenue",
  declaration: "Déclaration", taxe_locale: "Taxe locale",
};
const STATUTS: Record<string, { texte: string; classe: string }> = {
  ESTIMEE:             { texte: "Estimée",              classe: "bg-slate-200 text-slate-700" },
  DECLAREE:            { texte: "Déclarée, à payer",    classe: "bg-amber-100 text-amber-900" },
  PARTIELLEMENT_PAYEE: { texte: "Partiellement payée",  classe: "bg-blue-100 text-blue-900" },
  PAYEE:               { texte: "Payée",                classe: "bg-emerald-600 text-white" },
  EN_RETARD:           { texte: "En retard",            classe: "bg-red-100 text-red-900" },
  EXONEREE:            { texte: "Exonérée",             classe: "bg-slate-200 text-slate-700" },
  CONTESTEE:           { texte: "Contestée",            classe: "bg-amber-100 text-amber-900" },
  ANNULEE:             { texte: "Annulée",              classe: "bg-slate-200 text-slate-600" },
};

const fcfa = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—"
    : `${Math.round(Number(v)).toLocaleString("fr-FR")} FCFA`;

export default function FiscalitePage() {
  const { can } = usePermissions();
  const peutConfigurer = can("fiscalite", "configure");
  const peutValider = can("fiscalite", "validate");
  const peutDeclarer = can("fiscalite", "create");
  const peutPayer = can("fiscalite", "pay");

  const [catalogue, setCatalogue] = useState<Type[]>([]);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [regles, setRegles] = useState<Regle[]>([]);
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [calendrier, setCalendrier] = useState<any>({ echeances: [], penalite: "" });
  const [profil, setProfil] = useState<any>(null);
  const [comptes, setComptes] = useState<{ banques: any[]; caisses: any[] }>({ banques: [], caisses: [] });
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(async () => {
    const [rc, rr, rd, rcal, rp, rb, rk] = await Promise.all([
      authFetch("/fiscalite/catalogue", { cache: "no-store" }),
      authFetch("/fiscalite/regles", { cache: "no-store" }),
      authFetch("/fiscalite/declarations", { cache: "no-store" }),
      authFetch("/fiscalite/calendrier", { cache: "no-store" }),
      authFetch("/fiscalite/profil", { cache: "no-store" }),
      authFetch("/accounting/banks", { cache: "no-store" }).catch(() => null),
      authFetch("/caisses", { cache: "no-store" }).catch(() => null),
    ]);
    const dc = await rc.json().catch(() => ({}));
    if (!rc.ok) { setErreur(dc.error || "Impossible de charger la fiscalité."); return; }
    setCatalogue(Array.isArray(dc.catalogue) ? dc.catalogue : []);
    setAvertissement(dc.avertissement || null);
    const dr = await rr.json().catch(() => ({})); setRegles(Array.isArray(dr.regles) ? dr.regles : []);
    const dd = await rd.json().catch(() => ({})); setDeclarations(Array.isArray(dd.declarations) ? dd.declarations : []);
    setCalendrier(await rcal.json().catch(() => ({ echeances: [] })));
    setProfil(await rp.json().catch(() => null));
    const banques = rb && rb.ok ? await rb.json().catch(() => []) : [];
    const caisses = rk && rk.ok ? await rk.json().catch(() => []) : [];
    setComptes({
      banques: Array.isArray(banques) ? banques : (banques?.banks || banques?.banques || []),
      caisses: Array.isArray(caisses) ? caisses : (caisses?.caisses || []),
    });
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const agir = async (chemin: string, corps?: unknown, methode = "POST") => {
    setOccupe(true); setMessage(""); setErreur("");
    try {
      const r = await authFetch(chemin, {
        method: methode, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps ?? {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || "Opération refusée."); return null; }
      setMessage(d.message || d.avertissement || "Enregistré.");
      await charger();
      return d;
    } finally { setOccupe(false); }
  };

  const choisirCompte = (): { caisse_id?: number; bank_id?: number } | null => {
    const { banques, caisses } = comptes;
    const choix = window.prompt("Depuis quel compte ? Tapez « caisse » ou « banque » :",
      banques.length ? "banque" : "caisse");
    if (!choix) return null;
    const parCaisse = /caisse/i.test(choix);
    const liste = parCaisse ? caisses : banques;
    if (!liste.length) { setErreur(parCaisse ? "Aucune caisse ouverte." : "Aucune banque enregistrée."); return null; }
    const nomDe = (c: any) => c.nom_caisse || c.bank_name || `#${c.id}`;
    const rang = Number(window.prompt(liste.map((c: any, i: number) => `${i + 1}. ${nomDe(c)}`).join("\n"), "1"));
    const compte = liste[rang - 1];
    if (!compte) return null;
    return parCaisse ? { caisse_id: compte.id } : { bank_id: compte.id };
  };

  const actives = catalogue.filter((t) => t.obligation_active);
  const verifiees = regles.filter((r) => r.verification_status === "VERIFIEE").length;

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header>
          <h1 className="text-3xl font-black md:text-4xl">Fiscalité et cotisations</h1>
          <p className="mt-2 text-slate-600">
            Aucun taux n’est appliqué tant qu’une personne ne l’a pas vérifié dans le texte
            officiel et validé ici.
          </p>
        </header>

        {(message || erreur) && (
          <div className={`mt-5 rounded-xl p-4 font-bold ${
            erreur ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
            {erreur || message}
          </div>
        )}

        {/* ── CE QUE LE LOGICIEL NE SAIT PAS, EN PREMIER ── */}
        {avertissement && (
          <div className="mt-5 rounded-2xl border-2 border-amber-400 bg-amber-50 p-5">
            <p className="text-lg font-black text-amber-900">Aucun taux vérifié</p>
            <p className="mt-1 text-amber-900">{avertissement}</p>
            <p className="mt-2 text-sm text-amber-800">
              Sources à consulter : Direction générale des impôts du Mali, Code général des
              impôts, loi de finances en vigueur, INPS pour les cotisations sociales.
            </p>
          </div>
        )}

        {profil && !profil.configure && (
          <div className="mt-5 rounded-2xl border-2 border-slate-300 bg-white p-5">
            <p className="text-lg font-black">Profil fiscal non configuré</p>
            <p className="mt-1 text-slate-700">{profil.message}</p>
            {peutConfigurer && (
              <button disabled={occupe} onClick={async () => {
                const regime = window.prompt(
                  "Régime fiscal de l'entreprise :\n\nREEL_NORMAL, REEL_SIMPLIFIE ou SYNTHETIQUE",
                  "REEL_NORMAL");
                if (!regime) return;
                const activite = window.prompt("Activité principale :") ?? "";
                const tva = window.confirm("L'entreprise est-elle assujettie à la TVA ?");
                await agir("/fiscalite/profil",
                  { regime: regime.trim().toUpperCase(), activity: activite, vat_liable: tva }, "PUT");
              }}
                className="mt-3 min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white disabled:opacity-40">
                Configurer le profil fiscal
              </button>
            )}
          </div>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Chiffre libelle="Obligations actives" valeur={String(actives.length)} />
          <Chiffre libelle="Règles vérifiées" valeur={`${verifiees} / ${regles.length}`} />
          <Chiffre libelle="Échéances à venir" valeur={String(calendrier.echeances?.filter((e: any) => !e.en_retard).length || 0)} />
          <Chiffre libelle="En retard" valeur={String(calendrier.en_retard || 0)} fort={Boolean(calendrier.en_retard)} />
        </section>

        {/* ── LE CALENDRIER ── */}
        {(calendrier.echeances || []).length > 0 && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Échéances</h2>
            <div className="mt-3 grid gap-2">
              {calendrier.echeances.map((e: any) => (
                <div key={e.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 ${
                  e.en_retard ? "bg-red-100" : e.rappel ? "bg-amber-100" : "bg-slate-100"}`}>
                  <div>
                    <p className="font-black">{e.name} — {e.period_code}</p>
                    <p className="text-sm text-slate-600">
                      {e.reference} · échéance {String(e.due_date).slice(0, 10)}
                      {e.rappel ? ` · rappel ${e.rappel}` : ""}
                      {e.en_retard ? ` · ${Math.abs(Number(e.jours_restants))} jour(s) de retard` : ""}
                    </p>
                  </div>
                  <span className="font-black">{fcfa(e.remaining_amount)}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-500">{calendrier.penalite}</p>
          </section>
        )}

        {/* ── LES OBLIGATIONS ── */}
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">Obligations de l’entreprise</h2>
          <p className="mt-1 text-sm text-slate-600">
            Rien n’est actif par défaut : une obligation ne devient suivie que si quelqu’un
            l’active pour cette entreprise.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {catalogue.map((t) => (
              <div key={t.id} className={`rounded-xl border-2 p-4 ${
                t.obligation_active ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-black">{t.code} — {t.name}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {CATEGORIES[t.category] || t.category} · {t.authority}
                    </p>
                  </div>
                  {peutConfigurer && (
                    <button disabled={occupe}
                      onClick={() => agir("/fiscalite/obligations", { code: t.code, active: !t.obligation_active })}
                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black disabled:opacity-40 ${
                        t.obligation_active ? "bg-slate-200" : "bg-slate-900 text-white"}`}>
                      {t.obligation_active ? "Désactiver" : "Activer"}
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-700">{t.explanation}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Base : {t.base_label} · {t.frequency.toLowerCase()}
                </p>
                <p className={`mt-1 text-xs font-bold ${
                  t.regles_verifiees > 0 ? "text-emerald-700" : "text-amber-700"}`}>
                  {t.regles_verifiees > 0
                    ? `${t.regles_verifiees} règle(s) vérifiée(s)`
                    : "Aucun taux vérifié — montant à saisir à la main"}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── LES RÈGLES ── */}
        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <h2 className="text-xl font-black">Règles de calcul</h2>
            {peutConfigurer && (
              <button disabled={occupe} onClick={async () => {
                const code = window.prompt("Code de l'obligation (TVA, ITS, CFE…) :") ?? "";
                if (!code.trim()) return;
                const taux = window.prompt("Taux en pourcentage (laisser vide pour un montant fixe) :") ?? "";
                const fixe = taux.trim() ? "" : (window.prompt("Montant fixe :") ?? "");
                const depuis = window.prompt("Applicable à partir du (AAAA-MM-JJ) :",
                  `${new Date().getFullYear()}-01-01`) ?? "";
                if (!depuis.trim()) return;
                await agir("/fiscalite/regles", {
                  code: code.trim().toUpperCase(),
                  rate_percent: taux.trim() ? Number(taux) : null,
                  fixed_amount: fixe.trim() ? Number(fixe) : null,
                  effective_from: depuis.trim(),
                  source_reference: window.prompt("Référence du texte (facultative à ce stade) :") ?? "",
                });
              }}
                className="min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white disabled:opacity-40">
                Ajouter une règle
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="p-3">Obligation</th><th className="p-3">Valeur</th>
                  <th className="p-3">Période</th><th className="p-3">Source</th>
                  <th className="p-3">État</th><th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {regles.map((r) => {
                  const verifiee = r.verification_status === "VERIFIEE";
                  return (
                    <tr key={r.id} className="border-t align-top">
                      <td className="p-3"><span className="font-bold">{r.code}</span>
                        <span className="block text-xs text-slate-500">{r.name}</span></td>
                      <td className="p-3 font-black">
                        {r.rate_percent != null ? `${Number(r.rate_percent)} %`
                          : r.fixed_amount != null ? fcfa(r.fixed_amount) : "—"}
                      </td>
                      <td className="p-3 text-sm">
                        depuis {String(r.effective_from).slice(0, 10)}
                        {r.effective_to ? ` jusqu'au ${String(r.effective_to).slice(0, 10)}` : ""}
                      </td>
                      <td className="p-3 text-sm">
                        {r.source_reference || <span className="text-amber-700">non renseignée</span>}
                        {r.source_url && (
                          <a href={r.source_url} target="_blank" rel="noreferrer"
                            className="block truncate text-xs text-blue-700 underline">{r.source_url}</a>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`rounded-lg px-2 py-1 text-xs font-black ${
                          verifiee ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                          {verifiee ? "Vérifiée" : "À vérifier"}
                        </span>
                        {verifiee && r.verified_at && (
                          <span className="mt-1 block text-xs text-slate-500">
                            le {String(r.verified_at).slice(0, 10)} par {r.verifiee_par || "—"}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {peutValider && !verifiee && (
                          <button disabled={occupe} onClick={async () => {
                            const reference = window.prompt(
                              "Référence du texte officiel (obligatoire) :\n\n" +
                              "Ex. « Loi de finances 2026, article 12 » ou « CGI, article 145 »") ?? "";
                            if (reference.trim().length < 5) return;
                            const url = window.prompt("Lien vers la source (facultatif) :") ?? "";
                            await agir(`/fiscalite/regles/${r.id}/verifier`,
                              { source_reference: reference.trim(), source_url: url.trim() });
                          }}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">
                            Marquer vérifiée
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {regles.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-500">
                    Aucune règle enregistrée. Les montants devront être saisis à la main.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── LES DÉCLARATIONS ── */}
        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div>
              <h2 className="text-xl font-black">Déclarations</h2>
              <p className="mt-1 text-sm text-slate-600">
                Déclarer crée une dette. La trésorerie ne bouge qu’au paiement.
              </p>
            </div>
            {peutDeclarer && actives.length > 0 && (
              <button disabled={occupe} onClick={async () => {
                const code = window.prompt(
                  `Quelle obligation ?\n\n${actives.map((t) => `${t.code} — ${t.name}`).join("\n")}`) ?? "";
                if (!code.trim()) return;
                const periode = window.prompt("Période (AAAA-MM ou AAAA) :",
                  new Date().toISOString().slice(0, 7)) ?? "";
                if (!periode.trim()) return;
                const base = window.prompt("Base de calcul (montant sur lequel porte l'impôt) :", "0") ?? "0";
                const montant = window.prompt(
                  "Montant à déclarer.\n\n" +
                  "Laissez vide si une règle vérifiée doit le calculer.") ?? "";
                await agir("/fiscalite/declarations", {
                  code: code.trim().toUpperCase(), period_code: periode.trim(),
                  base_amount: Number(base) || 0,
                  declared_amount: montant.trim() ? Number(montant) : undefined,
                });
              }}
                className="min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white disabled:opacity-40">
                Déclarer
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="p-3">Référence</th><th className="p-3">Obligation</th>
                  <th className="p-3">Période</th><th className="p-3">Déclaré</th>
                  <th className="p-3">Payé</th><th className="p-3">Reste</th>
                  <th className="p-3">État</th><th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {declarations.map((d) => {
                  const s = STATUTS[d.status] || { texte: d.status, classe: "bg-slate-200" };
                  return (
                    <tr key={d.id} className={`border-t align-top ${d.en_retard ? "bg-red-50" : ""}`}>
                      <td className="p-3 font-mono text-sm">{d.reference}</td>
                      <td className="p-3"><span className="font-bold">{d.code}</span>
                        <span className="block text-xs text-slate-500">{d.name}</span></td>
                      <td className="p-3 text-sm">{d.period_code}</td>
                      <td className="p-3 font-bold">{fcfa(d.declared_amount)}</td>
                      <td className="p-3">{fcfa(d.paid_amount)}</td>
                      <td className="p-3 font-black">{fcfa(d.remaining_amount)}</td>
                      <td className="p-3">
                        <span className={`rounded-lg px-2 py-1 text-xs font-black ${s.classe}`}>{s.texte}</span>
                        {d.en_retard && (
                          <span className="mt-1 block text-xs font-bold text-red-700">en retard</span>
                        )}
                      </td>
                      <td className="p-3">
                        {peutPayer && Number(d.remaining_amount) > 0 && (
                          <button disabled={occupe} onClick={async () => {
                            const saisi = window.prompt(
                              `Paiement de ${d.name} (${d.period_code})\n` +
                              `Reste dû : ${fcfa(d.remaining_amount)}\n\nMontant payé :`,
                              String(Math.round(Number(d.remaining_amount))));
                            if (saisi === null) return;
                            const montant = Number(saisi);
                            if (!(montant > 0)) { setErreur("Montant invalide."); return; }
                            const quittance = window.prompt("Numéro de quittance (facultatif) :") ?? "";
                            const compte = choisirCompte(); if (!compte) return;
                            await agir(`/fiscalite/declarations/${d.id}/paiement`,
                              { amount: montant, receipt_number: quittance, ...compte });
                          }}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">
                            Payer
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {declarations.length === 0 && (
                  <tr><td colSpan={8} className="p-6 text-center text-slate-500">
                    Aucune déclaration.
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

function Chiffre({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm ${fort ? "bg-red-600 text-white" : "bg-white"}`}>
      <p className={`text-sm ${fort ? "text-red-100" : "text-slate-500"}`}>{libelle}</p>
      <p className="mt-1 text-2xl font-black">{valeur}</p>
    </div>
  );
}
