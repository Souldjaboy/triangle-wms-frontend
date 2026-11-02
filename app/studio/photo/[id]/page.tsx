"use client";

/**
 * L'ÉDITEUR PHOTO.
 *
 * Recadrer un reçu photographié de travers, le redresser, l'éclaircir pour
 * que les chiffres se lisent. Ce sont les gestes utiles ici : pas des
 * filtres d'ambiance, mais de quoi rendre lisible une pièce comptable prise
 * à la va-vite sur un comptoir.
 *
 * CE QUE CET ÉCRAN GARANTIT.
 *
 * 1. L'ORIGINAL NE DISPARAÎT JAMAIS. Enregistrer crée soit une version de
 *    plus — l'originale restant intacte, marquée, téléchargeable — soit un
 *    document à part qui garde le lien vers sa source. Les deux sont
 *    proposés explicitement, avec ce que chacun implique.
 *
 * 2. ON VOIT CE QU'ON ENREGISTRE. L'aperçu applique exactement le même
 *    traitement que l'image produite : même ordre, mêmes réglages. Un aperçu
 *    qui mentirait ferait enregistrer autre chose que ce qu'on a validé.
 *
 * 3. LA NOTE DE VERSION SE RELIT. Elle énumère ce qui a été fait —
 *    « recadrée, redressée de 2°, contraste +20 » — au lieu d'un
 *    « modification » qui n'apprend rien six mois plus tard.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "../../../lib/api";
import { usePermissions } from "../../../lib/permissions";
import {
  AlertTriangle, ArrowLeft, Check, Crop, FlipHorizontal, FlipVertical,
  Loader2, Lock, RotateCcw, RotateCw, Sun, Undo2, X,
} from "lucide-react";

type Doc = {
  id: number; name: string; mime: string; version: number;
  size_bytes: number; width_px?: number; trashed_at: string | null;
  folder_id: number | null; visibility: string;
};

type Reglages = {
  quarts: number;            /* rotations par quart de tour, 0 à 3 */
  inclinaison: number;       /* redressement fin, en degrés */
  miroirH: boolean; miroirV: boolean;
  luminosite: number;        /* 100 = inchangé */
  contraste: number;
  saturation: number;
};

const NEUTRE: Reglages = {
  quarts: 0, inclinaison: 0, miroirH: false, miroirV: false,
  luminosite: 100, contraste: 100, saturation: 100,
};

const poids = (n: number) =>
  !n ? "0 o" : n < 1024 ? `${n} o`
    : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} Ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`;

export default function EditeurPhoto() {
  const params = useParams();
  const router = useRouter();
  const documentId = Number(params?.id);
  const { can, loading: droitsEnCours } = usePermissions();

  const source = useRef<HTMLImageElement | null>(null);
  const zone = useRef<HTMLDivElement | null>(null);
  const toile = useRef<HTMLCanvasElement | null>(null);
  const urlSource = useRef("");

  const [doc, setDoc] = useState<Doc | null>(null);
  const [reglages, setReglages] = useState<Reglages>(NEUTRE);
  /* Le recadrage, en PART de l'image redressée : indépendant de l'échelle
     d'affichage, donc juste quelle que soit la taille de la fenêtre. */
  const [coupe, setCoupe] = useState<{ x: number; y: number; l: number; h: number } | null>(null);
  const [modeCoupe, setModeCoupe] = useState(false);
  const [geste, setGeste] = useState<"deplacer" | "etirer" | null>(null);
  const depart = useRef({ sx: 0, sy: 0, cx: 0, cy: 0, cl: 0, ch: 0 });

  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [tailleRendue, setTailleRendue] = useState({ l: 0, h: 0 });

  const peutModifier = can("studio.photo", "update");
  const peutCreer = can("studio.photo", "create");

  /* ─────────────────────────── CHARGER ──────────────────────────── */
  useEffect(() => {
    let vivant = true;
    (async () => {
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
        const d: Doc = (await rd.json()).document;
        if (!d.mime.startsWith("image/")) {
          throw new Error(
            `Ce document est au format ${d.mime} : l'éditeur photo ne vaut que pour une image.`);
        }
        const blob = await rf.blob();
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise<void>((ok, non) => {
          img.onload = () => ok();
          img.onerror = () => non(new Error("Cette image n'a pas pu être lue."));
          img.src = url;
        });
        if (!vivant) { URL.revokeObjectURL(url); return; }
        urlSource.current = url;
        source.current = img;
        setDoc(d);
        setChargement(false);
      } catch (e) {
        if (vivant) { setErreur((e as Error).message); setChargement(false); }
      }
    })();
    return () => {
      vivant = false;
      if (urlSource.current) URL.revokeObjectURL(urlSource.current);
    };
  }, [documentId]);

  /* ───────────── LE TRAITEMENT, DANS UN SENS UNIQUE ──────────────
     Rotation et miroir d'abord, recadrage ensuite, réglages de lumière en
     dernier. L'aperçu et l'enregistrement empruntent exactement le même
     chemin : c'est la seule façon que ce qu'on voit soit ce qu'on obtient. */
  const composer = useCallback((pourEnregistrer: boolean): HTMLCanvasElement | null => {
    const img = source.current;
    if (!img) return null;

    /* 1. redresser */
    const rad = (reglages.quarts * 90 + reglages.inclinaison) * Math.PI / 180;
    const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
    const largeurTournee = Math.ceil(img.naturalWidth * cos + img.naturalHeight * sin);
    const hauteurTournee = Math.ceil(img.naturalWidth * sin + img.naturalHeight * cos);

    const tournee = document.createElement("canvas");
    tournee.width = largeurTournee; tournee.height = hauteurTournee;
    const gt = tournee.getContext("2d");
    if (!gt) return null;
    /* Fond blanc : une rotation fine laisse des coins vides, et du noir
       derrière un document ressemblerait à une tache d'encre. */
    gt.fillStyle = "#ffffff";
    gt.fillRect(0, 0, largeurTournee, hauteurTournee);
    gt.translate(largeurTournee / 2, hauteurTournee / 2);
    gt.rotate(rad);
    gt.scale(reglages.miroirH ? -1 : 1, reglages.miroirV ? -1 : 1);
    gt.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    /* 2. recadrer */
    const c = coupe || { x: 0, y: 0, l: 1, h: 1 };
    const sx = Math.round(c.x * largeurTournee);
    const sy = Math.round(c.y * hauteurTournee);
    const sl = Math.max(1, Math.round(c.l * largeurTournee));
    const sh = Math.max(1, Math.round(c.h * hauteurTournee));

    const sortie = document.createElement("canvas");
    /* À l'aperçu on réduit : traiter 12 mégapixels à chaque mouvement de
       curseur fige l'onglet. À l'enregistrement, on garde tout. */
    const facteur = pourEnregistrer
      ? 1
      : Math.min(1, 900 / Math.max(sl, sh));
    sortie.width = Math.max(1, Math.round(sl * facteur));
    sortie.height = Math.max(1, Math.round(sh * facteur));
    const gs = sortie.getContext("2d");
    if (!gs) return null;

    /* 3. lumière */
    const filtres: string[] = [];
    if (reglages.luminosite !== 100) filtres.push(`brightness(${reglages.luminosite}%)`);
    if (reglages.contraste !== 100) filtres.push(`contrast(${reglages.contraste}%)`);
    if (reglages.saturation !== 100) filtres.push(`saturate(${reglages.saturation}%)`);
    if (filtres.length && "filter" in gs) gs.filter = filtres.join(" ");
    gs.drawImage(tournee, sx, sy, sl, sh, 0, 0, sortie.width, sortie.height);
    return sortie;
  }, [reglages, coupe]);

  /* L'aperçu se redessine à chaque réglage. */
  useEffect(() => {
    if (chargement || !doc) return;
    const rendu = composer(false);
    const hote = zone.current;
    if (!rendu || !hote) return;
    const largeurDispo = Math.min(hote.clientWidth || 600, 820);
    const hauteurDispo = Math.max(240, (window.innerHeight || 800) - 430);
    const echelle = Math.min(largeurDispo / rendu.width, hauteurDispo / rendu.height, 1);
    rendu.style.width = `${Math.round(rendu.width * echelle)}px`;
    rendu.style.height = `${Math.round(rendu.height * echelle)}px`;
    rendu.className = "block";
    toile.current = rendu;
    hote.replaceChildren(rendu);
    setTailleRendue({ l: rendu.width, h: rendu.height });
  }, [chargement, doc, composer]);

  /* ─────────────────────── LE CADRE DE COUPE ────────────────────── */
  const dansToile = (e: React.PointerEvent) => {
    const el = toile.current;
    const r = el?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const prendre = (e: React.PointerEvent, quoi: "deplacer" | "etirer") => {
    e.preventDefault(); e.stopPropagation();
    const p = dansToile(e);
    const c = coupe || { x: 0.1, y: 0.1, l: 0.8, h: 0.8 };
    depart.current = { sx: p.x, sy: p.y, cx: c.x, cy: c.y, cl: c.l, ch: c.h };
    setGeste(quoi);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const bouger = (e: React.PointerEvent) => {
    if (!geste) return;
    const p = dansToile(e);
    const dx = p.x - depart.current.sx, dy = p.y - depart.current.sy;
    if (geste === "deplacer") {
      setCoupe({
        x: Math.max(0, Math.min(1 - depart.current.cl, depart.current.cx + dx)),
        y: Math.max(0, Math.min(1 - depart.current.ch, depart.current.cy + dy)),
        l: depart.current.cl, h: depart.current.ch,
      });
    } else {
      setCoupe({
        x: depart.current.cx, y: depart.current.cy,
        /* Un cadre de coupe minuscule ne sert à rien et produit une image
           illisible : on garde un plancher de 5 %. */
        l: Math.max(0.05, Math.min(1 - depart.current.cx, depart.current.cl + dx)),
        h: Math.max(0.05, Math.min(1 - depart.current.cy, depart.current.ch + dy)),
      });
    }
  };
  const lacher = () => setGeste(null);

  /* ───────────────────────── ENREGISTRER ────────────────────────── */
  function resume(): string[] {
    const faits: string[] = [];
    if (reglages.quarts) faits.push(`tournée de ${reglages.quarts * 90}°`);
    if (reglages.inclinaison) faits.push(`redressée de ${reglages.inclinaison}°`);
    if (reglages.miroirH) faits.push("miroir horizontal");
    if (reglages.miroirV) faits.push("miroir vertical");
    if (coupe && (coupe.l < 0.999 || coupe.h < 0.999)) faits.push("recadrée");
    if (reglages.luminosite !== 100) faits.push(`luminosité ${reglages.luminosite > 100 ? "+" : ""}${reglages.luminosite - 100}`);
    if (reglages.contraste !== 100) faits.push(`contraste ${reglages.contraste > 100 ? "+" : ""}${reglages.contraste - 100}`);
    if (reglages.saturation !== 100) faits.push(`saturation ${reglages.saturation > 100 ? "+" : ""}${reglages.saturation - 100}`);
    return faits;
  }

  const riennAFaire = resume().length === 0;

  async function enregistrer(enVersion: boolean) {
    if (!doc) return;
    setEnvoi(true); setErreur("");
    try {
      const rendu = composer(true);
      if (!rendu) { setErreur("L'image n'a pas pu être composée."); return; }
      /* Du PNG : les images de documents passent par plusieurs
         enregistrements, et le JPEG perd un peu à chaque fois — au bout de
         trois retouches, les chiffres d'un reçu deviennent illisibles. */
      const blob = await new Promise<Blob | null>((ok) => rendu.toBlob((b) => ok(b), "image/png"));
      if (!blob) { setErreur("L'image n'a pas pu être encodée."); return; }

      const faits = resume();
      const form = new FormData();
      if (enVersion) {
        form.append("fichier", blob, doc.name.replace(/\.[^.]+$/, "") + ".png");
        form.append("note", `Photo retouchée : ${faits.join(", ")}`);
        const r = await authFetch(`/studio/documents/${documentId}/versions`, {
          method: "POST", body: form });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setErreur(j.error || "Enregistrement impossible."); return; }
        setMessage(
          `Enregistré en version ${j.document?.version}. La version précédente reste ` +
          `intacte et téléchargeable dans l'historique.`);
        setReglages(NEUTRE); setCoupe(null); setModeCoupe(false);
        /* On recharge la source : les réglages suivants doivent partir de
           l'image enregistrée, pas s'ajouter à ceux déjà appliqués. */
        setTimeout(() => router.refresh(), 100);
      } else {
        const nom = `${doc.name.replace(/\.[^.]+$/, "")} — retouchée.png`;
        form.append("fichier", blob, nom);
        form.append("nom", nom);
        form.append("visibilite", doc.visibility || "PRIVE");
        if (doc.folder_id) form.append("dossier_id", String(doc.folder_id));
        form.append("source_id", String(documentId));
        form.append("source_note", `Retouche de « ${doc.name} » (version ${doc.version}) : ${faits.join(", ")}.`);
        form.append("description", `Retouche : ${faits.join(", ")}.`);
        const r = await authFetch("/studio/documents", { method: "POST", body: form });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { setErreur(j.error || "Enregistrement impossible."); return; }
        setMessage(`Nouveau document « ${j.document?.name} » créé. L'original n'a pas été modifié.`);
      }
    } catch { setErreur("Le serveur n'a pas répondu."); }
    finally { setEnvoi(false); }
  }

  if (droitsEnCours) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!can("studio.photo", "view")) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Lock className="mx-auto mb-4 text-gray-500" size={40} />
          <h1 className="mb-2 text-xl font-semibold">Éditeur photo non accessible</h1>
          <p className="text-sm text-gray-400">
            Votre compte n&apos;a pas l&apos;accès à l&apos;éditeur photo pour
            cette société.
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
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 min-w-0">
          <Link href="/studio/bibliotheque" className="shrink-0 rounded-lg p-2 hover:bg-gray-800"
            aria-label="Retour à la bibliothèque">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">{doc?.name || "Éditeur photo"}</h1>
            <p className="truncate text-xs text-gray-500">
              {doc
                ? `Version ${doc.version} · ${poids(doc.size_bytes)}` +
                  (tailleRendue.l ? ` · aperçu ${tailleRendue.l}×${tailleRendue.h}` : "")
                : "Ouverture…"}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-4 min-w-0">
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
            <Loader2 size={16} className="animate-spin" /> Ouverture de l&apos;image…
          </p>
        ) : !doc ? null : (
          <>
            {/* ─────────────────────── L'APERÇU ──────────────────── */}
            <div className="flex justify-center overflow-auto rounded-xl border border-gray-800 bg-gray-950 p-2">
              <div className="relative inline-block" style={{ lineHeight: 0 }}>
                <div ref={zone} />
                {modeCoupe && toile.current && (
                  <div
                    className="absolute touch-none"
                    style={{
                      left: `${(coupe?.x ?? 0.1) * 100}%`,
                      top: `${(coupe?.y ?? 0.1) * 100}%`,
                      width: `${(coupe?.l ?? 0.8) * 100}%`,
                      height: `${(coupe?.h ?? 0.8) * 100}%`,
                      cursor: "move",
                    }}
                    onPointerDown={(e) => prendre(e, "deplacer")}
                    onPointerMove={bouger}
                    onPointerUp={lacher}
                    onPointerCancel={lacher}
                  >
                    <div className="h-full w-full border-2 border-dashed border-amber-400 bg-amber-400/10" />
                    <span
                      className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-amber-400"
                      onPointerDown={(e) => prendre(e, "etirer")}
                      onPointerMove={bouger}
                      onPointerUp={lacher}
                      onPointerCancel={lacher}
                    />
                  </div>
                )}
              </div>
            </div>
            <p className="mt-1 text-center text-xs text-gray-500">
              L&apos;aperçu applique exactement le traitement qui sera
              enregistré, en plus petit pour rester fluide.
            </p>

            {/* ────────────────────── LES OUTILS ─────────────────── */}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Crop size={15} /> Cadrage et orientation
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  <Bouton onClick={() => setReglages((r) => ({ ...r, quarts: (r.quarts + 3) % 4 }))}>
                    <RotateCcw size={14} /> Gauche
                  </Bouton>
                  <Bouton onClick={() => setReglages((r) => ({ ...r, quarts: (r.quarts + 1) % 4 }))}>
                    <RotateCw size={14} /> Droite
                  </Bouton>
                  <Bouton onClick={() => setReglages((r) => ({ ...r, miroirH: !r.miroirH }))}
                    actif={reglages.miroirH}>
                    <FlipHorizontal size={14} /> Miroir
                  </Bouton>
                  <Bouton onClick={() => setReglages((r) => ({ ...r, miroirV: !r.miroirV }))}
                    actif={reglages.miroirV}>
                    <FlipVertical size={14} /> Retourner
                  </Bouton>
                  <Bouton onClick={() => { setModeCoupe((m) => !m); if (!coupe) setCoupe({ x: 0.08, y: 0.08, l: 0.84, h: 0.84 }); }}
                    actif={modeCoupe}>
                    <Crop size={14} /> {modeCoupe ? "Terminer le cadrage" : "Recadrer"}
                  </Bouton>
                  {coupe && (
                    <Bouton onClick={() => { setCoupe(null); setModeCoupe(false); }}>
                      <Undo2 size={14} /> Pleine image
                    </Bouton>
                  )}
                </div>

                <Curseur
                  nom="Redressement" unite="°" min={-15} max={15} pas={0.5}
                  valeur={reglages.inclinaison}
                  onChange={(n) => setReglages((r) => ({ ...r, inclinaison: n }))}
                  aide="Pour une photo prise un peu de travers. Les coins vides sont remplis en blanc."
                />
              </section>

              <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Sun size={15} /> Lumière
                </h2>
                <Curseur nom="Luminosité" min={40} max={200} pas={1}
                  valeur={reglages.luminosite}
                  onChange={(n) => setReglages((r) => ({ ...r, luminosite: n }))} />
                <Curseur nom="Contraste" min={40} max={250} pas={1}
                  valeur={reglages.contraste}
                  onChange={(n) => setReglages((r) => ({ ...r, contraste: n }))} />
                <Curseur nom="Saturation" min={0} max={200} pas={1}
                  valeur={reglages.saturation}
                  onChange={(n) => setReglages((r) => ({ ...r, saturation: n }))} />

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {/* LE RÉGLAGE QUI SERT VRAIMENT ICI : un reçu photographié
                      sur un comptoir, dont les chiffres doivent se lire. */}
                  <Bouton onClick={() => setReglages((r) => ({
                    ...r, luminosite: 112, contraste: 165, saturation: 20 }))}>
                    Renforcer un document
                  </Bouton>
                  <Bouton onClick={() => setReglages((r) => ({
                    ...r, luminosite: 100, contraste: 100, saturation: 0 }))}>
                    Noir et blanc
                  </Bouton>
                  <Bouton onClick={() => setReglages((r) => ({
                    ...r, luminosite: 100, contraste: 100, saturation: 100 }))}>
                    Lumière d&apos;origine
                  </Bouton>
                </div>
              </section>
            </div>

            {/* ───────────────────── ENREGISTRER ─────────────────── */}
            <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900/40 p-3">
              <p className="text-xs text-gray-400">
                {riennAFaire
                  ? "Aucune retouche pour l'instant."
                  : `Ce qui sera enregistré : ${resume().join(", ")}.`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {peutModifier && (
                  <button onClick={() => enregistrer(true)} disabled={envoi || riennAFaire}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-30">
                    {envoi ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Enregistrer en nouvelle version
                  </button>
                )}
                {peutCreer && (
                  <button onClick={() => enregistrer(false)} disabled={envoi || riennAFaire}
                    className="flex items-center gap-2 rounded-lg border border-gray-800 px-4 py-2 text-sm hover:bg-gray-800 disabled:opacity-30">
                    Créer un document à part
                  </button>
                )}
                <button onClick={() => { setReglages(NEUTRE); setCoupe(null); setModeCoupe(false); }}
                  disabled={envoi || riennAFaire}
                  className="flex items-center gap-2 rounded-lg border border-gray-800 px-4 py-2 text-sm hover:bg-gray-800 disabled:opacity-30">
                  <Undo2 size={16} /> Tout annuler
                </button>
              </div>
              {/* DANS LES DEUX CAS, L'ORIGINAL RESTE. On le dit, parce que
                  c'est la question qu'on se pose avant de cliquer. */}
              <p className="mt-2 text-xs text-gray-500">
                « Nouvelle version » garde l&apos;original intact dans
                l&apos;historique du document ; « document à part » ne touche
                pas du tout à celui-ci et garde le lien vers sa source. Dans
                les deux cas, rien n&apos;est écrasé.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────── PETITES PIÈCES ───────────────────────────── */

function Bouton({ children, onClick, actif }: {
  children: React.ReactNode; onClick: () => void; actif?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
        actif ? "border-blue-600 bg-blue-950/50 text-blue-200" : "border-gray-800 hover:bg-gray-800"
      }`}>
      {children}
    </button>
  );
}

function Curseur({ nom, valeur, min, max, pas, onChange, unite = "", aide }: {
  nom: string; valeur: number; min: number; max: number; pas: number;
  onChange: (n: number) => void; unite?: string; aide?: string;
}) {
  const neutre = unite === "°" ? 0 : 100;
  return (
    <label className="mt-2 block">
      <span className="flex items-center justify-between text-xs text-gray-400">
        <span>{nom}</span>
        <span className={valeur === neutre ? "text-gray-600" : "text-blue-300"}>
          {valeur > neutre && unite !== "°" ? "+" : ""}
          {unite === "°" ? valeur : valeur - 100}{unite || ""}
        </span>
      </span>
      <input type="range" min={min} max={max} step={pas} value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-blue-500" />
      {aide && <span className="block text-[11px] text-gray-600">{aide}</span>}
    </label>
  );
}
