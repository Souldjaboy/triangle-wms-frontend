"use client";

/**
 * LES PRÉSENTATIONS : LA LISTE, LA CRÉATION, L'IMPORT.
 *
 * CE QUE CET ÉCRAN DIT AVANT QU'ON CLIQUE.
 *
 * 1. CE QU'UN IMPORT POWERPOINT REPREND, ET CE QU'IL NE REPREND PAS. Un
 *    .pptx peut contenir des tableaux, des graphiques, des SmartArt, des
 *    animations, et des formes qui tiennent leur position et leur couleur
 *    d'un masque ou d'un thème. Reprendre tout cela, c'est réécrire
 *    PowerPoint. L'import est donc lu, MONTRÉ, et son compte rendu affiché
 *    forme par forme — avant d'enregistrer quoi que ce soit. On voit ce
 *    qu'on obtient, puis on décide.
 *
 * 2. QUE RIEN N'EST ENREGISTRÉ TANT QU'ON N'A PAS DIT OUI. La lecture d'un
 *    fichier déposé ne crée aucun document. Enregistrer d'abord et expliquer
 *    ensuite mettrait dans la bibliothèque une présentation que personne n'a
 *    validée, et dont il faudrait deviner six mois plus tard pourquoi un
 *    tableau y manque.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";
import {
  FORMATS, MODELES_DIAPO, enPng, formatDe, rendre, ressourcesDe,
  type Format, type Plan,
} from "../../lib/presentation";
import {
  AlertTriangle, ArrowLeft, Check, Clock, Loader2, Lock, Plus, Presentation,
  Upload, X,
} from "lucide-react";

type Fiche = {
  id: number; name: string; design_format: string; version: number;
  diapositives: number; page_count: number | null; visibility: string;
  owner_name: string; updated_at: string; je_suis_proprietaire: boolean;
  design_mm_width: string; design_mm_height: string;
};

type Lecture = {
  plan: { diapositives: Plan[] };
  format: string;
  largeur_mm: number;
  hauteur_mm: number;
  non_repris: string[];
  message?: string;
};

const quand = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("fr-FR",
    { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

export default function Presentations() {
  const router = useRouter();
  const { can, loading: droitsEnCours } = usePermissions();
  const peutCreer = can("studio.presentation", "create");

  const [fiches, setFiches] = useState<Fiche[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [occupe, setOccupe] = useState("");

  /* La création */
  const [nouvelle, setNouvelle] = useState(false);
  const [titre, setTitre] = useState("");
  const [format, setFormat] = useState(FORMATS[0].cle);
  const [modele, setModele] = useState(MODELES_DIAPO[0].cle);
  /* QUI PEUT LA VOIR, DÈS LA CRÉATION.
     Le premier jet imposait « privée » et renvoyait à la fiche de la
     bibliothèque pour changer d'avis. Or une présentation est presque
     toujours faite POUR ÊTRE MONTRÉE : obliger à un détour pour le dire
     garantissait que la moitié des présentations resteraient invisibles à
     ceux qui en ont besoin, sans que personne comprenne pourquoi. Le défaut
     reste « privée » — c'est le choix prudent — mais il se change ici. */
  const [visibilite, setVisibilite] = useState("PRIVE");

  /* L'import */
  const champFichier = useRef<HTMLInputElement | null>(null);
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [nomImport, setNomImport] = useState("");
  const apercus = useRef<HTMLDivElement | null>(null);

  const charger = useCallback(async () => {
    setChargement(true); setErreur("");
    try {
      const r = await authFetch("/studio/presentations");
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error || "La liste n'a pas pu être lue.");
      }
      const d = await r.json();
      setFiches(d.presentations || []);
    } catch (e: any) { setErreur(e?.message || "Chargement impossible."); }
    finally { setChargement(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  /* ────────────────────── CRÉER ────────────────────── */
  async function creer() {
    const nom = titre.trim();
    if (!nom) { setErreur("Donnez un nom à cette présentation."); return; }
    setOccupe("creer"); setErreur("");
    try {
      const f = formatDe(format);
      const m = MODELES_DIAPO.find((x) => x.cle === modele) || MODELES_DIAPO[0];
      const plan: Plan = m.plan(f);
      const png = await enPng(plan, f);

      const form = new FormData();
      form.append("plan", JSON.stringify({ diapositives: [plan] }));
      form.append("diapositives", png, "diapo1.png");
      form.append("nom", nom);
      form.append("format", f.cle);
      form.append("visibilite", visibilite);
      const r = await authFetch("/studio/presentations", { method: "POST", body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "La création a échoué.");
      router.push(`/studio/presentations/${d.document.id}`);
    } catch (e: any) { setErreur(e?.message || "La création a échoué."); }
    finally { setOccupe(""); }
  }

  /* ────────────────────── IMPORTER ────────────────────── */
  async function lire(fichier: File) {
    setOccupe("lire"); setErreur(""); setMessage(""); setLecture(null);
    try {
      const form = new FormData();
      form.append("fichier", fichier, fichier.name);
      const r = await authFetch("/studio/presentations/lecture-pptx",
        { method: "POST", body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Ce fichier n'a pas pu être lu.");
      setLecture(d);
      setNomImport(fichier.name.replace(/\.pptx$/i, ""));
    } catch (e: any) { setErreur(e?.message || "Ce fichier n'a pas pu être lu."); }
    finally { setOccupe(""); }
  }

  /* LES APERÇUS SONT DESSINÉS AVEC LE MÊME MOTEUR QUE L'ÉDITEUR. On voit donc
     exactement ce qui sera enregistré, y compris ce qui a été perdu. */
  useEffect(() => {
    const hote = apercus.current;
    if (!hote || !lecture) return;
    let vivant = true;
    (async () => {
      const f: Format = { cle: lecture.format, nom: "",
        largeurMm: lecture.largeur_mm, hauteurMm: lecture.hauteur_mm };
      const sortie: HTMLElement[] = [];
      for (const [i, plan] of lecture.plan.diapositives.entries()) {
        const ressources = await ressourcesDe(plan);
        if (!vivant) return;
        const c = rendre(plan, f.largeurMm, f.hauteurMm,
          Math.min(2, 240 / f.largeurMm), ressources);
        c.className = "block w-full rounded border border-gray-700";
        const bloc = document.createElement("figure");
        bloc.className = "space-y-1";
        const legende = document.createElement("figcaption");
        legende.className = "text-[11px] text-gray-500";
        legende.textContent = `Diapositive ${i + 1}`;
        bloc.append(c, legende);
        sortie.push(bloc);
      }
      if (vivant) hote.replaceChildren(...sortie);
    })();
    return () => { vivant = false; };
  }, [lecture]);

  async function garderImport() {
    if (!lecture) return;
    const nom = nomImport.trim();
    if (!nom) { setErreur("Donnez un nom à cette présentation."); return; }
    setOccupe("garder"); setErreur("");
    try {
      const f: Format = { cle: lecture.format, nom: "",
        largeurMm: lecture.largeur_mm, hauteurMm: lecture.hauteur_mm };
      const form = new FormData();
      form.append("plan", JSON.stringify(lecture.plan));
      for (const [i, plan] of lecture.plan.diapositives.entries()) {
        form.append("diapositives", await enPng(plan, f), `diapo${i + 1}.png`);
      }
      form.append("nom", nom);
      if (FORMATS.some((x) => x.cle === lecture.format)) form.append("format", lecture.format);
      else {
        form.append("largeur_mm", String(lecture.largeur_mm));
        form.append("hauteur_mm", String(lecture.hauteur_mm));
      }
      form.append("visibilite", visibilite);
      /* LA PROVENANCE EST ÉCRITE DANS LE DOCUMENT, avec le compte de ce qui
         n'a pas été repris : dans six mois, c'est la seule chose qui
         expliquera un tableau manquant. */
      form.append("provenance",
        `Importée d'un fichier PowerPoint.` +
        (lecture.non_repris.length
          ? ` ${lecture.non_repris.length} élément${lecture.non_repris.length > 1 ? "s" : ""} ` +
            `n'a${lecture.non_repris.length > 1 ? "ient" : ""} pas pu être repris : ` +
            `${lecture.non_repris.slice(0, 6).join(" ; ")}` +
            `${lecture.non_repris.length > 6 ? " ; et d'autres" : ""}.`
          : " Tout a été repris."));
      const r = await authFetch("/studio/presentations", { method: "POST", body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "L'enregistrement a échoué.");
      router.push(`/studio/presentations/${d.document.id}`);
    } catch (e: any) { setErreur(e?.message || "L'enregistrement a échoué."); }
    finally { setOccupe(""); }
  }

  if (droitsEnCours) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white min-w-0 w-full">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pr-20 py-3 min-w-0">
          <Link href="/studio" className="shrink-0 rounded-lg p-2 hover:bg-gray-800"
            aria-label="Retour au Studio">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">Présentations</h1>
            <p className="truncate text-xs text-gray-500">
              {chargement ? "Chargement…"
                : `${fiches.length} présentation${fiches.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 min-w-0 space-y-4">
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
            <span className="min-w-0 flex-1">{message}</span>
          </p>
        )}

        {!peutCreer && (
          <p className="flex items-start gap-2 rounded-lg border border-gray-800 bg-gray-900 p-3 text-sm text-gray-400">
            <Lock size={16} className="mt-0.5 shrink-0" />
            Vous pouvez consulter les présentations, pas en créer.
          </p>
        )}

        {/* ─────────────── COMMENCER ─────────────── */}
        {peutCreer && !lecture && (
          <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setNouvelle((x) => !x)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-500">
                <Plus size={15} /> Nouvelle présentation
              </button>
              <button onClick={() => champFichier.current?.click()} disabled={occupe === "lire"}
                className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-40">
                {occupe === "lire" ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                Importer un PowerPoint
              </button>
              <input ref={champFichier} type="file" accept=".pptx" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) lire(f);
                }} />
            </div>

            <p className="mt-2 text-xs text-gray-500">
              Un fichier <strong className="text-gray-400">.pptx</strong> est lu et montré avant
              d&apos;être enregistré. Les zones de texte, les rectangles, les ellipses, les traits
              et les images sont reprises. Les tableaux, les graphiques, les SmartArt, les
              animations et les formes qui tiennent leur position d&apos;un masque ne le sont pas :
              chacune sera nommée dans le compte rendu. Un <strong className="text-gray-400">.ppt</strong>{" "}
              d&apos;avant 2007, un <strong className="text-gray-400">.odp</strong> ou un{" "}
              <strong className="text-gray-400">.key</strong> ne s&apos;ouvrent pas ici.
            </p>

            {nouvelle && (
              <div className="mt-4 space-y-3 border-t border-gray-800 pt-4">
                <label className="block text-xs text-gray-400">
                  Nom
                  <input value={titre} onChange={(e) => setTitre(e.target.value)}
                    placeholder="Bilan du trimestre"
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white" />
                </label>
                <label className="block text-xs text-gray-400">
                  Qui peut la voir
                  <select value={visibilite} onChange={(e) => setVisibilite(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white">
                    <option value="PRIVE">Moi seul, jusqu'à ce que je la partage</option>
                    <option value="EQUIPE">Mon équipe</option>
                    <option value="SOCIETE">Toute la société</option>
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-gray-400">
                    Format
                    <select value={format} onChange={(e) => setFormat(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white">
                      {FORMATS.map((f) => (
                        <option key={f.cle} value={f.cle}>
                          {f.nom} — {f.largeurMm.toFixed(0)} × {f.hauteurMm.toFixed(0)} mm
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-gray-400">
                    Première diapositive
                    <select value={modele} onChange={(e) => setModele(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white">
                      {MODELES_DIAPO.map((m) => (
                        <option key={m.cle} value={m.cle}>{m.nom} — {m.description}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <button onClick={creer} disabled={!!occupe}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-40">
                  {occupe === "creer" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Créer et ouvrir
                </button>
              </div>
            )}
          </section>
        )}

        {/* ─────────────── CE QU'ON A LU ─────────────── */}
        {lecture && (
          <section className="rounded-xl border border-blue-900 bg-blue-950/20 p-4 space-y-4">
            <div className="flex items-start gap-2">
              <Presentation size={18} className="mt-0.5 shrink-0 text-blue-300" />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">
                  {lecture.plan.diapositives.length} diapositive
                  {lecture.plan.diapositives.length > 1 ? "s" : ""} lue
                  {lecture.plan.diapositives.length > 1 ? "s" : ""}
                </h2>
                <p className="text-xs text-gray-400">
                  {lecture.largeur_mm.toFixed(0)} × {lecture.hauteur_mm.toFixed(0)} mm
                  {FORMATS.some((f) => f.cle === lecture.format) ? ` · ${formatDe(lecture.format).nom}` : " · format sur mesure"}
                  {" — "}
                  <strong className="text-amber-300">rien n&apos;est encore enregistré.</strong>
                </p>
              </div>
              <button onClick={() => setLecture(null)} className="shrink-0 rounded p-1 hover:bg-gray-800"
                aria-label="Abandonner cet import">
                <X size={16} />
              </button>
            </div>

            {/* LE COMPTE RENDU, AVANT LES APERÇUS : c'est ce qu'on risque
                d'ignorer si on le met après. */}
            {lecture.non_repris.length > 0 ? (
              <div data-compte-rendu="non-repris"
                className="rounded-lg border border-amber-900 bg-amber-950/40 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-200">
                  <AlertTriangle size={15} />
                  {lecture.non_repris.length} élément{lecture.non_repris.length > 1 ? "s" : ""} n&apos;
                  {lecture.non_repris.length > 1 ? "ont" : "a"} pas pu être repris
                </p>
                <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs text-amber-100/90">
                  {lecture.non_repris.map((x, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="shrink-0 text-amber-500">·</span>
                      <span className="min-w-0">{x}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-amber-200/70">
                  Ce compte rendu est recopié dans la provenance du document : il restera lisible
                  dans la fiche, longtemps après l&apos;import.
                </p>
              </div>
            ) : (
              <p data-compte-rendu="tout-repris"
                className="flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">
                <Check size={15} /> Tout a été repris.
              </p>
            )}

            <div>
              <h3 className="mb-2 text-sm font-medium">Ce que cela donnera</h3>
              <div ref={apercus}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[28rem] overflow-auto" />
            </div>

            <div className="flex flex-wrap items-end gap-3 border-t border-gray-800 pt-3">
              <label className="block text-xs text-gray-400">
                Qui peut la voir
                <select value={visibilite} onChange={(e) => setVisibilite(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white">
                  <option value="PRIVE">Moi seul</option>
                  <option value="EQUIPE">Mon équipe</option>
                  <option value="SOCIETE">Toute la société</option>
                </select>
              </label>
              <label className="block min-w-0 flex-1 text-xs text-gray-400">
                Nom
                <input value={nomImport} onChange={(e) => setNomImport(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 p-2 text-sm text-white" />
              </label>
              <button onClick={garderImport} disabled={!!occupe}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-40">
                {occupe === "garder" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Garder cette présentation
              </button>
              <button onClick={() => setLecture(null)} disabled={!!occupe}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm hover:bg-gray-800 disabled:opacity-40">
                Abandonner
              </button>
            </div>
          </section>
        )}

        {/* ─────────────── LA LISTE ─────────────── */}
        <section>
          {chargement ? (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 size={15} className="animate-spin" /> Chargement…
            </p>
          ) : !fiches.length ? (
            <p className="rounded-xl border border-gray-800 bg-gray-900/40 p-6 text-center text-sm text-gray-500">
              Aucune présentation pour l&apos;instant.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {fiches.map((f) => (
                <li key={f.id}>
                  <Link href={`/studio/presentations/${f.id}`}
                    className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-900/40 p-3 hover:border-gray-700 hover:bg-gray-900">
                    <Presentation size={18} className="mt-0.5 shrink-0 text-blue-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{f.name}</p>
                      <p className="truncate text-xs text-gray-500">
                        {f.diapositives} diapositive{f.diapositives > 1 ? "s" : ""}
                        {" · "}version {f.version}
                        {" · "}{Number(f.design_mm_width).toFixed(0)} × {Number(f.design_mm_height).toFixed(0)} mm
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-gray-600">
                        <Clock size={11} /> {quand(f.updated_at)}
                        {!f.je_suis_proprietaire && ` · ${f.owner_name}`}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
