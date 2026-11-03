"use client";

/**
 * ANNOTER UNE PAGE : TEXTE, TABLEAU, SURLIGNAGE, CADRE.
 *
 * On voit la page, on trace un cadre au doigt ou à la souris, on remplit. Ce
 * qui est posé est posé SUR LE SERVEUR, à la fin, en une fois : le navigateur
 * ne réécrit jamais le PDF, et tant qu'on n'a pas appuyé sur « Poser », le
 * document n'a pas bougé.
 *
 * CE QUE CET ÉCRAN DIT HONNÊTEMENT.
 *
 * 1. UN SURLIGNAGE EST DE L'ENCRE, PAS UNE ANNOTATION DE LECTEUR PDF. Dans
 *    Acrobat, un surlignage se sélectionne, se commente et se retire d'un
 *    clic. Ici, c'est un aplat translucide imprimé dans la page. L'intitulé
 *    le dit, parce que l'inverse se découvrirait trop tard.
 *
 * 2. RIEN NE DÉBORDE EN SILENCE. Si le texte ne tient pas dans son cadre, le
 *    serveur refuse et dit combien de lignes tiennent ; l'écran répète ce
 *    refus mot pour mot au lieu de rogner ou de rapetisser la police. Un
 *    document que personne n'a voulu est pire qu'un refus.
 *
 * 3. POSER CRÉE UNE VERSION DE PLUS. La précédente reste téléchargeable, avec
 *    son empreinte. C'est écrit avant d'appuyer, pas après.
 *
 * LE REPÈRE, QUI EST LE SEUL VRAI PIÈGE ICI.
 *
 * Les positions partent dans le repère de L'AFFICHAGE : origine en bas à
 * gauche de la page telle qu'on la voit, en points. Une page tournée d'un
 * quart de tour — les scanners en produisent sans arrêt — se présente
 * couchée, et c'est cette page couchée qui fait loi. Le serveur ne quitte ce
 * repère qu'au dernier moment, trait par trait et ligne par ligne, faute de
 * quoi les lignes d'un tableau deviendraient des colonnes. Voir
 * `services/pdf-reperes.js` et `app/lib/pdf.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "../../../../lib/api";
import { usePermissions } from "../../../../lib/permissions";
import { ouvrir, rendre, type PageRendue } from "../../../../lib/pdf";
import {
  AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, Highlighter,
  Loader2, Lock, Square, Table2, Trash2, Type, X,
} from "lucide-react";

type Nature = "TEXTE" | "TABLEAU" | "SURLIGNAGE" | "CADRE";

type Annotation = {
  cle: string;
  nature: Nature;
  page: number;
  /* En points, repère de l'affichage, origine en bas à gauche. */
  x: number; y: number; largeur: number; hauteur: number;
  texte: string;
  taille: number;
  couleur: string;
  police: string;
  alignement: "gauche" | "centre" | "droite";
  opacite: number;
  epaisseur: number;
  lignes: string[][];
  entete: boolean;
};

type Doc = { id: number; name: string; mime: string; version: number; page_count: number | null };
type PageVue = { page: number; largeur: number; hauteur: number; rotation: number };

const OUTILS: { nature: Nature; titre: string; aide: string; Icone: typeof Type }[] = [
  { nature: "TEXTE", titre: "Mention", Icone: Type,
    aide: "Un paragraphe dans un cadre. Il est coupé en lignes ; s'il ne tient pas, c'est refusé plutôt que rogné." },
  { nature: "TABLEAU", titre: "Tableau", Icone: Table2,
    aide: "Des lignes et des colonnes avec un filet. La hauteur de chaque ligne suit son contenu." },
  { nature: "SURLIGNAGE", titre: "Surlignage", Icone: Highlighter,
    aide: "Un aplat translucide IMPRIMÉ dans la page. Ce n'est pas le surligneur d'Acrobat : il ne se retirera pas d'un clic." },
  { nature: "CADRE", titre: "Cadre", Icone: Square,
    aide: "Un rectangle vide, pour entourer un montant ou une mention." },
];

const COULEURS = ["#111827", "#dc2626", "#2563eb", "#15803d", "#b45309", "#fde047"];
const POLICES = [
  { v: "sans", t: "Sans empattement" },
  { v: "sans-gras", t: "Sans empattement, gras" },
  { v: "serif", t: "Avec empattements" },
  { v: "serif-gras", t: "Avec empattements, gras" },
  { v: "mono", t: "Chasse fixe" },
];

const cleNeuve = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function neuve(nature: Nature, page: number, boite: { x: number; y: number; largeur: number; hauteur: number }): Annotation {
  return {
    cle: cleNeuve(), nature, page, ...boite,
    texte: nature === "TEXTE" ? "" : "",
    taille: nature === "TABLEAU" ? 9 : 12,
    couleur: nature === "SURLIGNAGE" ? "#fde047" : nature === "CADRE" ? "#dc2626" : "#111827",
    police: "sans",
    alignement: "gauche",
    opacite: 0.35,
    epaisseur: 1.5,
    lignes: [["Produit", "Quantité", "Unité"], ["", "", ""]],
    entete: true,
  };
}

/* Ce qui part au serveur : seulement les champs que sa nature utilise. */
function versServeur(a: Annotation) {
  const base = { nature: a.nature, page: a.page, x: a.x, y: a.y, largeur: a.largeur, hauteur: a.hauteur };
  if (a.nature === "TEXTE") {
    return { ...base, texte: a.texte, taille: a.taille, couleur: a.couleur,
      police: a.police, alignement: a.alignement };
  }
  if (a.nature === "TABLEAU") {
    return { ...base, lignes: a.lignes, taille: a.taille, couleur: a.couleur,
      police: a.police, entete: a.entete };
  }
  if (a.nature === "SURLIGNAGE") return { ...base, couleur: a.couleur, opacite: a.opacite };
  return { ...base, couleur: a.couleur, epaisseur: a.epaisseur };
}

export default function AnnoterPdf() {
  const params = useParams();
  const router = useRouter();
  const documentId = Number(params?.id);
  const { can, loading: droitsEnCours } = usePermissions();
  const peutModifier = can("studio.pdf", "update");

  const [doc, setDoc] = useState<Doc | null>(null);
  const [pages, setPages] = useState<PageVue[]>([]);
  const [numero, setNumero] = useState(1);
  const [rendu, setRendu] = useState<PageRendue | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [choisie, setChoisie] = useState<string>("");
  const [outil, setOutil] = useState<Nature>("TEXTE");

  const [chargement, setChargement] = useState(true);
  const [occupe, setOccupe] = useState("");
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  const cadre = useRef<HTMLDivElement | null>(null);
  const toile = useRef<HTMLDivElement | null>(null);
  const trace = useRef<{ x: number; y: number } | null>(null);
  const [enTrace, setEnTrace] = useState<{ x: number; y: number; l: number; h: number } | null>(null);
  const deplacement = useRef<{ cle: string; dx: number; dy: number; coin: boolean } | null>(null);
  const octets = useRef<ArrayBuffer | null>(null);

  const pageCourante = pages.find((p) => p.page === numero) || null;
  const aPoser = useMemo(() => annotations.filter((a) => a.page === numero), [annotations, numero]);
  const selection = annotations.find((a) => a.cle === choisie) || null;

  /* ───────────────────── CHARGER LE DOCUMENT ───────────────────── */
  /**
   * @param garderPage après une pose, on RESTE sur la page où l'on
   *   travaillait. Le premier jet remettait tout le monde en page 1 : qui
   *   annotait la page 7 d'un dossier de vingt feuillets devait y revenir à
   *   chaque mention posée, et l'écran ne disait pas pourquoi il avait
   *   bougé.
   */
  const charger = useCallback(async (garderPage = false) => {
    setChargement(true); setErreur("");
    try {
      const [rd, rg, rf] = await Promise.all([
        authFetch(`/studio/documents/${documentId}`),
        authFetch(`/studio/documents/${documentId}/pages-vues`),
        authFetch(`/studio/documents/${documentId}/fichier`),
      ]);
      if (!rd.ok) throw new Error("Ce document est introuvable, ou vous n'y avez pas accès.");
      if (!rg.ok) {
        const d = await rg.json().catch(() => ({}));
        throw new Error(d?.error || "La géométrie des pages n'a pas pu être lue.");
      }
      if (!rf.ok) throw new Error("Le fichier du document n'a pas pu être lu.");
      const dd = await rd.json();
      const dg = await rg.json();
      octets.current = await rf.arrayBuffer();
      setDoc(dd.document || dd);
      const vues = dg.pages || [];
      setPages(vues);
      /* La page est bornée au nouveau compte : annoter ne retire pas de page,
         mais rien n'interdit qu'on ait réorganisé le document entre-temps
         dans l'autre onglet. */
      setNumero((n) => (garderPage ? Math.min(Math.max(1, n), vues.length || 1) : 1));
    } catch (e: any) {
      setErreur(e?.message || "Chargement impossible.");
    } finally { setChargement(false); }
  }, [documentId]);

  useEffect(() => { if (documentId) charger(); }, [documentId, charger]);

  /* ───────────────────── RENDRE LA PAGE ───────────────────── */
  useEffect(() => {
    if (!octets.current || !pages.length) return;
    let vivant = true;
    (async () => {
      try {
        const large = Math.max(320, (cadre.current?.clientWidth || 900) - 8);
        const haut = Math.max(320, window.innerHeight - 260);
        const d = await ouvrir(octets.current!);
        const r = await rendre(d, numero, large, haut);
        if (!vivant) { await d.destroy(); return; }
        setRendu(r);
        await d.destroy();
      } catch (e: any) {
        if (vivant) setErreur(`La page ${numero} n'a pas pu être affichée : ${e?.message || e}`);
      }
    })();
    return () => { vivant = false; };
  }, [numero, pages.length]);

  /* La page rendue est un canvas détaché : on l'accroche dans le cadre. */
  useEffect(() => {
    const hote = toile.current;
    if (!hote || !rendu) return;
    hote.innerHTML = "";
    rendu.canvas.className = "block select-none";
    hote.appendChild(rendu.canvas);
  }, [rendu]);

  /* ───────────── TRACER, DÉPLACER, REDIMENSIONNER ─────────────
     Tout est en pixels CSS à l'écran et converti à la toute fin. */
  const relatif = (e: PointerEvent | React.PointerEvent) => {
    const r = toile.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (e as PointerEvent).clientX - r.left, y: (e as PointerEvent).clientY - r.top };
  };

  const commencerTrace = (e: React.PointerEvent) => {
    if (!peutModifier || !rendu) return;
    if ((e.target as HTMLElement).dataset?.annotation) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = relatif(e);
    trace.current = p;
    setChoisie("");
    setEnTrace({ x: p.x, y: p.y, l: 0, h: 0 });
  };

  const bougerTrace = (e: React.PointerEvent) => {
    const dep = deplacement.current;
    if (dep) {
      const p = relatif(e);
      setAnnotations((liste) => liste.map((a) => {
        if (a.cle !== dep.cle || !rendu) return a;
        const pt = rendu.versAffichage(p.x, p.y);
        if (dep.coin) {
          /* LA POIGNÉE EST EN BAS À DROITE À L'ÉCRAN, donc en (x + largeur, y)
             dans le repère de l'affichage, dont l'ordonnée monte. Ce qui doit
             rester fixe est le coin OPPOSÉ : le haut-gauche, c'est-à-dire x et
             le sommet `y + hauteur`. On recalcule donc la hauteur par rapport
             à ce sommet, et l'ordonnée descend avec le doigt.

             Le premier jet gardait `y` et tirait la hauteur dans le même
             mouvement : le cadre se déplaçait en même temps qu'il grandissait,
             et un agrandissement vers le bas devenait impossible à viser. */
          const sommet = a.y + a.hauteur;
          const bas = Math.min(sommet - 4, pt.y);
          return { ...a, largeur: Math.max(4, pt.x - a.x), y: bas, hauteur: sommet - bas };
        }
        return { ...a, x: pt.x - dep.dx, y: pt.y - dep.dy };
      }));
      return;
    }
    if (!trace.current) return;
    const p = relatif(e);
    setEnTrace({
      x: Math.min(trace.current.x, p.x), y: Math.min(trace.current.y, p.y),
      l: Math.abs(p.x - trace.current.x), h: Math.abs(p.y - trace.current.y),
    });
  };

  const finirTrace = () => {
    deplacement.current = null;
    const t = enTrace;
    trace.current = null;
    setEnTrace(null);
    if (!t || !rendu || !pageCourante) return;
    /* UN CADRE MINUSCULE EST UN CLIC, PAS UN TRACÉ. Sans ce seuil, chaque
       clic sur la page créerait une annotation invisible de deux pixels,
       qu'on retrouverait plus tard dans le PDF sans savoir d'où elle vient. */
    if (t.l < 12 || t.h < 12) return;
    const a = rendu.versAffichage(t.x, t.y + t.h);
    const b = rendu.versAffichage(t.x + t.l, t.y);
    const boite = {
      x: Math.max(0, Math.min(a.x, b.x)),
      y: Math.max(0, Math.min(a.y, b.y)),
      largeur: Math.abs(b.x - a.x),
      hauteur: Math.abs(b.y - a.y),
    };
    const nouvelle = neuve(outil, numero, boite);
    setAnnotations((l) => [...l, nouvelle]);
    setChoisie(nouvelle.cle);
    setMessage("");
  };

  const prendre = (e: React.PointerEvent, a: Annotation, coin: boolean) => {
    if (!peutModifier || !rendu) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = relatif(e);
    const pt = rendu.versAffichage(p.x, p.y);
    deplacement.current = { cle: a.cle, dx: pt.x - a.x, dy: pt.y - a.y, coin };
    setChoisie(a.cle);
  };

  const modifier = (cle: string, champs: Partial<Annotation>) =>
    setAnnotations((l) => l.map((a) => (a.cle === cle ? { ...a, ...champs } : a)));

  const retirer = (cle: string) => {
    setAnnotations((l) => l.filter((a) => a.cle !== cle));
    if (choisie === cle) setChoisie("");
  };

  /* ───────────────────── POSER ───────────────────── */
  const poser = async () => {
    if (!annotations.length) return;
    setOccupe("Pose en cours…"); setErreur(""); setMessage("");
    try {
      const r = await authFetch(`/studio/documents/${documentId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations: annotations.map(versServeur) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        /* LE REFUS DU SERVEUR EST REPRIS MOT POUR MOT. Il dit combien de
           lignes tiennent, ou de combien on dépasse : le reformuler en
           « erreur » ferait perdre la seule information utile.

           ET ON SÉLECTIONNE LE CADRE FAUTIF. Le serveur renvoie son rang
           dans la liste envoyée ; sans cela, avec plusieurs cadres en
           attente, il faudrait les essayer un par un pour trouver lequel
           déborde. RIEN N'A ÉTÉ POSÉ : le serveur refuse la liste entière,
           donc tout reste en attente, prêt à être corrigé. */
        const rang = Number(d?.index);
        if (Number.isInteger(rang) && rang >= 1 && rang <= annotations.length) {
          const fautive = annotations[rang - 1];
          setChoisie(fautive.cle);
          if (fautive.page !== numero) setNumero(fautive.page);
          throw new Error(
            `${d?.error || "La pose a échoué."}\n\n`
            + `Le cadre en cause est sélectionné ci-contre (le ${rang}\u1D49 de la liste). `
            + `Rien n'a été posé : corrigez-le et reposez l'ensemble.`);
        }
        throw new Error(d?.error || "La pose a échoué.");
      }
      setAnnotations([]); setChoisie("");
      setMessage(d?.message || "Annotations posées.");
      /* Le document a une version de plus : on recharge le fichier, sinon on
         continuerait à annoter l'ancienne version à l'écran. En gardant la
         page : on ne fait pas perdre sa place à qui travaille au feuillet 7. */
      await charger(true);
    } catch (e: any) {
      setErreur(e?.message || "La pose a échoué.");
    } finally { setOccupe(""); }
  };

  /* ───────────────────── ÉCRANS D'ATTENTE ───────────────────── */
  if (droitsEnCours || chargement) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }
  if (erreur && !doc) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="text-gray-300">{erreur}</p>
          <Link href="/studio/bibliotheque" className="mt-6 inline-block text-sm text-blue-400 hover:underline">
            Retour à la bibliothèque
          </Link>
        </div>
      </div>
    );
  }

  const vue = pageCourante;

  return (
    <div className="min-h-screen bg-gray-950 text-white min-w-0 w-full">
      <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
        {/* LA CLOCHE DE NOTIFICATIONS DE L'APPLICATION FLOTTE EN HAUT À
            DROITE, fixée, au-dessus de tout (z-9500). Un en-tête qui va
            jusqu'au bord de la fenêtre lui met donc ses propres boutons
            dessous : « Poser » devenait impossible à cliquer, et c'est un
            essai au navigateur qui l'a découvert — à la lecture du code, rien
            ne le laisse voir, la cloche vivant dans la coquille commune.
            D'où la réserve à droite : la largeur de la cloche et sa marge. */}
        <div className="mx-auto max-w-[1600px] px-4 pr-20 py-3 flex items-center gap-3">
          <button onClick={() => router.push(`/studio/pdf/${documentId}`)}
            className="shrink-0 rounded-lg p-2 hover:bg-gray-800" aria-label="Retour à l'éditeur de pages">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">Annoter — {doc?.name}</h1>
            <p className="text-xs text-gray-500">
              Version {doc?.version}
              {vue ? ` · page ${numero} sur ${pages.length} · ${Math.round(vue.largeur)}×${Math.round(vue.hauteur)} points` : ""}
              {vue?.rotation ? ` · page tournée de ${vue.rotation}°` : ""}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {annotations.length > 0 && (
              <span className="hidden sm:inline text-xs text-amber-300">
                {annotations.length} annotation{annotations.length > 1 ? "s" : ""} en attente
              </span>
            )}
            <button onClick={poser} disabled={!annotations.length || !!occupe || !peutModifier}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-blue-500">
              {occupe ? <Loader2 className="w-4 h-4 animate-spin" /> : "Poser"}
            </button>
          </div>
        </div>
      </header>

      {!peutModifier && (
        <div className="mx-auto max-w-[1600px] px-4 pt-4">
          <p className="flex items-start gap-2 rounded-lg border border-gray-800 bg-gray-900 p-3 text-sm text-gray-400">
            <Lock className="w-4 h-4 mt-0.5 shrink-0" />
            Vous pouvez regarder ce document, pas l'annoter. Annoter modifie le document et demande
            le droit de modification sur l'éditeur PDF.
          </p>
        </div>
      )}

      {(erreur || message) && (
        <div className="mx-auto max-w-[1600px] px-4 pt-4">
          {erreur && (
            <p data-bandeau="erreur"
              className="flex items-start gap-2 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-200">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap">{erreur}</span>
              <button onClick={() => setErreur("")} className="ml-auto shrink-0 rounded p-1 hover:bg-red-900/60"
                aria-label="Masquer l'erreur"><X className="w-4 h-4" /></button>
            </p>
          )}
          {message && (
            <p data-bandeau="succes"
              className="flex items-start gap-2 rounded-lg border border-green-900 bg-green-950/60 p-3 text-sm text-green-200">
              <Check className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{message}</span>
            </p>
          )}
        </div>
      )}

      <main className="mx-auto max-w-[1600px] px-4 py-4 grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* ─────────────── LA PAGE ─────────────── */}
        <section className="min-w-0" ref={cadre}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {OUTILS.map(({ nature, titre, Icone }) => (
              <button key={nature} onClick={() => setOutil(nature)} disabled={!peutModifier}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 ${
                  outil === nature
                    ? "border-blue-500 bg-blue-600/20 text-blue-200"
                    : "border-gray-800 bg-gray-900 text-gray-300 hover:bg-gray-800"}`}>
                <Icone className="w-4 h-4" /> {titre}
              </button>
            ))}
            <span className="ml-auto flex items-center gap-1">
              <button onClick={() => setNumero((n) => Math.max(1, n - 1))} disabled={numero <= 1}
                className="rounded-lg border border-gray-800 bg-gray-900 p-1.5 disabled:opacity-30 hover:bg-gray-800"
                aria-label="Page précédente"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-1 text-sm text-gray-400">{numero} / {pages.length}</span>
              <button onClick={() => setNumero((n) => Math.min(pages.length, n + 1))}
                disabled={numero >= pages.length}
                className="rounded-lg border border-gray-800 bg-gray-900 p-1.5 disabled:opacity-30 hover:bg-gray-800"
                aria-label="Page suivante"><ChevronRight className="w-4 h-4" /></button>
            </span>
          </div>

          <p className="mb-2 text-xs text-gray-500">
            {OUTILS.find((o) => o.nature === outil)?.aide}
          </p>

          <div className="overflow-auto rounded-xl border border-gray-800 bg-gray-900 p-1">
            <div
              ref={toile}
              className="relative mx-auto w-fit touch-none"
              style={{ cursor: peutModifier ? "crosshair" : "default" }}
              onPointerDown={commencerTrace}
              onPointerMove={bougerTrace}
              onPointerUp={finirTrace}
              onPointerCancel={finirTrace}
            >
              {/* Le canvas est accroché ici par l'effet ci-dessus. */}
            </div>
          </div>
        </section>

        {/* ─────────────── LE PANNEAU ─────────────── */}
        <aside className="min-w-0 space-y-3">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
            <h2 className="text-sm font-semibold">En attente sur cette page</h2>
            {!aPoser.length ? (
              <p className="mt-2 text-xs text-gray-500">
                Tracez un cadre sur la page avec l'outil choisi. Rien n'est écrit dans le document
                avant « Poser ».
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {aPoser.map((a) => (
                  <li key={a.cle}>
                    <button onClick={() => setChoisie(a.cle)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                        choisie === a.cle ? "bg-blue-600/20 text-blue-200" : "hover:bg-gray-800 text-gray-300"}`}>
                      <span className="truncate">
                        {OUTILS.find((o) => o.nature === a.nature)?.titre}
                        {a.nature === "TEXTE" && a.texte ? ` — ${a.texte.slice(0, 22)}` : ""}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-gray-500">
                        {Math.round(a.largeur)}×{Math.round(a.hauteur)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selection && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">
                  {OUTILS.find((o) => o.nature === selection.nature)?.titre}
                </h2>
                <button onClick={() => retirer(selection.cle)}
                  className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-300 hover:bg-red-950/60">
                  <Trash2 className="w-3.5 h-3.5" /> Retirer
                </button>
              </div>

              {selection.nature === "TEXTE" && (
                <>
                  <label className="block text-xs text-gray-400">
                    Texte
                    <textarea value={selection.texte} rows={4}
                      onChange={(e) => modifier(selection.cle, { texte: e.target.value })}
                      placeholder="Reçu conforme, le…"
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white" />
                  </label>
                  <label className="block text-xs text-gray-400">
                    Police
                    <select value={selection.police}
                      onChange={(e) => modifier(selection.cle, { police: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white">
                      {POLICES.map((p) => <option key={p.v} value={p.v}>{p.t}</option>)}
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <label className="block flex-1 text-xs text-gray-400">
                      Taille
                      <input type="number" min={4} max={144} value={selection.taille}
                        onChange={(e) => modifier(selection.cle, { taille: Number(e.target.value) })}
                        className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white" />
                    </label>
                    <label className="block flex-1 text-xs text-gray-400">
                      Alignement
                      <select value={selection.alignement}
                        onChange={(e) => modifier(selection.cle, { alignement: e.target.value as any })}
                        className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white">
                        <option value="gauche">À gauche</option>
                        <option value="centre">Centré</option>
                        <option value="droite">À droite</option>
                      </select>
                    </label>
                  </div>
                </>
              )}

              {selection.nature === "TABLEAU" && (
                <>
                  <label className="flex items-center gap-2 text-xs text-gray-400">
                    <input type="checkbox" checked={selection.entete}
                      onChange={(e) => modifier(selection.cle, { entete: e.target.checked })} />
                    La première ligne est un en-tête
                  </label>
                  <div className="space-y-1">
                    {selection.lignes.map((ligne, iL) => (
                      <div key={iL} className="flex gap-1">
                        {ligne.map((cellule, iC) => (
                          <input key={iC} value={cellule}
                            onChange={(e) => {
                              const l = selection.lignes.map((x) => [...x]);
                              l[iL][iC] = e.target.value;
                              modifier(selection.cle, { lignes: l });
                            }}
                            className={`min-w-0 flex-1 rounded border border-gray-700 bg-gray-950 px-1.5 py-1 text-xs text-white ${
                              selection.entete && iL === 0 ? "font-semibold" : ""}`} />
                        ))}
                        <button
                          onClick={() => modifier(selection.cle, {
                            lignes: selection.lignes.length > 1
                              ? selection.lignes.filter((_, i) => i !== iL) : selection.lignes })}
                          disabled={selection.lignes.length <= 1}
                          className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-800 disabled:opacity-30"
                          aria-label={`Retirer la ligne ${iL + 1}`}><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => modifier(selection.cle, {
                        lignes: [...selection.lignes, Array(selection.lignes[0].length).fill("")] })}
                      className="flex-1 rounded-lg border border-gray-700 px-2 py-1.5 text-xs hover:bg-gray-800">
                      + une ligne
                    </button>
                    <button
                      onClick={() => modifier(selection.cle, {
                        lignes: selection.lignes.map((l) => [...l, ""]) })}
                      className="flex-1 rounded-lg border border-gray-700 px-2 py-1.5 text-xs hover:bg-gray-800">
                      + une colonne
                    </button>
                    <button
                      onClick={() => modifier(selection.cle, {
                        lignes: selection.lignes[0].length > 1
                          ? selection.lignes.map((l) => l.slice(0, -1)) : selection.lignes })}
                      disabled={selection.lignes[0].length <= 1}
                      className="rounded-lg border border-gray-700 px-2 py-1.5 text-xs hover:bg-gray-800 disabled:opacity-30">
                      − colonne
                    </button>
                  </div>
                  <label className="block text-xs text-gray-400">
                    Taille
                    <input type="number" min={4} max={48} value={selection.taille}
                      onChange={(e) => modifier(selection.cle, { taille: Number(e.target.value) })}
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white" />
                  </label>
                </>
              )}

              {selection.nature === "SURLIGNAGE" && (
                <>
                  <p className="rounded-lg border border-amber-900 bg-amber-950/40 p-2 text-xs text-amber-200">
                    Ce surlignage est de l'ENCRE dans la page, pas une annotation de lecteur PDF :
                    il ne se retirera pas d'un clic dans Acrobat. La version d'avant, elle, reste
                    intacte.
                  </p>
                  <label className="block text-xs text-gray-400">
                    Opacité — {Math.round(selection.opacite * 100)} %
                    <input type="range" min={5} max={100} value={Math.round(selection.opacite * 100)}
                      onChange={(e) => modifier(selection.cle, { opacite: Number(e.target.value) / 100 })}
                      className="mt-1 w-full" />
                  </label>
                </>
              )}

              {selection.nature === "CADRE" && (
                <label className="block text-xs text-gray-400">
                  Épaisseur du trait
                  <input type="number" min={0.25} max={12} step={0.25} value={selection.epaisseur}
                    onChange={(e) => modifier(selection.cle, { epaisseur: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white" />
                </label>
              )}

              <div>
                <span className="block text-xs text-gray-400">Couleur</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {COULEURS.map((c) => (
                    <button key={c} onClick={() => modifier(selection.cle, { couleur: c })}
                      aria-label={`Couleur ${c}`}
                      className={`h-7 w-7 rounded-md border-2 ${
                        selection.couleur === c ? "border-white" : "border-gray-700"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Position : {Math.round(selection.x)} ; {Math.round(selection.y)} —
                {" "}{Math.round(selection.largeur)}×{Math.round(selection.hauteur)} points,
                dans le repère de la page telle qu'elle s'affiche.
              </p>
            </div>
          )}

          <p className="rounded-xl border border-gray-800 bg-gray-900 p-3 text-xs text-gray-500">
            Poser crée une <strong className="text-gray-300">version de plus</strong>. La version{" "}
            {doc?.version} restera téléchargeable avec son empreinte, et l'original — la version 1 —
            ne change jamais.
          </p>
        </aside>
      </main>

      {/* ─── LES CADRES, PAR-DESSUS LA PAGE ───
          Ils sont insérés par un portail dans le conteneur de la toile, à
          côté du canvas : hors du flux, en position absolue. */}
      {rendu && (
        <Cadres
          toile={toile}
          rendu={rendu}
          annotations={aPoser}
          choisie={choisie}
          enTrace={enTrace}
          outil={outil}
          onPrendre={prendre}
        />
      )}
    </div>
  );
}

/**
 * LES CADRES POSÉS PAR-DESSUS LA PAGE.
 *
 * Ils vivent dans le même conteneur que le canvas, en position absolue. On ne
 * les dessine pas DANS le canvas : il faudrait le re-rendre à chaque
 * déplacement, ce qui rendrait le glissement saccadé sur un téléphone.
 */
function Cadres({
  toile, rendu, annotations, choisie, enTrace, outil, onPrendre,
}: {
  toile: React.RefObject<HTMLDivElement | null>;
  rendu: PageRendue;
  annotations: Annotation[];
  choisie: string;
  enTrace: { x: number; y: number; l: number; h: number } | null;
  outil: Nature;
  onPrendre: (e: React.PointerEvent, a: Annotation, coin: boolean) => void;
}) {
  const [hote, setHote] = useState<HTMLDivElement | null>(null);
  useEffect(() => { setHote(toile.current); }, [toile, rendu]);
  if (!hote) return null;

  const ecran = (a: Annotation) => {
    const hautGauche = rendu.affichageVersEcran(a.x, a.y + a.hauteur);
    return {
      left: hautGauche.x, top: hautGauche.y,
      width: a.largeur * rendu.echelle, height: a.hauteur * rendu.echelle,
    };
  };

  const teinte: Record<Nature, string> = {
    TEXTE: "border-blue-400", TABLEAU: "border-emerald-400",
    SURLIGNAGE: "border-amber-300", CADRE: "border-red-400",
  };

  return (
    <>
      {createPortal(
        <>
          {annotations.map((a) => {
            const b = ecran(a);
            const actif = choisie === a.cle;
            return (
              <div key={a.cle} data-annotation="1"
                onPointerDown={(e) => onPrendre(e, a, false)}
                className={`absolute cursor-move border-2 ${teinte[a.nature]} ${
                  actif ? "bg-white/10" : "bg-white/5"}`}
                style={{ left: b.left, top: b.top, width: b.width, height: b.height }}>
                <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap rounded bg-gray-950/90 px-1 text-[10px] text-gray-300">
                  {a.nature === "TEXTE" ? "Mention" : a.nature === "TABLEAU" ? "Tableau"
                    : a.nature === "SURLIGNAGE" ? "Surlignage" : "Cadre"}
                </span>
                <span data-annotation="1"
                  onPointerDown={(e) => onPrendre(e, a, true)}
                  style={{ touchAction: "none" }}
                  className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-se-resize rounded-sm border border-gray-900 bg-white" />
              </div>
            );
          })}
          {enTrace && enTrace.l > 2 && (
            <div className={`pointer-events-none absolute border-2 border-dashed ${teinte[outil]} bg-white/5`}
              style={{ left: enTrace.x, top: enTrace.y, width: enTrace.l, height: enTrace.h }} />
          )}
        </>,
        hote,
      )}
    </>
  );
}

