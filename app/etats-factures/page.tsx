"use client";

/**
 * LES ÉTATS DE FACTURES.
 *
 * Deux onglets : préparer un état, consulter ceux qui existent.
 *
 * CE QUE CET ÉCRAN DOIT MONTRER SANS QU'ON LE DEMANDE.
 *
 * 1. QU'UNE FACTURE EST DÉJÀ PRISE, ET PAR QUEL ÉTAT. La faire disparaître
 *    sans explication conduit à la chercher, puis à la ressaisir. La case est
 *    donc affichée, barrée, avec le numéro de l'état qui la détient.
 *
 * 2. QUE LA REPRISE DES ÉTATS ANTÉRIEURS N'EST PAS FAITE. Tant qu'elle ne
 *    l'est pas, l'absence d'une facture de la liste ne prouve rien. Un
 *    bandeau le dit, et ne disparaît que lorsque quelqu'un l'a déclaré.
 *
 * 3. QUE VALIDER N'EST PAS ANODIN. La confirmation énonce ce qui devient
 *    impossible ensuite, au lieu de demander « Êtes-vous sûr ? ».
 *
 * L'écran ne calcule aucun total : il affiche ceux du serveur. Deux calculs
 * pour le même chiffre finissent toujours par diverger.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";
import { usePermissions } from "../lib/permissions";

type Prise = { etat_id: number; numero: string; statut: string; origine: string };
type Facture = {
  id: number; numero: string; date: string | null; echeance: string | null;
  client: string; destination: string; montant: number; paye: number;
  restant: number; statut: string; deja_sur_etat: Prise | null;
};
type Avertissement = {
  historique_complet: boolean; etats_repris: number; note: string;
  declare_par: string; declare_le: string | null; message: string;
};
type Etat = {
  id: number; statement_number: string; product: string; title: string;
  period_from: string | null; period_to: string | null; status: string;
  origin: string; historical_reference: string;
  invoices_count: number; total_invoiced: string; total_paid: string;
  total_remaining: string; notes: string;
  created_by_name: string; created_at: string;
  validated_by_name: string; validated_at: string | null;
  cancelled_by_name: string; cancelled_at: string | null; cancel_reason: string;
  replaces_statement_id: number | null; replace_reason: string;
  remplace_numero: string | null; remplace_par_numero: string | null;
  lignes_non_rapprochees: number;
  printed_count: number; last_printed_at: string | null;
};
type Ligne = {
  id: number; invoice_number: string; invoice_date: string | null;
  client_name: string; site: string; total_amount: string; paid_amount: string;
  remaining_amount: string; status_at_time: string; reconciled: boolean;
};
type Trace = {
  id: number; action: string; reason: string; acted_by_name: string; acted_at: string;
  details: Record<string, unknown>;
};

const PRODUITS = [
  { cle: "SABLE", libelle: "Sable" },
  { cle: "CIMENT", libelle: "Ciment" },
] as const;

const fdate = (d: string | null) => {
  if (!d) return "—";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d).slice(0, 10);
};
const fcfa = (v: string | number | null | undefined) =>
  `${Math.round(Number(v || 0)).toLocaleString("fr-FR")} FCFA`;

const COULEUR_STATUT: Record<string, string> = {
  BROUILLON: "bg-gray-200 text-gray-800",
  VALIDE: "bg-green-100 text-green-800",
  ANNULE: "bg-red-100 text-red-800",
  REMPLACE: "bg-amber-100 text-amber-800",
};
const LIBELLE_STATUT: Record<string, string> = {
  BROUILLON: "Brouillon", VALIDE: "Validé", ANNULE: "Annulé", REMPLACE: "Remplacé",
};
const LIBELLE_ACTION: Record<string, string> = {
  CREATION: "Créé", AJOUT_LIGNE: "Factures ajoutées", RETRAIT_LIGNE: "Facture retirée",
  VALIDATION: "Validé", IMPRESSION: "Imprimé", REIMPRESSION: "Réimprimé",
  ANNULATION: "Annulé", REMPLACEMENT: "Remplacé",
  REPRISE_HISTORIQUE: "État antérieur repris", RAPPROCHEMENT: "Lignes rapprochées",
};

export default function EtatsDeFacturesPage() {
  const { can } = usePermissions();

  /* Lu après le montage : lire localStorage ou l'heure pendant le rendu ferait
     diverger le HTML du serveur et celui du navigateur. */
  const [monte, setMonte] = useState(false);
  useEffect(() => { setMonte(true); }, []);

  const [produit, setProduit] = useState<"SABLE" | "CIMENT">("SABLE");
  const [onglet, setOnglet] = useState<"preparer" | "archives">("preparer");

  const [factures, setFactures] = useState<Facture[]>([]);
  const [avert, setAvert] = useState<Avertissement | null>(null);
  const [cochees, setCochees] = useState<Set<number>>(new Set());
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [recherche, setRecherche] = useState("");
  const [titre, setTitre] = useState("");

  const [etats, setEtats] = useState<Etat[]>([]);
  const [ouvert, setOuvert] = useState<{ etat: Etat; lignes: Ligne[]; historique: Trace[] } | null>(null);

  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [occupe, setOccupe] = useState(false);
  const [confirmation, setConfirmation] = useState<null | {
    titre: string; corps: React.ReactNode; action: string;
    motif?: { libelle: string; minimum: number };
    executer: (motif: string) => Promise<void>;
  }>(null);
  const [motifSaisi, setMotifSaisi] = useState("");

  const chargerSelection = useCallback(async () => {
    const p = new URLSearchParams({ product: produit, inclure_prises: "1" });
    if (du) p.set("du", du);
    if (au) p.set("au", au);
    if (recherche.trim()) p.set("q", recherche.trim());
    const r = await authFetch(`/invoice-statements/selection?${p.toString()}`);
    const d = await r.json().catch(() => null);
    if (r.ok && d) {
      setFactures(d.factures || []);
      setAvert(d.avertissement_historique || null);
      setErreur("");
    } else {
      setFactures([]); setAvert(null);
      setErreur(d?.error || "Sélection impossible.");
    }
  }, [produit, du, au, recherche]);

  const chargerEtats = useCallback(async () => {
    const r = await authFetch(`/invoice-statements?product=${produit}`);
    const d = await r.json().catch(() => null);
    if (r.ok && d) setEtats(d.etats || []);
    else setEtats([]);
  }, [produit]);

  const tout = useCallback(async () => {
    setChargement(true);
    await Promise.all([chargerSelection(), chargerEtats()]);
    setChargement(false);
  }, [chargerSelection, chargerEtats]);

  useEffect(() => { if (monte) tout(); }, [monte, tout]);
  useEffect(() => { setCochees(new Set()); }, [produit]);

  const libres = useMemo(() => factures.filter((f) => !f.deja_sur_etat), [factures]);
  const prises = useMemo(() => factures.filter((f) => f.deja_sur_etat), [factures]);
  const selection = useMemo(
    () => libres.filter((f) => cochees.has(f.id)), [libres, cochees]);
  const totalSelection = useMemo(
    () => selection.reduce((s, f) => s + Number(f.montant || 0), 0), [selection]);
  const restantSelection = useMemo(
    () => selection.reduce((s, f) => s + Number(f.restant || 0), 0), [selection]);

  const basculer = (id: number) => {
    setCochees((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const appel = async (chemin: string, options: RequestInit, succes: string) => {
    setOccupe(true); setErreur(""); setMessage("");
    const r = await authFetch(chemin, options);
    const d = await r.json().catch(() => ({}));
    setOccupe(false);
    if (r.ok) { setMessage(succes); await tout(); return d; }
    setErreur(d.error || "Opération impossible.");
    return null;
  };

  const creer = async () => {
    if (!selection.length) return;
    const d = await appel("/invoice-statements", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: produit, factures: selection.map((f) => f.id),
        titre: titre.trim(), du: du || null, au: au || null,
      }),
    }, `Brouillon créé avec ${selection.length} facture(s).`);
    if (d) { setCochees(new Set()); setTitre(""); setOnglet("archives"); }
  };

  const ouvrir = async (e: Etat) => {
    const r = await authFetch(`/invoice-statements/${e.id}`);
    const d = await r.json().catch(() => null);
    if (r.ok && d) setOuvert({ etat: { ...e, ...d.etat }, lignes: d.lignes || [], historique: d.historique || [] });
    else setErreur(d?.error || "Lecture impossible.");
  };

  const demanderValidation = (e: Etat) => setConfirmation({
    titre: `Valider l'état ${e.statement_number} ?`,
    action: "Valider",
    corps: (
      <>
        <p className="mb-2">
          Ses <strong>{e.invoices_count} facture(s)</strong> cesseront d'être
          disponibles : elles ne pourront plus figurer sur un autre état.
        </p>
        <p className="mb-2">Après validation, cet état ne se modifie plus. Pour le changer,
          il faudra l'annuler ou le corriger — ce qui crée un nouvel état et conserve celui-ci.</p>
        <p className="text-gray-600">Rien ne sera effacé.</p>
      </>
    ),
    executer: async () => {
      await appel(`/invoice-statements/${e.id}/valider`, { method: "POST" },
        `État ${e.statement_number} validé.`);
    },
  });

  const demanderAnnulation = (e: Etat) => setConfirmation({
    titre: `Annuler l'état ${e.statement_number} ?`,
    action: "Annuler l'état",
    motif: { libelle: "Motif de l'annulation", minimum: 10 },
    corps: (
      <>
        <p className="mb-2">
          L'état restera consultable et imprimable, marqué « annulé », avec votre motif.
        </p>
        <p className="mb-2">
          Ses <strong>{e.invoices_count} facture(s)</strong> redeviendront disponibles
          pour un autre état.
        </p>
        <p className="text-gray-600">Aucune facture n'est modifiée ni supprimée.</p>
      </>
    ),
    executer: async (motif) => {
      await appel(`/invoice-statements/${e.id}/annuler`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motif }),
      }, `État ${e.statement_number} annulé.`);
    },
  });

  const demanderCorrection = (e: Etat) => setConfirmation({
    titre: `Corriger l'état ${e.statement_number} ?`,
    action: "Créer l'état correctif",
    motif: { libelle: "Motif de la correction", minimum: 10 },
    corps: (
      <>
        <p className="mb-2">
          Un <strong>nouvel état</strong> sera créé en brouillon, avec les mêmes factures.
          Vous pourrez y ajouter ou retirer des lignes avant de le valider.
        </p>
        <p className="mb-2">
          L'état {e.statement_number} passera « remplacé » : il reste consultable et
          imprimable, et cesse de réclamer ses factures.
        </p>
        <p className="text-gray-600">Rien n'est effacé. Les deux états se lisent côte à côte.</p>
      </>
    ),
    executer: async (motif) => {
      const d = await appel(`/invoice-statements/${e.id}/corriger`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motif }),
      }, `État correctif créé.`);
      if (d?.etat) setOuvert(null);
    },
  });

  const imprimer = (e: Etat) => {
    window.open(`/api/invoice-statements/${e.id}/pdf`, "_blank", "noopener");
  };

  const declarerHistorique = () => setConfirmation({
    titre: "Déclarer la reprise des états antérieurs achevée ?",
    action: "Déclarer achevée",
    motif: { libelle: "Sur quoi vous appuyez-vous ?", minimum: 10 },
    corps: (
      <>
        <p className="mb-2">
          L'avertissement disparaîtra, et l'écran affirmera qu'une facture absente
          de la liste est libre.
        </p>
        <p className="text-gray-600">
          Ne le déclarez que si tous les états papier antérieurs ont été repris.
          Votre note et votre nom resteront attachés à cette déclaration.
        </p>
      </>
    ),
    executer: async (note) => {
      await appel("/invoice-statements/historique/declarer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: produit, complet: true, note }),
      }, "Reprise déclarée achevée.");
    },
  });

  if (!monte) return null;

  if (!can("etat_facture", "view")) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold mb-2">États de factures</h1>
        <p className="text-gray-600">Vous n'avez pas accès à ce registre.</p>
      </div>
    );
  }

  return (
    /* `min-w-0 w-full` n'est pas décoratif : <body> est « flex flex-col », et
       un enfant flex a min-width:auto — il refuse de rétrécir sous la largeur
       minimale de son contenu. Sans cela, le tableau impose 595 px à la page
       entière sur un téléphone, et son « overflow-x-auto » ne sert à rien. */
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full min-w-0 relative z-0">
      <header className="mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold">États de factures</h1>
        <p className="text-sm text-gray-600 mt-1">
          Une liste de factures arrêtée, numérotée et conservée. Une facture ne
          figure que sur un seul état à la fois.
        </p>
      </header>

      {/* Le produit — la séparation sable / ciment est explicite, jamais devinée. */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PRODUITS.map((p) => (
          <button
            key={p.cle}
            onClick={() => setProduit(p.cle as "SABLE" | "CIMENT")}
            className={`px-4 py-2 rounded border text-sm ${
              produit === p.cle ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50"
            }`}
          >
            {p.libelle}
          </button>
        ))}
      </div>

      {avert && !avert.historique_complet && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          {/* Un seul énoncé du risque : le serveur. Répéter la phrase dans le
              titre et dans le corps donne deux textes à maintenir, qui finiront
              par se contredire. */}
          <p className="font-medium text-amber-900">Reprise des états antérieurs incomplète</p>
          <p className="text-amber-800 mt-1">{avert.message}</p>
          {avert.etats_repris > 0 && (
            <p className="text-amber-700 mt-1">{avert.etats_repris} état(s) antérieur(s) déjà repris.</p>
          )}
          {can("etat_facture", "archive") && (
            <button onClick={declarerHistorique}
              className="mt-2 text-amber-900 underline hover:no-underline">
              Tous les états antérieurs ont été repris
            </button>
          )}
        </div>
      )}
      {avert && avert.historique_complet && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Reprise des états antérieurs déclarée achevée
          {avert.declare_par ? ` par ${avert.declare_par}` : ""}
          {avert.declare_le ? ` le ${fdate(avert.declare_le)}` : ""}.
          {avert.note ? ` « ${avert.note} »` : ""}
        </div>
      )}

      {message && (
        <div className="mb-3 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-900">{message}</div>
      )}
      {erreur && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">{erreur}</div>
      )}

      <div className="flex gap-2 border-b mb-4">
        {([["preparer", "Préparer un état"], ["archives", `Les états (${etats.length})`]] as const).map(([cle, lib]) => (
          <button key={cle} onClick={() => setOnglet(cle as "preparer" | "archives")}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${
              onglet === cle ? "border-gray-900 font-medium" : "border-transparent text-gray-600 hover:text-gray-900"
            }`}>
            {lib}
          </button>
        ))}
      </div>

      {chargement && <p className="text-sm text-gray-500">Chargement…</p>}

      {/* ════════════════════════════════════ PRÉPARER ══ */}
      {!chargement && onglet === "preparer" && (
        <div>
          <div className="grid gap-3 sm:grid-cols-4 mb-4">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Du</span>
              <input type="date" value={du} onChange={(e) => setDu(e.target.value)}
                className="w-full border rounded px-2 py-1.5" />
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Au</span>
              <input type="date" value={au} onChange={(e) => setAu(e.target.value)}
                className="w-full border rounded px-2 py-1.5" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="block text-gray-600 mb-1">Facture ou client</span>
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
                placeholder="FS-0001, SOCOBAT…"
                className="w-full border rounded px-2 py-1.5" />
            </label>
          </div>

          {!libres.length && !prises.length && (
            <p className="text-sm text-gray-500">Aucune facture sur cette période.</p>
          )}

          {!!libres.length && (
            <div className="overflow-x-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="p-2 w-10">
                      <input type="checkbox" aria-label="Tout cocher"
                        checked={cochees.size === libres.length && libres.length > 0}
                        onChange={(e) => setCochees(e.target.checked ? new Set(libres.map((f) => f.id)) : new Set())} />
                    </th>
                    <th className="p-2">Facture</th>
                    <th className="p-2">Date</th>
                    <th className="p-2">Client</th>
                    <th className="p-2 text-right">Montant</th>
                    <th className="p-2 text-right">Restant</th>
                    <th className="p-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {libres.map((f) => (
                    <tr key={f.id} className={`border-t ${cochees.has(f.id) ? "bg-blue-50" : ""}`}>
                      <td className="p-2">
                        <input type="checkbox" checked={cochees.has(f.id)}
                          onChange={() => basculer(f.id)}
                          aria-label={`Porter ${f.numero} sur l'état`} />
                      </td>
                      <td className="p-2 font-mono">{f.numero}</td>
                      <td className="p-2">{fdate(f.date)}</td>
                      <td className="p-2">{f.client || "—"}</td>
                      <td className="p-2 text-right">{fcfa(f.montant)}</td>
                      <td className="p-2 text-right">{fcfa(f.restant)}</td>
                      <td className="p-2 text-xs text-gray-600">{f.statut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Les factures déjà prises restent VISIBLES : les faire disparaître
              conduit à les chercher, puis à les ressaisir. */}
          {!!prises.length && (
            <details className="mt-4 border rounded">
              <summary className="p-3 text-sm cursor-pointer bg-gray-50">
                {prises.length} facture(s) figurent déjà sur un état validé
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {prises.map((f) => (
                      <tr key={f.id} className="border-t text-gray-500">
                        <td className="p-2 font-mono line-through">{f.numero}</td>
                        <td className="p-2">{fdate(f.date)}</td>
                        <td className="p-2">{f.client || "—"}</td>
                        <td className="p-2 text-right">{fcfa(f.montant)}</td>
                        <td className="p-2 text-xs">
                          sur l'état <span className="font-mono">{f.deja_sur_etat?.numero}</span>
                          {f.deja_sur_etat?.origine === "HISTORIQUE" && " (repris d'un état antérieur)"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {!!selection.length && (
            <div className="mt-4 rounded border bg-white p-4 shadow-sm">
              <div className="grid gap-2 sm:grid-cols-3 text-sm mb-3">
                <div><span className="text-gray-600">Factures retenues : </span><strong>{selection.length}</strong></div>
                <div><span className="text-gray-600">Total : </span><strong>{fcfa(totalSelection)}</strong></div>
                <div><span className="text-gray-600">Restant dû : </span><strong>{fcfa(restantSelection)}</strong></div>
              </div>
              <label className="block text-sm mb-3">
                <span className="block text-gray-600 mb-1">Intitulé de l'état (facultatif)</span>
                <input value={titre} onChange={(e) => setTitre(e.target.value)}
                  placeholder="Factures de septembre 2026"
                  className="w-full border rounded px-2 py-1.5" />
              </label>
              <button onClick={creer} disabled={occupe || !can("etat_facture", "create")}
                className="px-4 py-2 rounded bg-gray-900 text-white text-sm disabled:opacity-50">
                {occupe ? "…" : `Créer le brouillon (${selection.length} facture(s))`}
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Un brouillon ne bloque rien : les factures restent disponibles jusqu'à la validation.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════ LES ÉTATS ══ */}
      {!chargement && onglet === "archives" && (
        <div className="space-y-2">
          {!etats.length && <p className="text-sm text-gray-500">Aucun état pour ce produit.</p>}
          {etats.map((e) => (
            <div key={e.id} className="border rounded p-3 bg-white">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-medium">{e.statement_number}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${COULEUR_STATUT[e.status] || "bg-gray-100"}`}>
                  {LIBELLE_STATUT[e.status] || e.status}
                </span>
                {e.origin === "HISTORIQUE" && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    repris de {e.historical_reference}
                  </span>
                )}
                {e.lignes_non_rapprochees > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    {e.lignes_non_rapprochees} ligne(s) non rapprochée(s)
                  </span>
                )}
                <span className="text-sm text-gray-600">
                  {e.invoices_count} facture(s) · {fcfa(e.total_invoiced)}
                </span>
                {e.printed_count > 0 && (
                  <span className="text-xs text-gray-500">imprimé {e.printed_count}×</span>
                )}
              </div>
              {e.title && <p className="text-sm text-gray-700 mt-1">{e.title}</p>}
              {e.status === "REMPLACE" && e.remplace_par_numero && (
                <p className="text-sm text-amber-800 mt-1">
                  Repris par <span className="font-mono">{e.remplace_par_numero}</span>
                  {e.replace_reason ? ` — ${e.replace_reason}` : ""}
                </p>
              )}
              {e.status === "ANNULE" && (
                <p className="text-sm text-red-800 mt-1">
                  Annulé par {e.cancelled_by_name} — {e.cancel_reason}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <button onClick={() => ouvrir(e)}
                  className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Voir</button>
                {can("etat_facture", "print") && (
                  <button onClick={() => imprimer(e)}
                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
                    {e.printed_count > 0 ? "Réimprimer" : "Imprimer"}
                  </button>
                )}
                {e.status === "BROUILLON" && can("etat_facture", "validate") && (
                  <button onClick={() => demanderValidation(e)}
                    className="px-3 py-1.5 text-sm rounded bg-gray-900 text-white">Valider</button>
                )}
                {e.status === "VALIDE" && can("etat_facture", "cancel") && (
                  <button onClick={() => demanderAnnulation(e)}
                    className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50">
                    Annuler
                  </button>
                )}
                {e.status === "VALIDE" && can("etat_facture", "correct") && (
                  <button onClick={() => demanderCorrection(e)}
                    className="px-3 py-1.5 text-sm border border-amber-300 text-amber-800 rounded hover:bg-amber-50">
                    Corriger
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════ LE DÉTAIL ══ */}
      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
          role="dialog" aria-modal="true" aria-label={`État ${ouvert.etat.statement_number}`}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h2 className="font-semibold font-mono">{ouvert.etat.statement_number}</h2>
                <p className="text-sm text-gray-600">
                  {ouvert.etat.invoices_count} facture(s) · {fcfa(ouvert.etat.total_invoiced)} ·
                  restant {fcfa(ouvert.etat.total_remaining)}
                </p>
              </div>
              <button onClick={() => setOuvert(null)} aria-label="Fermer"
                className="text-gray-500 hover:text-gray-900 text-xl leading-none px-2">×</button>
            </div>

            <div className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="p-2">Facture</th><th className="p-2">Date</th>
                    <th className="p-2">Client</th>
                    <th className="p-2 text-right">Montant</th>
                    <th className="p-2 text-right">Payé</th>
                    <th className="p-2 text-right">Restant</th>
                  </tr>
                </thead>
                <tbody>
                  {ouvert.lignes.map((l) => (
                    <tr key={l.id} className={`border-t ${l.reconciled ? "" : "text-red-700"}`}>
                      <td className="p-2 font-mono">
                        {l.invoice_number}
                        {!l.reconciled && <span className="ml-1 text-xs">(non rapprochée)</span>}
                      </td>
                      <td className="p-2">{fdate(l.invoice_date)}</td>
                      <td className="p-2">{l.client_name || "—"}</td>
                      <td className="p-2 text-right">{fcfa(l.total_amount)}</td>
                      <td className="p-2 text-right">{fcfa(l.paid_amount)}</td>
                      <td className="p-2 text-right">{fcfa(l.remaining_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 className="font-medium mt-6 mb-2 text-sm">Historique</h3>
              <ul className="space-y-1 text-sm">
                {ouvert.historique.map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-2 border-t py-1.5">
                    <span className="font-medium">{LIBELLE_ACTION[h.action] || h.action}</span>
                    <span className="text-gray-600">par {h.acted_by_name}</span>
                    <span className="text-gray-500">le {fdate(h.acted_at)}</span>
                    {h.reason && <span className="text-gray-700">— {h.reason}</span>}
                  </li>
                ))}
              </ul>
              {!ouvert.historique.length && (
                <p className="text-sm text-gray-500">Aucune trace.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════ CONFIRMATION ══ */}
      {confirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog" aria-modal="true" aria-label={confirmation.titre}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="border-b p-4">
              <h2 className="font-semibold">{confirmation.titre}</h2>
            </div>
            <div className="p-4 text-sm">
              {confirmation.corps}
              {confirmation.motif && (
                <label className="block mt-4">
                  <span className="block text-gray-700 mb-1">
                    {confirmation.motif.libelle} ({confirmation.motif.minimum} caractères minimum)
                  </span>
                  <textarea value={motifSaisi} onChange={(e) => setMotifSaisi(e.target.value)}
                    rows={3} className="w-full border rounded px-2 py-1.5" />
                  <span className={`text-xs ${
                    motifSaisi.trim().length >= confirmation.motif.minimum ? "text-green-700" : "text-gray-500"
                  }`}>
                    {motifSaisi.trim().length} / {confirmation.motif.minimum}
                  </span>
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <button onClick={() => { setConfirmation(null); setMotifSaisi(""); }}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Retour</button>
              <button
                disabled={occupe || (!!confirmation.motif && motifSaisi.trim().length < confirmation.motif.minimum)}
                onClick={async () => {
                  const m = motifSaisi.trim();
                  const executer = confirmation.executer;
                  setConfirmation(null); setMotifSaisi("");
                  await executer(m);
                }}
                className="px-4 py-2 text-sm rounded bg-gray-900 text-white disabled:opacity-50">
                {confirmation.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
