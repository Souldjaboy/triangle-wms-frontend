"use client";

/**
 * LES REGISTRES DU PERSONNEL.
 *
 * Trois onglets : les contrats, les pièces remises, les clauses.
 *
 * DEUX DROITS DISTINCTS GOUVERNENT CET ÉCRAN. `rh.document.view` ouvre la
 * page ; `rh.document.voir_remuneration` est exigé en plus pour qu'un montant
 * s'affiche. Quand il manque, les salaires sont remplacés par « masqué » —
 * et pas par zéro, qu'on lirait comme un salaire nul.
 *
 * L'écran ne calcule RIEN. Les montants, les états et les références viennent
 * du serveur : deux calculs pour le même chiffre finissent toujours par
 * diverger.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "../lib/api";
import { usePermissions } from "../lib/permissions";

type Contrat = {
  id: number; reference: string; contract_type: string; job_title: string;
  site_label: string | null; start_date: string; end_date: string | null;
  trial_period_days: number | null; weekly_hours: string | null;
  gross_salary: string | null; cdd_reason: string | null; status: string;
  signed_at: string | null; ended_at: string | null; end_reason: string | null;
  full_name: string | null; employee_number: number | null;
};

type Document = {
  id: number; reference: string; doc_type: string; title: string;
  period_code: string | null; issued_on: string; issued_by_name: string;
  pdf_sha256: string; full_name: string | null; cancelled_at: string | null;
  cancel_reason: string | null; cancelled_by_name: string | null;
  status: string; version: number; version_reason: string;
  superseded_at: string | null; archivee: boolean; pdf_bytes: number;
  printed_count: number;
};
type Version = {
  id: number; reference: string; version: number; status: string;
  issued_on: string; issued_by_name: string; version_reason: string;
  superseded_at: string | null; cancelled_at: string | null;
  cancel_reason: string | null; cancelled_by_name: string | null;
  printed_count: number; archivee: boolean;
};
type Trace = {
  id: number; action: string; reason: string; acted_by_name: string; acted_at: string;
};

type Clause = {
  id: number; clause_key: string; title: string; body: string;
  applies_to: string[]; legal_reference: string | null;
  requires_legal_validation: boolean;
};

const fdate = (d: string | null) => {
  if (!d) return "—";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d).slice(0, 10);
};
const fcfa = (v: string | number | null) =>
  v == null ? null : `${Number(v).toLocaleString("fr-FR")} FCFA`;

const ETAT: Record<string, string> = {
  BROUILLON: "bg-gray-200 text-gray-800",
  ACTIF: "bg-green-100 text-green-800",
  SUSPENDU: "bg-amber-100 text-amber-800",
  TERMINE: "bg-gray-300 text-gray-700",
  ANNULE: "bg-red-100 text-red-800",
};

const ETAT_PIECE: Record<string, { libelle: string; classe: string }> = {
  EMIS: { libelle: "En vigueur", classe: "bg-green-100 text-green-800" },
  REMPLACE: { libelle: "Remplacée", classe: "bg-amber-100 text-amber-800" },
  ANNULE: { libelle: "Annulée", classe: "bg-red-100 text-red-800" },
};
const ACTION_PIECE: Record<string, string> = {
  APERCU: "Aperçu consulté", EMISSION: "Émise", REIMPRESSION: "Réimprimée",
  NOUVELLE_VERSION: "Nouvelle version", REMPLACEMENT: "Remplacée", ANNULATION: "Annulée",
};

const TYPE_DOC: Record<string, string> = {
  CONTRAT: "Contrat", BULLETIN: "Bulletin de paie",
  ATTESTATION_TRAVAIL: "Attestation de travail",
  CERTIFICAT_TRAVAIL: "Certificat de travail",
  ATTESTATION_STAGE: "Attestation de stage",
  ATTESTATION_FORMATION: "Attestation de formation",
  DIPLOME: "Diplôme",
};

export default function RegistresRhPage() {
  const { can } = usePermissions();
  const [onglet, setOnglet] = useState<"contrats" | "documents" | "clauses">("contrats");
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [aValider, setAValider] = useState(0);
  const [masque, setMasque] = useState(false);
  const [filtreType, setFiltreType] = useState("");
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  /* Les versions d'une pièce, ouvertes à la demande : la chaîne ne se devine
     pas d'une ligne de tableau. */
  const [versions, setVersions] = useState<null | {
    document: Document; versions: Version[]; en_vigueur: Version | null; historique: Trace[];
  }>(null);
  const [aAnnuler, setAAnnuler] = useState<Document | null>(null);
  const [motifAnnulation, setMotifAnnulation] = useState("");
  const [occupe, setOccupe] = useState(false);

  /* Lu après le montage : lire localStorage pendant le rendu ferait diverger
     le HTML du serveur et celui du navigateur, et React refait alors tout le
     DOM. */
  const [monte, setMonte] = useState(false);
  useEffect(() => { setMonte(true); }, []);

  const charger = useCallback(async () => {
    setChargement(true); setErreur("");
    const [rC, rD, rCl] = await Promise.all([
      authFetch("/rh/contrats"),
      authFetch(`/rh/documents${filtreType ? `?type=${filtreType}` : ""}`),
      authFetch("/rh/clauses"),
    ]);
    const dC = await rC.json().catch(() => null);
    if (rC.ok && dC) { setContrats(dC.contrats || []); setMasque(dC.remunerations_masquees === true); }
    else setErreur(dC?.error || "Lecture des contrats impossible.");
    const dD = await rD.json().catch(() => null);
    if (rD.ok && dD) setDocuments(dD.documents || []);
    const dCl = await rCl.json().catch(() => null);
    if (rCl.ok && dCl) { setClauses(dCl.clauses || []); setAValider(dCl.a_valider || 0); }
    setChargement(false);
  }, [filtreType]);

  useEffect(() => { if (monte) charger(); }, [monte, charger]);

  const actifs = useMemo(() => contrats.filter((c) => c.status === "ACTIF").length, [contrats]);

  /* La pièce ARCHIVÉE, octet pour octet. On ouvre l'URL du serveur plutôt que
     de régénérer : une attestation signée se conserve, elle ne se recalcule
     pas. Si l'archive manque ou a été altérée, le serveur refuse et le dit. */
  const ouvrirPiece = (d: Document) => {
    window.open(`/api/rh/documents/${d.id}/pdf`, "_blank", "noopener");
  };

  const ouvrirVersions = async (d: Document) => {
    setErreur("");
    const r = await authFetch(`/rh/documents/${d.id}/versions`);
    const data = await r.json().catch(() => null);
    if (r.ok && data) setVersions({ ...data, document: d });
    else setErreur(data?.error || "Lecture des versions impossible.");
  };

  const annulerPiece = async () => {
    if (!aAnnuler) return;
    setOccupe(true); setErreur("");
    const r = await authFetch(`/rh/documents/${aAnnuler.id}/annuler`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motif: motifAnnulation.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    setOccupe(false);
    if (r.ok) {
      setMessage(d.avertissement || `Pièce ${aAnnuler.reference} annulée.`);
      setAAnnuler(null); setMotifAnnulation("");
      await charger();
    } else setErreur(d.error || "Annulation impossible.");
  };

  const terminer = async (c: Contrat) => {
    const motif = window.prompt(
      `Fin du contrat ${c.reference} — ${c.full_name}\n\n`
      + "Motif (5 caractères minimum). Il restera attaché au contrat :");
    if (motif === null) return;
    if (motif.trim().length < 5) { setErreur("Motif de fin de contrat obligatoire."); return; }
    const r = await authFetch(`/rh/contrats/${c.id}/terminer`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motif: motif.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setMessage(`Contrat ${c.reference} clos.`); await charger(); }
    else setErreur(d.error || "Fin de contrat impossible.");
  };

  const activer = async (c: Contrat) => {
    const r = await authFetch(`/rh/contrats/${c.id}/activer`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setMessage(`Contrat ${c.reference} mis en vigueur.`); await charger(); }
    else setErreur(d.error || "Activation impossible.");
  };

  if (!monte) {
    return <main className="min-h-screen bg-gray-100 p-6">
      <div className="rounded-lg bg-white p-8 font-bold text-gray-900">Chargement…</div>
    </main>;
  }
  if (!can("rh.document", "view")) {
    return <main className="min-h-screen bg-gray-100 p-6">
      <div className="rounded-lg bg-white p-8 shadow">
        <h2 className="text-2xl font-black text-gray-900">Accès refusé</h2>
        <p className="mt-2 text-gray-600">
          Le module « Documents du personnel » ne vous est pas ouvert.
        </p>
      </div>
    </main>;
  }

  const ONGLETS = [
    ["contrats", `Contrats (${contrats.length})`],
    ["documents", `Pièces remises (${documents.length})`],
    ["clauses", `Clauses (${clauses.length})`],
  ] as const;

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Documents du personnel</h1>
          <p className="text-sm text-gray-600">
            Contrats, bulletins, attestations, certificats et diplômes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/paie" className="rounded-lg border border-gray-300 px-4 py-2 font-bold text-gray-700">
            Paie
          </Link>
          <button onClick={charger} className="rounded-lg bg-black px-4 py-2 font-bold text-white">
            Actualiser
          </button>
        </div>
      </div>

      {message && <div className="mb-4 rounded-lg bg-green-50 p-4 font-bold text-green-800">{message}</div>}
      {erreur && <div className="mb-4 rounded-lg bg-red-50 p-4 font-bold text-red-800">{erreur}</div>}

      {/* Dire que le montant est caché vaut mieux que de l'afficher à zéro. */}
      {masque && (
        <div className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">Les rémunérations vous sont masquées.</p>
          <p className="mt-1">
            Voir un salaire demande le droit « Voir les rémunérations », distinct
            du droit d'ouvrir ce module. Les montants ne sont pas à zéro : ils ne
            vous sont pas transmis.
          </p>
        </div>
      )}

      {aValider > 0 && onglet === "contrats" && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-bold">
            {aValider} clause(s) de contrat n'ont pas été relues par un juriste.
          </p>
          <p className="mt-1">
            Chaque contrat imprimé porte un bandeau le signalant. Le logiciel ne
            se prononce pas sur la conformité d'un texte juridique.
          </p>
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {ONGLETS.map(([cle, libelle]) => (
          <button key={cle} onClick={() => setOnglet(cle)}
                  className={`rounded-lg px-4 py-3 font-bold ${
                    onglet === cle ? "bg-yellow-500 text-black" : "bg-white text-gray-700"}`}>
            {libelle}
          </button>
        ))}
      </div>

      {chargement ? (
        <div className="rounded-lg bg-white p-8 font-bold shadow">Chargement…</div>
      ) : onglet === "contrats" ? (
        <section className="rounded-2xl bg-white p-5 shadow">
          <div className="mb-4 flex flex-wrap items-baseline gap-4">
            <h2 className="text-xl font-black">Contrats</h2>
            <span className="text-sm text-gray-600">{actifs} en vigueur</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>{["Référence", "Salarié", "Type", "Fonction", "Période", "Rémunération", "État", ""]
                  .map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {contrats.length === 0 ? (
                  <tr><td colSpan={8} className="p-4 text-gray-500">Aucun contrat.</td></tr>
                ) : contrats.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{c.reference}</td>
                    <td className="p-3">
                      {c.full_name || "—"}
                      {c.employee_number != null && (
                        <span className="block text-xs text-gray-500">n° {c.employee_number}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="font-bold">{c.contract_type}</span>
                      {c.contract_type === "CDD" && c.cdd_reason && (
                        <span className="block text-xs text-gray-500">{c.cdd_reason}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {c.job_title}
                      {c.site_label && <span className="block text-xs text-gray-500">{c.site_label}</span>}
                    </td>
                    <td className="p-3 text-xs">
                      du {fdate(c.start_date)}
                      {c.end_date ? <><br />au {fdate(c.end_date)}</> : <><br />sans terme</>}
                    </td>
                    <td className="p-3 font-bold">
                      {c.gross_salary == null
                        ? <span className="text-xs font-normal text-gray-400">masqué</span>
                        : fcfa(c.gross_salary)}
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${ETAT[c.status] || "bg-gray-200"}`}>
                        {c.status}
                      </span>
                      {c.status === "TERMINE" && c.end_reason && (
                        <span className="mt-1 block text-xs text-gray-500">{c.end_reason}</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {c.status === "BROUILLON" && can("rh.document", "update") && (
                        <button onClick={() => activer(c)}
                                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white">
                          Mettre en vigueur
                        </button>
                      )}
                      {c.status === "ACTIF" && can("rh.document", "update") && (
                        <button onClick={() => terminer(c)}
                                className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-800">
                          Clore
                        </button>
                      )}
                      {/* Un contrat porte un salaire : l'imprimer demande le
                          droit de voir les rémunérations, que le serveur
                          vérifie de toute façon. */}
                      {can("rh.document", "print") && !masque && (
                        <a href={`/api/rh/contrats/${c.id}/pdf`} target="_blank" rel="noreferrer"
                           className="ml-2 rounded-lg border border-slate-900 px-3 py-1.5 text-xs font-bold text-slate-900">
                          Imprimer
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : onglet === "documents" ? (
        <section className="rounded-2xl bg-white p-5 shadow">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black">Pièces remises</h2>
            <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)}
                    className="rounded-lg border border-gray-300 p-2">
              <option value="">Tous les types</option>
              {Object.entries(TYPE_DOC).map(([cle, libelle]) => (
                <option key={cle} value={cle}>{libelle}</option>
              ))}
            </select>
          </div>
          <p className="mb-3 text-sm text-gray-600">
            Chaque pièce porte une référence unique et l'empreinte du PDF remis.
            Le fichier lui-même est conservé : « Voir » sert l'archive telle
            qu'elle a été remise, et non une régénération qui pourrait différer.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>{["Référence", "Type", "Salarié", "Période", "Émise le", "Par", "État", ""]
                  .map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr><td colSpan={8} className="p-4 text-gray-500">Aucune pièce remise.</td></tr>
                ) : documents.map((d) => (
                  <tr key={d.id} className={`border-t ${d.status !== "EMIS" ? "opacity-60" : ""}`}>
                    <td className="p-3 font-mono text-xs">
                      {d.reference}
                      {d.version > 1 && (
                        <span className="ml-1 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-700">
                          v{d.version}
                        </span>
                      )}
                      <span className="block text-[10px] text-gray-400" title={d.pdf_sha256}>
                        {String(d.pdf_sha256 || "").slice(0, 12)}…
                      </span>
                    </td>
                    <td className="p-3">{TYPE_DOC[d.doc_type] || d.doc_type}</td>
                    <td className="p-3">{d.full_name || "—"}</td>
                    <td className="p-3">{d.period_code || "—"}</td>
                    <td className="p-3">{fdate(d.issued_on)}</td>
                    <td className="p-3 text-xs text-gray-600">{d.issued_by_name}</td>
                    <td className="p-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                        (ETAT_PIECE[d.status] || ETAT_PIECE.EMIS).classe}`}>
                        {(ETAT_PIECE[d.status] || { libelle: d.status }).libelle}
                      </span>
                      {d.status === "ANNULE" && d.cancel_reason && (
                        <span className="block text-[11px] text-red-700">{d.cancel_reason}</span>
                      )}
                      {d.printed_count > 1 && (
                        <span className="block text-[11px] text-gray-500">
                          sortie {d.printed_count}×
                        </span>
                      )}
                      {!d.archivee && (
                        <span className="block text-[11px] text-amber-700" title="Éditée avant la conservation des fichiers">
                          fichier non conservé
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {d.archivee && can("rh.document", "print") && (
                          <button onClick={() => ouvrirPiece(d)}
                            className="rounded bg-gray-100 px-2 py-1 text-xs font-bold text-gray-800">
                            {d.printed_count > 0 ? "Réimprimer" : "Voir"}
                          </button>
                        )}
                        <button onClick={() => ouvrirVersions(d)}
                          className="rounded bg-gray-100 px-2 py-1 text-xs font-bold text-gray-800">
                          Versions
                        </button>
                        {d.status === "EMIS" && can("rh.document", "delete") && (
                          <button onClick={() => { setAAnnuler(d); setMotifAnnulation(""); }}
                            className="rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-800">
                            Annuler
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-black">Clauses de contrat</h2>
          <p className="mb-4 text-sm text-gray-600">
            Ces textes sont des <b>données</b>, pas du code : ils se modifient sans
            toucher à l'application. Le logiciel n'invente aucune disposition
            légale et ne se prononce pas sur leur conformité.
          </p>
          <ul className="space-y-3">
            {clauses.map((cl) => (
              <li key={cl.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-black">{cl.title}</span>
                  <span className="text-xs text-gray-500">
                    {cl.applies_to?.join(", ")}
                    {cl.requires_legal_validation && (
                      <span className="ml-2 rounded bg-red-100 px-2 py-0.5 font-bold text-red-800">
                        à faire valider
                      </span>
                    )}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700">{cl.body}</p>
                {cl.legal_reference && (
                  <p className="mt-1 text-xs italic text-gray-500">{cl.legal_reference}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* ─────────────────────── LES VERSIONS D'UNE PIÈCE ──────────────── */}
      {versions && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          role="dialog" aria-modal="true" aria-label="Versions de la pièce">
          <div className="my-8 w-full max-w-3xl rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between border-b p-4">
              <div>
                <h2 className="font-black">{TYPE_DOC[versions.document.doc_type] || versions.document.doc_type}</h2>
                <p className="text-sm text-gray-600">
                  {versions.document.full_name || "—"}
                  {versions.document.period_code ? ` — ${versions.document.period_code}` : ""}
                </p>
              </div>
              <button onClick={() => setVersions(null)} aria-label="Fermer"
                className="px-2 text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
            </div>
            <div className="p-4">
              {versions.versions.length === 1 && (
                <p className="mb-3 text-sm text-gray-600">
                  Cette pièce n&apos;a qu&apos;une version.
                </p>
              )}
              <ul className="space-y-2">
                {versions.versions.map((x) => (
                  <li key={x.id} className={`rounded border p-3 text-sm ${
                    x.status === "EMIS" ? "border-green-300 bg-green-50" : "bg-gray-50"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono">{x.reference}</span>
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[11px] font-bold">v{x.version}</span>
                      <span className={`rounded px-2 py-0.5 text-xs font-bold ${
                        (ETAT_PIECE[x.status] || ETAT_PIECE.EMIS).classe}`}>
                        {(ETAT_PIECE[x.status] || { libelle: x.status }).libelle}
                      </span>
                      <span className="text-gray-600">
                        émise le {fdate(x.issued_on)} par {x.issued_by_name}
                      </span>
                    </div>
                    {x.version_reason && (
                      <p className="mt-1 text-gray-700">Motif : {x.version_reason}</p>
                    )}
                    {x.status === "ANNULE" && x.cancel_reason && (
                      <p className="mt-1 text-red-700">
                        Annulée par {x.cancelled_by_name} — {x.cancel_reason}
                      </p>
                    )}
                    {!x.archivee && (
                      <p className="mt-1 text-amber-700">
                        Fichier non conservé : cette pièce a été éditée avant l&apos;archivage.
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              <h3 className="mb-2 mt-5 text-sm font-black">Historique</h3>
              <ul className="space-y-1 text-sm">
                {versions.historique.map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-2 border-t py-1.5">
                    <span className="font-medium">{ACTION_PIECE[h.action] || h.action}</span>
                    <span className="text-gray-600">par {h.acted_by_name}</span>
                    <span className="text-gray-500">le {fdate(h.acted_at)}</span>
                    {h.reason && <span className="text-gray-700">— {h.reason}</span>}
                  </li>
                ))}
              </ul>
              {versions.historique.length === 0 && (
                <p className="text-sm text-gray-500">Aucune trace.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────── ANNULER UNE PIÈCE ─────────────────── */}
      {aAnnuler && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog" aria-modal="true" aria-label="Annuler la pièce">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="border-b p-4">
              <h2 className="font-black">Annuler la pièce {aAnnuler.reference} ?</h2>
            </div>
            <div className="p-4 text-sm">
              <p className="mb-2">
                La pièce <strong>reste au registre</strong>, marquée annulée, avec votre motif.
                Son fichier est conservé.
              </p>
              <p className="mb-2 text-amber-800">
                Si elle a déjà été remise au salarié, prévenez-le : le document qu&apos;il
                détient ne fera plus foi.
              </p>
              <label className="mt-3 block">
                <span className="mb-1 block text-gray-700">
                  Motif de l&apos;annulation (10 caractères minimum)
                </span>
                <textarea value={motifAnnulation} onChange={(e) => setMotifAnnulation(e.target.value)}
                  rows={3} className="w-full rounded border px-2 py-1.5" />
                <span className={`text-xs ${
                  motifAnnulation.trim().length >= 10 ? "text-green-700" : "text-gray-500"}`}>
                  {motifAnnulation.trim().length} / 10
                </span>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <button onClick={() => { setAAnnuler(null); setMotifAnnulation(""); }}
                className="rounded border px-4 py-2 text-sm hover:bg-gray-50">Retour</button>
              <button onClick={annulerPiece}
                disabled={occupe || motifAnnulation.trim().length < 10}
                className="rounded bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50">
                {occupe ? "…" : "Annuler la pièce"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
