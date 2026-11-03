"use client";

/**
 * L'ÉDITEUR DE PRÉSENTATION.
 *
 * À gauche la bande des diapositives, au milieu celle qu'on travaille, à
 * droite ses réglages. On ajoute, on duplique, on réordonne, on supprime ; on
 * pose du texte, des formes, des images.
 *
 * CE QUE CET ÉCRAN REFUSE DE LAISSER ARRIVER.
 *
 * 1. QU'ON PERDE SON TRAVAIL SANS LE SAVOIR. L'en-tête dit en permanence s'il
 *    reste des modifications non enregistrées, et quitter la page les
 *    emporterait : le navigateur demande donc confirmation. Un éditeur qui se
 *    tait sur ce point finit par coûter une soirée de travail à quelqu'un.
 *
 * 2. QU'UNE DIAPOSITIVE DISPARAISSE EN SILENCE. Supprimer la dernière est
 *    impossible — une présentation sans diapositive n'en est pas une — et
 *    chaque suppression dit laquelle.
 *
 * 3. QU'ON CONFONDE L'APERÇU ET LE RÉSULTAT. L'aperçu et l'enregistrement
 *    passent par la MÊME fonction de rendu, à deux échelles différentes. Deux
 *    chemins finiraient par diverger, et l'on projetterait autre chose que ce
 *    qu'on a validé — ce qui ne se découvre qu'une fois la réunion commencée.
 *
 * CE QUE L'EXPORT POWERPOINT DIT HONNÊTEMENT. Il produit des formes VRAIES et
 * modifiables, pas des images de diapositives. Mais les polices sont celles
 * d'Office — Arial, Georgia, Courier New — et le placement du texte, qu'Office
 * calcule avec ses propres règles de ligne, peut bouger d'un millimètre. Le
 * PDF, lui, est exactement ce qu'on voit. L'écran le dit avant d'exporter.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { authFetch } from "../../../lib/api";
import { usePermissions } from "../../../lib/permissions";
import { cadre, nouvelId, POLICES, type Element } from "../../../lib/creation";
import {
  MODELES_DIAPO, PX_PAR_MM_DIAPOSITIVE, copier, enPng, rendre, ressourcesDe,
  type Format, type Plan,
} from "../../../lib/presentation";
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Check, Circle, Copy,
  FileDown, Image as ImageIcon, Loader2, Lock, Minus, Plus, Save, Square,
  Trash2, Type, X,
} from "lucide-react";

type Infos = {
  document: { id: number; name: string; version: number; trashed_at: string | null };
  plan: { diapositives: Plan[] };
  format: string;
  largeur_mm: number;
  hauteur_mm: number;
  mon_niveau: string;
};

const COULEURS = ["#0f172a", "#ffffff", "#1d4ed8", "#dc2626", "#15803d", "#b45309", "#64748b"];

export default function EditeurPresentation() {
  const params = useParams();
  const router = useRouter();
  const documentId = Number(params?.id);
  const { can, loading: droitsEnCours } = usePermissions();
  const peutModifier = can("studio.presentation", "update");
  const peutExporter = can("studio.presentation", "export");

  const [infos, setInfos] = useState<Infos | null>(null);
  const [diapos, setDiapos] = useState<Plan[]>([]);
  const [courante, setCourante] = useState(0);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [modifie, setModifie] = useState(false);

  const [chargement, setChargement] = useState(true);
  const [occupe, setOccupe] = useState("");
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [avancement, setAvancement] = useState("");

  const zone = useRef<HTMLDivElement | null>(null);
  const toile = useRef<HTMLCanvasElement | null>(null);
  const bande = useRef<HTMLDivElement | null>(null);
  const images = useRef<Map<string, HTMLImageElement>>(new Map());
  const depart = useRef({ sx: 0, sy: 0, ex: 0, ey: 0, el: 0, eh: 0 });
  const [geste, setGeste] = useState<null | "deplacer" | "etirer">(null);
  const [echelle, setEchelle] = useState(1);
  const champImage = useRef<HTMLInputElement | null>(null);

  const format: Format | null = infos
    ? { cle: infos.format, nom: "", largeurMm: infos.largeur_mm, hauteurMm: infos.hauteur_mm }
    : null;
  const plan = diapos[courante] || null;
  const element = plan?.elements.find((e) => e.id === choisi) || null;

  /* ───────────────────────── CHARGER ───────────────────────── */
  const charger = useCallback(async () => {
    setChargement(true); setErreur("");
    try {
      const r = await authFetch(`/studio/presentations/${documentId}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Cette présentation est introuvable.");
      setInfos(d);
      setDiapos(d.plan?.diapositives || []);
      setCourante(0); setChoisi(null); setModifie(false);
    } catch (e: any) { setErreur(e?.message || "Ouverture impossible."); }
    finally { setChargement(false); }
  }, [documentId]);

  useEffect(() => { if (documentId) charger(); }, [documentId, charger]);

  /* Les images de TOUTES les diapositives, décodées une fois : la bande des
     vignettes en a besoin autant que l'aperçu. */
  useEffect(() => {
    for (const d of diapos) {
      for (const el of d.elements) {
        if (el.type !== "image" || images.current.has(el.id)) continue;
        const img = new Image();
        img.onload = () => { setPretes((n) => n + 1); };
        img.onerror = () => { /* le rendu montrera « image absente » */ };
        img.src = el.src;
        images.current.set(el.id, img);
      }
    }
  }, [diapos]);
  const [pretes, setPretes] = useState(0);

  const ressources = useCallback(
    () => ({ images: images.current as Map<string, CanvasImageSource> }), []);

  /* ─────────────────────── L'APERÇU ─────────────────────── */
  const dessiner = useCallback(() => {
    if (!format || !plan) return;
    const hote = zone.current;
    if (!hote) return;
    const largeurDispo = Math.min(hote.clientWidth || 600, 1100);
    const hauteurDispo = Math.max(200, (window.innerHeight || 800) - 400);
    const px = Math.max(0.3, Math.min(
      largeurDispo / format.largeurMm, hauteurDispo / format.hauteurMm,
      PX_PAR_MM_DIAPOSITIVE));
    const c = rendre(plan, format.largeurMm, format.hauteurMm, px, ressources());
    c.className = "block";
    c.style.boxShadow = "0 8px 24px rgba(0,0,0,0.5)";
    toile.current = c;
    hote.replaceChildren(c);
    setEchelle(px);
  }, [format, plan, ressources, pretes]);

  useEffect(() => { if (!chargement) dessiner(); }, [chargement, dessiner]);
  useEffect(() => {
    const r = () => dessiner();
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, [dessiner]);

  /* ─────────────────── LES VIGNETTES ───────────────────
     Elles sont redessinées quand le jeu change. Une signature du contenu sert
     de déclencheur plutôt que le tableau lui-même : sans elle, chaque
     déplacement de souris redessinerait les vingt vignettes. */
  const signature = useMemo(() => JSON.stringify(
    diapos.map((d) => [d.fond, d.elements.length,
      d.elements.map((e) => `${e.type}${(e as any).texte || ""}${(e as any).couleur || ""}`).join()])),
    [diapos]);

  useEffect(() => {
    const hote = bande.current;
    if (!hote || !format) return;
    const px = Math.min(1.2, 150 / format.largeurMm);
    const sortie = diapos.map((d, i) => {
      const c = rendre(d, format.largeurMm, format.hauteurMm, px, ressources());
      c.className = "block w-full rounded";
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.dataset.diapo = String(i + 1);
      bouton.setAttribute("aria-label", `Diapositive ${i + 1}`);
      bouton.className = "block w-full rounded-lg border-2 p-0.5 text-left "
        + (i === courante ? "border-blue-500 bg-blue-600/10" : "border-gray-800 hover:border-gray-600");
      const n = document.createElement("span");
      n.className = "block px-1 pt-0.5 text-[10px] text-gray-500";
      n.textContent = String(i + 1);
      bouton.append(c, n);
      bouton.onclick = () => { setCourante(i); setChoisi(null); };
      return bouton;
    });
    hote.replaceChildren(...sortie);
  }, [signature, courante, format, ressources, pretes, diapos]);

  /* ───────────── QUITTER AVEC DU TRAVAIL NON ENREGISTRÉ ───────────── */
  useEffect(() => {
    if (!modifie) return;
    const garde = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", garde);
    return () => window.removeEventListener("beforeunload", garde);
  }, [modifie]);

  /* ─────────────────── MODIFIER LE PLAN ─────────────────── */
  const majDiapo = (i: number, suite: (p: Plan) => Plan) => {
    setDiapos((liste) => liste.map((d, j) => (j === i ? suite(d) : d)));
    setModifie(true);
  };

  const maj = useCallback((id: string, champs: Partial<Element>) => {
    setDiapos((liste) => liste.map((d, j) => (j !== courante ? d : {
      ...d,
      elements: d.elements.map((e) => (e.id === id ? { ...e, ...champs } as Element : e)),
    })));
    setModifie(true);
  }, [courante]);

  const ajouter = (el: Element) => {
    majDiapo(courante, (p) => ({ ...p, elements: [...p.elements, el] }));
    setChoisi(el.id);
  };

  const supprimerElement = (id: string) => {
    majDiapo(courante, (p) => ({ ...p, elements: p.elements.filter((e) => e.id !== id) }));
    images.current.delete(id);
    setChoisi(null);
  };

  const dupliquerElement = (id: string) => {
    const el = plan?.elements.find((e) => e.id === id);
    if (!el) return;
    const copie = { ...el, id: nouvelId(), x: el.x + 4, y: el.y + 4 } as Element;
    if (el.type === "image") {
      const img = images.current.get(el.id);
      if (img) images.current.set(copie.id, img);
    }
    ajouter(copie);
  };

  const rang = (id: string, sens: -1 | 1) => {
    majDiapo(courante, (p) => {
      const i = p.elements.findIndex((e) => e.id === id);
      const j = i + sens;
      if (i < 0 || j < 0 || j >= p.elements.length) return p;
      const n = [...p.elements];
      [n[i], n[j]] = [n[j], n[i]];
      return { ...p, elements: n };
    });
  };

  /* ─────────────────── LES DIAPOSITIVES ─────────────────── */
  const ajouterDiapo = (cle: string) => {
    if (!format) return;
    const m = MODELES_DIAPO.find((x) => x.cle === cle) || MODELES_DIAPO[0];
    const neuve = m.plan(format);
    setDiapos((liste) => {
      const n = [...liste];
      n.splice(courante + 1, 0, neuve);
      return n;
    });
    setCourante((i) => i + 1);
    setChoisi(null); setModifie(true);
    setMessage(`Diapositive ${courante + 2} ajoutée — « ${m.nom} ».`);
  };

  const dupliquerDiapo = () => {
    if (!plan) return;
    const copie = copier(plan);
    /* Les images décodées suivent la copie, sinon la vignette afficherait
       « image absente » jusqu'au rechargement. */
    plan.elements.forEach((el, i) => {
      if (el.type !== "image") return;
      const img = images.current.get(el.id);
      if (img) images.current.set(copie.elements[i].id, img);
    });
    setDiapos((liste) => {
      const n = [...liste];
      n.splice(courante + 1, 0, copie);
      return n;
    });
    setCourante((i) => i + 1);
    setChoisi(null); setModifie(true);
  };

  const supprimerDiapo = () => {
    if (diapos.length <= 1) {
      /* UNE PRÉSENTATION SANS DIAPOSITIVE N'EN EST PAS UNE, et le serveur la
         refuserait. Autant le dire ici que laisser l'enregistrement échouer. */
      setErreur("C'est la dernière diapositive : une présentation en a au moins une.");
      return;
    }
    const numero = courante + 1;
    setDiapos((liste) => liste.filter((_, j) => j !== courante));
    setCourante((i) => Math.max(0, Math.min(i, diapos.length - 2)));
    setChoisi(null); setModifie(true);
    setMessage(`Diapositive ${numero} supprimée. Elle reviendra si vous rechargez sans enregistrer.`);
  };

  const deplacerDiapo = (sens: -1 | 1) => {
    const j = courante + sens;
    if (j < 0 || j >= diapos.length) return;
    setDiapos((liste) => {
      const n = [...liste];
      [n[courante], n[j]] = [n[j], n[courante]];
      return n;
    });
    setCourante(j); setModifie(true);
  };

  /* ──────────────── DÉPLACER À LA SOURIS ──────────────── */
  const enMm = (e: React.PointerEvent) => {
    const c = toile.current;
    const r = c?.getBoundingClientRect();
    if (!r || !format) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - r.left) / r.width) * format.largeurMm,
      y: ((e.clientY - r.top) / r.height) * format.hauteurMm,
    };
  };

  const prendre = (e: React.PointerEvent, id: string, quoi: "deplacer" | "etirer") => {
    e.preventDefault(); e.stopPropagation();
    const el = plan?.elements.find((x) => x.id === id);
    if (!el || !peutModifier) return;
    const c = cadre(el);
    const p = enMm(e);
    depart.current = { sx: p.x, sy: p.y, ex: c.x, ey: c.y, el: c.l, eh: c.h };
    setChoisi(id); setGeste(quoi);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const bouger = (e: React.PointerEvent) => {
    if (!geste || !choisi || !format) return;
    const p = enMm(e);
    const dx = p.x - depart.current.sx, dy = p.y - depart.current.sy;
    const el = plan?.elements.find((x) => x.id === choisi);
    if (!el) return;
    const arrondi = (v: number) => Math.round(v * 10) / 10;
    if (geste === "deplacer") {
      maj(choisi, { x: arrondi(depart.current.ex + dx), y: arrondi(depart.current.ey + dy) } as Partial<Element>);
    } else if (el.type === "ligne" || el.type === "texte") {
      maj(choisi, { l: Math.max(5, arrondi(depart.current.el + dx)) } as Partial<Element>);
    } else {
      maj(choisi, {
        l: Math.max(5, arrondi(depart.current.el + dx)),
        h: Math.max(5, arrondi(depart.current.eh + dy)),
      } as Partial<Element>);
    }
  };
  const lacher = () => setGeste(null);

  /* ────────────────────── ENREGISTRER ────────────────────── */
  async function enregistrer() {
    if (!format || !infos) return;
    setOccupe("enregistrer"); setErreur(""); setMessage("");
    try {
      const form = new FormData();
      form.append("plan", JSON.stringify({ diapositives: diapos }));
      for (const [i, d] of diapos.entries()) {
        setAvancement(`Diapositive ${i + 1} sur ${diapos.length}…`);
        /* LA MÊME FONCTION QUE L'APERÇU, à la finesse de la projection. */
        form.append("diapositives", await enPng(d, format), `diapo${i + 1}.png`);
      }
      setAvancement("Envoi…");
      const r = await authFetch(`/studio/presentations/${documentId}`,
        { method: "POST", body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "L'enregistrement a échoué.");
      setInfos((x) => (x ? { ...x, document: { ...x.document, version: d.document.version } } : x));
      setModifie(false);
      setMessage(d?.message || "Enregistré.");
    } catch (e: any) { setErreur(e?.message || "L'enregistrement a échoué."); }
    finally { setOccupe(""); setAvancement(""); }
  }

  async function exporter() {
    setOccupe("pptx"); setErreur(""); setMessage("");
    try {
      const r = await authFetch(`/studio/presentations/${documentId}/pptx`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "L'export a échoué.");
      setMessage(
        `${d.message} Le fichier « ${d.document.name} » est dans la bibliothèque.` +
        (d.nonRepris?.length ? `\n\nNon repris : ${d.nonRepris.join(" ; ")}.` : ""));
    } catch (e: any) { setErreur(e?.message || "L'export a échoué."); }
    finally { setOccupe(""); }
  }

  /* ────────────────────── ÉCRANS D'ATTENTE ────────────────────── */
  if (droitsEnCours || chargement) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }
  if (!infos) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-400" />
          <p className="text-gray-300">{erreur || "Cette présentation est introuvable."}</p>
          <Link href="/studio/presentations" className="mt-6 inline-block text-sm text-blue-400 hover:underline">
            Retour aux présentations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white min-w-0 w-full">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 pr-20 py-3 min-w-0">
          <button onClick={() => {
            if (modifie && !window.confirm(
              "Des modifications ne sont pas enregistrées. Quitter les perdra. Continuer ?")) return;
            router.push("/studio/presentations");
          }} className="shrink-0 rounded-lg p-2 hover:bg-gray-800"
            aria-label="Retour aux présentations">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">{infos.document.name}</h1>
            <p className="truncate text-xs text-gray-500">
              {diapos.length} diapositive{diapos.length > 1 ? "s" : ""}
              {" · "}version {infos.document.version}
              {" · "}{infos.largeur_mm.toFixed(0)} × {infos.hauteur_mm.toFixed(0)} mm
              {modifie && <span className="text-amber-400"> · modifications non enregistrées</span>}
            </p>
          </div>
          {peutExporter && (
            <button onClick={exporter} disabled={!!occupe}
              className="shrink-0 flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-40">
              {occupe === "pptx" ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
              <span className="hidden sm:inline">PowerPoint</span>
            </button>
          )}
          {peutModifier && (
            <button onClick={enregistrer} disabled={!!occupe || !modifie}
              className="shrink-0 flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-40">
              {occupe === "enregistrer" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Enregistrer
            </button>
          )}
        </div>
        {avancement && (
          <p className="mx-auto max-w-[1600px] px-4 pb-2 text-xs text-gray-500">{avancement}</p>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4 min-w-0 space-y-3">
        {!peutModifier && (
          <p className="flex items-start gap-2 rounded-lg border border-gray-800 bg-gray-900 p-3 text-sm text-gray-400">
            <Lock size={16} className="mt-0.5 shrink-0" />
            Vous pouvez regarder cette présentation, pas la modifier.
          </p>
        )}
        {erreur && (
          <p data-bandeau="erreur"
            className="flex items-start gap-2 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1 whitespace-pre-wrap">{erreur}</span>
            <button onClick={() => setErreur("")} className="shrink-0" aria-label="Fermer">
              <X size={14} />
            </button>
          </p>
        )}
        {message && (
          <p data-bandeau="succes"
            className="flex items-start gap-2 rounded-lg border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">
            <Check size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1 whitespace-pre-wrap">{message}</span>
            <button onClick={() => setMessage("")} className="shrink-0" aria-label="Fermer">
              <X size={14} />
            </button>
          </p>
        )}

        <div className="grid gap-3 lg:grid-cols-[9rem_1fr_20rem]">
          {/* ──────────── LA BANDE ──────────── */}
          <aside className="min-w-0">
            <div ref={bande}
              className="flex gap-2 overflow-x-auto pb-2 lg:max-h-[70vh] lg:flex-col lg:overflow-y-auto lg:overflow-x-visible" />
            {peutModifier && (
              <div className="mt-2 space-y-1.5">
                <select onChange={(e) => { if (e.target.value) { ajouterDiapo(e.target.value); e.target.value = ""; } }}
                  defaultValue=""
                  aria-label="Ajouter une diapositive"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 p-1.5 text-xs text-white">
                  <option value="">+ Ajouter…</option>
                  {MODELES_DIAPO.map((m) => <option key={m.cle} value={m.cle}>{m.nom}</option>)}
                </select>
                <div className="flex gap-1">
                  <button onClick={dupliquerDiapo} title="Dupliquer cette diapositive"
                    aria-label="Dupliquer cette diapositive"
                    className="flex-1 rounded border border-gray-800 p-1.5 hover:bg-gray-800">
                    <Copy size={13} className="mx-auto" />
                  </button>
                  <button onClick={() => deplacerDiapo(-1)} disabled={courante === 0}
                    title="Monter" aria-label="Monter cette diapositive"
                    className="flex-1 rounded border border-gray-800 p-1.5 hover:bg-gray-800 disabled:opacity-25">
                    <ArrowUp size={13} className="mx-auto" />
                  </button>
                  <button onClick={() => deplacerDiapo(1)} disabled={courante >= diapos.length - 1}
                    title="Descendre" aria-label="Descendre cette diapositive"
                    className="flex-1 rounded border border-gray-800 p-1.5 hover:bg-gray-800 disabled:opacity-25">
                    <ArrowDown size={13} className="mx-auto" />
                  </button>
                  <button onClick={supprimerDiapo} title="Supprimer cette diapositive"
                    aria-label="Supprimer cette diapositive"
                    className="flex-1 rounded border border-gray-800 p-1.5 text-red-300 hover:bg-red-950/60">
                    <Trash2 size={13} className="mx-auto" />
                  </button>
                </div>
              </div>
            )}
          </aside>

          {/* ──────────── LA DIAPOSITIVE ──────────── */}
          <section className="min-w-0">
            {peutModifier && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Outil onClick={() => ajouter({
                  id: nouvelId(), type: "texte", x: infos.largeur_mm * 0.1,
                  y: infos.hauteur_mm * 0.4, l: infos.largeur_mm * 0.5,
                  texte: "Votre texte", taille: infos.hauteur_mm * 0.04,
                  couleur: "#0f172a", graisse: 400, alignement: "gauche",
                  police: "sans", interligne: 1.3 } as Element)}>
                  <Type size={14} /> Texte
                </Outil>
                <Outil onClick={() => ajouter({
                  id: nouvelId(), type: "rect", x: infos.largeur_mm * 0.1,
                  y: infos.hauteur_mm * 0.3, l: infos.largeur_mm * 0.25,
                  h: infos.hauteur_mm * 0.2, couleur: "#1d4ed8", rayon: 0,
                  bordure: 0, couleurBordure: "#1d4ed8" } as Element)}>
                  <Square size={14} /> Rectangle
                </Outil>
                <Outil onClick={() => ajouter({
                  id: nouvelId(), type: "ellipse", x: infos.largeur_mm * 0.1,
                  y: infos.hauteur_mm * 0.3, l: infos.hauteur_mm * 0.2,
                  h: infos.hauteur_mm * 0.2, couleur: "#15803d",
                  bordure: 0, couleurBordure: "#15803d" } as Element)}>
                  <Circle size={14} /> Ellipse
                </Outil>
                <Outil onClick={() => ajouter({
                  id: nouvelId(), type: "ligne", x: infos.largeur_mm * 0.1,
                  y: infos.hauteur_mm * 0.5, l: infos.largeur_mm * 0.3,
                  epaisseur: 1, couleur: "#1d4ed8" } as Element)}>
                  <Minus size={14} /> Trait
                </Outil>
                <Outil onClick={() => champImage.current?.click()}>
                  <ImageIcon size={14} /> Image
                </Outil>
                <input ref={champImage} type="file" accept="image/png,image/jpeg" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    /* L'IMAGE EST GARDÉE DANS LE PLAN. Au-delà de 900 Ko, le plan
                       de la présentation deviendrait trop lourd et le serveur le
                       refuserait : on le dit tout de suite plutôt que de laisser
                       échouer l'enregistrement une fois tout le travail fait. */
                    if (f.size > 900 * 1024) {
                      setErreur(
                        "Cette image dépasse 900 Ko. Réduisez-la, ou retouchez-la depuis la "
                        + "bibliothèque avant de l'utiliser ici.");
                      return;
                    }
                    const lecteur = new FileReader();
                    lecteur.onload = () => {
                      const src = String(lecteur.result || "");
                      const id = nouvelId();
                      const img = new Image();
                      img.onload = () => setPretes((n) => n + 1);
                      img.src = src;
                      images.current.set(id, img);
                      ajouter({ id, type: "image", x: infos.largeur_mm * 0.1,
                        y: infos.hauteur_mm * 0.25, l: infos.largeur_mm * 0.3,
                        h: infos.hauteur_mm * 0.3, src, arrondi: 0 } as Element);
                    };
                    lecteur.onerror = () => setErreur("Cette image n'a pas pu être lue.");
                    lecteur.readAsDataURL(f);
                  }} />
              </div>
            )}

            <div className="flex justify-center overflow-auto rounded-xl border border-gray-800 bg-gray-900 p-3">
              <div className="relative inline-block" style={{ lineHeight: 0 }}
                onPointerDown={() => setChoisi(null)}>
                {/* LA TOILE EST ACCROCHÉE DANS CE SEUL CONTENEUR, par l'effet
                    d'aperçu, qui remplace son contenu. Les poignées sont donc
                    ses SŒURS et non ses filles : « replaceChildren » emporte
                    tout ce qu'il trouve, y compris ce que React y aurait mis,
                    et React ne le saurait pas. */}
                <div ref={zone} />
                {/* Les poignées sont placées en POURCENTAGE des dimensions de
                    la diapositive. En pixels, il faudrait connaître l'échelle
                    exacte de la toile à chaque redimensionnement de fenêtre —
                    et un décalage d'un seul pixel se voit quand on vise un
                    trait d'un millimètre. */}
                {peutModifier && plan && toile.current && plan.elements.map((el) => {
                  const c = cadre(el);
                  const prise = el.id === choisi;
                  return (
                    <div key={el.id} className="absolute touch-none"
                      style={{
                        left: `${(c.x / infos.largeur_mm) * 100}%`,
                        top: `${(c.y / infos.hauteur_mm) * 100}%`,
                        width: `${(c.l / infos.largeur_mm) * 100}%`,
                        height: `${(c.h / infos.hauteur_mm) * 100}%`,
                        cursor: "move",
                        outline: prise ? "2px solid #3b82f6" : "1px dashed rgba(148,163,184,0.3)",
                      }}
                      onPointerDown={(e) => prendre(e, el.id, "deplacer")}
                      onPointerMove={bouger} onPointerUp={lacher} onPointerCancel={lacher}>
                      {prise && (
                        <span style={{ touchAction: "none" }}
                          className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-blue-500"
                          onPointerDown={(e) => prendre(e, el.id, "etirer")}
                          onPointerMove={bouger} onPointerUp={lacher} onPointerCancel={lacher} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ──────────── LES RÉGLAGES ──────────── */}
          <aside className="min-w-0 space-y-3">
            {!element ? (
              <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
                <h2 className="mb-2 text-sm font-semibold">Réglages</h2>
                <p className="text-xs text-gray-600">
                  Touchez un élément de la diapositive pour le régler.
                </p>
                <div className="mt-3">
                  <span className="block text-xs text-gray-400">Fond de la diapositive</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {COULEURS.map((c) => (
                      <button key={c} disabled={!peutModifier}
                        onClick={() => majDiapo(courante, (p) => ({ ...p, fond: c }))}
                        aria-label={`Fond ${c}`}
                        className={`h-7 w-7 rounded-md border-2 disabled:opacity-40 ${
                          plan?.fond === c ? "border-white" : "border-gray-700"}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <Reglages
                el={element} peutModifier={peutModifier}
                maj={maj} onSupprimer={supprimerElement}
                onDupliquer={dupliquerElement} onRang={rang} />
            )}

            <p className="rounded-xl border border-gray-800 bg-gray-900/40 p-3 text-xs text-gray-500">
              <strong className="text-gray-300">Le PDF est exact</strong> : il contient
              précisément ce que vous voyez. L&apos;export PowerPoint, lui, produit de vraies
              formes modifiables, mais avec les polices d&apos;Office — Arial, Georgia,
              Courier New — et Office recalcule le placement des lignes à sa façon : un texte
              peut y bouger d&apos;un millimètre.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Outil({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-gray-800 px-2.5 py-1.5 text-xs hover:bg-gray-800">
      {children}
    </button>
  );
}

function Reglages({ el, peutModifier, maj, onSupprimer, onDupliquer, onRang }: {
  el: Element; peutModifier: boolean;
  maj: (id: string, champs: Partial<Element>) => void;
  onSupprimer: (id: string) => void;
  onDupliquer: (id: string) => void;
  onRang: (id: string, sens: -1 | 1) => void;
}) {
  const nom = el.type === "texte" ? "Texte" : el.type === "rect" ? "Rectangle"
    : el.type === "ellipse" ? "Ellipse" : el.type === "ligne" ? "Trait"
    : el.type === "image" ? "Image" : "Élément";
  const d = (champs: Partial<Element>) => maj(el.id, champs);

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-3 space-y-3">
      <div className="flex items-center gap-1">
        <h2 className="text-sm font-semibold">{nom}</h2>
        <span className="ml-auto flex gap-1">
          <button onClick={() => onRang(el.id, -1)} disabled={!peutModifier}
            title="Mettre derrière" aria-label="Mettre derrière"
            className="rounded border border-gray-800 p-1 hover:bg-gray-800 disabled:opacity-30">
            <ArrowDown size={12} />
          </button>
          <button onClick={() => onRang(el.id, 1)} disabled={!peutModifier}
            title="Mettre devant" aria-label="Mettre devant"
            className="rounded border border-gray-800 p-1 hover:bg-gray-800 disabled:opacity-30">
            <ArrowUp size={12} />
          </button>
          <button onClick={() => onDupliquer(el.id)} disabled={!peutModifier}
            title="Dupliquer" aria-label="Dupliquer"
            className="rounded border border-gray-800 p-1 hover:bg-gray-800 disabled:opacity-30">
            <Copy size={12} />
          </button>
          <button onClick={() => onSupprimer(el.id)} disabled={!peutModifier}
            title="Supprimer" aria-label="Supprimer"
            className="rounded border border-gray-800 p-1 text-red-300 hover:bg-red-950/60 disabled:opacity-30">
            <Trash2 size={12} />
          </button>
        </span>
      </div>

      {el.type === "texte" && (
        <>
          <label className="block text-xs text-gray-400">
            Contenu
            <textarea value={el.texte} rows={3} disabled={!peutModifier}
              onChange={(e) => d({ texte: e.target.value } as Partial<Element>)}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white" />
          </label>
          <div className="flex gap-2">
            <label className="block flex-1 text-xs text-gray-400">
              Taille (mm)
              <input type="number" min={1} max={200} step={0.5} value={el.taille} disabled={!peutModifier}
                onChange={(e) => d({ taille: Number(e.target.value) } as Partial<Element>)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white" />
            </label>
            <label className="block flex-1 text-xs text-gray-400">
              Graisse
              <select value={el.graisse} disabled={!peutModifier}
                onChange={(e) => d({ graisse: Number(e.target.value) } as Partial<Element>)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white">
                <option value={400}>Normale</option>
                <option value={700}>Gras</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <label className="block flex-1 text-xs text-gray-400">
              Police
              <select value={el.police} disabled={!peutModifier}
                onChange={(e) => d({ police: e.target.value } as Partial<Element>)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white">
                {POLICES.map((p) => <option key={p.cle} value={p.cle}>{p.nom}</option>)}
              </select>
            </label>
            <label className="block flex-1 text-xs text-gray-400">
              Alignement
              <select value={el.alignement} disabled={!peutModifier}
                onChange={(e) => d({ alignement: e.target.value as any } as Partial<Element>)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white">
                <option value="gauche">À gauche</option>
                <option value="centre">Centré</option>
                <option value="droite">À droite</option>
              </select>
            </label>
          </div>
          <label className="block text-xs text-gray-400">
            Interligne — {el.interligne.toFixed(1)}
            <input type="range" min={80} max={250} value={Math.round(el.interligne * 100)}
              disabled={!peutModifier}
              onChange={(e) => d({ interligne: Number(e.target.value) / 100 } as Partial<Element>)}
              className="mt-1 w-full" />
          </label>
        </>
      )}

      {el.type === "ligne" && (
        <label className="block text-xs text-gray-400">
          Épaisseur (mm)
          <input type="number" min={0.1} max={20} step={0.1} value={el.epaisseur} disabled={!peutModifier}
            onChange={(e) => d({ epaisseur: Number(e.target.value) } as Partial<Element>)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white" />
        </label>
      )}

      {(el.type === "rect" || el.type === "ellipse") && (
        <label className="block text-xs text-gray-400">
          Bordure (mm)
          <input type="number" min={0} max={20} step={0.1} value={el.bordure} disabled={!peutModifier}
            onChange={(e) => d({ bordure: Number(e.target.value) } as Partial<Element>)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white" />
        </label>
      )}

      {el.type === "rect" && (
        <label className="block text-xs text-gray-400">
          Coins arrondis (mm)
          <input type="number" min={0} max={60} step={0.5} value={el.rayon} disabled={!peutModifier}
            onChange={(e) => d({ rayon: Number(e.target.value) } as Partial<Element>)}
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white" />
        </label>
      )}

      {el.type !== "image" && (
        <div>
          <span className="block text-xs text-gray-400">Couleur</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {COULEURS.map((c) => (
              <button key={c} disabled={!peutModifier}
                onClick={() => d({ couleur: c } as Partial<Element>)}
                aria-label={`Couleur ${c}`}
                className={`h-7 w-7 rounded-md border-2 disabled:opacity-40 ${
                  (el as any).couleur === c ? "border-white" : "border-gray-700"}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600">
        Position : {cadre(el).x.toFixed(1)} ; {cadre(el).y.toFixed(1)} mm —
        {" "}{cadre(el).l.toFixed(1)} × {cadre(el).h.toFixed(1)} mm
      </p>
    </section>
  );
}
