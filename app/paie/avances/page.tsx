"use client";

/**
 * AVANCES SUR SALAIRE.
 *
 * L'écran met le SOLDE au premier plan, jamais le montant initial : c'est le
 * solde qui décide de ce qu'on peut encore retenir ou rembourser. Une avance
 * de 25 000 déjà remboursée de 20 000 n'affiche pas « 25 000 » en gros, elle
 * affiche « reste 5 000 ».
 *
 * Les termes sont ceux de la conversation : Argent versé, Reste à rembourser,
 * En attente du directeur.
 */

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";

type Avance = {
  id: number; reference: string; status: string;
  amount_requested: string; amount_authorized: string | null;
  amount_paid: string; balance: string; installment_amount: string;
  first_period_code: string; reason: string;
  employee_id: number; full_name: string; employee_number: number;
};
type Echeance = { rank: number; period_code: string; amount_due: string; amount_taken: string; status: string };
type Mouvement = {
  id: number; amount: string; origin: string; balance_before: string; balance_after: string;
  reference: string; reason: string; performed_by_name: string; created_at: string;
  reverses_repayment_id: number | null;
};

const STATUTS: Record<string, { texte: string; classe: string }> = {
  BROUILLON:        { texte: "Brouillon",                classe: "bg-slate-200 text-slate-800" },
  DEMANDEE:         { texte: "En attente du directeur",  classe: "bg-amber-100 text-amber-900" },
  VALIDEE:          { texte: "Validée, à verser",        classe: "bg-blue-100 text-blue-900" },
  REFUSEE:          { texte: "Refusée",                  classe: "bg-red-100 text-red-900" },
  VERSEE:           { texte: "Versée",                   classe: "bg-emerald-100 text-emerald-900" },
  EN_REMBOURSEMENT: { texte: "En remboursement",         classe: "bg-blue-100 text-blue-900" },
  REMBOURSEE:       { texte: "Remboursée",               classe: "bg-emerald-600 text-white" },
  ANNULEE:          { texte: "Annulée",                  classe: "bg-slate-200 text-slate-600" },
};

const ORIGINES: Record<string, string> = {
  RETENUE_PAIE: "Retenue sur paie",
  VERSEMENT_DIRECT: "Versement au comptoir",
  CONTREPASSATION: "Contrepassation",
};

const fcfa = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—"
    : `${Math.round(Number(v)).toLocaleString("fr-FR")} FCFA`;

export default function AvancesPage() {
  const { can } = usePermissions();
  const peutCreer = can("paie.avance", "create");
  const peutValider = can("paie.avance", "validate");
  const peutPayer = can("paie.avance", "pay");
  const peutModifier = can("paie.avance", "update");
  const peutAnnuler = can("paie.avance", "cancel");

  const [avances, setAvances] = useState<Avance[]>([]);
  const [employes, setEmployes] = useState<any[]>([]);
  const [comptes, setComptes] = useState<{ banques: any[]; caisses: any[] }>({ banques: [], caisses: [] });
  const [fiche, setFiche] = useState<{ avance: Avance; echeancier: Echeance[]; mouvements: Mouvement[] } | null>(null);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  const [nouvelle, setNouvelle] = useState({ employee_id: "", amount_requested: "", installment_amount: "", reason: "" });

  const charger = useCallback(async () => {
    const [ra, re, rb, rc] = await Promise.all([
      authFetch("/avances", { cache: "no-store" }),
      authFetch("/attendance-v2/employees", { cache: "no-store" }),
      authFetch("/accounting/banks", { cache: "no-store" }).catch(() => null),
      authFetch("/caisses", { cache: "no-store" }).catch(() => null),
    ]);
    const da = await ra.json().catch(() => ({}));
    if (!ra.ok) { setErreur(da.error || "Impossible de charger les avances."); return; }
    setAvances(Array.isArray(da.avances) ? da.avances : []);
    const de = await re.json().catch(() => ({}));
    setEmployes(Array.isArray(de.employees) ? de.employees : []);
    const banques = rb && rb.ok ? await rb.json().catch(() => []) : [];
    const caisses = rc && rc.ok ? await rc.json().catch(() => []) : [];
    setComptes({
      banques: Array.isArray(banques) ? banques : (banques?.banks || banques?.banques || []),
      caisses: Array.isArray(caisses) ? caisses : (caisses?.caisses || []),
    });
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const agir = async (chemin: string, corps?: unknown) => {
    setOccupe(true); setMessage(""); setErreur("");
    try {
      const r = await authFetch(chemin, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps ?? {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || "Opération refusée."); return null; }
      setMessage(d.message || "Enregistré.");
      await charger();
      if (fiche) await ouvrirFiche(fiche.avance.id);
      return d;
    } finally { setOccupe(false); }
  };

  const ouvrirFiche = async (id: number) => {
    const r = await authFetch(`/avances/${id}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErreur(d.error || "Avance illisible."); return; }
    setFiche({ avance: d.avance, echeancier: d.echeancier || [], mouvements: d.mouvements || [] });
  };

  /** Choisir un compte financier, en toutes lettres. */
  const choisirCompte = (): { caisse_id?: number; bank_id?: number } | null => {
    const { banques, caisses } = comptes;
    const choix = window.prompt("Depuis quel compte ? Tapez « caisse » ou « banque » :",
      caisses.length ? "caisse" : "banque");
    if (!choix) return null;
    const parCaisse = /caisse/i.test(choix);
    const liste = parCaisse ? caisses : banques;
    if (!liste.length) { setErreur(parCaisse ? "Aucune caisse ouverte." : "Aucune banque enregistrée."); return null; }
    const nomDe = (c: any) => c.nom_caisse || c.bank_name || `#${c.id}`;
    const rang = Number(window.prompt(
      liste.map((c: any, i: number) => `${i + 1}. ${nomDe(c)}`).join("\n"), "1"));
    const compte = liste[rang - 1];
    if (!compte) return null;
    return parCaisse ? { caisse_id: compte.id } : { bank_id: compte.id };
  };

  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    const montant = Number(nouvelle.amount_requested);
    if (!nouvelle.employee_id || !(montant > 0)) { setErreur("Employé et montant sont obligatoires."); return; }
    const d = new Date();
    await agir("/avances", {
      employee_id: Number(nouvelle.employee_id),
      amount_requested: montant,
      installment_amount: Number(nouvelle.installment_amount || 0),
      first_period_code: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      reason: nouvelle.reason,
    });
    setNouvelle({ employee_id: "", amount_requested: "", installment_amount: "", reason: "" });
  };

  const totalDu = avances.reduce((t, a) => t + Number(a.balance || 0), 0);

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header>
          <h1 className="text-3xl font-black md:text-4xl">Avances sur salaire</h1>
          <p className="mt-2 text-slate-600">
            Une avance n’est pas une dépense : c’est de l’argent avancé au salarié, qu’il
            rembourse ensuite. Le solde restant décide de tout.
          </p>
        </header>

        {(message || erreur) && (
          <div className={`mt-5 rounded-xl p-4 font-bold ${
            erreur ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
            {erreur || message}
          </div>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Chiffre libelle="Avances en cours" valeur={String(avances.filter((a) => Number(a.balance) > 0).length)} />
          <Chiffre libelle="Reste à rembourser" valeur={fcfa(totalDu)} />
          <Chiffre libelle="En attente du directeur" valeur={String(avances.filter((a) => a.status === "DEMANDEE").length)} />
          <Chiffre libelle="À verser" valeur={String(avances.filter((a) => a.status === "VALIDEE").length)} />
        </section>

        {peutCreer && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Demander une avance</h2>
            <form onSubmit={creer} className="mt-4 grid gap-3 md:grid-cols-4">
              <label className="block md:col-span-1">
                <span className="mb-1 block text-sm font-bold">Employé</span>
                <select className="min-h-12 w-full rounded-xl border p-3" value={nouvelle.employee_id}
                  onChange={(e) => setNouvelle({ ...nouvelle, employee_id: e.target.value })}>
                  <option value="">Choisir…</option>
                  {employes.map((e) => (
                    <option key={e.id} value={e.id}>{e.employee_number}. {e.full_name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Montant demandé</span>
                <input type="number" min={1} className="min-h-12 w-full rounded-xl border p-3"
                  value={nouvelle.amount_requested}
                  onChange={(e) => setNouvelle({ ...nouvelle, amount_requested: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Mensualité</span>
                <input type="number" min={0} className="min-h-12 w-full rounded-xl border p-3"
                  placeholder="0 = en une fois"
                  value={nouvelle.installment_amount}
                  onChange={(e) => setNouvelle({ ...nouvelle, installment_amount: e.target.value })} />
                <span className="mt-1 block text-xs text-slate-500">
                  Laisser vide pour retenir en une seule fois.
                </span>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Motif</span>
                <input className="min-h-12 w-full rounded-xl border p-3" value={nouvelle.reason}
                  onChange={(e) => setNouvelle({ ...nouvelle, reason: e.target.value })} />
              </label>
              <button type="submit" disabled={occupe}
                className="min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white disabled:opacity-40 md:col-span-4 md:w-auto md:justify-self-start">
                Enregistrer la demande
              </button>
            </form>
          </section>
        )}

        {/* ── LA FICHE ── */}
        {fiche && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{fiche.avance.full_name}</h2>
                <p className="font-mono text-sm text-slate-500">{fiche.avance.reference}</p>
              </div>
              <button onClick={() => setFiche(null)}
                className="min-h-10 rounded-xl bg-slate-200 px-4 font-black">Fermer</button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Chiffre libelle="Argent versé" valeur={fcfa(fiche.avance.amount_paid)} />
              <Chiffre libelle="Reste à rembourser" valeur={fcfa(fiche.avance.balance)} fort />
              <Chiffre libelle="Mensualité"
                valeur={Number(fiche.avance.installment_amount) ? fcfa(fiche.avance.installment_amount) : "En une fois"} />
              <Chiffre libelle="État" valeur={(STATUTS[fiche.avance.status] || { texte: fiche.avance.status }).texte} />
            </div>

            {fiche.echeancier.length > 0 && (
              <div className="mt-5">
                <h3 className="font-black">Échéancier</h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr><th className="p-2">#</th><th className="p-2">Période</th>
                        <th className="p-2">À retenir</th><th className="p-2">Retenu</th><th className="p-2">État</th></tr>
                    </thead>
                    <tbody>
                      {fiche.echeancier.map((e) => (
                        <tr key={e.rank} className="border-t">
                          <td className="p-2">{e.rank}</td>
                          <td className="p-2">{e.period_code}</td>
                          <td className="p-2">{fcfa(e.amount_due)}</td>
                          <td className="p-2">{fcfa(e.amount_taken)}</td>
                          <td className="p-2 font-bold">
                            {e.status === "A_VENIR" ? "À venir"
                              : e.status === "RETENUE" ? "Retenue"
                              : e.status === "SUSPENDUE" ? "Suspendue" : e.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {fiche.mouvements.length > 0 && (
              <div className="mt-5">
                <h3 className="font-black">Historique des remboursements</h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr><th className="p-2">Date</th><th className="p-2">Origine</th>
                        <th className="p-2">Montant</th><th className="p-2">Solde après</th>
                        <th className="p-2">Auteur</th><th className="p-2">Action</th></tr>
                    </thead>
                    <tbody>
                      {fiche.mouvements.map((m) => (
                        <tr key={m.id} className="border-t">
                          <td className="p-2">{new Date(m.created_at).toLocaleDateString("fr-FR")}</td>
                          <td className="p-2">{ORIGINES[m.origin] || m.origin}</td>
                          <td className={`p-2 font-bold ${Number(m.amount) < 0 ? "text-amber-700" : ""}`}>
                            {fcfa(m.amount)}
                          </td>
                          <td className="p-2">{fcfa(m.balance_after)}</td>
                          <td className="p-2 text-slate-500">{m.performed_by_name}</td>
                          <td className="p-2">
                            {peutAnnuler && m.origin !== "CONTREPASSATION" && !m.reverses_repayment_id && (
                              <button disabled={occupe} onClick={async () => {
                                const motif = window.prompt("Motif de la contrepassation (obligatoire) :") ?? "";
                                if (motif.trim().length < 5) return;
                                await agir(`/avances/remboursements/${m.id}/contrepasser`, { reason: motif.trim() });
                              }}
                                className="rounded-lg bg-slate-200 px-3 py-1 text-xs font-black disabled:opacity-40">
                                Contrepasser
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── LA LISTE ── */}
        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b p-5"><h2 className="text-xl font-black">Toutes les avances</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="p-3">Employé</th><th className="p-3">Référence</th>
                  <th className="p-3">Demandé</th><th className="p-3">Versé</th>
                  <th className="p-3">Reste à rembourser</th><th className="p-3">État</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {avances.map((a) => {
                  const s = STATUTS[a.status] || { texte: a.status, classe: "bg-slate-200" };
                  return (
                    <tr key={a.id} className="border-t align-top">
                      <td className="p-3 font-bold">{a.full_name}</td>
                      <td className="p-3 font-mono text-sm">{a.reference}</td>
                      <td className="p-3">{fcfa(a.amount_requested)}</td>
                      <td className="p-3">{Number(a.amount_paid) ? fcfa(a.amount_paid) : "—"}</td>
                      <td className="p-3 font-black">{Number(a.balance) ? fcfa(a.balance) : "—"}</td>
                      <td className="p-3">
                        <span className={`rounded-lg px-2 py-1 text-xs font-black ${s.classe}`}>{s.texte}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => ouvrirFiche(a.id)}
                            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-black text-white">
                            Détail
                          </button>
                          {peutValider && a.status === "DEMANDEE" && (
                            <>
                              <button disabled={occupe} onClick={() => agir(`/avances/${a.id}/decision`, { decision: "VALIDEE" })}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">
                                Valider
                              </button>
                              <button disabled={occupe} onClick={async () => {
                                const motif = window.prompt("Motif du refus (obligatoire) :") ?? "";
                                if (motif.trim().length < 3) return;
                                await agir(`/avances/${a.id}/decision`, { decision: "REFUSEE", reason: motif.trim() });
                              }}
                                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">
                                Refuser
                              </button>
                            </>
                          )}
                          {peutPayer && a.status === "VALIDEE" && (
                            <button disabled={occupe} onClick={async () => {
                              const compte = choisirCompte(); if (!compte) return;
                              await agir(`/avances/${a.id}/versement`, compte);
                            }}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">
                              Verser
                            </button>
                          )}
                          {peutPayer && ["VERSEE", "EN_REMBOURSEMENT"].includes(a.status) && (
                            <button disabled={occupe} onClick={async () => {
                              const saisi = window.prompt(
                                `Remboursement de ${a.full_name}\nReste dû : ${fcfa(a.balance)}\n\nMontant reçu :`);
                              if (saisi === null) return;
                              const montant = Number(saisi);
                              if (!(montant > 0)) { setErreur("Montant invalide."); return; }
                              const compte = choisirCompte(); if (!compte) return;
                              await agir(`/avances/${a.id}/remboursement`, { amount: montant, ...compte });
                            }}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">
                              Encaisser un remboursement
                            </button>
                          )}
                          {peutModifier && ["VERSEE", "EN_REMBOURSEMENT"].includes(a.status) && (
                            <button disabled={occupe} onClick={async () => {
                              const saisi = window.prompt(
                                `Nouvelle mensualité pour ${a.full_name} (0 = solder en une fois) :`,
                                String(Math.round(Number(a.installment_amount || 0))));
                              if (saisi === null) return;
                              const motif = window.prompt("Motif du rééchelonnement (obligatoire) :") ?? "";
                              if (motif.trim().length < 5) return;
                              await agir(`/avances/${a.id}/reechelonner`,
                                { installment_amount: Number(saisi), reason: motif.trim() });
                            }}
                              className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-black disabled:opacity-40">
                              Rééchelonner
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {avances.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-500">Aucune avance.</td></tr>
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
    <div className={`rounded-2xl p-4 shadow-sm ${fort ? "bg-slate-900 text-white" : "bg-white"}`}>
      <p className={`text-sm ${fort ? "text-slate-300" : "text-slate-500"}`}>{libelle}</p>
      <p className="mt-1 text-xl font-black">{valeur}</p>
    </div>
  );
}
