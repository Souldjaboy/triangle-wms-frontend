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
            Chaque pièce porte une référence unique et l'empreinte du PDF remis :
            deux exemplaires d'une même référence sont le même document, octet
            pour octet.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>{["Référence", "Type", "Salarié", "Période", "Émise le", "Par", "Empreinte"]
                  .map((h) => <th key={h} className="p-3">{h}</th>)}</tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr><td colSpan={7} className="p-4 text-gray-500">Aucune pièce remise.</td></tr>
                ) : documents.map((d) => (
                  <tr key={d.id} className={`border-t ${d.cancelled_at ? "opacity-50" : ""}`}>
                    <td className="p-3 font-mono text-xs">{d.reference}</td>
                    <td className="p-3">{TYPE_DOC[d.doc_type] || d.doc_type}</td>
                    <td className="p-3">{d.full_name || "—"}</td>
                    <td className="p-3">{d.period_code || "—"}</td>
                    <td className="p-3">{fdate(d.issued_on)}</td>
                    <td className="p-3 text-xs text-gray-600">{d.issued_by_name}</td>
                    <td className="p-3 font-mono text-xs text-gray-400" title={d.pdf_sha256}>
                      {String(d.pdf_sha256 || "").slice(0, 12)}…
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
    </main>
  );
}
