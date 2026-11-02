"use client";

/**
 * LE SCANNER.
 *
 * Viser une feuille, la voir détectée, capturer, corriger si besoin, page
 * suivante — puis assembler en PDF rangé dans la bibliothèque.
 *
 * CE QUE CET ÉCRAN REFUSE DE FAIRE.
 *
 * 1. PERDRE DES PAGES. Chaque page part au serveur dès qu'elle est gardée.
 *    Scanner un contrat de douze feuilles prend plusieurs minutes : l'écran
 *    se verrouille, un appel entre, le navigateur recharge l'onglet. Des
 *    pages qui ne vivraient que dans cette page web seraient perdues — et la
 *    deuxième fois, on ne scanne plus, on photographie mal.
 *
 * 2. FAIRE SEMBLANT D'AVOIR REDRESSÉ. Quand aucun contour n'est trouvé, le
 *    bandeau le dit et la capture reste possible — telle quelle, sans
 *    prétendre à une correction qui n'a pas eu lieu. Une page simplement
 *    photographiée et une page redressée ne se valent pas, et la liste
 *    distingue les deux.
 *
 * 3. CACHER CE QUE ÇA COÛTE. La reconnaissance d'image pèse 8,6 Mo : le
 *    chargement est annoncé, avec son avancement. Mieux vaut une attente
 *    expliquée qu'une page qu'on croit cassée.
 *
 * 4. EXIGER UNE CAMÉRA. Sur un poste fixe sans caméra, on importe une photo
 *    prise au téléphone : le même redressement s'applique. Un scanner qui ne
 *    marche que sur mobile n'est utilisable que la moitié du temps.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";
import {
  chargerVision, detecterCoins, redresser, aire, tailleRedressee,
  type Coins, type Vision,
} from "../../lib/vision";
import { LANGUES, fermerOcr, lireTexte, ocrDisponible, type ProgresOcr } from "../../lib/ocr";
import {
  ArrowLeft, Camera, CameraOff, Check, ChevronLeft, ChevronRight, FileText,
  FolderOpen, Image as ImageIcon, Loader2, Play, RotateCcw, ScanLine,
  Trash2, Upload, X, AlertTriangle, Crop, Lock, Layers, Type,
} from "lucide-react";

type Dossier = { id: number; name: string; path: string };
type Page = {
  id: number; position: number; mime: string; size_bytes: number;
  width_px: number | null; height_px: number | null;
  corrected: boolean; texte_reconnu: boolean; captured_at: string;
};
type Seance = {
  id: number; title: string; folder_id: number | null; visibility: string;
  page_format: string; status: string; document_id: number | null;
  ocr_language: string;
};
type AReprendre = {
  id: number; title: string; pages: number; octets: number;
  pages_redressees: number; updated_at: string; derniere_page: string | null;
};

const poids = (n: number) =>
  !n ? "0 o" : n < 1024 ? `${n} o`
    : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} Ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`;

const moment = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—"
    : d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/* La détection tourne sur une image réduite : analyser 1920×1080 à chaque
   image consomme tout le processeur du téléphone et la visée devient
   saccadée, ce qui fait bouger la feuille. */
const LARGEUR_ANALYSE = 480;
/* Combien de TEMPS le cadre doit rester immobile avant une capture
   automatique. En temps, pas en nombre d'images : à 60 images par seconde,
   neuf images font cent cinquante millisecondes — la capture partait avant
   que la main ait eu le temps de s'immobiliser. Et le même compte donnerait
   une seconde et demie sur un téléphone poussif. Le ressenti dépend du
   temps, pas du matériel.

   Huit dixièmes de seconde : assez pour que le mouvement s'arrête, assez
   court pour ne pas donner l'impression qu'il faut cesser de respirer. */
const STABILITE_MS = 800;
const DERIVE_MAX = 14;          /* pixels d'écart toléré entre deux images */
/* La feuille doit occuper une part crédible du cadre : sous ce seuil, le
   contour trouvé est en général un carrelage ou le bord de la table. */
const PART_MINIMALE = 0.12;

export default function ScannerStudio() {
  const { can, loading: droitsEnCours } = usePermissions();

  const [seance, setSeance] = useState<Seance | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [aReprendre, setAReprendre] = useState<AReprendre[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [occupe, setOccupe] = useState("");

  const peutScanner = can("studio.scanner", "create");

  /* ──────────────────────── LA VISION, À LA DEMANDE ──────────────────── */
  const [vision, setVision] = useState<Vision | null>(null);
  const [visionEtape, setVisionEtape] = useState("");
  const [visionErreur, setVisionErreur] = useState("");

  const demanderVision = useCallback(async () => {
    if (vision) return vision;
    setVisionErreur("");
    try {
      const v = await chargerVision(setVisionEtape);
      setVision(v);
      return v;
    } catch (e) {
      setVisionErreur(
        `${(e as Error).message} Vous pouvez tout de même capturer sans redressement.`);
      return null;
    }
  }, [vision]);

  /* ─────────────────────────── CHARGEMENTS ──────────────────────────── */
  const chargerReprise = useCallback(async () => {
    try {
      const r = await authFetch("/studio/scans");
      if (!r.ok) {
        if (r.status === 404) setErreur("Le scanner n'est pas ouvert pour votre compte dans cette société.");
        return;
      }
      setAReprendre((await r.json()).seances || []);
    } catch { /* la reprise n'est pas vitale pour commencer une séance */ }
  }, []);

  const chargerDossiers = useCallback(async () => {
    try {
      const r = await authFetch("/studio/dossiers");
      if (r.ok) setDossiers((await r.json()).dossiers || []);
    } catch { /* on scannera hors dossier */ }
  }, []);

  const chargerSeance = useCallback(async (id: number) => {
    try {
      const r = await authFetch(`/studio/scans/${id}`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setErreur(e.error || "Séance introuvable.");
        setSeance(null); setPages([]);
        return;
      }
      const d = await r.json();
      setSeance(d.seance); setPages(d.pages || []);
    } catch { setErreur("Le serveur n'a pas répondu."); }
  }, []);

  useEffect(() => { chargerReprise(); chargerDossiers(); }, [chargerReprise, chargerDossiers]);

  /* LE MOTEUR DE LECTURE RETIENT SON MODÈLE EN MÉMOIRE — plusieurs dizaines
     de mégaoctets. On le libère en quittant l'écran, sinon un onglet laissé
     ouvert toute la journée garde cette charge pour rien. */
  useEffect(() => () => { fermerOcr(); }, []);

  if (droitsEnCours) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!can("studio.scanner", "view")) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Lock className="mx-auto mb-4 text-gray-500" size={40} />
          <h1 className="mb-2 text-xl font-semibold">Scanner non accessible</h1>
          <p className="text-sm text-gray-400">
            Votre compte n&apos;a pas l&apos;accès au scanner pour cette société.
          </p>
          <Link href="/studio" className="mt-6 inline-block text-sm text-blue-400 hover:underline">
            Retour au Studio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white min-w-0 w-full">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 min-w-0">
          <Link href="/studio" className="shrink-0 rounded-lg p-2 hover:bg-gray-800" aria-label="Retour au Studio">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">Scanner</h1>
            <p className="truncate text-xs text-gray-500">
              {seance
                ? `${seance.title || "Sans titre"} — ${pages.length} page${pages.length > 1 ? "s" : ""}`
                : "Viser, capturer, assembler en PDF"}
            </p>
          </div>
          {seance && (
            <span className="shrink-0 rounded bg-gray-800 px-2 py-1 text-xs text-gray-300">
              nº {seance.id}
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-4 min-w-0">
        {message && (
          <Bandeau ton="vert" onFermer={() => setMessage("")}>{message}</Bandeau>
        )}
        {erreur && (
          <Bandeau ton="rouge" onFermer={() => setErreur("")}>{erreur}</Bandeau>
        )}

        {!seance ? (
          <Demarrer
            dossiers={dossiers}
            aReprendre={aReprendre}
            peutScanner={peutScanner}
            onOuverte={(s) => { setSeance(s); setPages([]); setMessage(""); }}
            onReprise={(id) => chargerSeance(id)}
            onErreur={setErreur}
          />
        ) : (
          <Numeriser
            seance={seance}
            pages={pages}
            vision={vision}
            visionEtape={visionEtape}
            visionErreur={visionErreur}
            occupe={occupe}
            onDemanderVision={demanderVision}
            onPages={setPages}
            onRecharger={() => chargerSeance(seance.id)}
            onOccupe={setOccupe}
            onMessage={setMessage}
            onErreur={setErreur}
            onTerminee={() => {
              setSeance(null); setPages([]);
              chargerReprise();
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────── PETITES PIÈCES ───────────────────────────── */

function Bandeau({ ton, children, onFermer }: {
  ton: "vert" | "rouge" | "ambre"; children: React.ReactNode; onFermer?: () => void;
}) {
  const style = {
    vert: "border-emerald-800 bg-emerald-950/50 text-emerald-200",
    rouge: "border-red-800 bg-red-950/50 text-red-200",
    ambre: "border-amber-800 bg-amber-950/40 text-amber-200",
  }[ton];
  const Icone = ton === "vert" ? Check : AlertTriangle;
  return (
    <div className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${style}`}>
      <Icone size={16} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {onFermer && (
        <button onClick={onFermer} className="shrink-0 hover:text-white" aria-label="Fermer">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ════════════════════════════ COMMENCER ════════════════════════════════ */

function Demarrer({ dossiers, aReprendre, peutScanner, onOuverte, onReprise, onErreur }: {
  dossiers: Dossier[]; aReprendre: AReprendre[]; peutScanner: boolean;
  onOuverte: (s: Seance) => void; onReprise: (id: number) => void;
  onErreur: (e: string) => void;
}) {
  const [titre, setTitre] = useState("");
  const [dossierId, setDossierId] = useState("");
  const [visibilite, setVisibilite] = useState("PRIVE");
  const [format, setFormat] = useState("AUTO");
  const [occupe, setOccupe] = useState(false);
  /* La reconnaissance de texte est un CHOIX, jamais une surprise : elle
     coûte plusieurs mégaoctets de téléchargement. Vide = pas de lecture. */
  const [langue, setLangue] = useState("");
  const [ocrPossible, setOcrPossible] = useState<boolean | null>(null);

  useEffect(() => { ocrDisponible().then(setOcrPossible); }, []);

  async function ouvrir(e: React.FormEvent) {
    e.preventDefault();
    setOccupe(true);
    try {
      const r = await authFetch("/studio/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre: titre.trim(), dossier_id: dossierId || null,
          visibilite, format, ocr_langue: langue,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { onErreur(d.error || "Ouverture impossible."); return; }
      onOuverte(d.seance);
    } catch { onErreur("Le serveur n'a pas répondu."); }
    finally { setOccupe(false); }
  }

  return (
    <div className="space-y-6 min-w-0">
      {/* CE QU'IL Y A À REPRENDRE, EN PREMIER. Sept pages en attente valent
          mieux que sept pages refaites. */}
      {aReprendre.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Layers size={16} /> Séances en attente
          </h2>
          <ul className="space-y-2">
            {aReprendre.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => onReprise(s.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-amber-900/60 bg-amber-950/20 px-3 py-3 text-left hover:border-amber-700 min-w-0"
                >
                  <ScanLine size={18} className="shrink-0 text-amber-300" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.title || `Séance nº ${s.id}`}</p>
                    <p className="truncate text-xs text-gray-400">
                      {s.pages} page{s.pages > 1 ? "s" : ""} déjà prise{s.pages > 1 ? "s" : ""}
                      {s.pages_redressees ? `, dont ${s.pages_redressees} redressée${s.pages_redressees > 1 ? "s" : ""}` : ""}
                      {" · "}{poids(Number(s.octets))}
                      {" · "}dernière page {moment(s.derniere_page)}
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-gray-500" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-600">
            Ces pages sont déjà au serveur : elles ont survécu à la fermeture
            de l&apos;onglet. Reprenez là où vous vous êtes arrêté.
          </p>
        </section>
      )}

      {peutScanner ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Nouvelle numérisation</h2>
          <form onSubmit={ouvrir} className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-sm">
            <label className="block">
              <span className="text-xs text-gray-400">
                De quoi s&apos;agit-il ? — c&apos;est maintenant, le papier en main, qu&apos;on le sait
              </span>
              <input
                value={titre} onChange={(e) => setTitre(e.target.value)}
                placeholder="ex. Contrat transport Bamako 2026"
                className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 outline-none focus:border-blue-600"
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block min-w-0">
                <span className="text-xs text-gray-400">Dossier</span>
                <select value={dossierId} onChange={(e) => setDossierId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 outline-none focus:border-blue-600">
                  <option value="">Hors dossier</option>
                  {dossiers.map((d) => <option key={d.id} value={d.id}>{d.path}</option>)}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="text-xs text-gray-400">Qui pourra le voir</span>
                <select value={visibilite} onChange={(e) => setVisibilite(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 outline-none focus:border-blue-600">
                  <option value="PRIVE">Privé — vous seul</option>
                  <option value="EQUIPE">Équipe</option>
                  <option value="SOCIETE">Société</option>
                </select>
              </label>
              <label className="block min-w-0">
                <span className="text-xs text-gray-400">Format du PDF</span>
                <select value={format} onChange={(e) => setFormat(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 outline-none focus:border-blue-600">
                  <option value="AUTO">Selon chaque page</option>
                  <option value="A4_PORTRAIT">A4 debout</option>
                  <option value="A4_PAYSAGE">A4 couché</option>
                </select>
              </label>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
              <p className="flex items-center gap-2 text-xs font-medium text-gray-300">
                <Type size={14} /> Reconnaissance du texte
              </p>
              {ocrPossible === false ? (
                /* ON NE PROPOSE PAS CE QUI ÉCHOUERA. */
                <p className="mt-1 text-xs text-amber-200">
                  La reconnaissance de texte n&apos;est pas installée sur ce
                  serveur. Les pages seront enregistrées sans texte : le PDF
                  se cherchera par son nom et sa description.
                </p>
              ) : (
                <>
                  <select value={langue} onChange={(e) => setLangue(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 outline-none focus:border-blue-600">
                    <option value="">Sans reconnaissance — plus rapide</option>
                    {Object.entries(LANGUES).map(([cle, l]) => (
                      <option key={cle} value={cle}>
                        {l.nom} — {l.poids} à télécharger une fois
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {langue
                      ? "Le texte est lu sur votre appareil : aucune image ne part vers un service extérieur. Le document devient trouvable par son contenu."
                      : "Sans reconnaissance, le document ne se cherchera que par son nom, sa description et ses étiquettes."}
                  </p>
                </>
              )}
            </div>
            <p className="rounded-lg bg-gray-950 px-3 py-2 text-xs text-gray-500">
              « Selon chaque page » suit l&apos;orientation réelle de chaque
              feuille : une annexe tarifaire à l&apos;italienne ne sera pas
              couchée de force sur un A4 debout, où elle sortirait illisible.
              Tant que la séance n&apos;est pas assemblée, ces pages ne sont
              visibles que de vous.
            </p>
            <button type="submit" disabled={occupe}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500 disabled:opacity-50">
              {occupe ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Commencer
            </button>
          </form>
        </section>
      ) : (
        <p className="rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-4 text-sm text-gray-400">
          Votre compte peut consulter le scanner mais pas numériser. Un
          administrateur peut l&apos;autoriser depuis les droits.
        </p>
      )}
    </div>
  );
}

/* ════════════════════════════ NUMÉRISER ════════════════════════════════ */

function Numeriser({
  seance, pages, vision, visionEtape, visionErreur, occupe,
  onDemanderVision, onPages, onRecharger, onOccupe, onMessage, onErreur, onTerminee,
}: {
  seance: Seance; pages: Page[]; vision: Vision | null;
  visionEtape: string; visionErreur: string; occupe: string;
  onDemanderVision: () => Promise<Vision | null>;
  onPages: (p: Page[]) => void;
  onRecharger: () => void;
  onOccupe: (s: string) => void;
  onMessage: (m: string) => void;
  onErreur: (e: string) => void;
  onTerminee: () => void;
}) {
  /* La prise en cours : l'image pleine résolution et ses coins, qu'on peut
     corriger avant de garder. */
  const [prise, setPrise] = useState<{ canvas: HTMLCanvasElement; coins: Coins | null } | null>(null);
  const [assembler, setAssembler] = useState(false);

  return (
    <div className="space-y-4 min-w-0">
      {prise ? (
        <Relecture
          prise={prise}
          vision={vision}
          langue={seance.ocr_language || ""}
          onAnnuler={() => setPrise(null)}
          onGardee={(page) => {
            setPrise(null);
            onPages([...pages, page].sort((a, b) => a.position - b.position));
            onMessage(`Page ${page.position} gardée.`);
          }}
          seanceId={seance.id}
          onErreur={onErreur}
        />
      ) : (
        <Viseur
          vision={vision}
          visionEtape={visionEtape}
          visionErreur={visionErreur}
          onDemanderVision={onDemanderVision}
          onPrise={(canvas, coins) => setPrise({ canvas, coins })}
          onErreur={onErreur}
        />
      )}

      <Feuillets
        seanceId={seance.id}
        pages={pages}
        occupe={occupe}
        onOccupe={onOccupe}
        onRecharger={onRecharger}
        onErreur={onErreur}
        onMessage={onMessage}
      />

      {!prise && (
        <div className="flex flex-wrap gap-2 border-t border-gray-800 pt-4">
          <button
            onClick={() => setAssembler(true)}
            disabled={!pages.length}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-40"
          >
            <FileText size={16} /> Assembler le PDF ({pages.length})
          </button>
          <Abandonner seanceId={seance.id} pages={pages.length}
            onAbandonnee={onTerminee} onErreur={onErreur} />
        </div>
      )}

      {assembler && (
        <Assemblage
          seance={seance} pages={pages.length}
          onFermer={() => setAssembler(false)}
          onFini={(m) => { onMessage(m); setAssembler(false); onTerminee(); }}
          onErreur={onErreur}
        />
      )}
    </div>
  );
}

/* ───────────────────────────── LE VISEUR ──────────────────────────────── */

function Viseur({ vision, visionEtape, visionErreur, onDemanderVision, onPrise, onErreur }: {
  vision: Vision | null; visionEtape: string; visionErreur: string;
  onDemanderVision: () => Promise<Vision | null>;
  onPrise: (canvas: HTMLCanvasElement, coins: Coins | null) => void;
  onErreur: (e: string) => void;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const calque = useRef<HTMLCanvasElement | null>(null);
  const travail = useRef<HTMLCanvasElement | null>(null);
  const flux = useRef<MediaStream | null>(null);
  const boucle = useRef<number | null>(null);
  const fichier = useRef<HTMLInputElement | null>(null);

  const [camera, setCamera] = useState<"eteinte" | "demarrage" | "allumee" | "refusee">("eteinte");
  const [refus, setRefus] = useState("");
  const [detecte, setDetecte] = useState(false);
  const [auto, setAutoEtat] = useState(true);
  /* On écrit dans les deux : l'état pour l'affichage de la case, la
     référence pour la boucle qui ne relit jamais l'état. */
  const setAuto = useCallback((valeur: boolean) => {
    autoRef.current = valeur; setAutoEtat(valeur);
  }, []);
  const [part, setPart] = useState(0);

  /* Les coins de la dernière image analysée, et depuis combien d'images le
     cadre ne bouge plus. Dans des refs : les remettre dans l'état à chaque
     image redessinerait tout le composant soixante fois par seconde. */
  const derniers = useRef<Coins | null>(null);
  /* Depuis QUAND le cadre ne bouge plus. Zéro signifie « il bouge ». */
  const immobileDepuis = useRef(0);
  const pris = useRef(false);

  /* LA BOUCLE D'ANALYSE RELIT CES RÉFÉRENCES, elle ne lit pas l'état.

     Une boucle qui se replanifie elle-même avec requestAnimationFrame garde
     pour toujours la fermeture créée au premier tour. Elle avait donc
     capturé « vision = null » — l'état au moment où la caméra s'allume,
     avant que les 8,6 Mo d'OpenCV aient fini d'arriver — et ne l'a jamais
     revu. Résultat : la caméra affichait bien l'image, mais aucune feuille
     n'était JAMAIS détectée. Exactement ce que vit un utilisateur la
     première fois, quand le téléchargement n'est pas encore en cache.

     Une référence n'est pas figée dans la fermeture : la boucle voit la
     valeur du moment. */
  const visionRef = useRef<Vision | null>(vision);
  const autoRef = useRef(true);

  useEffect(() => { visionRef.current = vision; }, [vision]);

  const arreter = useCallback(() => {
    if (boucle.current !== null) { cancelAnimationFrame(boucle.current); boucle.current = null; }
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
    setCamera("eteinte"); setDetecte(false); setPart(0);
    immobileDepuis.current = 0; derniers.current = null;
  }, []);

  /* LA CAMÉRA S'ÉTEINT EN QUITTANT. Un flux laissé ouvert garde la diode
     allumée et vide la batterie — et donne, à juste titre, le sentiment
     d'être filmé. */
  useEffect(() => arreter, [arreter]);

  const capturer = useCallback((coins: Coins | null) => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    /* On capture à la résolution de la caméra, pas à celle de l'analyse :
       un scan lisible demande les pixels d'origine. */
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);

    /* Les coins viennent de l'image réduite : il faut les remettre à
       l'échelle de l'image capturée, sinon le redressement rogne au hasard. */
    let pleine: Coins | null = null;
    if (coins && travail.current?.width) {
      const f = v.videoWidth / travail.current.width;
      const m = (p: { x: number; y: number }) => ({ x: p.x * f, y: p.y * f });
      pleine = {
        topLeftCorner: m(coins.topLeftCorner),
        topRightCorner: m(coins.topRightCorner),
        bottomLeftCorner: m(coins.bottomLeftCorner),
        bottomRightCorner: m(coins.bottomRightCorner),
      };
    }
    arreter();
    onPrise(c, pleine);
  }, [arreter, onPrise]);

  const analyser = useCallback(() => {
    const v = video.current, cal = calque.current;
    if (!v || !cal || !v.videoWidth) { boucle.current = requestAnimationFrame(analyser); return; }

    /* Le calque suit la taille affichée de la vidéo, sinon le quadrilatère
       se dessine à côté de la feuille. */
    const r = v.getBoundingClientRect();
    if (cal.width !== Math.round(r.width) || cal.height !== Math.round(r.height)) {
      cal.width = Math.round(r.width); cal.height = Math.round(r.height);
    }
    const ctx = cal.getContext("2d");
    if (!ctx) { boucle.current = requestAnimationFrame(analyser); return; }
    ctx.clearRect(0, 0, cal.width, cal.height);

    const v2 = visionRef.current;
    let coins: Coins | null = null;
    if (v2) {
      if (!travail.current) travail.current = document.createElement("canvas");
      const t = travail.current;
      const echelle = LARGEUR_ANALYSE / v.videoWidth;
      t.width = LARGEUR_ANALYSE;
      t.height = Math.max(1, Math.round(v.videoHeight * echelle));
      t.getContext("2d")?.drawImage(v, 0, 0, t.width, t.height);

      coins = detecterCoins(v2, t);
      /* Un contour qui n'occupe presque rien du cadre est en général un
         carrelage ou le bord de la table : on ne le présente pas comme une
         feuille détectée. */
      if (coins && aire(coins) < t.width * t.height * PART_MINIMALE) coins = null;
    }

    if (coins) {
      const f = cal.width / (travail.current?.width || 1);
      const p = [coins.topLeftCorner, coins.topRightCorner,
        coins.bottomRightCorner, coins.bottomLeftCorner];
      ctx.beginPath();
      ctx.moveTo(p[0].x * f, p[0].y * f);
      for (let i = 1; i < 4; i++) ctx.lineTo(p[i].x * f, p[i].y * f);
      ctx.closePath();
      ctx.strokeStyle = "rgba(34,197,94,0.95)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "rgba(34,197,94,0.14)";
      ctx.fill();

      /* LA STABILITÉ, PAS LA SEULE PRÉSENCE. Capturer dès qu'un contour
         apparaît donne une photo floue prise en mouvement. */
      const avant = derniers.current;
      const derive = avant ? Math.max(
        Math.hypot(coins.topLeftCorner.x - avant.topLeftCorner.x, coins.topLeftCorner.y - avant.topLeftCorner.y),
        Math.hypot(coins.topRightCorner.x - avant.topRightCorner.x, coins.topRightCorner.y - avant.topRightCorner.y),
        Math.hypot(coins.bottomLeftCorner.x - avant.bottomLeftCorner.x, coins.bottomLeftCorner.y - avant.bottomLeftCorner.y),
        Math.hypot(coins.bottomRightCorner.x - avant.bottomRightCorner.x, coins.bottomRightCorner.y - avant.bottomRightCorner.y),
      ) : Infinity;
      const maintenant = performance.now();
      if (derive >= DERIVE_MAX) immobileDepuis.current = maintenant;
      else if (!immobileDepuis.current) immobileDepuis.current = maintenant;
      derniers.current = coins;
      const immobile = maintenant - immobileDepuis.current;
      setDetecte(true);
      /* Une part de 0 à 1 : l'écran en fait une jauge compréhensible plutôt
         qu'un décompte d'images qui ne veut rien dire pour qui regarde. */
      setPart(Math.min(1, immobile / STABILITE_MS));

      if (autoRef.current && immobile >= STABILITE_MS && !pris.current) {
        pris.current = true;
        capturer(coins);
        return;
      }
    } else {
      immobileDepuis.current = 0; derniers.current = null;
      setDetecte(false); setPart(0);
    }

    boucle.current = requestAnimationFrame(analyser);
  }, [capturer]);

  const allumer = useCallback(async () => {
    setCamera("demarrage"); setRefus("");
    pris.current = false;
    /* La vision d'abord : démarrer la caméra puis faire attendre 8,6 Mo
       devant un flux déjà ouvert chauffe le téléphone pour rien. */
    await onDemanderVision();
    try {
      const f = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 }, height: { ideal: 1080 },
        },
        audio: false,
      });
      flux.current = f;
      if (video.current) {
        video.current.srcObject = f;
        await video.current.play().catch(() => {});
      }
      setCamera("allumee");
      boucle.current = requestAnimationFrame(analyser);
    } catch (e) {
      const nom = (e as DOMException)?.name || "";
      setCamera("refusee");
      /* On dit LAQUELLE des raisons : « échec » n'aide personne à agir. */
      setRefus(
        nom === "NotAllowedError"
          ? "L'accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur, ou importez une photo."
          : nom === "NotFoundError"
            ? "Aucune caméra sur cet appareil. Importez une photo prise au téléphone : le redressement s'applique de la même façon."
            : nom === "NotReadableError"
              ? "La caméra est déjà utilisée par une autre application."
              : `La caméra n'a pas démarré (${nom || "raison inconnue"}). Vous pouvez importer une photo.`);
    }
  }, [analyser, onDemanderVision]);

  /* L'IMPORT D'UNE PHOTO : même traitement, sans caméra. */
  const importer = useCallback(async (f: File) => {
    try {
      const v = await onDemanderVision();
      const url = URL.createObjectURL(f);
      try {
        const img = new Image();
        img.decoding = "sync";
        await new Promise<void>((ok, non) => {
          img.onload = () => ok();
          img.onerror = () => non(new Error("Cette image n'a pas pu être lue."));
          img.src = url;
        });
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext("2d")?.drawImage(img, 0, 0);
        /* La détection tourne sur une réduction, puis les coins sont remis à
           l'échelle : analyser une photo de 12 Mpx fige l'onglet. */
        let coins: Coins | null = null;
        if (v) {
          const t = document.createElement("canvas");
          const echelle = Math.min(1, LARGEUR_ANALYSE / c.width);
          t.width = Math.max(1, Math.round(c.width * echelle));
          t.height = Math.max(1, Math.round(c.height * echelle));
          t.getContext("2d")?.drawImage(c, 0, 0, t.width, t.height);
          const trouves = detecterCoins(v, t);
          if (trouves && aire(trouves) >= t.width * t.height * PART_MINIMALE) {
            const fa = c.width / t.width;
            const m = (p: { x: number; y: number }) => ({ x: p.x * fa, y: p.y * fa });
            coins = {
              topLeftCorner: m(trouves.topLeftCorner),
              topRightCorner: m(trouves.topRightCorner),
              bottomLeftCorner: m(trouves.bottomLeftCorner),
              bottomRightCorner: m(trouves.bottomRightCorner),
            };
          }
        }
        arreter();
        onPrise(c, coins);
      } finally { URL.revokeObjectURL(url); }
    } catch (e) { onErreur((e as Error).message || "Import impossible."); }
  }, [onDemanderVision, onPrise, onErreur, arreter]);

  return (
    <section className="min-w-0">
      {visionEtape && !vision && !visionErreur && (
        <p className="mb-2 flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2 text-xs text-gray-300">
          <Loader2 size={14} className="shrink-0 animate-spin" /> {visionEtape}
        </p>
      )}
      {visionErreur && <Bandeau ton="ambre">{visionErreur}</Bandeau>}

      <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-black">
        {/* La vidéo reste montée : la démonter entre deux captures redemande
            l'autorisation au navigateur sur certains appareils. */}
        <video
          ref={video} playsInline muted
          className={`block w-full ${camera === "allumee" ? "" : "hidden"}`}
          style={{ maxHeight: "60vh", objectFit: "contain" }}
        />
        <canvas
          ref={calque}
          className={`pointer-events-none absolute inset-0 h-full w-full ${camera === "allumee" ? "" : "hidden"}`}
        />

        {camera !== "allumee" && (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
            {camera === "refusee"
              ? <CameraOff size={34} className="text-gray-600" />
              : <ScanLine size={34} className="text-gray-600" />}
            {camera === "demarrage" ? (
              <p className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={14} className="animate-spin" /> Démarrage…
              </p>
            ) : camera === "refusee" ? (
              <p className="max-w-md text-sm text-amber-200">{refus}</p>
            ) : (
              <p className="max-w-md text-sm text-gray-400">
                Posez la feuille sur un fond contrasté — une table sombre pour
                du papier blanc. Le cadre vert apparaît quand les quatre coins
                sont trouvés.
              </p>
            )}
          </div>
        )}

        {camera === "allumee" && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 py-3">
            <span className={`rounded px-2 py-1 text-xs ${
              detecte ? "bg-emerald-900/80 text-emerald-100" : "bg-gray-900/80 text-gray-300"
            }`}>
              {detecte
                ? auto ? "Feuille détectée — immobilisez" : "Feuille détectée"
                : vision ? "Aucune feuille détectée" : "Détection en cours de chargement…"}
              {detecte && auto && (
                <span className="ml-2 inline-block h-1 w-12 overflow-hidden rounded bg-emerald-950 align-middle">
                  <span className="block h-full bg-emerald-300 transition-[width] duration-100"
                    style={{ width: `${Math.round(part * 100)}%` }} />
                </span>
              )}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => { pris.current = false; capturer(derniers.current); }}
                className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200"
              >
                <Camera size={16} /> Capturer
              </button>
              <button onClick={arreter}
                className="rounded-full bg-gray-800/90 p-2 text-gray-200 hover:bg-gray-700"
                aria-label="Éteindre la caméra">
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {camera !== "allumee" && (
          <button onClick={allumer} disabled={camera === "demarrage"}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50">
            <Camera size={16} /> {camera === "refusee" ? "Réessayer la caméra" : "Allumer la caméra"}
          </button>
        )}
        <button onClick={() => fichier.current?.click()}
          className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-sm hover:bg-gray-800">
          <Upload size={16} /> Importer une photo
        </button>
        <input ref={fichier} type="file" accept="image/*" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";          /* même fichier deux fois de suite */
            if (f) importer(f);
          }} />
        <label className="ml-auto flex items-center gap-2 text-xs text-gray-400">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)}
            className="h-4 w-4 rounded border-gray-700 bg-gray-900" />
          Capture automatique
        </label>
      </div>
    </section>
  );
}

/* ──────────────────── RELECTURE ET RETOUCHE DES COINS ─────────────────── */

function Relecture({ prise, vision, langue, seanceId, onAnnuler, onGardee, onErreur }: {
  prise: { canvas: HTMLCanvasElement; coins: Coins | null };
  vision: Vision | null; langue: string; seanceId: number;
  onAnnuler: () => void;
  onGardee: (p: Page) => void;
  onErreur: (e: string) => void;
}) {
  const toile = useRef<HTMLCanvasElement | null>(null);
  const [coins, setCoins] = useState<Coins | null>(prise.coins);
  const [tire, setTire] = useState<keyof Coins | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [apercu, setApercu] = useState<string>("");
  const [lecture, setLecture] = useState<ProgresOcr | null>(null);

  const ORDRE: (keyof Coins)[] = [
    "topLeftCorner", "topRightCorner", "bottomRightCorner", "bottomLeftCorner"];

  /* Pas de coins trouvés : on en propose quatre, en retrait des bords, à
     déplacer. Mieux vaut un cadre à corriger que pas de cadre du tout. */
  const coinsParDefaut = useCallback((): Coins => {
    const { width: w, height: h } = prise.canvas;
    const m = 0.08;
    return {
      topLeftCorner: { x: w * m, y: h * m },
      topRightCorner: { x: w * (1 - m), y: h * m },
      bottomRightCorner: { x: w * (1 - m), y: h * (1 - m) },
      bottomLeftCorner: { x: w * m, y: h * (1 - m) },
    };
  }, [prise.canvas]);

  const dessiner = useCallback(() => {
    const c = toile.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    /* On dessine à la taille affichée, pas à la taille de la photo : une
       photo de 1920 px dans un cadre de 360 px donnerait des poignées de
       trois pixels, intouchables au doigt. */
    const largeurCible = c.clientWidth || 360;
    const echelle = largeurCible / prise.canvas.width;
    c.width = Math.round(prise.canvas.width * echelle);
    c.height = Math.round(prise.canvas.height * echelle);
    ctx.drawImage(prise.canvas, 0, 0, c.width, c.height);

    if (!coins) return;
    const p = ORDRE.map((k) => coins[k]);
    ctx.beginPath();
    ctx.moveTo(p[0].x * echelle, p[0].y * echelle);
    for (let i = 1; i < 4; i++) ctx.lineTo(p[i].x * echelle, p[i].y * echelle);
    ctx.closePath();
    ctx.strokeStyle = "rgba(59,130,246,0.95)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "rgba(59,130,246,0.12)"; ctx.fill();
    for (const pt of p) {
      ctx.beginPath();
      ctx.arc(pt.x * echelle, pt.y * echelle, 11, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fill();
      ctx.strokeStyle = "rgba(37,99,235,1)"; ctx.lineWidth = 3; ctx.stroke();
    }
  }, [coins, prise.canvas]);

  useEffect(() => { dessiner(); }, [dessiner]);
  useEffect(() => {
    const r = () => dessiner();
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, [dessiner]);

  const position = (e: React.PointerEvent) => {
    const c = toile.current!;
    const r = c.getBoundingClientRect();
    const echelle = prise.canvas.width / r.width;
    return { x: (e.clientX - r.left) * echelle, y: (e.clientY - r.top) * echelle };
  };

  const attraper = (e: React.PointerEvent) => {
    const actuels = coins || coinsParDefaut();
    if (!coins) setCoins(actuels);
    const p = position(e);
    /* Le coin le plus proche, à condition d'être à portée du doigt : sinon un
       clic au milieu de la page téléporterait un coin. */
    let proche: keyof Coins | null = null, distance = Infinity;
    for (const k of ORDRE) {
      const d = Math.hypot(actuels[k].x - p.x, actuels[k].y - p.y);
      if (d < distance) { distance = d; proche = k; }
    }
    const portee = prise.canvas.width * 0.12;
    if (proche && distance < portee) {
      setTire(proche);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  };

  const bouger = (e: React.PointerEvent) => {
    if (!tire || !coins) return;
    const p = position(e);
    setCoins({
      ...coins,
      [tire]: {
        x: Math.max(0, Math.min(prise.canvas.width, p.x)),
        y: Math.max(0, Math.min(prise.canvas.height, p.y)),
      },
    } as Coins);
  };

  async function garder(redressee: boolean) {
    setEnvoi(true);
    try {
      let source = prise.canvas;
      let coinsUtilises: Coins | null = null;
      if (redressee) {
        if (!vision) { onErreur("La reconnaissance d'image n'est pas chargée : gardez la page telle quelle."); return; }
        if (!coins) { onErreur("Placez d'abord les quatre coins."); return; }
        source = redresser(vision, prise.canvas, coins);
        coinsUtilises = coins;
      }

      /* LA LECTURE SE FAIT SUR L'IMAGE REDRESSÉE, pas sur la photo d'origine :
         un texte de travers se lit beaucoup moins bien. Et elle se fait AVANT
         l'envoi, pour que la page parte déjà accompagnée de son texte. */
      let texte = "";
      if (langue) {
        try {
          setLecture({ etape: "Préparation de la lecture…", part: 0 });
          const r = await lireTexte(source, langue, setLecture);
          texte = r.texte;
          /* On ne cache pas une lecture ratée : un texte vide ou une
             confiance très basse veut dire que la page ne sera pas
             trouvable par son contenu, et il vaut mieux le savoir
             maintenant que six mois plus tard. */
          if (!texte) {
            onErreur("Aucun texte n'a pu être lu sur cette page : elle sera enregistrée sans texte.");
          } else if (r.confiance > 0 && r.confiance < 45) {
            onErreur(`Le texte lu est peu sûr (${Math.round(r.confiance)} %). La page est gardée, mais vérifiez l'éclairage et la netteté.`);
          }
        } catch (e) {
          /* Une lecture impossible ne doit pas faire perdre la page. */
          onErreur(`${(e as Error).message} La page est gardée sans texte.`);
        } finally {
          setLecture(null);
        }
      }

      const blob = await new Promise<Blob | null>((ok) =>
        source.toBlob((b) => ok(b), "image/jpeg", 0.92));
      if (!blob) { onErreur("La page n'a pas pu être encodée."); return; }

      const form = new FormData();
      form.append("page", blob, `page-${Date.now()}.jpg`);
      if (texte) form.append("ocr_texte", texte);
      if (redressee) form.append("redressee", "1");
      if (coinsUtilises) {
        form.append("coins", JSON.stringify(
          ORDRE.map((k) => [Math.round(coinsUtilises![k].x), Math.round(coinsUtilises![k].y)])));
      }
      const r = await authFetch(`/studio/scans/${seanceId}/pages`, { method: "POST", body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { onErreur(d.error || "La page n'a pas été acceptée."); return; }
      onGardee(d.page);
    } catch { onErreur("Le serveur n'a pas répondu."); }
    finally { setEnvoi(false); }
  }

  /* L'aperçu du redressement : on ne garde pas une page sans avoir vu ce que
     la correction donne. */
  const voirRedressement = useCallback(() => {
    if (!vision || !coins) return;
    try {
      const c = redresser(vision, prise.canvas, coins, 1200);
      setApercu(c.toDataURL("image/jpeg", 0.85));
    } catch { onErreur("Le redressement a échoué sur ces coins."); }
  }, [vision, coins, prise.canvas, onErreur]);

  const taille = coins ? tailleRedressee(coins) : null;

  return (
    <section className="min-w-0">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Crop size={16} /> Vérifier avant de garder
      </h2>

      {!prise.coins && (
        <Bandeau ton="ambre">
          Aucun contour n&apos;a été trouvé sur cette image : rien n&apos;a été
          redressé. Placez les quatre coins à la main, ou gardez la page telle
          quelle — elle sera alors marquée comme non redressée.
        </Bandeau>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-800 bg-black">
        <canvas
          ref={toile}
          className="block w-full touch-none"
          style={{ maxHeight: "58vh", objectFit: "contain" }}
          onPointerDown={attraper}
          onPointerMove={bouger}
          onPointerUp={() => setTire(null)}
          onPointerCancel={() => setTire(null)}
        />
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Faites glisser les poignées blanches sur les quatre coins de la feuille.
        {taille ? ` La page redressée mesurera ${taille.largeur}×${taille.hauteur} px.` : ""}
      </p>

      {apercu && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-gray-400">Aperçu du redressement :</p>
          <div className="overflow-hidden rounded-lg border border-gray-800 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={apercu} alt="Aperçu de la page redressée"
              className="mx-auto block max-h-[40vh] w-auto" />
          </div>
        </div>
      )}

      {lecture && (
        /* LE TÉLÉCHARGEMENT DU MOTEUR PREND DU TEMPS LA PREMIÈRE FOIS.
           Un bouton figé sans explication donne l'impression d'un blocage. */
        <div className="mt-3 rounded-lg border border-blue-900 bg-blue-950/40 px-3 py-2">
          <p className="flex items-center gap-2 text-xs text-blue-100">
            <Loader2 size={14} className="shrink-0 animate-spin" />
            {lecture.etape || "Lecture du texte…"}
          </p>
          <span className="mt-1 block h-1 w-full overflow-hidden rounded bg-blue-950">
            <span className="block h-full bg-blue-400 transition-[width] duration-200"
              style={{ width: `${Math.round(Math.min(1, lecture.part) * 100)}%` }} />
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => garder(true)} disabled={envoi || !vision || !coins}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-40">
          {envoi ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Redresser et garder
        </button>
        <button onClick={voirRedressement} disabled={!vision || !coins}
          className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-40">
          <ImageIcon size={16} /> Voir le redressement
        </button>
        <button onClick={() => garder(false)} disabled={envoi}
          className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-50">
          Garder telle quelle
        </button>
        <button onClick={onAnnuler} disabled={envoi}
          className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-50">
          <RotateCcw size={16} /> Reprendre
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────── LES PAGES PRISES ─────────────────────────── */

function Feuillets({ seanceId, pages, occupe, onOccupe, onRecharger, onErreur, onMessage }: {
  seanceId: number; pages: Page[]; occupe: string;
  onOccupe: (s: string) => void;
  onRecharger: () => void;
  onErreur: (e: string) => void;
  onMessage: (m: string) => void;
}) {
  if (!pages.length) {
    return (
      <p className="rounded-xl border border-dashed border-gray-800 px-4 py-6 text-center text-xs text-gray-600">
        Aucune page encore. Chaque page gardée part aussitôt au serveur :
        fermer cet onglet ne la perdra pas.
      </p>
    );
  }

  async function agir(chemin: string, options: RequestInit, succes: string, cle: string) {
    onOccupe(cle);
    try {
      const r = await authFetch(chemin, options);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { onErreur(d.error || "Action impossible."); return; }
      onMessage(succes);
      onRecharger();
    } catch { onErreur("Le serveur n'a pas répondu."); }
    finally { onOccupe(""); }
  }

  return (
    <section className="min-w-0">
      <h2 className="mb-2 text-sm font-semibold">
        {pages.length} page{pages.length > 1 ? "s" : ""}
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {pages.map((p, i) => (
          <li key={p.id} className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50 min-w-0">
            <Vignette seanceId={seanceId} page={p} />
            <div className="p-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium">Page {p.position}</span>
                {p.corrected ? (
                  <span className="rounded bg-emerald-900/60 px-1 py-0.5 text-[10px] text-emerald-200">
                    redressée
                  </span>
                ) : (
                  /* ON NE FAIT PAS SEMBLANT. Une page photographiée telle
                     quelle n'est pas une page redressée. */
                  <span className="rounded bg-gray-800 px-1 py-0.5 text-[10px] text-gray-400">
                    telle quelle
                  </span>
                )}
              </div>
              <p className="truncate text-[10px] text-gray-500">
                {poids(p.size_bytes)}
                {p.width_px ? ` · ${p.width_px}×${p.height_px}` : ""}
              </p>
              <div className="mt-1 flex items-center gap-1">
                <button
                  disabled={i === 0 || !!occupe}
                  onClick={() => agir(`/studio/scans/${seanceId}/pages/${p.id}/rang`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ vers: p.position - 1 }),
                  }, `Page déplacée en ${p.position - 1}.`, `m${p.id}`)}
                  className="rounded border border-gray-800 p-1 hover:bg-gray-800 disabled:opacity-30"
                  aria-label={`Remonter la page ${p.position}`}>
                  <ChevronLeft size={12} />
                </button>
                <button
                  disabled={i === pages.length - 1 || !!occupe}
                  onClick={() => agir(`/studio/scans/${seanceId}/pages/${p.id}/rang`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ vers: p.position + 1 }),
                  }, `Page déplacée en ${p.position + 1}.`, `d${p.id}`)}
                  className="rounded border border-gray-800 p-1 hover:bg-gray-800 disabled:opacity-30"
                  aria-label={`Descendre la page ${p.position}`}>
                  <ChevronRight size={12} />
                </button>
                <button
                  disabled={!!occupe}
                  onClick={() => agir(`/studio/scans/${seanceId}/pages/${p.id}`, { method: "DELETE" },
                    `Page ${p.position} retirée.`, `s${p.id}`)}
                  className="ml-auto rounded border border-gray-800 p-1 text-red-300 hover:bg-red-950/50 disabled:opacity-30"
                  aria-label={`Retirer la page ${p.position}`}>
                  {occupe === `s${p.id}` ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* L'image d'une page passe par le jeton : une URL nue ne donne rien. */
function Vignette({ seanceId, page }: { seanceId: number; page: Page }) {
  const [url, setUrl] = useState("");
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    let vivant = true; let cree = "";
    authFetch(`/studio/scans/${seanceId}/pages/${page.id}/image`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const b = await r.blob();
        if (!vivant) return;
        cree = URL.createObjectURL(b);
        setUrl(cree);
      })
      .catch(() => { if (vivant) setEchec(true); });
    return () => { vivant = false; if (cree) URL.revokeObjectURL(cree); };
  }, [seanceId, page.id]);

  if (echec) {
    return (
      <div className="flex h-28 items-center justify-center bg-gray-950 px-2 text-center text-[10px] text-amber-300">
        Cette page n&apos;a pas pu être relue.
      </div>
    );
  }
  if (!url) {
    return (
      <div className="flex h-28 items-center justify-center bg-gray-950">
        <Loader2 size={16} className="animate-spin text-gray-700" />
      </div>
    );
  }
  return (
    <div className="h-28 bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Page ${page.position}`} className="h-full w-full object-contain" />
    </div>
  );
}

/* ───────────────────────────── ASSEMBLAGE ─────────────────────────────── */

function Assemblage({ seance, pages, onFermer, onFini, onErreur }: {
  seance: Seance; pages: number;
  onFermer: () => void; onFini: (m: string) => void; onErreur: (e: string) => void;
}) {
  const [nom, setNom] = useState(seance.title || "");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [fait, setFait] = useState<{ id: number; nom: string; avertissements: string[]; message: string } | null>(null);

  async function lancer() {
    setOccupe(true);
    try {
      const r = await authFetch(`/studio/scans/${seance.id}/assembler`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom.trim(), description: description.trim(), tags: tags.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { onErreur(d.error || "Assemblage impossible."); return; }
      setFait({
        id: d.document?.id, nom: d.document?.name,
        avertissements: d.avertissements || [], message: d.message || "",
      });
    } catch { onErreur("Le serveur n'a pas répondu."); }
    finally { setOccupe(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <div className="my-8 w-full max-w-lg rounded-xl border border-gray-800 bg-gray-900 p-4 min-w-0">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">{fait ? "Document rangé" : "Assembler le PDF"}</h2>
          <button onClick={fait ? () => onFini(fait.message) : onFermer}
            className="rounded p-1 hover:bg-gray-800" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        {fait ? (
          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-emerald-100">
              <Check size={16} className="mt-0.5 shrink-0" />
              <span>{fait.message}</span>
            </p>
            {/* LES AVERTISSEMENTS SONT MONTRÉS, PAS AVALÉS. Une page dont
                l'orientation n'a pas pu être lue doit être signalée : sinon
                on accuse le scanner de l'avoir couchée. */}
            {fait.avertissements.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
                {fait.avertissements.map((a, i) => <li key={i}>• {a}</li>)}
              </ul>
            )}
            <p className="text-xs text-gray-500">
              Les pages d&apos;origine restent conservées : si le PDF déçoit,
              on peut les reprendre au lieu de tout rescanner.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/studio/bibliotheque"
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
                <FolderOpen size={16} /> Ouvrir la bibliothèque
              </Link>
              <button onClick={() => onFini(fait.message)}
                className="rounded-lg border border-gray-800 px-4 py-2 text-sm hover:bg-gray-800">
                Numériser autre chose
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="text-xs text-gray-400">Nom du document</span>
              <input value={nom} onChange={(e) => setNom(e.target.value)}
                placeholder="ex. Contrat transport Bamako 2026"
                className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 outline-none focus:border-blue-600" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">Description (facultative)</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 outline-none focus:border-blue-600" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">Étiquettes, séparées par des virgules</span>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="contrat, transport"
                className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 outline-none focus:border-blue-600" />
            </label>
            <p className="rounded-lg bg-gray-950 px-3 py-2 text-xs text-gray-500">
              {pages} page{pages > 1 ? "s" : ""} seront assemblées dans
              l&apos;ordre affiché.{" "}
              {seance.ocr_language
                ? "Le texte lu sur chaque page accompagne le document : il sera trouvable par son contenu."
                : "Sans texte reconnu, le PDF ne se cherchera que par son nom et sa description."}
            </p>
            <div className="flex gap-2">
              <button onClick={lancer} disabled={occupe || !pages}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500 disabled:opacity-50">
                {occupe ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                Assembler
              </button>
              <button onClick={onFermer} disabled={occupe}
                className="rounded-lg border border-gray-800 px-4 py-2 hover:bg-gray-800 disabled:opacity-50">
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────── ABANDONNER ─────────────────────────────── */

function Abandonner({ seanceId, pages, onAbandonnee, onErreur }: {
  seanceId: number; pages: number;
  onAbandonnee: () => void; onErreur: (e: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [occupe, setOccupe] = useState(false);

  async function abandonner() {
    setOccupe(true);
    try {
      const r = await authFetch(`/studio/scans/${seanceId}/abandonner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motif }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { onErreur(d.error || "Abandon impossible."); return; }
      onAbandonnee();
    } catch { onErreur("Le serveur n'a pas répondu."); }
    finally { setOccupe(false); }
  }

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)}
        className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800">
        <Trash2 size={14} /> Abandonner
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-red-900 bg-red-950/40 p-3">
      <p className="text-sm font-medium text-red-100">Abandonner cette séance ?</p>
      <p className="mt-1 text-xs text-red-200">
        {pages
          ? `Les ${pages} page${pages > 1 ? "s" : ""} déjà prise${pages > 1 ? "s" : ""} ${pages > 1 ? "seront effacées" : "sera effacée"} du serveur. Il faudra tout rescanner.`
          : "Aucune page n'a encore été prise : il n'y a rien à perdre."}
      </p>
      <input value={motif} onChange={(e) => setMotif(e.target.value)}
        placeholder="Motif (facultatif) — ex. mauvais document sous la main"
        className="mt-2 w-full rounded-lg border border-red-900 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-red-600" />
      <div className="mt-2 flex gap-2">
        <button onClick={abandonner} disabled={occupe}
          className="flex items-center gap-2 rounded-lg bg-red-700 px-3 py-1.5 text-sm hover:bg-red-600 disabled:opacity-50">
          {occupe && <Loader2 size={14} className="animate-spin" />} Abandonner
        </button>
        <button onClick={() => setOuvert(false)}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-800">
          Continuer la séance
        </button>
      </div>
    </div>
  );
}
