"use client";

/**
 * L'ÉDITEUR DE PAGES.
 *
 * Les pages d'un PDF, en vignettes : on les choisit, on les déplace, on les
 * tourne, on en retire, on en extrait, on découpe le document en plusieurs,
 * on y ajoute d'autres PDF.
 *
 * CE QUE CET ÉCRAN REFUSE DE LAISSER ARRIVER.
 *
 * 1. QU'UNE PAGE DISPARAISSE SANS QU'ON LE SACHE. Chaque action dit combien
 *    de pages il y avait et combien il en reste. Un feuillet perdu dans un
 *    contrat se découvre au mauvais moment.
 *
 * 2. QU'ON CONFONDE « MODIFIER » ET « FABRIQUER ». Réordonner, tourner et
 *    retirer changent CE document — une version de plus. Extraire, découper
 *    et fusionner en créent d'AUTRES et n'y touchent pas. Les deux familles
 *    sont séparées à l'écran, et chaque bouton dit laquelle il est.
 *
 * 3. QU'ON RETIRE DES PAGES SANS RAISON ÉCRITE. C'est le seul geste qui fait
 *    disparaître du contenu de la version courante : il demande un motif
 *    qu'on relira dans l'historique.
 *
 * Le découpage se fait par COUPURES ENTRE LES PAGES plutôt que par listes :
 * ainsi aucune page ne peut être oubliée ni mise dans deux parties, ce qui
 * est l'erreur de saisie la plus coûteuse.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "../../../lib/api";
import { usePermissions } from "../../../lib/permissions";
import { ouvrir, rendre } from "../../../lib/pdf";
import {
  AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, FileText,
  FolderOpen, Loader2, Lock, RotateCcw, RotateCw, Scissors, Trash2, X,
} from "lucide-react";

type Doc = {
  id: number; name: string; mime: string; version: number;
  page_count: number | null; size_bytes: number; trashed_at: string | null;
};
type Vignette = { page: number; url: string; largeur: number; hauteur: number };

const poids = (n: number) =>
  !n ? "0 o" : n < 1024 ? `${n} o`
    : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} Ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`;

export default function EditeurPdf() {
  const params = useParams();
  const router = useRouter();
  const documentId = Number(params?.id);
  const { can, loading: droitsEnCours } = usePermissions();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [vignettes, setVignettes] = useState<Vignette[]>([]);
  const [ordre, setOrdre] = useState<number[]>([]);
  const [choisies, setChoisies] = useState<Set<number>>(new Set());
  const [coupures, setCoupures] = useState<Set<number>>(new Set());
  const [modeDecoupe, setModeDecoupe] = useState(false);

  const [chargement, setChargement] = useState(true);
  const [occupe, setOccupe] = useState("");
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [retrait, setRetrait] = useState(false);
  const [motif, setMotif] = useState("");

  const urls = useRef<string[]>([]);

  const peutModifier = can("studio.pdf", "update");
  const peutCreer = can("studio.pdf", "create");

  /* ───────────────────── CHARGER ET VIGNETTER ───────────────────── */
  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    /* Les anciennes vignettes sont libérées : cent pages gardées en mémoire
       après chaque rechargement finissent par faire tomber l'onglet. */
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    try {
      const [rd, rf] = await Promise.all([
        authFetch(`/studio/documents/${documentId}`),
        authFetch(`/studio/documents/${documentId}/fichier`),
      ]);
      if (!rd.ok) {
        const e = await rd.json().catch(() => ({}));
        throw new Error(e.error || "Ce document ne vous est pas accessible.");
      }
      if (!rf.ok) throw new Error("Le fichier n'a pas pu être lu.");
      const detail = await rd.json();
      const d: Doc = detail.document;
      if (d.mime !== "application/pdf") {
        throw new Error(`Ce document est au format ${d.mime} : l'éditeur de pages ne vaut que pour un PDF.`);
      }
      setDoc(d);

      const octets = await rf.arrayBuffer();
      const pdf = await ouvrir(octets);
      const faites: Vignette[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const r = await rendre(pdf, n, 150);
        const blob = await new Promise<Blob | null>((ok) =>
          r.canvas.toBlob((b) => ok(b), "image/png"));
        if (!blob) continue;
        const u = URL.createObjectURL(blob);
        urls.current.push(u);
        faites.push({ page: n, url: u, largeur: r.canvas.width, hauteur: r.canvas.height });
      }
      await pdf.destroy();
      setVignettes(faites);
      setOrdre(faites.map((f) => f.page));
      setChoisies(new Set());
      setCoupures(new Set());
    } catch (e) {
      setErreur((e as Error).message);
      setDoc(null);
    } finally { setChargement(false); }
  }, [documentId]);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  /* ─────────────────────────── ACTIONS ──────────────────────────── */
  async function agir(chemin: string, corps: unknown, cle: string, methode = "POST") {
    setOccupe(cle); setErreur("");
    try {
      const r = await authFetch(chemin, {
        method: methode,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(j.error || "Action impossible."); return null; }
      setMessage(j.message || "C'est fait.");
      return j;
    } catch { setErreur("Le serveur n'a pas répondu."); return null; }
    finally { setOccupe(""); }
  }

  const choisiesTriees = () => [...choisies].sort((a, b) => a - b);

  const deplacer = (page: number, sens: -1 | 1) => {
    setOrdre((o) => {
      const i = o.indexOf(page);
      const j = i + sens;
      if (i < 0 || j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  };

  const ordreChange = ordre.join(",") !== vignettes.map((v) => v.page).join(",");

  /* Les tranches déduites des coupures : contiguës, donc aucune page
     oubliée et aucune page dans deux parties. */
  const tranches = (() => {
    const bornes = [...coupures].sort((a, b) => a - b);
    const out: number[][] = [];
    let debut = 1;
    for (const b of bornes) {
      out.push(Array.from({ length: b - debut + 1 }, (_, k) => debut + k));
      debut = b + 1;
    }
    if (debut <= vignettes.length) {
      out.push(Array.from({ length: vignettes.length - debut + 1 }, (_, k) => debut + k));
    }
    return out;
  })();

  if (droitsEnCours) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!can("studio.pdf", "view")) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Lock className="mx-auto mb-4 text-gray-500" size={40} />
          <h1 className="mb-2 text-xl font-semibold">Éditeur non accessible</h1>
          <p className="text-sm text-gray-400">
            Votre compte n&apos;a pas l&apos;accès à l&apos;éditeur de pages
            pour cette société.
          </p>
          <Link href="/studio/bibliotheque" className="mt-6 inline-block text-sm text-blue-400 hover:underline">
            Retour à la bibliothèque
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white min-w-0 w-full">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 min-w-0">
          <Link href="/studio/bibliotheque" className="shrink-0 rounded-lg p-2 hover:bg-gray-800"
            aria-label="Retour à la bibliothèque">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">{doc?.name || "Éditeur de pages"}</h1>
            <p className="truncate text-xs text-gray-500">
              {doc
                ? `${vignettes.length} page${vignettes.length > 1 ? "s" : ""} · version ${doc.version} · ${poids(doc.size_bytes)}`
                : "Ouverture…"}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-4 min-w-0">
        {message && (
          <p className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
            <Check size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">{message}</span>
            <button onClick={() => setMessage("")} className="shrink-0" aria-label="Fermer"><X size={14} /></button>
          </p>
        )}
        {erreur && (
          <p className="mb-3 flex items-start gap-2 rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">{erreur}</span>
            <button onClick={() => setErreur("")} className="shrink-0" aria-label="Fermer"><X size={14} /></button>
          </p>
        )}

        {chargement ? (
          <p className="flex items-center gap-2 py-16 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin" /> Ouverture du document…
          </p>
        ) : !doc ? null : (
          <>
            {/* ──────────────────── LA BARRE D'ACTIONS ─────────────── */}
            <div className="mb-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400">
                  {choisies.size
                    ? `${choisies.size} page${choisies.size > 1 ? "s" : ""} choisie${choisies.size > 1 ? "s" : ""}`
                    : "Touchez une page pour la choisir"}
                </span>
                {choisies.size > 0 && (
                  <button onClick={() => setChoisies(new Set())}
                    className="rounded border border-gray-800 px-2 py-1 text-xs hover:bg-gray-800">
                    Tout désélectionner
                  </button>
                )}
                <button
                  onClick={() => setChoisies(new Set(vignettes.map((v) => v.page)))}
                  className="rounded border border-gray-800 px-2 py-1 text-xs hover:bg-gray-800">
                  Tout choisir
                </button>
              </div>

              {/* CE QUI MODIFIE CE DOCUMENT */}
              {peutModifier && (
                <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-2">
                  <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-500">
                    Modifie ce document — une version de plus
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      disabled={!choisies.size || !!occupe}
                      onClick={() => agir(`/studio/documents/${documentId}/pages/rotation`,
                        { pages: choisiesTriees(), angle: -90 }, "rg").then((r) => r && charger())}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-800 disabled:opacity-30">
                      <RotateCcw size={14} /> Tourner à gauche
                    </button>
                    <button
                      disabled={!choisies.size || !!occupe}
                      onClick={() => agir(`/studio/documents/${documentId}/pages/rotation`,
                        { pages: choisiesTriees(), angle: 90 }, "rd").then((r) => r && charger())}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-800 disabled:opacity-30">
                      <RotateCw size={14} /> Tourner à droite
                    </button>
                    <button
                      disabled={!choisies.size || !!occupe || choisies.size >= vignettes.length}
                      onClick={() => setRetrait(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-900 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/50 disabled:opacity-30">
                      <Trash2 size={14} /> Retirer
                    </button>
                    <button
                      disabled={!ordreChange || !!occupe}
                      onClick={() => agir(`/studio/documents/${documentId}/pages/ordre`,
                        { ordre }, "ordre").then((r) => r && charger())}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-30">
                      {occupe === "ordre" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Enregistrer l&apos;ordre
                    </button>
                    {ordreChange && (
                      <button onClick={() => setOrdre(vignettes.map((v) => v.page))}
                        className="rounded-lg border border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-800">
                        Annuler le déplacement
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* CE QUI CRÉE D'AUTRES DOCUMENTS */}
              {peutCreer && (
                <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-2">
                  <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-500">
                    Crée d&apos;autres documents — celui-ci n&apos;est pas modifié
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      disabled={!choisies.size || !!occupe}
                      onClick={() => agir(`/studio/documents/${documentId}/pages/extraire`,
                        { pages: choisiesTriees() }, "extraire")}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-800 disabled:opacity-30">
                      <Copy size={14} /> Extraire dans un nouveau document
                    </button>
                    <button
                      onClick={() => { setModeDecoupe((m) => !m); setCoupures(new Set()); }}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
                        modeDecoupe ? "border-amber-700 bg-amber-950/40 text-amber-200" : "border-gray-800 hover:bg-gray-800"
                      }`}>
                      <Scissors size={14} /> {modeDecoupe ? "Arrêter le découpage" : "Découper"}
                    </button>
                  </div>

                  {modeDecoupe && (
                    <div className="mt-2 rounded-lg bg-gray-950 p-2">
                      <p className="text-xs text-gray-400">
                        Cliquez sur les ciseaux entre deux pages pour couper.
                        {tranches.length > 1
                          ? ` ${tranches.length} parties : ${tranches.map((t) => t.length + " p.").join(" + ")}.`
                          : " Aucune coupure pour l'instant."}
                      </p>
                      {/* AUCUNE PAGE NE PEUT ÊTRE OUBLIÉE : les parties sont
                          contiguës et couvrent tout le document. */}
                      <p className="mt-1 text-[11px] text-gray-600">
                        Les parties se suivent : aucune page ne peut être
                        oubliée ni se retrouver dans deux documents.
                      </p>
                      <button
                        disabled={tranches.length < 2 || !!occupe}
                        onClick={() => agir(`/studio/documents/${documentId}/pages/decouper`, {
                          tranches: tranches.map((t, i) => ({
                            nom: `${doc.name.replace(/\.pdf$/i, "")} — partie ${i + 1}`,
                            pages: t,
                          })),
                        }, "decouper").then((r) => { if (r) { setModeDecoupe(false); setCoupures(new Set()); } })}
                        className="mt-2 flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-30">
                        {occupe === "decouper" ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
                        Créer {tranches.length} documents
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {retrait && (
              <ConfirmerRetrait
                pages={choisiesTriees()}
                total={vignettes.length}
                motif={motif} setMotif={setMotif}
                occupe={occupe === "retirer"}
                onAnnuler={() => { setRetrait(false); setMotif(""); }}
                onConfirmer={() => agir(`/studio/documents/${documentId}/pages`,
                  { pages: choisiesTriees(), motif }, "retirer", "DELETE")
                  .then((r) => { if (r) { setRetrait(false); setMotif(""); charger(); } })}
              />
            )}

            {/* ────────────────────── LES VIGNETTES ─────────────────── */}
            <ul className="flex flex-wrap gap-3">
              {ordre.map((numero, index) => {
                const vig = vignettes.find((v) => v.page === numero);
                if (!vig) return null;
                const prise = choisies.has(numero);
                return (
                  <li key={numero} className="flex items-start gap-1">
                    <div className="w-[150px] min-w-0">
                      <button
                        onClick={() => setChoisies((s) => {
                          const n = new Set(s);
                          if (n.has(numero)) n.delete(numero); else n.add(numero);
                          return n;
                        })}
                        className={`block w-full overflow-hidden rounded-lg border-2 bg-white ${
                          prise ? "border-blue-500 ring-2 ring-blue-500/40" : "border-gray-800 hover:border-gray-600"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={vig.url} alt={`Page ${numero}`} className="block w-full" />
                      </button>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-xs text-gray-400">
                          Page {numero}
                          {index + 1 !== numero && (
                            <span className="ml-1 text-blue-300">→ {index + 1}</span>
                          )}
                        </span>
                        {peutModifier && (
                          <span className="ml-auto flex gap-0.5">
                            <button onClick={() => deplacer(numero, -1)} disabled={index === 0}
                              className="rounded border border-gray-800 p-1 hover:bg-gray-800 disabled:opacity-20"
                              aria-label={`Avancer la page ${numero}`}>
                              <ChevronLeft size={11} />
                            </button>
                            <button onClick={() => deplacer(numero, 1)} disabled={index === ordre.length - 1}
                              className="rounded border border-gray-800 p-1 hover:bg-gray-800 disabled:opacity-20"
                              aria-label={`Reculer la page ${numero}`}>
                              <ChevronRight size={11} />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* LES CISEAUX, entre deux pages. */}
                    {modeDecoupe && index < ordre.length - 1 && (
                      <button
                        onClick={() => setCoupures((c) => {
                          const n = new Set(c);
                          if (n.has(index + 1)) n.delete(index + 1); else n.add(index + 1);
                          return n;
                        })}
                        className={`mt-12 rounded-full border p-1.5 ${
                          coupures.has(index + 1)
                            ? "border-amber-500 bg-amber-500 text-gray-900"
                            : "border-gray-700 text-gray-500 hover:border-amber-600 hover:text-amber-400"
                        }`}
                        aria-label={`Couper après la page ${index + 1}`}
                      >
                        <Scissors size={12} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {peutCreer && (
              <Fusionner
                documentId={documentId}
                nomCourant={doc.name}
                onFait={(m) => { setMessage(m); }}
                onErreur={setErreur}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── RETIRER DES PAGES ───────────────────────────── */

function ConfirmerRetrait({ pages, total, motif, setMotif, occupe, onAnnuler, onConfirmer }: {
  pages: number[]; total: number; motif: string; setMotif: (s: string) => void;
  occupe: boolean; onAnnuler: () => void; onConfirmer: () => void;
}) {
  return (
    <div className="mb-3 rounded-lg border border-red-800 bg-red-950/40 p-3">
      <p className="text-sm font-medium text-red-100">
        Retirer {pages.length} page{pages.length > 1 ? "s" : ""} sur {total} ?
      </p>
      <ul className="mt-1.5 space-y-0.5 text-xs text-red-200">
        <li>• Pages concernées : {pages.join(", ")}.</li>
        <li>• Le document passera de {total} à {total - pages.length} pages.</li>
        {/* CE QUI RASSURE DOIT ÊTRE DIT AUSSI : rien n'est perdu pour de bon. */}
        <li>• La version actuelle, complète, restera téléchargeable dans l&apos;historique.</li>
      </ul>
      <label className="mt-2 block">
        <span className="text-xs text-red-200">
          Pourquoi ces pages partent — dix caractères minimum
        </span>
        <input value={motif} onChange={(e) => setMotif(e.target.value)}
          placeholder="ex. pages blanches du scanner"
          className="mt-1 w-full rounded-lg border border-red-900 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-red-600" />
      </label>
      <div className="mt-2 flex gap-2">
        <button onClick={onConfirmer} disabled={occupe || motif.trim().length < 10}
          className="flex items-center gap-2 rounded-lg bg-red-700 px-3 py-1.5 text-sm hover:bg-red-600 disabled:opacity-40">
          {occupe && <Loader2 size={14} className="animate-spin" />} Retirer
        </button>
        <button onClick={onAnnuler}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-800">
          Garder toutes les pages
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────── FUSIONNER ────────────────────────────────── */

function Fusionner({ documentId, nomCourant, onFait, onErreur }: {
  documentId: number; nomCourant: string;
  onFait: (m: string) => void; onErreur: (e: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [candidats, setCandidats] = useState<Doc[]>([]);
  const [choisis, setChoisis] = useState<number[]>([]);
  const [nom, setNom] = useState("");
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    if (!ouvert) return;
    authFetch("/studio/documents?limite=200")
      .then(async (r) => {
        if (!r.ok) return;
        const d = await r.json();
        setCandidats((d.documents || []).filter(
          (x: Doc) => x.mime === "application/pdf" && x.id !== documentId && !x.trashed_at));
      })
      .catch(() => { /* la liste n'est pas vitale : on dira juste qu'elle est vide */ });
  }, [ouvert, documentId]);

  async function fusionner() {
    setOccupe(true);
    try {
      const r = await authFetch("/studio/pdf/fusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          /* CE DOCUMENT EN PREMIER, puis ceux choisis dans l'ordre des clics :
             l'ordre d'assemblage est celui qu'on a sous les yeux. */
          documents: [documentId, ...choisis],
          nom: nom.trim(),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { onErreur(j.error || "Fusion impossible."); return; }
      setOuvert(false); setChoisis([]); setNom("");
      onFait(j.message || "Documents fusionnés.");
    } catch { onErreur("Le serveur n'a pas répondu."); }
    finally { setOccupe(false); }
  }

  if (!ouvert) {
    return (
      <button onClick={() => { setOuvert(true); setNom(`${nomCourant.replace(/\.pdf$/i, "")} et suite`); }}
        className="mt-5 flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-sm hover:bg-gray-800">
        <FolderOpen size={14} /> Assembler avec d&apos;autres PDF
      </button>
    );
  }

  return (
    <section className="mt-5 rounded-xl border border-gray-800 bg-gray-900/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Assembler avec d&apos;autres PDF</h2>
        <button onClick={() => setOuvert(false)} className="rounded p-1 hover:bg-gray-800" aria-label="Fermer">
          <X size={16} />
        </button>
      </div>
      <p className="mb-2 text-xs text-gray-500">
        Un nouveau document sera créé. Ni celui-ci ni les autres ne seront
        modifiés. L&apos;ordre d&apos;assemblage est celui de vos clics,
        ce document venant en premier.
      </p>

      {!candidats.length ? (
        <p className="text-xs text-gray-600">Aucun autre PDF accessible.</p>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {candidats.map((c) => {
            const rang = choisis.indexOf(c.id);
            return (
              <li key={c.id}>
                <button
                  onClick={() => setChoisis((l) =>
                    l.includes(c.id) ? l.filter((x) => x !== c.id) : [...l, c.id])}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm min-w-0 ${
                    rang >= 0 ? "border-blue-600 bg-blue-950/40" : "border-gray-800 hover:bg-gray-800"
                  }`}
                >
                  <FileText size={14} className="shrink-0 text-gray-400" />
                  <span className="truncate">{c.name}</span>
                  {c.page_count ? (
                    <span className="shrink-0 text-xs text-gray-500">{c.page_count} p.</span>
                  ) : null}
                  {rang >= 0 && (
                    <span className="ml-auto shrink-0 rounded bg-blue-600 px-1.5 text-xs">
                      {rang + 2}ᵉ
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <label className="mt-2 block">
        <span className="text-xs text-gray-400">Nom du document assemblé</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-600" />
      </label>

      <button onClick={fusionner} disabled={occupe || !choisis.length || !nom.trim()}
        className="mt-2 flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500 disabled:opacity-30">
        {occupe ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        Assembler {choisis.length + 1} documents
      </button>
    </section>
  );
}
