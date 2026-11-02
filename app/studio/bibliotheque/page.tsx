"use client";

/**
 * LA BIBLIOTHÈQUE DOCUMENTAIRE DU STUDIO.
 *
 * C'est l'écran où les documents vivent : on les dépose, on les cherche, on
 * les ouvre, on les partage, on les jette — et on peut les ravoir.
 *
 * CE QUE CET ÉCRAN REFUSE DE CACHER.
 *
 * 1. QU'UN DOCUMENT A ÉTÉ MODIFIÉ. La liste des versions marque l'original
 *    d'un fermoir et le dit en clair. Présenter la dernière version comme si
 *    c'était le document d'origine serait un faux : le cahier des charges
 *    l'interdit, et un reçu retouché qui passe pour un reçu d'origine est un
 *    problème comptable, pas un détail d'affichage.
 *
 * 2. QUE CE LIEN NE SERA PLUS JAMAIS RELU. Le serveur ne garde que
 *    l'empreinte du jeton. Si la fenêtre se ferme sans qu'on l'ait copié, il
 *    est perdu — et il faut en créer un autre. L'écran le dit AVANT, et
 *    oblige à fermer soi-même.
 *
 * 3. QUE LA CORBEILLE N'EST PAS LA SUPPRESSION. Jeter est réversible et le
 *    bouton le dit. Supprimer ne l'est pas : la confirmation énonce ce qui
 *    disparaît, exige un motif, et ne se contente pas d'un « Êtes-vous
 *    sûr ? » auquel personne ne réfléchit.
 *
 * 4. QU'ON NE VOIT PAS TOUT. Un document privé d'un collègue n'apparaît pas,
 *    et l'écran ne prétend pas afficher le fonds complet de la société.
 *
 * L'écran n'additionne rien et ne recalcule rien : il affiche ce que le
 * serveur renvoie. Deux calculs du même chiffre finissent par diverger.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiUrl, authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";
import SignerDocument from "../../components/SignerDocument";
import {
  ArrowLeft, Upload, Search, Folder, FolderPlus, FileText, Image as ImageIcon,
  Trash2, RotateCcw, Share2, Link2, History, Download, Eye, X, Lock,
  ShieldCheck, AlertTriangle, Users, Building2, Loader2, Copy, Check,
  FileSpreadsheet, Presentation, ScanLine, PenTool, Stamp, Layers,
} from "lucide-react";

/* ─────────────────────────── CE QUE RENVOIE LE SERVEUR ───────────────────── */

type Dossier = {
  id: number; name: string; path: string; parent_id: number | null;
  documents: number;
};

type Doc = {
  id: number; name: string; kind: string; mime: string; size_bytes: number;
  sha256: string; page_count: number | null; version: number; tags: string[];
  description: string; visibility: "PRIVE" | "EQUIPE" | "SOCIETE";
  folder_id: number | null; folder_path: string | null;
  owner_id: number | null; owner_name: string;
  created_at: string; updated_at: string; updated_by_name: string;
  trashed_at: string | null; trashed_by_name: string | null;
  source_document_id: number | null;
  je_suis_proprietaire: boolean; versions: number; partages: number;
  texte_reconnu: boolean;
};

type Version = {
  id: number; version: number; mime: string; size_bytes: number;
  sha256: string; page_count: number | null; change_note: string;
  is_original: boolean; created_by_name: string; created_at: string;
};

type Partage = {
  id: number; kind: "INTERNE" | "LIEN"; access: string;
  grantee_user_id: number | null; grantee_name: string | null;
  expires_at: string | null; max_downloads: number | null;
  download_count: number; revoked_at: string | null; revoke_reason: string;
  created_by_name: string; created_at: string;
};

type Trace = {
  action: string; detail: string; user_name: string; acted_at: string;
};

type Detail = {
  document: Doc; mon_niveau: string; motif_acces: string;
  versions: Version[]; partages: Partage[]; journal: Trace[];
};

/* ───────────────────────────────── OUTILS ────────────────────────────────── */

/* Les octets : on ne montre pas « 1483776 » à quelqu'un qui veut savoir si la
   pièce jointe passera par courriel. */
function poids(n: number): string {
  if (!n) return "0 o";
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

function moment(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* L'empreinte entière est illisible et inutile à l'écran ; ses deux bouts
   suffisent à comparer deux documents de visu, et la valeur complète reste
   dans l'infobulle pour qui veut la vérifier. */
function empreinteCourte(s: string): string {
  if (!s || s.length < 16) return s || "—";
  return `${s.slice(0, 8)}…${s.slice(-8)}`;
}

const ICONES: Record<string, typeof FileText> = {
  SCAN: ScanLine, PDF: FileText, IMAGE: ImageIcon, CREATION: PenTool,
  PRESENTATION: Presentation, SIGNATURE: PenTool, CACHET: Stamp,
};

function IconeDe({ doc }: { doc: Doc }) {
  let I = ICONES[doc.kind] || FileText;
  if (!ICONES[doc.kind]) {
    if (doc.mime?.startsWith("image/")) I = ImageIcon;
    else if (doc.mime?.includes("sheet") || doc.mime?.includes("excel")) I = FileSpreadsheet;
    else if (doc.mime?.includes("presentation")) I = Presentation;
  }
  return <I size={18} className="shrink-0 text-blue-300" />;
}

const VISIBILITES: Record<string, { texte: string; aide: string; Icone: typeof Lock }> = {
  PRIVE: {
    texte: "Privé", Icone: Lock,
    aide: "Vous seul, et les personnes à qui vous le partagez nommément.",
  },
  EQUIPE: {
    texte: "Équipe", Icone: Users,
    aide: "Les personnes à qui ce document est partagé nommément.",
  },
  SOCIETE: {
    texte: "Société", Icone: Building2,
    aide: "Toute personne de cette société ayant accès au Studio.",
  },
};

/* Les mots du journal, écrits pour être relus par quelqu'un qui n'a pas
   participé. « LECTURE » ne se raconte pas, « consulté » si. */
const ACTIONS: Record<string, string> = {
  DEPOT: "déposé", LECTURE: "consulté", TELECHARGEMENT: "téléchargé",
  APERCU: "aperçu", MODIFICATION: "modifié", NOUVELLE_VERSION: "nouvelle version",
  DEPLACEMENT: "déplacé", CORBEILLE: "mis à la corbeille",
  RESTAURATION: "restauré", SUPPRESSION: "supprimé définitivement",
  PARTAGE: "partagé", REVOCATION: "partage révoqué",
  LIEN_CREE: "lien créé", LIEN_UTILISE: "lien utilisé", REFUS: "accès refusé",
};

/* ═════════════════════════════════ ÉCRAN ═════════════════════════════════ */

export default function BibliothequeStudio() {
  const { can, loading: droitsEnCours } = usePermissions();

  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [dossierActif, setDossierActif] = useState<number | "tous" | "racine">("tous");
  const [corbeille, setCorbeille] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [rechercheLancee, setRechercheLancee] = useState("");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailEnCours, setDetailEnCours] = useState(false);
  /* QUELLE FICHE EST OUVERTE, MAINTENANT. Après une action (jeter,
     restaurer, nouvelle version) on recharge, et le rechargement rouvrait la
     fiche — même si entre-temps on l'avait fermée. Le panneau revenait donc
     tout seul une seconde après qu'on l'ait chassé. Ce repère dit à la
     réponse en vol si elle a encore le droit de s'afficher. */
  const fenetreOuverte = useRef<number | null>(null);

  const fermer = useCallback(() => {
    fenetreOuverte.current = null;
    setDetail(null);
  }, []);

  const peutDeposer = can("studio.bibliotheque", "create");
  const peutModifier = can("studio.bibliotheque", "update");
  const peutSupprimer = can("studio.bibliotheque", "delete");
  const peutPartager = can("studio.bibliotheque", "share");
  /* Signer dépend du module des signatures, pas de celui de la bibliothèque :
     quelqu'un peut avoir le droit de ranger des documents sans celui d'y
     apposer une marque. */
  const peutSigner = can("studio.signature", "create");
  /* Organiser les pages dépend du module de l'éditeur PDF. */
  const peutOrganiser = can("studio.pdf", "view");

  /* ───────────────────────────── CHARGEMENTS ────────────────────────────── */

  const chargerDossiers = useCallback(async () => {
    try {
      const r = await authFetch("/studio/dossiers");
      if (!r.ok) return;
      const d = await r.json();
      setDossiers(d.dossiers || []);
    } catch { /* la liste des dossiers n'est pas vitale pour afficher les documents */ }
  }, []);

  const chargerDocs = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      const p = new URLSearchParams();
      if (dossierActif !== "tous") p.set("dossier", String(dossierActif));
      if (corbeille) p.set("corbeille", "1");
      if (rechercheLancee.trim()) p.set("q", rechercheLancee.trim());
      const r = await authFetch(`/studio/documents?${p.toString()}`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        /* 404 ici veut dire « module non ouvert pour ce compte » : le backend
           ne distingue pas un module masqué d'une page absente, exprès. */
        setErreur(r.status === 404
          ? "Le Studio n'est pas ouvert pour votre compte dans cette société."
          : (e.error || "Lecture impossible."));
        setDocs([]);
        return;
      }
      const d = await r.json();
      setDocs(d.documents || []);
    } catch {
      setErreur("Le serveur n'a pas répondu.");
      setDocs([]);
    } finally {
      setChargement(false);
    }
  }, [dossierActif, corbeille, rechercheLancee]);

  useEffect(() => { chargerDossiers(); }, [chargerDossiers]);
  useEffect(() => { chargerDocs(); }, [chargerDocs]);

  /* Changer de société change le fonds : on ne garde pas les documents de
     l'autre à l'écran le temps d'un rechargement. */
  useEffect(() => {
    const vider = () => { setDocs([]); fermer(); chargerDossiers(); chargerDocs(); };
    window.addEventListener("triangle-entreprise-changee", vider);
    return () => window.removeEventListener("triangle-entreprise-changee", vider);
  }, [chargerDocs, chargerDossiers, fermer]);

  const ouvrir = useCallback(async (id: number) => {
    fenetreOuverte.current = id;
    setDetailEnCours(true);
    try {
      const r = await authFetch(`/studio/documents/${id}`);
      /* Fermée pendant la requête : on ne rouvre rien. */
      if (fenetreOuverte.current !== id) return;
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setErreur(e.error || "Ce document ne vous est pas accessible.");
        fenetreOuverte.current = null;
        return;
      }
      setDetail(await r.json());
    } catch {
      if (fenetreOuverte.current === id) setErreur("Le serveur n'a pas répondu.");
    } finally {
      setDetailEnCours(false);
    }
  }, []);


  const rafraichir = useCallback(async (id?: number) => {
    await chargerDocs();
    await chargerDossiers();
    if (id && fenetreOuverte.current === id) await ouvrir(id);
  }, [chargerDocs, chargerDossiers, ouvrir]);

  const parDossier = useMemo(() => {
    const m = new Map<number | null, number>();
    for (const d of docs) m.set(d.folder_id, (m.get(d.folder_id) || 0) + 1);
    return m;
  }, [docs]);

  if (droitsEnCours) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!can("studio.bibliotheque", "view")) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Lock className="mx-auto mb-4 text-gray-500" size={40} />
          <h1 className="text-xl font-semibold mb-2">Bibliothèque non accessible</h1>
          <p className="text-gray-400 text-sm">
            Votre compte n&apos;a pas l&apos;accès à la bibliothèque du Studio
            pour cette société. Un administrateur peut l&apos;ouvrir depuis les
            droits et permissions.
          </p>
          <Link href="/studio" className="inline-block mt-6 text-blue-400 hover:underline text-sm">
            Retour au Studio
          </Link>
        </div>
      </div>
    );
  }

  return (
    /* `min-w-0 w-full` : le <body> est en flex-col, et un enfant de flex a
       min-width:auto. Sans cela une largeur de tableau déborde toute la page
       sur téléphone et `overflow-x-auto` ne sert à rien. */
    <div className="min-h-screen bg-gray-950 text-white min-w-0 w-full">
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 min-w-0">
          <Link href="/studio" className="p-2 hover:bg-gray-800 rounded-lg shrink-0" aria-label="Retour au Studio">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold truncate">Bibliothèque documentaire</h1>
            <p className="text-xs text-gray-500 truncate">
              Les fichiers sont rangés hors du dossier public : aucune URL ne les atteint.
            </p>
          </div>
          {peutDeposer && !corbeille && (
            <Deposer
              dossiers={dossiers}
              dossierActif={typeof dossierActif === "number" ? dossierActif : null}
              /* LA FICHE S'OUVRE SUR CE QUI VIENT D'ÊTRE DÉPOSÉ. C'est
                 voulu : on voit aussitôt sous quel nom le document est
                 enregistré, qui peut le voir, et son empreinte. Un simple
                 « Document déposé » laisse ces trois questions ouvertes, et
                 c'est à ce moment-là qu'une erreur de société ou de
                 visibilité se corrige sans douleur. Échap referme. */
              onDepose={(id) => {
                setMessage("Document déposé.");
                chargerDocs(); chargerDossiers();
                if (id) ouvrir(id);
              }}
            />
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 min-w-0">
        {message && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
            <Check size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">{message}</span>
            <button onClick={() => setMessage("")} className="shrink-0 hover:text-white" aria-label="Fermer">
              <X size={14} />
            </button>
          </div>
        )}
        {erreur && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">{erreur}</span>
            <button onClick={() => setErreur("")} className="shrink-0 hover:text-white" aria-label="Fermer">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 min-w-0">
          {/* ───────────────────────── DOSSIERS ───────────────────────── */}
          <aside className="lg:w-64 shrink-0 min-w-0">
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-2">
              <Bouton
                actif={dossierActif === "tous" && !corbeille}
                onClick={() => { setDossierActif("tous"); setCorbeille(false); }}
              >
                <FileText size={16} /> Tous les documents
              </Bouton>
              <Bouton
                actif={dossierActif === "racine" && !corbeille}
                onClick={() => { setDossierActif("racine"); setCorbeille(false); }}
              >
                <Folder size={16} /> Hors dossier
                <Compte n={parDossier.get(null)} />
              </Bouton>

              <div className="my-2 border-t border-gray-800" />

              <div className="max-h-72 overflow-y-auto">
                {dossiers.map((d) => (
                  <Bouton
                    key={d.id}
                    actif={dossierActif === d.id && !corbeille}
                    onClick={() => { setDossierActif(d.id); setCorbeille(false); }}
                    /* La profondeur se lit dans le chemin : pas besoin d'un
                       arbre dépliable pour trois niveaux. */
                    indent={Math.max(0, d.path.split("/").filter(Boolean).length - 1)}
                  >
                    <Folder size={16} />
                    <span className="truncate">{d.name}</span>
                    <Compte n={d.documents} />
                  </Bouton>
                ))}
                {!dossiers.length && (
                  <p className="px-3 py-2 text-xs text-gray-600">Aucun dossier.</p>
                )}
              </div>

              {peutDeposer && (
                <NouveauDossier
                  dossiers={dossiers}
                  onCree={() => { setMessage("Dossier créé."); chargerDossiers(); }}
                />
              )}

              <div className="my-2 border-t border-gray-800" />
              <Bouton actif={corbeille} onClick={() => { setCorbeille(true); setDossierActif("tous"); }}>
                <Trash2 size={16} /> Corbeille
              </Bouton>
            </div>
          </aside>

          {/* ───────────────────────── DOCUMENTS ──────────────────────── */}
          <main className="flex-1 min-w-0">
            <form
              className="mb-3 flex gap-2 min-w-0"
              onSubmit={(e) => { e.preventDefault(); setRechercheLancee(recherche); }}
            >
              <div className="relative flex-1 min-w-0">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Nom, description, ou texte reconnu dans un scan…"
                  className="w-full rounded-lg border border-gray-800 bg-gray-900 pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-600"
                />
              </div>
              <button type="submit" className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
                Chercher
              </button>
              {rechercheLancee && (
                <button
                  type="button"
                  onClick={() => { setRecherche(""); setRechercheLancee(""); }}
                  className="shrink-0 rounded-lg border border-gray-800 px-3 py-2 text-sm hover:bg-gray-800"
                >
                  Effacer
                </button>
              )}
            </form>

            {corbeille && (
              <p className="mb-3 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
                Ces documents sont à la corbeille. Rien n&apos;est effacé : ils
                se restaurent d&apos;un clic. La suppression définitive, elle,
                est irréversible et demande un motif.
              </p>
            )}

            {chargement ? (
              <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
                <Loader2 size={16} className="animate-spin" /> Lecture…
              </div>
            ) : !docs.length ? (
              <div className="rounded-xl border border-dashed border-gray-800 py-14 text-center">
                <FileText className="mx-auto mb-3 text-gray-700" size={32} />
                <p className="text-sm text-gray-500">
                  {rechercheLancee
                    ? "Aucun document ne correspond à cette recherche."
                    : corbeille
                      ? "La corbeille est vide."
                      : "Aucun document ici."}
                </p>
                {!rechercheLancee && !corbeille && (
                  <p className="mx-auto mt-2 max-w-md text-xs text-gray-600">
                    Cette liste ne montre que ce qui vous est accessible : vos
                    documents, ceux partagés avec vous, et ceux ouverts à toute
                    la société. Les documents privés d&apos;un collègue
                    n&apos;y figurent pas.
                  </p>
                )}
              </div>
            ) : (
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li key={d.id}>
                    <button
                      onClick={() => ouvrir(d.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-3 text-left hover:border-gray-700 hover:bg-gray-900 min-w-0"
                    >
                      <IconeDe doc={d} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate font-medium">{d.name}</span>
                          {d.version > 1 && (
                            /* On ne laisse pas croire que c'est l'original. */
                            <span className="shrink-0 rounded bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                              v{d.version} — modifié
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-gray-500">
                          {d.folder_path || "hors dossier"} · {poids(d.size_bytes)}
                          {d.page_count ? ` · ${d.page_count} page${d.page_count > 1 ? "s" : ""}` : ""}
                          {" · "}{d.owner_name}
                          {" · "}{moment(d.updated_at)}
                          {d.texte_reconnu ? " · texte reconnu" : ""}
                        </p>
                      </div>
                      <Visibilite v={d.visibility} />
                      {d.partages > 0 && (
                        <span className="hidden shrink-0 items-center gap-1 text-xs text-gray-500 sm:flex">
                          <Share2 size={12} /> {d.partages}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </main>
        </div>
      </div>

      {(detail || detailEnCours) && (
        <FicheDocument
          detail={detail}
          enCours={detailEnCours}
          droits={{ peutModifier, peutSupprimer, peutPartager, peutSigner, peutOrganiser }}
          dossiers={dossiers}
          onFermer={fermer}
          onChange={(msg, id) => { if (msg) setMessage(msg); rafraichir(id); }}
          onSupprime={(msg) => { setMessage(msg); fermer(); rafraichir(); }}
          onErreur={setErreur}
        />
      )}
    </div>
  );
}

/* ───────────────────────────── PETITES PIÈCES ───────────────────────────── */

function Bouton({ actif, onClick, children, indent = 0 }: {
  actif: boolean; onClick: () => void; children: React.ReactNode; indent?: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{ paddingLeft: 12 + indent * 12 }}
      className={`flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-sm min-w-0 ${
        actif ? "bg-blue-600/20 text-blue-200" : "text-gray-300 hover:bg-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

function Compte({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="ml-auto shrink-0 text-xs text-gray-600">{n}</span>;
}

function Visibilite({ v }: { v: string }) {
  const info = VISIBILITES[v] || VISIBILITES.PRIVE;
  const { Icone } = info;
  return (
    <span
      title={info.aide}
      className="hidden shrink-0 items-center gap-1 rounded border border-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400 sm:flex"
    >
      <Icone size={11} /> {info.texte}
    </span>
  );
}

/* ─────────────────────────────── DÉPOSER ────────────────────────────────── */

function Deposer({ dossiers, dossierActif, onDepose }: {
  dossiers: Dossier[]; dossierActif: number | null;
  onDepose: (id: number) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [visibilite, setVisibilite] = useState("PRIVE");
  const [dossierId, setDossierId] = useState<string>(dossierActif ? String(dossierActif) : "");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => { setDossierId(dossierActif ? String(dossierActif) : ""); }, [dossierActif]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!fichier) { setErreur("Choisissez un fichier."); return; }
    setEnvoi(true); setErreur("");
    try {
      const f = new FormData();
      f.append("fichier", fichier);
      if (nom.trim()) f.append("nom", nom.trim());
      if (description.trim()) f.append("description", description.trim());
      if (tags.trim()) f.append("tags", tags.trim());
      f.append("visibilite", visibilite);
      if (dossierId) f.append("dossier_id", dossierId);
      const r = await authFetch("/studio/documents", { method: "POST", body: f });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        /* Le serveur refuse les fichiers déguisés : du HTML renommé en PDF,
           par exemple. Le message dit pourquoi — sinon on réessaie
           indéfiniment le même fichier. */
        setErreur(d.error || "Dépôt refusé.");
        return;
      }
      setOuvert(false);
      setFichier(null); setNom(""); setDescription(""); setTags("");
      onDepose(d.document?.id);
    } catch {
      setErreur("Le serveur n'a pas répondu.");
    } finally {
      setEnvoi(false);
    }
  }

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="shrink-0 flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-500"
      >
        <Upload size={16} /> <span className="hidden sm:inline">Déposer</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <form onSubmit={envoyer} className="w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-4 my-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Déposer un document</h2>
          <button type="button" onClick={() => setOuvert(false)} className="p-1 hover:bg-gray-800 rounded" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <button
              type="button"
              onClick={() => champ.current?.click()}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed border-gray-700 px-3 py-6 text-left hover:border-gray-600"
            >
              <Upload size={18} className="shrink-0 text-gray-500" />
              <span className="min-w-0 flex-1">
                {fichier ? (
                  <>
                    <span className="block truncate">{fichier.name}</span>
                    <span className="text-xs text-gray-500">{poids(fichier.size)}</span>
                  </>
                ) : (
                  <span className="text-gray-500">Choisir un fichier…</span>
                )}
              </span>
            </button>
            <input
              ref={champ} type="file" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setFichier(f);
                if (f && !nom) setNom(f.name);
              }}
            />
          </div>

          <label className="block">
            <span className="text-xs text-gray-400">Nom</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 outline-none focus:border-blue-600" />
          </label>

          <label className="block">
            <span className="text-xs text-gray-400">Description (facultative)</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 outline-none focus:border-blue-600" />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="text-xs text-gray-400">Dossier</span>
              <select value={dossierId} onChange={(e) => setDossierId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 outline-none focus:border-blue-600">
                <option value="">Hors dossier</option>
                {dossiers.map((d) => <option key={d.id} value={d.id}>{d.path}</option>)}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="text-xs text-gray-400">Qui peut le voir</span>
              <select value={visibilite} onChange={(e) => setVisibilite(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 outline-none focus:border-blue-600">
                <option value="PRIVE">Privé — vous seul</option>
                <option value="EQUIPE">Équipe — les personnes désignées</option>
                <option value="SOCIETE">Société — tout le Studio</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-gray-400">Étiquettes, séparées par des virgules</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="contrat, 2026, client"
              className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 outline-none focus:border-blue-600" />
          </label>

          <p className="rounded-lg bg-gray-950 px-3 py-2 text-xs text-gray-500">
            Le fichier est rangé hors du dossier servi publiquement, sous une
            clé qui ne porte ni son nom ni son extension. Son empreinte est
            enregistrée : elle est revérifiée à chaque téléchargement.
          </p>

          {erreur && (
            <p className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-200">{erreur}</p>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={envoi || !fichier}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50">
            {envoi && <Loader2 size={14} className="animate-spin" />} Déposer
          </button>
          <button type="button" onClick={() => setOuvert(false)}
            className="rounded-lg border border-gray-800 px-4 py-2 text-sm hover:bg-gray-800">
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─────────────────────────── NOUVEAU DOSSIER ────────────────────────────── */

function NouveauDossier({ dossiers, onCree }: { dossiers: Dossier[]; onCree: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [parent, setParent] = useState("");
  const [erreur, setErreur] = useState("");

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return;
    setErreur("");
    try {
      const r = await authFetch("/studio/dossiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom.trim(), parent_id: parent || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || "Création impossible."); return; }
      setNom(""); setParent(""); setOuvert(false); onCree();
    } catch { setErreur("Le serveur n'a pas répondu."); }
  }

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)}
        className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-800 hover:text-gray-300">
        <FolderPlus size={16} /> Nouveau dossier
      </button>
    );
  }

  return (
    <form onSubmit={creer} className="mt-1 space-y-2 rounded-lg bg-gray-950 p-2">
      <input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du dossier"
        className="w-full rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-sm outline-none focus:border-blue-600" />
      <select value={parent} onChange={(e) => setParent(e.target.value)}
        className="w-full rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-xs outline-none focus:border-blue-600">
        <option value="">À la racine</option>
        {dossiers.map((d) => <option key={d.id} value={d.id}>Dans {d.path}</option>)}
      </select>
      {erreur && <p className="text-xs text-red-300">{erreur}</p>}
      <div className="flex gap-1">
        <button type="submit" className="flex-1 rounded bg-blue-600 px-2 py-1.5 text-xs hover:bg-blue-500">Créer</button>
        <button type="button" onClick={() => { setOuvert(false); setErreur(""); }}
          className="rounded border border-gray-800 px-2 py-1.5 text-xs hover:bg-gray-800">Annuler</button>
      </div>
    </form>
  );
}

/* ═════════════════════════ LA FICHE D'UN DOCUMENT ════════════════════════ */

function FicheDocument({ detail, enCours, droits, dossiers, onFermer, onChange, onSupprime, onErreur }: {
  detail: Detail | null; enCours: boolean;
  droits: { peutModifier: boolean; peutSupprimer: boolean; peutPartager: boolean;
    peutSigner: boolean; peutOrganiser: boolean };
  dossiers: Dossier[];
  onFermer: () => void;
  onChange: (message: string, id?: number) => void;
  onSupprime: (message: string) => void;
  onErreur: (e: string) => void;
}) {
  const [onglet, setOnglet] = useState<"apercu" | "versions" | "partages" | "journal">("apercu");
  const [occupe, setOccupe] = useState("");
  const [signer, setSigner] = useState(false);

  useEffect(() => { setOnglet("apercu"); }, [detail?.document?.id]);

  /* Échap ferme : un panneau qui ne se ferme qu'au clic sur une croix de
     16 pixels est une impasse sur téléphone. */
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onFermer(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFermer]);

  if (enCours && !detail) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!detail) return null;

  const d = detail.document;
  const lectureSeule = detail.mon_niveau === "LECTURE";
  const modifiable = droits.peutModifier && !lectureSeule && !d.trashed_at;

  async function agir(chemin: string, options: RequestInit, succes: string) {
    setOccupe(chemin);
    try {
      const r = await authFetch(chemin, options);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { onErreur(j.error || "Action impossible."); return null; }
      onChange(succes, d.id);
      return j;
    } catch { onErreur("Le serveur n'a pas répondu."); return null; }
    finally { setOccupe(""); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-0 sm:p-4">
      <div className="w-full max-w-3xl rounded-none border-gray-800 bg-gray-900 sm:my-8 sm:rounded-xl sm:border min-w-0">
        {/* ───── en-tête ───── */}
        <div className="flex items-start gap-3 border-b border-gray-800 p-4 min-w-0">
          <IconeDe doc={d} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold">{d.name}</h2>
            <p className="truncate text-xs text-gray-500">
              {d.folder_path || "hors dossier"} · {poids(d.size_bytes)} · {d.mime}
            </p>
          </div>
          <button onClick={onFermer} className="shrink-0 rounded p-1 hover:bg-gray-800" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        {/* ───── bandeaux d'honnêteté ───── */}
        <div className="space-y-2 px-4 pt-3">
          {d.version > 1 && (
            /* EXIGENCE EXPLICITE DU CAHIER DES CHARGES : un document modifié
               ne doit jamais être présenté comme un original intact. */
            <p className="flex items-start gap-2 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                Ce document a été modifié : vous consultez la version {d.version}.
                L&apos;original est conservé intact et reste téléchargeable
                dans l&apos;onglet « Versions ».
              </span>
            </p>
          )}
          {d.trashed_at && (
            <p className="flex items-start gap-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-300">
              <Trash2 size={14} className="mt-0.5 shrink-0" />
              <span>À la corbeille depuis le {moment(d.trashed_at)} par {d.trashed_by_name || "—"}. Rien n&apos;est effacé.</span>
            </p>
          )}
          {lectureSeule && (
            <p className="flex items-start gap-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-400">
              <Eye size={14} className="mt-0.5 shrink-0" />
              <span>
                Vous avez ce document en lecture{detail.motif_acces ? ` (${detail.motif_acces.toLowerCase()})` : ""}.
                Vous pouvez le consulter et le télécharger, pas le modifier.
              </span>
            </p>
          )}
        </div>

        {/* ───── onglets ───── */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-800 px-4 pt-3">
          {([
            ["apercu", "Aperçu", Eye],
            ["versions", `Versions (${detail.versions.length})`, History],
            ["partages", `Partages (${detail.partages.filter((p) => !p.revoked_at).length})`, Share2],
            ["journal", "Journal", ShieldCheck],
          ] as const).map(([cle, texte, I]) => (
            <button
              key={cle} onClick={() => setOnglet(cle)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${
                onglet === cle ? "border-blue-500 text-blue-300" : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              <I size={14} /> {texte}
            </button>
          ))}
        </div>

        <div className="p-4">
          {onglet === "apercu" && (
            <Apercu d={d} detail={detail} modifiable={modifiable} dossiers={dossiers}
              onChange={onChange} onErreur={onErreur} />
          )}
          {onglet === "versions" && (
            <Versions detail={detail} modifiable={modifiable}
              onChange={onChange} onErreur={onErreur} />
          )}
          {onglet === "partages" && (
            <Partages detail={detail} peutPartager={droits.peutPartager && !d.trashed_at}
              onChange={onChange} onErreur={onErreur} />
          )}
          {onglet === "journal" && <Journal journal={detail.journal} />}
        </div>

        {/* ───── actions ───── */}
        <div className="flex flex-wrap gap-2 border-t border-gray-800 p-4">
          <Telecharger chemin={`/studio/documents/${d.id}/fichier`} nom={d.name} mime={d.mime} onErreur={onErreur} />

          {/* ON NE PROPOSE DE SIGNER QUE CE QUI SE SIGNE : un PDF, pas à la
              corbeille, et seulement si l'on peut modifier le document. */}
          {droits.peutOrganiser && d.mime === "application/pdf" && !d.trashed_at && (
            <Link
              href={`/studio/pdf/${d.id}`}
              className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-sm hover:bg-gray-800"
            >
              <Layers size={14} /> Organiser les pages
            </Link>
          )}

                    {droits.peutSigner && d.mime === "application/pdf" && !d.trashed_at && modifiable && (
            <button
              onClick={() => setSigner(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-sm hover:bg-gray-800"
            >
              <PenTool size={14} /> Signer
            </button>
          )}

          {droits.peutModifier && !d.trashed_at && !lectureSeule && (
            <button
              disabled={!!occupe}
              onClick={() => agir(`/studio/documents/${d.id}/corbeille`, { method: "POST" },
                "Mis à la corbeille. Vous pouvez le restaurer.")}
              className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              <Trash2 size={14} /> Mettre à la corbeille
            </button>
          )}

          {droits.peutModifier && d.trashed_at && (
            <button
              disabled={!!occupe}
              onClick={() => agir(`/studio/documents/${d.id}/restaurer`, { method: "POST" }, "Document restauré.")}
              className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              <RotateCcw size={14} /> Restaurer
            </button>
          )}

          {droits.peutSupprimer && d.trashed_at && (
            <SupprimerDefinitivement d={d} onSupprime={onSupprime} onErreur={onErreur} />
          )}
        </div>
      </div>

      {signer && (
        <SignerDocument
          documentId={d.id}
          documentNom={d.name}
          onFermer={() => setSigner(false)}
          onFini={(m) => { setSigner(false); onChange(m, d.id); }}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────── APERÇU ────────────────────────────────── */

/* Les types qu'un navigateur affiche sans risque. Ni HTML ni SVG : les deux
   exécutent du script, et un aperçu ne doit pas faire tourner le code d'un
   fichier déposé par quelqu'un d'autre. */
const AFFICHABLES = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "text/plain",
]);

function Apercu({ d, detail, modifiable, dossiers, onChange, onErreur }: {
  d: Doc; detail: Detail; modifiable: boolean; dossiers: Dossier[];
  onChange: (m: string, id?: number) => void; onErreur: (e: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [chargeApercu, setChargeApercu] = useState(false);
  const [edite, setEdite] = useState(false);
  const [nom, setNom] = useState(d.name);
  const [description, setDescription] = useState(d.description);
  const [visibilite, setVisibilite] = useState(d.visibility);
  const [dossierId, setDossierId] = useState(d.folder_id ? String(d.folder_id) : "");

  useEffect(() => {
    setNom(d.name); setDescription(d.description); setVisibilite(d.visibility);
    setDossierId(d.folder_id ? String(d.folder_id) : ""); setEdite(false);
  }, [d.id, d.name, d.description, d.visibility, d.folder_id]);

  /* L'aperçu passe par authFetch, pas par une balise <img src="…"> : le
     fichier n'est servi qu'à une requête portant le jeton, donc une URL
     seule ne donne rien. L'objet URL est libéré au démontage, sans quoi le
     contenu reste en mémoire du navigateur après la fermeture. */
  useEffect(() => {
    if (!AFFICHABLES.has(d.mime)) return;
    let vivant = true; let cree = "";
    setChargeApercu(true);
    authFetch(`/studio/documents/${d.id}/fichier?apercu=1`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const b = await r.blob();
        if (!vivant) return;
        cree = URL.createObjectURL(b);
        setUrl(cree);
      })
      .catch(() => { if (vivant) setUrl(""); })
      .finally(() => { if (vivant) setChargeApercu(false); });
    return () => { vivant = false; if (cree) URL.revokeObjectURL(cree); setUrl(""); };
  }, [d.id, d.mime]);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await authFetch(`/studio/documents/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nom, description, visibility: visibilite,
          folder_id: dossierId ? Number(dossierId) : null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { onErreur(j.error || "Modification impossible."); return; }
      setEdite(false);
      onChange("Fiche mise à jour.", d.id);
    } catch { onErreur("Le serveur n'a pas répondu."); }
  }

  return (
    <div className="space-y-4 min-w-0">
      {AFFICHABLES.has(d.mime) ? (
        <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-950">
          {chargeApercu ? (
            <div className="flex h-56 items-center justify-center text-gray-600">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : !url ? (
            <div className="flex h-32 items-center justify-center text-xs text-gray-600">
              L&apos;aperçu n&apos;a pas pu être chargé.
            </div>
          ) : d.mime === "application/pdf" ? (
            <iframe src={url} title={`Aperçu de ${d.name}`} className="h-[55vh] w-full bg-white" />
          ) : d.mime === "text/plain" ? (
            <iframe src={url} title={`Aperçu de ${d.name}`} className="h-64 w-full bg-white" />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={url} alt={d.name} className="max-h-[55vh] w-full object-contain" />
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-4 text-xs text-gray-500">
          Ce format ne s&apos;affiche pas dans le navigateur ({d.mime}).
          Téléchargez-le pour l&apos;ouvrir. Les fichiers HTML et SVG ne sont
          volontairement jamais affichés ici : ils peuvent exécuter du code.
        </p>
      )}

      {!edite ? (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          <Ligne t="Nature">{d.kind}</Ligne>
          <Ligne t="Qui peut le voir">
            {(VISIBILITES[d.visibility] || VISIBILITES.PRIVE).texte}
            <span className="block text-xs text-gray-600">
              {(VISIBILITES[d.visibility] || VISIBILITES.PRIVE).aide}
            </span>
          </Ligne>
          <Ligne t="Déposé par">{d.owner_name} · {moment(d.created_at)}</Ligne>
          <Ligne t="Dernière modification">{d.updated_by_name || "—"} · {moment(d.updated_at)}</Ligne>
          {d.page_count ? <Ligne t="Pages">{d.page_count}</Ligne> : null}
          <Ligne t="Empreinte SHA-256">
            <span title={d.sha256} className="font-mono text-xs">{empreinteCourte(d.sha256)}</span>
            <span className="block text-xs text-gray-600">
              Revérifiée à chaque téléchargement : un fichier altéré n&apos;est pas servi.
            </span>
          </Ligne>
          {d.description ? <Ligne t="Description" large>{d.description}</Ligne> : null}
          {d.tags?.length ? (
            <Ligne t="Étiquettes" large>
              <span className="flex flex-wrap gap-1">
                {d.tags.map((t) => (
                  <span key={t} className="rounded bg-gray-800 px-1.5 py-0.5 text-xs">{t}</span>
                ))}
              </span>
            </Ligne>
          ) : null}
          {d.texte_reconnu && (
            <Ligne t="Texte reconnu" large>
              Ce document porte du texte reconnu : il est trouvable par son
              contenu dans la recherche.
            </Ligne>
          )}
        </dl>
      ) : (
        <form onSubmit={enregistrer} className="space-y-3 rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm">
          <label className="block">
            <span className="text-xs text-gray-400">Nom</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 outline-none focus:border-blue-600" />
          </label>
          <label className="block">
            <span className="text-xs text-gray-400">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 outline-none focus:border-blue-600" />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="text-xs text-gray-400">Dossier</span>
              <select value={dossierId} onChange={(e) => setDossierId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 outline-none focus:border-blue-600">
                <option value="">Hors dossier</option>
                {dossiers.map((x) => <option key={x.id} value={x.id}>{x.path}</option>)}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="text-xs text-gray-400">Qui peut le voir</span>
              <select value={visibilite} onChange={(e) => setVisibilite(e.target.value as Doc["visibility"])}
                className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 outline-none focus:border-blue-600">
                <option value="PRIVE">Privé</option>
                <option value="EQUIPE">Équipe</option>
                <option value="SOCIETE">Société</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm hover:bg-blue-500">Enregistrer</button>
            <button type="button" onClick={() => setEdite(false)}
              className="rounded-lg border border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-800">Annuler</button>
          </div>
        </form>
      )}

      {modifiable && !edite && (
        <button onClick={() => setEdite(true)} className="text-sm text-blue-400 hover:underline">
          Renommer, déplacer, changer la visibilité
        </button>
      )}
    </div>
  );
}

function Ligne({ t, children, large }: { t: string; children: React.ReactNode; large?: boolean }) {
  return (
    <div className={large ? "sm:col-span-2 min-w-0" : "min-w-0"}>
      <dt className="text-xs text-gray-500">{t}</dt>
      <dd className="break-words text-gray-200">{children}</dd>
    </div>
  );
}

/* ─────────────────────────────── VERSIONS ───────────────────────────────── */

function Versions({ detail, modifiable, onChange, onErreur }: {
  detail: Detail; modifiable: boolean;
  onChange: (m: string, id?: number) => void; onErreur: (e: string) => void;
}) {
  const [fichier, setFichier] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  const d = detail.document;

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!fichier) return;
    setEnvoi(true);
    try {
      const f = new FormData();
      f.append("fichier", fichier);
      f.append("note", note);
      const r = await authFetch(`/studio/documents/${d.id}/versions`, { method: "POST", body: f });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { onErreur(j.error || "Nouvelle version refusée."); return; }
      setFichier(null); setNote("");
      onChange(`Version ${j.document?.version} enregistrée. L'original reste intact.`, d.id);
    } catch { onErreur("Le serveur n'a pas répondu."); }
    finally { setEnvoi(false); }
  }

  return (
    <div className="space-y-4 min-w-0">
      <p className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-gray-400">
        Chaque modification ajoute une version : aucune ne remplace la
        précédente, et la version 1 — l&apos;original — garde son fichier et
        son empreinte pour toujours.
      </p>

      <ul className="space-y-2">
        {detail.versions.map((v) => (
          <li key={v.id} className="rounded-lg border border-gray-800 bg-gray-950 p-3 min-w-0">
            <div className="flex items-start gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Version {v.version}</span>
                  {v.is_original && (
                    <span className="flex items-center gap-1 rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
                      <ShieldCheck size={10} /> original, jamais modifié
                    </span>
                  )}
                  {v.version === d.version && !v.is_original && (
                    <span className="rounded bg-blue-900/60 px-1.5 py-0.5 text-[10px] font-medium text-blue-200">
                      version affichée
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {v.created_by_name} · {moment(v.created_at)} · {poids(v.size_bytes)}
                  {v.page_count ? ` · ${v.page_count} p.` : ""}
                </p>
                {v.change_note && (
                  <p className="mt-1 break-words text-xs text-gray-300">« {v.change_note} »</p>
                )}
                <p className="mt-1 font-mono text-[10px] text-gray-600" title={v.sha256}>
                  {empreinteCourte(v.sha256)}
                </p>
              </div>
              <Telecharger
                chemin={`/studio/versions/${v.id}/fichier`}
                nom={`${d.name} (v${v.version})`} mime={v.mime}
                compact onErreur={onErreur}
              />
            </div>
          </li>
        ))}
      </ul>

      {modifiable && (
        <form onSubmit={envoyer} className="space-y-2 rounded-lg border border-gray-800 bg-gray-950 p-3">
          <p className="text-sm font-medium">Enregistrer une nouvelle version</p>
          <button type="button" onClick={() => champ.current?.click()}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-700 px-3 py-3 text-left text-sm hover:border-gray-600">
            <Upload size={16} className="shrink-0 text-gray-500" />
            <span className="min-w-0 flex-1 truncate">
              {fichier ? fichier.name : <span className="text-gray-500">Choisir le fichier modifié…</span>}
            </span>
          </button>
          <input ref={champ} type="file" className="hidden"
            onChange={(e) => setFichier(e.target.files?.[0] || null)} />
          <label className="block">
            <span className="text-xs text-gray-400">
              Ce qui change, en dix caractères au moins — c&apos;est ce qu&apos;on relira dans six mois
            </span>
            <input value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="ex. montant corrigé après vérification du bon de livraison"
              className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm outline-none focus:border-blue-600" />
          </label>
          <button type="submit" disabled={envoi || !fichier || note.trim().length < 10}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm hover:bg-blue-500 disabled:opacity-50">
            {envoi && <Loader2 size={14} className="animate-spin" />} Enregistrer la version {d.version + 1}
          </button>
        </form>
      )}
    </div>
  );
}

/* ─────────────────────────────── PARTAGES ──────────────────────────────── */

function Partages({ detail, peutPartager, onChange, onErreur }: {
  detail: Detail; peutPartager: boolean;
  onChange: (m: string, id?: number) => void; onErreur: (e: string) => void;
}) {
  const d = detail.document;
  const [heures, setHeures] = useState("72");
  const [maxTel, setMaxTel] = useState("");
  const [lien, setLien] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [occupe, setOccupe] = useState(false);

  async function creerLien() {
    setOccupe(true);
    try {
      const r = await authFetch(`/studio/documents/${d.id}/liens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heures: Number(heures) || 72,
          max_telechargements: maxTel ? Number(maxTel) : null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { onErreur(j.error || "Création du lien impossible."); return; }
      /* On ne rafraîchit pas tout de suite : recharger la fiche ferait
         disparaître le jeton, et il n'est affiché qu'une fois. */
      setLien(j.lien);
    } catch { onErreur("Le serveur n'a pas répondu."); }
    finally { setOccupe(false); }
  }

  async function revoquer(id: number) {
    const motif = window.prompt("Pourquoi ce partage est-il révoqué ?");
    if (motif === null) return;
    try {
      const r = await authFetch(`/studio/partages/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motif }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { onErreur(j.error || "Révocation impossible."); return; }
      onChange("Partage révoqué. Le lien ne s'ouvrira plus.", d.id);
    } catch { onErreur("Le serveur n'a pas répondu."); }
  }

  /* L'adresse passe par apiUrl : si le backend est servi sur un autre
     domaine (NEXT_PUBLIC_API_URL), coller « /api » devant donnerait un lien
     qui n'ouvre rien chez le destinataire. */
  const adresseComplete = lien
    ? new URL(apiUrl(lien), typeof window !== "undefined" ? window.location.origin : "http://localhost").toString()
    : "";

  return (
    <div className="space-y-4 min-w-0">
      {lien && (
        /* LE JETON N'EXISTE PLUS NULLE PART AILLEURS. Le serveur n'en a gardé
           que l'empreinte. Fermer cette fenêtre sans l'avoir copié le perd
           définitivement : l'écran le dit, et ne se referme pas tout seul. */
        <div className="rounded-lg border border-amber-700 bg-amber-950/50 p-3">
          <p className="flex items-start gap-2 text-xs text-amber-100">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Copiez ce lien maintenant. Il n&apos;est affiché qu&apos;une
              seule fois : le serveur n&apos;en conserve que l&apos;empreinte
              et ne pourra jamais le réafficher. Si vous le perdez, il faudra
              en créer un autre et révoquer celui-ci.
            </span>
          </p>
          <div className="mt-2 flex gap-2 min-w-0">
            <input readOnly value={adresseComplete}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded border border-amber-800 bg-gray-950 px-2 py-1.5 font-mono text-xs" />
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(adresseComplete);
                  setCopie(true); setTimeout(() => setCopie(false), 2000);
                } catch {
                  /* Le presse-papiers est refusé hors HTTPS et dans certains
                     navigateurs : le champ reste sélectionnable à la main, on
                     ne prétend pas avoir copié. */
                  onErreur("Copie automatique refusée par le navigateur : sélectionnez le lien à la main.");
                }
              }}
              className="shrink-0 flex items-center gap-1 rounded bg-amber-700 px-2 py-1.5 text-xs hover:bg-amber-600"
            >
              {copie ? <Check size={12} /> : <Copy size={12} />} {copie ? "Copié" : "Copier"}
            </button>
          </div>
          <button onClick={() => { setLien(null); onChange("", d.id); }}
            className="mt-2 text-xs text-amber-200 underline">
            J&apos;ai copié le lien, fermer cet avertissement
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {detail.partages.map((p) => (
          <li key={p.id} className={`rounded-lg border p-3 min-w-0 ${
            p.revoked_at ? "border-gray-800 bg-gray-950 opacity-60" : "border-gray-700 bg-gray-950"
          }`}>
            <div className="flex items-start gap-2 min-w-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {p.kind === "LIEN" ? <Link2 size={14} className="text-gray-400" /> : <Users size={14} className="text-gray-400" />}
                  <span className="font-medium">
                    {p.kind === "LIEN" ? "Lien signé" : (p.grantee_name || "Personne supprimée")}
                  </span>
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300">{p.access}</span>
                  {p.revoked_at && (
                    <span className="rounded bg-red-900/60 px-1.5 py-0.5 text-[10px] text-red-200">révoqué</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  par {p.created_by_name} · {moment(p.created_at)}
                  {p.expires_at ? ` · expire le ${moment(p.expires_at)}` : ""}
                  {p.max_downloads ? ` · ${p.download_count}/${p.max_downloads} ouvertures` : ""}
                  {!p.max_downloads && p.kind === "LIEN" ? ` · ${p.download_count} ouverture${p.download_count > 1 ? "s" : ""}` : ""}
                </p>
                {p.revoke_reason && (
                  <p className="mt-1 break-words text-xs text-gray-400">Motif : {p.revoke_reason}</p>
                )}
              </div>
              {peutPartager && !p.revoked_at && (
                <button onClick={() => revoquer(p.id)}
                  className="shrink-0 rounded border border-gray-700 px-2 py-1 text-xs hover:bg-gray-800">
                  Révoquer
                </button>
              )}
            </div>
          </li>
        ))}
        {!detail.partages.length && (
          <p className="text-xs text-gray-600">Ce document n&apos;est partagé avec personne.</p>
        )}
      </ul>

      {peutPartager && (
        <div className="space-y-2 rounded-lg border border-gray-800 bg-gray-950 p-3">
          <p className="text-sm font-medium">Créer un lien signé</p>
          <p className="text-xs text-gray-500">
            Un lien s&apos;ouvre sans compte : il doit donc toujours expirer.
            Limiter le nombre d&apos;ouvertures réduit ce qu&apos;une
            transmission par erreur peut coûter.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="text-xs text-gray-400">Valable (heures)</span>
              <input type="number" min={1} max={720} value={heures} onChange={(e) => setHeures(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm outline-none focus:border-blue-600" />
            </label>
            <label className="block min-w-0">
              <span className="text-xs text-gray-400">Ouvertures maximum (vide = sans limite)</span>
              <input type="number" min={1} value={maxTel} onChange={(e) => setMaxTel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm outline-none focus:border-blue-600" />
            </label>
          </div>
          <button onClick={creerLien} disabled={occupe}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm hover:bg-blue-500 disabled:opacity-50">
            {occupe && <Loader2 size={14} className="animate-spin" />} <Link2 size={14} /> Créer le lien
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────── JOURNAL ──────────────────────────────── */

function Journal({ journal }: { journal: Trace[] }) {
  if (!journal.length) {
    return <p className="text-xs text-gray-600">Aucune trace enregistrée.</p>;
  }
  return (
    <div className="min-w-0">
      <p className="mb-3 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-gray-400">
        Chaque consultation, téléchargement et refus est tracé. Cette trace
        survit au document : si quelqu&apos;un le supprime définitivement,
        elle reste pour expliquer le vide.
      </p>
      <ul className="space-y-1.5">
        {journal.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-xs min-w-0">
            <span className="shrink-0 font-mono text-gray-600">{moment(t.acted_at)}</span>
            <span className="min-w-0 flex-1 break-words text-gray-300">
              <strong className="font-medium">{t.user_name || "—"}</strong>
              {" "}{ACTIONS[t.action] || t.action.toLowerCase()}
              {t.detail ? ` — ${t.detail}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────────────── TÉLÉCHARGER ─────────────────────────────── */

/* Un <a href> n'emporte pas le jeton : le fichier doit être demandé par
   authFetch, puis remis au navigateur comme un objet local. */
function Telecharger({ chemin, nom, mime, compact, onErreur }: {
  chemin: string; nom: string; mime: string; compact?: boolean;
  onErreur: (e: string) => void;
}) {
  const [occupe, setOccupe] = useState(false);

  async function prendre() {
    setOccupe(true);
    try {
      const r = await authFetch(chemin);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        /* 409 : l'empreinte ne correspond plus. Le serveur refuse de servir,
           et c'est le bon comportement — on le dit tel quel. */
        onErreur(j.error || "Téléchargement impossible.");
        return;
      }
      const b = await r.blob();
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u;
      a.download = nom || "document";
      document.body.appendChild(a);
      a.click();
      a.remove();
      /* Révoqué après un tour de boucle : révoquer immédiatement annule le
         téléchargement sur certains navigateurs. */
      setTimeout(() => URL.revokeObjectURL(u), 10_000);
    } catch { onErreur("Le serveur n'a pas répondu."); }
    finally { setOccupe(false); }
  }

  if (compact) {
    return (
      <button onClick={prendre} disabled={occupe} title={`Télécharger (${mime})`}
        className="shrink-0 rounded border border-gray-700 p-1.5 hover:bg-gray-800 disabled:opacity-50"
        aria-label={`Télécharger ${nom}`}>
        {occupe ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      </button>
    );
  }

  return (
    <button onClick={prendre} disabled={occupe}
      className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50">
      {occupe ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Télécharger
    </button>
  );
}

/* ──────────────────── SUPPRESSION DÉFINITIVE ───────────────────────────── */

function SupprimerDefinitivement({ d, onSupprime, onErreur }: {
  d: Doc; onSupprime: (m: string) => void; onErreur: (e: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [occupe, setOccupe] = useState(false);

  async function supprimer() {
    setOccupe(true);
    try {
      const r = await authFetch(`/studio/documents/${d.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motif }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { onErreur(j.error || "Suppression impossible."); return; }
      onSupprime(`« ${d.name} » supprimé définitivement. Seule la trace du journal subsiste.`);
    } catch { onErreur("Le serveur n'a pas répondu."); }
    finally { setOccupe(false); }
  }

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)}
        className="flex items-center gap-2 rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300 hover:bg-red-950/50">
        <Trash2 size={14} /> Supprimer définitivement
      </button>
    );
  }

  return (
    /* La confirmation ÉNONCE ce qui devient impossible, au lieu de demander
       « Êtes-vous sûr ? » — question à laquelle personne ne réfléchit. */
    <div className="w-full rounded-lg border border-red-800 bg-red-950/40 p-3">
      <p className="text-sm font-medium text-red-100">Supprimer définitivement ce document ?</p>
      <ul className="mt-2 space-y-1 text-xs text-red-200">
        <li>• Les fichiers des {d.versions} version{d.versions > 1 ? "s" : ""}, original compris, sont effacés du disque.</li>
        <li>• Aucune restauration n&apos;est possible : la corbeille ne le contiendra plus.</li>
        <li>• Les liens de partage cessent d&apos;ouvrir quoi que ce soit.</li>
        <li>• Seule la ligne du journal subsiste, pour expliquer le vide.</li>
      </ul>
      <label className="mt-3 block">
        <span className="text-xs text-red-200">Motif — obligatoire, dix caractères au moins</span>
        <input value={motif} onChange={(e) => setMotif(e.target.value)}
          placeholder="ex. déposé par erreur dans la mauvaise société"
          className="mt-1 w-full rounded-lg border border-red-900 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-red-600" />
      </label>
      <div className="mt-3 flex gap-2">
        <button onClick={supprimer} disabled={occupe || motif.trim().length < 10}
          className="flex items-center gap-2 rounded-lg bg-red-700 px-3 py-1.5 text-sm hover:bg-red-600 disabled:opacity-50">
          {occupe && <Loader2 size={14} className="animate-spin" />} Supprimer définitivement
        </button>
        <button onClick={() => { setOuvert(false); setMotif(""); }}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-800">
          Garder le document
        </button>
      </div>
    </div>
  );
}
