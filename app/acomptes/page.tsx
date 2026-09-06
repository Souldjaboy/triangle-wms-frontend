"use client";

/**
 * ACOMPTES ET DÉPÔTS CLIENTS.
 *
 * L'écran sépare visuellement deux gestes qu'on confond tout le temps :
 *
 *   • ENREGISTRER UN VERSEMENT — l'argent entre en banque, une fois ;
 *   • IMPUTER SUR UNE FACTURE — aucun argent ne bouge, on solde une avance
 *     contre une créance.
 *
 * Le second est présenté comme une affectation, jamais comme un encaissement,
 * et l'écran le dit en toutes lettres. C'est l'erreur qui double un chiffre
 * d'affaires sans que le solde bancaire ne la contredise.
 */

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../lib/api";
import { usePermissions } from "../lib/permissions";

type Depot = {
  id: number; reference: string; activity: string; customer_id: number; customer_name: string;
  amount: string; available_amount: string; used_amount: string;
  business_date: string; status: string; payment_method: string; external_reference: string;
};
type LigneEtat = { date: string; libelle: string; depot: number; utilisation: number; solde: number };

const STATUTS: Record<string, { texte: string; classe: string }> = {
  ACTIF:  { texte: "Disponible", classe: "bg-emerald-100 text-emerald-900" },
  EPUISE: { texte: "Épuisé",     classe: "bg-slate-200 text-slate-700" },
  ANNULE: { texte: "Annulé",     classe: "bg-red-100 text-red-900" },
};

const fcfa = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—"
    : `${Math.round(Number(v)).toLocaleString("fr-FR")} FCFA`;

export default function AcomptesPage() {
  const { can } = usePermissions();
  const peutCreer = can("acompte_client", "create");
  const peutImputer = can("acompte_client", "update");
  const peutAnnuler = can("acompte_client", "cancel");
  const peutImprimer = can("acompte_client", "print");

  const [activite, setActivite] = useState<"sable" | "ciment">("sable");
  const [depots, setDepots] = useState<Depot[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [comptes, setComptes] = useState<{ banques: any[]; caisses: any[] }>({ banques: [], caisses: [] });
  const [situation, setSituation] = useState<any>(null);
  const [etat, setEtat] = useState<{ depot: any; lignes: LigneEtat[]; coherent: boolean } | null>(null);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  const [nouveau, setNouveau] = useState({ client_id: "", amount: "", payment_method: "VIREMENT", external_reference: "", notes: "" });

  const charger = useCallback(async () => {
    const [rd, rc, rb, rk] = await Promise.all([
      authFetch(`/acomptes?activite=${activite}`, { cache: "no-store" }),
      authFetch(activite === "sable" ? "/sand/customers" : "/cement/customers", { cache: "no-store" }).catch(() => null),
      authFetch("/accounting/banks", { cache: "no-store" }).catch(() => null),
      authFetch("/caisses", { cache: "no-store" }).catch(() => null),
    ]);
    const dd = await rd.json().catch(() => ({}));
    if (!rd.ok) { setErreur(dd.error || "Impossible de charger les acomptes."); return; }
    setDepots(Array.isArray(dd.acomptes) ? dd.acomptes : []);

    const dc = rc && rc.ok ? await rc.json().catch(() => []) : [];
    setClients(Array.isArray(dc) ? dc : (dc?.customers || dc?.clients || []));
    const banques = rb && rb.ok ? await rb.json().catch(() => []) : [];
    const caisses = rk && rk.ok ? await rk.json().catch(() => []) : [];
    setComptes({
      banques: Array.isArray(banques) ? banques : (banques?.banks || banques?.banques || []),
      caisses: Array.isArray(caisses) ? caisses : (caisses?.caisses || []),
    });
  }, [activite]);

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
      return d;
    } finally { setOccupe(false); }
  };

  const choisirCompte = (): { caisse_id?: number; bank_id?: number } | null => {
    const { banques, caisses } = comptes;
    const choix = window.prompt("Sur quel compte ? Tapez « caisse » ou « banque » :",
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

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    const montant = Number(nouveau.amount);
    if (!nouveau.client_id || !(montant > 0)) { setErreur("Client et montant sont obligatoires."); return; }
    const compte = choisirCompte(); if (!compte) return;
    await agir("/acomptes", {
      activite, client_id: Number(nouveau.client_id), amount: montant,
      payment_method: nouveau.payment_method, external_reference: nouveau.external_reference,
      notes: nouveau.notes, ...compte,
    });
    setNouveau({ client_id: "", amount: "", payment_method: "VIREMENT", external_reference: "", notes: "" });
  };

  const voirSituation = async (clientId: number) => {
    const r = await authFetch(`/acomptes/client/${activite}/${clientId}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErreur(d.error || "Situation illisible."); return; }
    setSituation(d);
  };

  const voirEtat = async (depotId: number) => {
    const r = await authFetch(`/acomptes/${depotId}/etat`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErreur(d.error || "État illisible."); return; }
    setEtat(d);
  };

  const imputer = async (factureId: number, numero: string) => {
    const saisi = window.prompt(
      `Imputer un acompte sur la facture ${numero}.\n\n` +
      `Aucun argent ne sera encaissé : l'argent est déjà entré au moment du dépôt.\n\n` +
      `Montant à imputer (vide = tout ce qui reste dû) :`);
    if (saisi === null) return;
    const montant = saisi.trim() ? Number(saisi) : undefined;
    if (saisi.trim() && !(Number(montant) > 0)) { setErreur("Montant invalide."); return; }
    const d = await agir("/acomptes/affectation", { activite, invoice_id: factureId, amount: montant });
    if (d && situation) await voirSituation(situation.client_id);
  };

  const totalDisponible = depots.reduce((t, d) => t + Number(d.available_amount || 0), 0);

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 md:p-8">
      <style>{`@media print {
        body { background:#fff }
        .sans-impression { display:none !important }
        .a-imprimer { position:fixed; inset:0; margin:0; padding:24px }
      }`}</style>

      <div className="mx-auto max-w-7xl">
        <header className="sans-impression">
          <h1 className="text-3xl font-black md:text-4xl">Acomptes clients</h1>
          <p className="mt-2 text-slate-600">
            L’argent entre une seule fois, au versement. L’affecter à une facture ne fait
            entrer aucun argent : cela réduit le dépôt et solde la facture.
          </p>
        </header>

        {(message || erreur) && (
          <div className={`sans-impression mt-5 rounded-xl p-4 font-bold ${
            erreur ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
            {erreur || message}
          </div>
        )}

        <section className="sans-impression mt-6 flex flex-wrap items-center gap-3">
          {(["sable", "ciment"] as const).map((a) => (
            <button key={a} onClick={() => { setActivite(a); setSituation(null); setEtat(null); }}
              className={`min-h-12 rounded-xl px-5 font-black ${
                activite === a ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}>
              {a === "sable" ? "Sable" : "Ciment"}
            </button>
          ))}
          <span className="ml-auto rounded-xl bg-white px-4 py-3 font-black shadow-sm">
            Dépôt disponible : {fcfa(totalDisponible)}
          </span>
        </section>

        {peutCreer && (
          <section className="sans-impression mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Enregistrer un versement</h2>
            <p className="mt-1 text-sm text-slate-600">
              L’argent reçu augmente le compte choisi, et devient un crédit du client.
            </p>
            <form onSubmit={enregistrer} className="mt-4 grid gap-3 md:grid-cols-5">
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-bold">Client</span>
                <select className="min-h-12 w-full rounded-xl border p-3" value={nouveau.client_id}
                  onChange={(e) => setNouveau({ ...nouveau, client_id: e.target.value })}>
                  <option value="">Choisir…</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Montant reçu</span>
                <input type="number" min={1} className="min-h-12 w-full rounded-xl border p-3"
                  value={nouveau.amount} onChange={(e) => setNouveau({ ...nouveau, amount: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Mode</span>
                <select className="min-h-12 w-full rounded-xl border p-3" value={nouveau.payment_method}
                  onChange={(e) => setNouveau({ ...nouveau, payment_method: e.target.value })}>
                  <option>VIREMENT</option><option>ESPECES</option>
                  <option>CHEQUE</option><option>MOBILE_MONEY</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Référence</span>
                <input className="min-h-12 w-full rounded-xl border p-3" value={nouveau.external_reference}
                  onChange={(e) => setNouveau({ ...nouveau, external_reference: e.target.value })} />
              </label>
              <button type="submit" disabled={occupe}
                className="min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white disabled:opacity-40 md:col-span-5 md:w-auto md:justify-self-start">
                Enregistrer le versement
              </button>
            </form>
          </section>
        )}

        {/* ── L'ÉTAT DU DÉPÔT, IMPRIMABLE ── */}
        {etat && (
          <section className="a-imprimer mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{etat.depot.societe}</p>
                <h2 className="text-2xl font-black">État du dépôt {etat.depot.reference}</h2>
                <p className="text-slate-600">
                  {etat.depot.client} · {etat.depot.activite} · reçu le {etat.depot.date}
                </p>
              </div>
              <button onClick={() => setEtat(null)}
                className="sans-impression min-h-10 rounded-xl bg-slate-200 px-4 font-black">Fermer</button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <Chiffre libelle="Dépôt initial" valeur={fcfa(etat.depot.montant_initial)} />
              <Chiffre libelle="Total utilisé" valeur={fcfa(etat.depot.total_utilise)} />
              <Chiffre libelle="Solde restant" valeur={fcfa(etat.depot.solde)} fort />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr><th className="p-2">Date</th><th className="p-2">Description</th>
                    <th className="p-2 text-right">Dépôt +</th>
                    <th className="p-2 text-right">Utilisation −</th>
                    <th className="p-2 text-right">Solde</th></tr>
                </thead>
                <tbody>
                  {etat.lignes.map((l, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{String(l.date).slice(0, 10)}</td>
                      <td className="p-2">{l.libelle}</td>
                      <td className="p-2 text-right">{l.depot ? fcfa(l.depot) : ""}</td>
                      <td className="p-2 text-right">{l.utilisation ? fcfa(l.utilisation) : ""}</td>
                      <td className="p-2 text-right font-bold">{fcfa(l.solde)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!etat.coherent && (
              <p className="mt-3 rounded-xl bg-red-100 p-3 font-bold text-red-800">
                Le solde du détail ne correspond pas à celui de la fiche. Signalez-le avant
                d’utiliser cet état.
              </p>
            )}

            {peutImprimer && (
              <button onClick={() => window.print()}
                className="sans-impression mt-4 min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white">
                Imprimer cet état
              </button>
            )}
          </section>
        )}

        {/* ── LA SITUATION D'UN CLIENT ── */}
        {situation && (
          <section className="sans-impression mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-xl font-black">Situation du compte client</h2>
              <button onClick={() => setSituation(null)}
                className="min-h-10 rounded-xl bg-slate-200 px-4 font-black">Fermer</button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Chiffre libelle="Total déposé" valeur={fcfa(situation.total_depose)} />
              <Chiffre libelle="Argent utilisé" valeur={fcfa(situation.total_utilise)} />
              <Chiffre libelle="Dépôt disponible" valeur={fcfa(situation.total_disponible)} fort />
              <Chiffre libelle="Factures impayées" valeur={fcfa(situation.total_impaye)} />
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr><th className="p-2">Facture</th><th className="p-2">Date</th>
                    <th className="p-2">Total</th><th className="p-2">Payé</th>
                    <th className="p-2">Reste</th><th className="p-2">État</th><th className="p-2">Action</th></tr>
                </thead>
                <tbody>
                  {(situation.factures || []).map((f: any) => (
                    <tr key={f.id} className="border-t">
                      <td className="p-2 font-bold">{f.invoice_number}</td>
                      <td className="p-2">{String(f.invoice_date).slice(0, 10)}</td>
                      <td className="p-2">{fcfa(f.total_amount)}</td>
                      <td className="p-2">{fcfa(f.paid_amount)}</td>
                      <td className="p-2 font-bold">{fcfa(f.remaining_amount)}</td>
                      <td className="p-2">{f.status}</td>
                      <td className="p-2">
                        {peutImputer && Number(f.remaining_amount) > 0 && Number(situation.total_disponible) > 0 && (
                          <button disabled={occupe} onClick={() => imputer(f.id, f.invoice_number)}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40">
                            Affecter un acompte
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── LES DÉPÔTS ── */}
        <section className="sans-impression mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b p-5"><h2 className="text-xl font-black">Dépôts ({depots.length})</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="p-3">Référence</th><th className="p-3">Client</th>
                  <th className="p-3">Date</th><th className="p-3">Versé</th>
                  <th className="p-3">Utilisé</th><th className="p-3">Disponible</th>
                  <th className="p-3">État</th><th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {depots.map((d) => {
                  const s = STATUTS[d.status] || { texte: d.status, classe: "bg-slate-200" };
                  return (
                    <tr key={d.id} className="border-t align-top">
                      <td className="p-3 font-mono text-sm">{d.reference}</td>
                      <td className="p-3 font-bold">{d.customer_name}</td>
                      <td className="p-3 text-sm">{String(d.business_date).slice(0, 10)}</td>
                      <td className="p-3">{fcfa(d.amount)}</td>
                      <td className="p-3">{fcfa(d.used_amount)}</td>
                      <td className="p-3 font-black">{fcfa(d.available_amount)}</td>
                      <td className="p-3">
                        <span className={`rounded-lg px-2 py-1 text-xs font-black ${s.classe}`}>{s.texte}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => voirSituation(d.customer_id)}
                            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-black text-white">
                            Compte client
                          </button>
                          {peutImprimer && (
                            <button onClick={() => voirEtat(d.id)}
                              className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-black">
                              État du dépôt
                            </button>
                          )}
                          {peutAnnuler && Number(d.available_amount) > 0 && (
                            <button disabled={occupe} onClick={async () => {
                              const saisi = window.prompt(
                                `Rembourser ${d.customer_name}\nDisponible : ${fcfa(d.available_amount)}\n\nMontant :`);
                              if (saisi === null) return;
                              const montant = Number(saisi);
                              if (!(montant > 0)) { setErreur("Montant invalide."); return; }
                              const motif = window.prompt("Motif du remboursement (obligatoire) :") ?? "";
                              if (motif.trim().length < 5) return;
                              const compte = choisirCompte(); if (!compte) return;
                              await agir(`/acomptes/${d.id}/remboursement`,
                                { amount: montant, reason: motif.trim(), ...compte });
                            }}
                              className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-black text-black disabled:opacity-40">
                              Rembourser
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {depots.length === 0 && (
                  <tr><td colSpan={8} className="p-6 text-center text-slate-500">
                    Aucun dépôt enregistré pour cette activité.
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
    <div className={`rounded-2xl p-4 ${fort ? "bg-slate-900 text-white" : "bg-slate-100"}`}>
      <p className={`text-sm ${fort ? "text-slate-300" : "text-slate-500"}`}>{libelle}</p>
      <p className="mt-1 text-lg font-black">{valeur}</p>
    </div>
  );
}
