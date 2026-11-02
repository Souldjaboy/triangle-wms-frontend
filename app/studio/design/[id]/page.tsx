"use client";

/**
 * L'ÉDITEUR DE MISE EN PAGE.
 *
 * On pose du texte, des formes, des images, un QR ; on les déplace, on les
 * règle ; on enregistre ; on sort un PDF d'impression aux vraies dimensions.
 *
 * CE QUE CET ÉDITEUR TIENT.
 *
 * 1. TOUT EST EN MILLIMÈTRES. Pas en pixels : une carte de visite fait 85 mm
 *    de large, et c'est ce que l'imprimeur attend. Les réglages affichent
 *    donc des millimètres, et le PDF sort à la taille exacte.
 *
 * 2. L'APERÇU EST LE RENDU. Le même code dessine l'écran, l'image enregistrée
 *    et le PDF — seule l'échelle change. Deux chemins finiraient par
 *    diverger, et l'on imprimerait autre chose que ce qu'on a validé : ce qui
 *    ne se voit qu'une fois les cartes livrées.
 *
 * 3. ENREGISTRER NE PERD RIEN. Chaque enregistrement crée une version de
 *    plus ; la précédente reste téléchargeable. Une mise en page ratée ne
 *    coûte donc que de revenir en arrière.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { authFetch } from "../../../lib/api";
import { usePermissions } from "../../../lib/permissions";
import {
  MODELES, POLICES, cadre, nouvelId, rendre, PX_PAR_MM_IMPRESSION,
  type Element, type Plan,
} from "../../../lib/creation";
import {
  AlertTriangle, ArrowLeft, Check, Circle, Copy, Image as ImageIcon, Loader2,
  Lock, Minus, Printer, QrCode, Square, Trash2, Type, X, ArrowUp, ArrowDown,
} from "lucide-react";

type Infos = {
  document: { id: number; name: string; version: number; visibility: string };
  plan: Plan; format: string; largeur_mm: number; hauteur_mm: number;
  mon_niveau: string;
};

export default function EditeurCreation() {
  const params = useParams();
  const documentId = Number(params?.id);
  const { can, loading: droitsEnCours } = usePermissions();

  const [infos, setInfos] = useState<Infos | null>(null);
  const [plan, setPlan] = useState<Plan>({ fond: "#ffffff", elements: [] });
  const [choisi, setChoisi] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [occupe, setOccupe] = useState("");
  const [modifie, setModifie] = useState(false);

  const zone = useRef<HTMLDivElement | null>(null);
  const toile = useRef<HTMLCanvasElement | null>(null);
  const images = useRef<Map<string, HTMLImageElement>>(new Map());
  const qrRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const [qrPrets, setQrPrets] = useState(0);
  const [echelle, setEchelle] = useState(1);

  const depart = useRef({ sx: 0, sy: 0, ex: 0, ey: 0, el: 0, eh: 0 });
  const [geste, setGeste] = useState<"deplacer" | "etirer" | null>(null);

  const peutModifier = can("studio.design", "update");
  const peutExporter = can("studio.design", "export");

  /* ─────────────────────────── CHARGER ──────────────────────────── */
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const r = await authFetch(`/studio/creations/${documentId}`);
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error || "Cette création ne vous est pas accessible.");
        }
        const d: Infos = await r.json();
        if (!vivant) return;
        setInfos(d);
        setPlan(d.plan);
        setChargement(false);
      } catch (e) {
        if (vivant) { setErreur((e as Error).message); setChargement(false); }
      }
    })();
    return () => { vivant = false; };
  }, [documentId]);

  /* ─────────────── LES RESSOURCES : IMAGES ET QR ────────────────── */
  useEffect(() => {
    for (const el of plan.elements) {
      if (el.type !== "image" || !el.src || images.current.has(el.id)) continue;
      const img = new Image();
      img.onload = () => { images.current.set(el.id, img); setQrPrets((n) => n + 1); };
      img.onerror = () => { /* le rendu montrera « image absente » */ };
      img.src = el.src;
    }
  }, [plan]);

  const ressources = useCallback(() => ({
    images: images.current as Map<string, CanvasImageSource>,
    qr: qrRefs.current as Map<string, CanvasImageSource>,
  }), []);

  /* ─────────────────────────── L'APERÇU ─────────────────────────── */
  const dessiner = useCallback(() => {
    if (!infos) return;
    const hote = zone.current;
    if (!hote) return;
    const largeurDispo = Math.min(hote.clientWidth || 600, 900);
    const hauteurDispo = Math.max(220, (window.innerHeight || 800) - 470);
    const px = Math.max(0.5, Math.min(
      largeurDispo / infos.largeur_mm, hauteurDispo / infos.hauteur_mm,
      PX_PAR_MM_IMPRESSION));
    const c = rendre(plan, infos.largeur_mm, infos.hauteur_mm, px, ressources());
    c.className = "block";
    c.style.boxShadow = "0 8px 24px rgba(0,0,0,0.5)";
    toile.current = c;
    hote.replaceChildren(c);
    setEchelle(px);
  }, [infos, plan, ressources, qrPrets]);

  useEffect(() => { if (!chargement) dessiner(); }, [chargement, dessiner]);
  useEffect(() => {
    const r = () => dessiner();
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, [dessiner]);

  /* Les QR sont dessinés par des canvas cachés, puis recopiés dans le plan :
     c'est la seule façon d'avoir un VRAI QR lisible par le pointage, sans
     réécrire un encodeur. */
  const elementsQr = useMemo(
    () => plan.elements.filter((e) => e.type === "qr") as Extract<Element, { type: "qr" }>[],
    [plan]);

  /* qrcode.react peint son canvas dans un effet, donc APRÈS le montage : lire
     le canvas au moment où la référence arrive donnerait un carré blanc. On
     laisse passer une image, puis on redemande le dessin. La signature des
     QR sert de déclencheur — changer la valeur d'un QR doit le redessiner. */
  const signatureQr = elementsQr
    .map((e) => `${e.id}:${e.valeur}:${e.couleur}`).join("|");
  useEffect(() => {
    if (!signatureQr) return;
    const h = window.setTimeout(() => setQrPrets((x) => x + 1), 80);
    return () => window.clearTimeout(h);
  }, [signatureQr]);

  /* ─────────────────────── MODIFIER LE PLAN ─────────────────────── */
  const maj = useCallback((id: string, champs: Partial<Element>) => {
    setPlan((p) => ({
      ...p,
      elements: p.elements.map((e) => (e.id === id ? { ...e, ...champs } as Element : e)),
    }));
    setModifie(true);
  }, []);

  const ajouter = (el: Element) => {
    setPlan((p) => ({ ...p, elements: [...p.elements, el] }));
    setChoisi(el.id);
    setModifie(true);
  };

  const supprimer = (id: string) => {
    setPlan((p) => ({ ...p, elements: p.elements.filter((e) => e.id !== id) }));
    images.current.delete(id); qrRefs.current.delete(id);
    setChoisi(null); setModifie(true);
  };

  const dupliquer = (id: string) => {
    const el = plan.elements.find((e) => e.id === id);
    if (!el) return;
    const copie = { ...el, id: nouvelId(), x: el.x + 3, y: el.y + 3 } as Element;
    if (el.type === "image") {
      const img = images.current.get(el.id);
      if (img) images.current.set(copie.id, img);
    }
    ajouter(copie);
  };

  const deplacerRang = (id: string, sens: -1 | 1) => {
    setPlan((p) => {
      const i = p.elements.findIndex((e) => e.id === id);
      const j = i + sens;
      if (i < 0 || j < 0 || j >= p.elements.length) return p;
      const n = [...p.elements];
      [n[i], n[j]] = [n[j], n[i]];
      return { ...p, elements: n };
    });
    setModifie(true);
  };

  /* ──────────────────── DÉPLACER À LA SOURIS ────────────────────── */
  const enMm = (e: React.PointerEvent) => {
    const c = toile.current;
    const r = c?.getBoundingClientRect();
    if (!r || !infos) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - r.left) / r.width) * infos.largeur_mm,
      y: ((e.clientY - r.top) / r.height) * infos.hauteur_mm,
    };
  };

  const prendre = (e: React.PointerEvent, id: string, quoi: "deplacer" | "etirer") => {
    e.preventDefault(); e.stopPropagation();
    const el = plan.elements.find((x) => x.id === id);
    if (!el) return;
    const c = cadre(el);
    const p = enMm(e);
    depart.current = { sx: p.x, sy: p.y, ex: c.x, ey: c.y, el: c.l, eh: c.h };
    setChoisi(id); setGeste(quoi);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const bouger = (e: React.PointerEvent) => {
    if (!geste || !choisi || !infos) return;
    const p = enMm(e);
    const dx = p.x - depart.current.sx, dy = p.y - depart.current.sy;
    const el = plan.elements.find((x) => x.id === choisi);
    if (!el) return;
    if (geste === "deplacer") {
      maj(choisi, { x: Math.round((depart.current.ex + dx) * 10) / 10,
        y: Math.round((depart.current.ey + dy) * 10) / 10 } as Partial<Element>);
    } else if (el.type === "qr") {
      maj(choisi, { taille: Math.max(5, Math.round((depart.current.el + dx) * 10) / 10) } as Partial<Element>);
    } else if (el.type === "ligne" || el.type === "texte") {
      maj(choisi, { l: Math.max(3, Math.round((depart.current.el + dx) * 10) / 10) } as Partial<Element>);
    } else {
      maj(choisi, {
        l: Math.max(3, Math.round((depart.current.el + dx) * 10) / 10),
        h: Math.max(3, Math.round((depart.current.eh + dy) * 10) / 10),
      } as Partial<Element>);
    }
  };
  const lacher = () => setGeste(null);

  /* ────────────────────────── ENREGISTRER ───────────────────────── */
  async function enregistrer() {
    if (!infos) return;
    setOccupe("enregistrer"); setErreur("");
    try {
      /* LA MÊME FONCTION QUE L'APERÇU, à la finesse de l'impression. */
      const canvas = rendre(plan, infos.largeur_mm, infos.hauteur_mm,
        PX_PAR_MM_IMPRESSION, ressources());
      const blob = await new Promise<Blob | null>((ok) =>
        canvas.toBlob((b) => ok(b), "image/png"));
      if (!blob) { setErreur("L'image n'a pas pu être produite."); return; }
      const form = new FormData();
      form.append("image", blob, `${infos.document.name}.png`);
      form.append("plan", JSON.stringify(plan));
      form.append("largeur_mm", String(infos.largeur_mm));
      form.append("hauteur_mm", String(infos.hauteur_mm));
      form.append("format", infos.format || "");
      form.append("note", `Mise en page modifiée — ${plan.elements.length} éléments`);
      const r = await authFetch(`/studio/creations/${documentId}`, { method: "POST", body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(j.error || "Enregistrement impossible."); return; }
      setMessage(j.message || "Enregistré.");
      setModifie(false);
      setInfos((i) => i ? { ...i, document: { ...i.document, version: j.creation.version } } : i);
    } catch { setErreur("Le serveur n'a pas répondu."); }
    finally { setOccupe(""); }
  }

  async function exporter(exemplaires: number) {
    setOccupe("imprimer"); setErreur("");
    try {
      const r = await authFetch(`/studio/creations/${documentId}/impression`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exemplaires }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(j.error || "Export impossible."); return; }
      setMessage(j.message || "PDF créé.");
    } catch { setErreur("Le serveur n'a pas répondu."); }
    finally { setOccupe(""); }
  }

  const elChoisi = plan.elements.find((e) => e.id === choisi) || null;

  if (droitsEnCours) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (!can("studio.design", "view")) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Lock className="mx-auto mb-4 text-gray-500" size={40} />
          <h1 className="mb-2 text-xl font-semibold">Studio graphique non accessible</h1>
          <Link href="/studio" className="mt-6 inline-block text-sm text-blue-400 hover:underline">
            Retour au Studio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white min-w-0 w-full">
      {/* Les QR, dessinés hors de l'écran puis recopiés dans le plan. */}
      <div className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
        {elementsQr.map((el) => (
          <QRCodeCanvas
            key={`${el.id}-${el.valeur}-${el.couleur}`}
            value={el.valeur || " "}
            size={600}
            fgColor={el.couleur || "#000000"}
            bgColor="#ffffff"
            level="M"
            /* LA RÉFÉRENCE NE DÉCLENCHE PLUS DE RENDU.

               Une fonction de référence écrite en ligne est recréée à chaque
               rendu : React détache puis rattache alors la référence, donc la
               rappelle, donc l'état changeait, donc on rendait à nouveau —
               « Maximum update depth exceeded », et l'éditeur plantait sur
               TOUT modèle portant un QR. Elle se contente maintenant de
               ranger le canvas ; c'est un effet, plus bas, qui demande le
               redessin une fois que qrcode.react a eu le temps de peindre. */
            ref={(n: HTMLCanvasElement | null) => { if (n) qrRefs.current.set(el.id, n); }}
          />
        ))}
      </div>

      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 min-w-0">
          <Link href="/studio/design" className="shrink-0 rounded-lg p-2 hover:bg-gray-800"
            aria-label="Retour au studio graphique">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">{infos?.document.name || "Création"}</h1>
            <p className="truncate text-xs text-gray-500">
              {infos
                ? `${infos.largeur_mm} × ${infos.hauteur_mm} mm · version ${infos.document.version}` +
                  (modifie ? " · modifications non enregistrées" : "")
                : "Ouverture…"}
            </p>
          </div>
          {peutModifier && (
            <button onClick={enregistrer} disabled={!!occupe || !modifie}
              className="shrink-0 flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-40">
              {occupe === "enregistrer" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Enregistrer
            </button>
          )}
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
            <Loader2 size={16} className="animate-spin" /> Ouverture…
          </p>
        ) : !infos ? null : (
          <>
            {/* ─────────────────── LA PLANCHE ──────────────────── */}
            <div className="flex justify-center overflow-auto rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="relative inline-block" style={{ lineHeight: 0 }}
                onPointerDown={() => setChoisi(null)}>
                <div ref={zone} />
                {/* Les poignées, posées par-dessus, en millimètres. */}
                {peutModifier && toile.current && plan.elements.map((el) => {
                  const c = cadre(el);
                  const prise = el.id === choisi;
                  return (
                    <div
                      key={el.id}
                      className="absolute touch-none"
                      style={{
                        left: `${(c.x / infos.largeur_mm) * 100}%`,
                        top: `${(c.y / infos.hauteur_mm) * 100}%`,
                        width: `${(c.l / infos.largeur_mm) * 100}%`,
                        height: `${(c.h / infos.hauteur_mm) * 100}%`,
                        cursor: "move",
                        outline: prise ? "2px solid #3b82f6" : "1px dashed rgba(148,163,184,0.35)",
                      }}
                      onPointerDown={(e) => prendre(e, el.id, "deplacer")}
                      onPointerMove={bouger}
                      onPointerUp={lacher}
                      onPointerCancel={lacher}
                    >
                      {prise && (
                        <span
                          className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-blue-500"
                          onPointerDown={(e) => prendre(e, el.id, "etirer")}
                          onPointerMove={bouger}
                          onPointerUp={lacher}
                          onPointerCancel={lacher}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="mt-1 text-center text-xs text-gray-500">
              Tout est en millimètres : ce que vous voyez sortira à cette
              taille exacte à l&apos;impression.
            </p>

            {peutModifier && (
              <>
                {/* ──────────────── AJOUTER ──────────────── */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Ajout onClick={() => ajouter({
                    id: nouvelId(), type: "texte", x: 5, y: 5,
                    l: Math.min(60, infos.largeur_mm - 10), texte: "Texte",
                    taille: Math.max(3, infos.hauteur_mm / 12), couleur: "#0f172a",
                    graisse: 400, alignement: "gauche", police: "sans", interligne: 1.3,
                  })}><Type size={14} /> Texte</Ajout>
                  <Ajout onClick={() => ajouter({
                    id: nouvelId(), type: "rect", x: 5, y: 5,
                    l: infos.largeur_mm / 3, h: infos.hauteur_mm / 5,
                    couleur: "#1d4ed8", rayon: 0, bordure: 0, couleurBordure: "#0f172a",
                  })}><Square size={14} /> Rectangle</Ajout>
                  <Ajout onClick={() => ajouter({
                    id: nouvelId(), type: "ellipse", x: 5, y: 5,
                    l: infos.hauteur_mm / 4, h: infos.hauteur_mm / 4,
                    couleur: "#1d4ed8", bordure: 0, couleurBordure: "#0f172a",
                  })}><Circle size={14} /> Cercle</Ajout>
                  <Ajout onClick={() => ajouter({
                    id: nouvelId(), type: "ligne", x: 5, y: infos.hauteur_mm / 2,
                    l: infos.largeur_mm / 2, epaisseur: 0.5, couleur: "#0f172a",
                  })}><Minus size={14} /> Trait</Ajout>
                  <Ajout onClick={() => ajouter({
                    id: nouvelId(), type: "qr", x: 5, y: 5,
                    taille: Math.min(30, infos.hauteur_mm / 2), valeur: "REF-0000",
                    couleur: "#0f172a",
                  })}><QrCode size={14} /> QR</Ajout>
                  <AjoutImage onAjout={(src) => ajouter({
                    id: nouvelId(), type: "image", x: 5, y: 5,
                    l: infos.largeur_mm / 3, h: infos.hauteur_mm / 3, src, arrondi: 0,
                  })} onErreur={setErreur} />
                </div>

                {/* ──────────────── RÉGLAGES ──────────────── */}
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <Reglages el={elChoisi} plan={plan} maj={maj}
                    onFond={(c) => { setPlan((p) => ({ ...p, fond: c })); setModifie(true); }}
                    onSupprimer={supprimer} onDupliquer={dupliquer}
                    onRang={deplacerRang} />

                  <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
                    <h2 className="mb-2 text-sm font-semibold">Les éléments</h2>
                    {!plan.elements.length ? (
                      <p className="text-xs text-gray-600">
                        Rien encore. Les boutons ci-dessus en ajoutent.
                      </p>
                    ) : (
                      <ul className="max-h-56 space-y-1 overflow-y-auto">
                        {[...plan.elements].reverse().map((el) => (
                          <li key={el.id}>
                            <button onClick={() => setChoisi(el.id)}
                              className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs min-w-0 ${
                                el.id === choisi ? "border-blue-600 bg-blue-950/40" : "border-gray-800 hover:bg-gray-800"
                              }`}>
                              <span className="shrink-0 text-gray-400">{nomType(el)}</span>
                              <span className="truncate text-gray-300">{resumeEl(el)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-[11px] text-gray-600">
                      Le dernier de la liste est au-dessus des autres.
                    </p>
                  </section>
                </div>
              </>
            )}

            {/* ──────────────── IMPRIMER ──────────────── */}
            {peutExporter && (
              <section className="mt-4 rounded-xl border border-gray-800 bg-gray-900/40 p-3">
                <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <Printer size={15} /> Pour l&apos;imprimeur
                </h2>
                <p className="mb-2 text-xs text-gray-500">
                  Un PDF dont chaque page fait exactement{" "}
                  {infos.largeur_mm} × {infos.hauteur_mm} mm. Il est rangé dans
                  la bibliothèque, à côté de cette création.
                  {modifie && (
                    <span className="block text-amber-300">
                      Des modifications ne sont pas encore enregistrées : le
                      PDF partira de la dernière version enregistrée.
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 4, 10].map((n) => (
                    <button key={n} onClick={() => exporter(n)} disabled={!!occupe}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-800 disabled:opacity-40">
                      {occupe === "imprimer" ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                      {n} exemplaire{n > 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────── PETITES PIÈCES ───────────────────────────── */

const nomType = (el: Element) => ({
  texte: "Texte", rect: "Rectangle", ellipse: "Cercle",
  ligne: "Trait", image: "Image", qr: "QR",
}[el.type]);

const resumeEl = (el: Element) =>
  el.type === "texte" ? String(el.texte).split("\n")[0].slice(0, 40)
    : el.type === "qr" ? el.valeur
      : `${Math.round(el.x)} × ${Math.round(el.y)} mm`;

function Ajout({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-800">
      {children}
    </button>
  );
}

function AjoutImage({ onAjout, onErreur }: {
  onAjout: (src: string) => void; onErreur: (e: string) => void;
}) {
  const champ = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <Ajout onClick={() => champ.current?.click()}><ImageIcon size={14} /> Image</Ajout>
      <input ref={champ} type="file" accept="image/png,image/jpeg" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          /* L'image est gardée DANS le plan. Au-delà d'un mégaoctet, le plan
             devient énorme et le serveur le refuse : on le dit tout de suite
             plutôt que de laisser échouer l'enregistrement. */
          if (f.size > 900 * 1024) {
            onErreur(
              "Cette image dépasse 900 Ko. Réduisez-la, ou retouchez-la depuis " +
              "la bibliothèque avant de l'utiliser ici.");
            return;
          }
          const lecteur = new FileReader();
          lecteur.onload = () => onAjout(String(lecteur.result || ""));
          lecteur.onerror = () => onErreur("Cette image n'a pas pu être lue.");
          lecteur.readAsDataURL(f);
        }} />
    </>
  );
}

function Reglages({ el, plan, maj, onFond, onSupprimer, onDupliquer, onRang }: {
  el: Element | null; plan: Plan;
  maj: (id: string, champs: Partial<Element>) => void;
  onFond: (c: string) => void;
  onSupprimer: (id: string) => void;
  onDupliquer: (id: string) => void;
  onRang: (id: string, sens: -1 | 1) => void;
}) {
  if (!el) {
    return (
      <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
        <h2 className="mb-2 text-sm font-semibold">Réglages</h2>
        <p className="text-xs text-gray-600">
          Touchez un élément de la planche pour le régler.
        </p>
        <Couleur nom="Fond de la planche" valeur={plan.fond} onChange={onFond} />
      </section>
    );
  }

  const c = cadre(el);
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{nomType(el)}</h2>
        <div className="flex gap-1">
          <Icone titre="Vers l'arrière" onClick={() => onRang(el.id, -1)}><ArrowDown size={13} /></Icone>
          <Icone titre="Vers l'avant" onClick={() => onRang(el.id, 1)}><ArrowUp size={13} /></Icone>
          <Icone titre="Dupliquer" onClick={() => onDupliquer(el.id)}><Copy size={13} /></Icone>
          <Icone titre="Supprimer" rouge onClick={() => onSupprimer(el.id)}><Trash2 size={13} /></Icone>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Nombre nom="Gauche (mm)" valeur={c.x} onChange={(n) => maj(el.id, { x: n } as Partial<Element>)} />
        <Nombre nom="Haut (mm)" valeur={c.y} onChange={(n) => maj(el.id, { y: n } as Partial<Element>)} />
      </div>

      {el.type === "texte" && (
        <>
          <label className="mt-2 block">
            <span className="text-xs text-gray-400">Texte</span>
            <textarea value={el.texte} rows={3}
              onChange={(e) => maj(el.id, { texte: e.target.value } as Partial<Element>)}
              className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-600" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Nombre nom="Largeur (mm)" valeur={el.l} onChange={(n) => maj(el.id, { l: n } as Partial<Element>)} />
            <Nombre nom="Corps (mm)" valeur={el.taille} pas={0.2}
              onChange={(n) => maj(el.id, { taille: n } as Partial<Element>)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Choix nom="Police" valeur={el.police}
              options={POLICES.map((p) => [p.cle, p.nom])}
              onChange={(v) => maj(el.id, { police: v } as Partial<Element>)} />
            <Choix nom="Graisse" valeur={String(el.graisse)}
              options={[["400", "Normale"], ["600", "Demi-grasse"], ["700", "Grasse"]]}
              onChange={(v) => maj(el.id, { graisse: Number(v) } as Partial<Element>)} />
          </div>
          <Choix nom="Alignement" valeur={el.alignement}
            options={[["gauche", "À gauche"], ["centre", "Centré"], ["droite", "À droite"]]}
            onChange={(v) => maj(el.id, { alignement: v } as Partial<Element>)} />
          <Couleur nom="Couleur" valeur={el.couleur}
            onChange={(v) => maj(el.id, { couleur: v } as Partial<Element>)} />
        </>
      )}

      {(el.type === "rect" || el.type === "ellipse") && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Nombre nom="Largeur (mm)" valeur={el.l} onChange={(n) => maj(el.id, { l: n } as Partial<Element>)} />
            <Nombre nom="Hauteur (mm)" valeur={el.h} onChange={(n) => maj(el.id, { h: n } as Partial<Element>)} />
          </div>
          <Couleur nom="Remplissage" valeur={el.couleur}
            onChange={(v) => maj(el.id, { couleur: v } as Partial<Element>)} />
          <div className="grid grid-cols-2 gap-2">
            <Nombre nom="Bordure (mm)" valeur={el.bordure} pas={0.1}
              onChange={(n) => maj(el.id, { bordure: n } as Partial<Element>)} />
            {el.type === "rect" && (
              <Nombre nom="Arrondi (mm)" valeur={el.rayon} pas={0.5}
                onChange={(n) => maj(el.id, { rayon: n } as Partial<Element>)} />
            )}
          </div>
          {el.bordure > 0 && (
            <Couleur nom="Couleur de bordure" valeur={el.couleurBordure}
              onChange={(v) => maj(el.id, { couleurBordure: v } as Partial<Element>)} />
          )}
        </>
      )}

      {el.type === "ligne" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Nombre nom="Longueur (mm)" valeur={el.l} onChange={(n) => maj(el.id, { l: n } as Partial<Element>)} />
            <Nombre nom="Épaisseur (mm)" valeur={el.epaisseur} pas={0.1}
              onChange={(n) => maj(el.id, { epaisseur: n } as Partial<Element>)} />
          </div>
          <Couleur nom="Couleur" valeur={el.couleur}
            onChange={(v) => maj(el.id, { couleur: v } as Partial<Element>)} />
        </>
      )}

      {el.type === "image" && (
        <div className="grid grid-cols-2 gap-2">
          <Nombre nom="Largeur (mm)" valeur={el.l} onChange={(n) => maj(el.id, { l: n } as Partial<Element>)} />
          <Nombre nom="Hauteur (mm)" valeur={el.h} onChange={(n) => maj(el.id, { h: n } as Partial<Element>)} />
        </div>
      )}

      {el.type === "qr" && (
        <>
          <label className="mt-2 block">
            <span className="text-xs text-gray-400">
              Ce que le QR contient — un matricule, une référence, une adresse
            </span>
            <input value={el.valeur}
              onChange={(e) => maj(el.id, { valeur: e.target.value } as Partial<Element>)}
              className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-600" />
          </label>
          <Nombre nom="Taille (mm)" valeur={el.taille}
            onChange={(n) => maj(el.id, { taille: n } as Partial<Element>)} />
          <Couleur nom="Couleur" valeur={el.couleur}
            onChange={(v) => maj(el.id, { couleur: v } as Partial<Element>)} />
          {/* UN QR TROP PETIT NE SE LIT PAS. Mieux vaut le dire ici qu'après
              avoir imprimé deux cents badges. */}
          {el.taille < 15 && (
            <p className="mt-1 text-xs text-amber-300">
              Sous 15 mm, un QR devient difficile à lire pour un téléphone.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Icone({ children, onClick, titre, rouge }: {
  children: React.ReactNode; onClick: () => void; titre: string; rouge?: boolean;
}) {
  return (
    <button onClick={onClick} title={titre} aria-label={titre}
      className={`rounded border p-1.5 ${
        rouge ? "border-red-900 text-red-300 hover:bg-red-950/50" : "border-gray-800 hover:bg-gray-800"
      }`}>
      {children}
    </button>
  );
}

function Nombre({ nom, valeur, onChange, pas = 0.5 }: {
  nom: string; valeur: number; onChange: (n: number) => void; pas?: number;
}) {
  return (
    <label className="mt-2 block">
      <span className="text-xs text-gray-400">{nom}</span>
      <input type="number" value={Number.isFinite(valeur) ? valeur : 0} step={pas}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-2 py-1.5 text-sm outline-none focus:border-blue-600" />
    </label>
  );
}

function Choix({ nom, valeur, options, onChange }: {
  nom: string; valeur: string; options: [string, string][]; onChange: (v: string) => void;
}) {
  return (
    <label className="mt-2 block min-w-0">
      <span className="text-xs text-gray-400">{nom}</span>
      <select value={valeur} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-2 py-1.5 text-sm outline-none focus:border-blue-600">
        {options.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
      </select>
    </label>
  );
}

function Couleur({ nom, valeur, onChange }: {
  nom: string; valeur: string; onChange: (v: string) => void;
}) {
  return (
    <label className="mt-2 flex items-center gap-2">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(valeur) ? valeur : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-gray-800 bg-gray-950" />
      <span className="text-xs text-gray-400">{nom}</span>
      <span className="ml-auto font-mono text-[11px] text-gray-600">{valeur}</span>
    </label>
  );
}
