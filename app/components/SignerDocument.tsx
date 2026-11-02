"use client";

/**
 * POSER UNE SIGNATURE SUR UN PDF.
 *
 * On voit la page, on fait glisser la signature à sa place, on redimensionne,
 * on signe. La modification, elle, se fait sur le SERVEUR : le navigateur ne
 * réécrit jamais le document, il dit seulement où poser.
 *
 * CE QUE CET ÉCRAN DIT AVANT QU'ON SIGNE.
 *
 * 1. QUE SIGNER NE REMPLACE PAS L'ORIGINAL. Une version de plus est créée ;
 *    la version non signée reste intacte et téléchargeable. C'est écrit
 *    AVANT le clic, pas après.
 *
 * 2. SUR QUELLE PAGE, ET À QUELLE TAILLE. Une signature posée sur la page 1
 *    d'un contrat de douze feuillets au lieu de la dernière, c'est un
 *    document à refaire.
 *
 * 3. QUE LA PAGE PEUT ÊTRE TOURNÉE. Les scanners produisent sans arrêt des
 *    pages avec une rotation : elle est affichée telle qu'un lecteur la
 *    montre, et les coordonnées envoyées tiennent compte de la rotation.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../lib/api";
import { ouvrir, rendre, type PageRendue } from "../lib/pdf";
import {
  AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, PenTool, X,
} from "lucide-react";

type Signature = {
  id: number; kind: "SIGNATURE" | "CACHET"; label: string;
  ratio: string | null; is_default: boolean; est_la_mienne: boolean;
};
type PageInfo = { page: number; largeur: number; hauteur: number; rotation: number };

/* La signature est posée dans un cadre qu'on déplace. Sa largeur de départ :
   un quart de la page, ce qui correspond à une signature manuscrite sur un
   contrat — assez lisible, pas envahissante. */
const PART_LARGEUR = 0.25;

export default function SignerDocument({ documentId, documentNom, onFini, onFermer }: {
  documentId: number; documentNom: string;
  onFini: (message: string) => void;
  onFermer: () => void;
}) {
  const cadre = useRef<HTMLDivElement | null>(null);
  const zone = useRef<HTMLDivElement | null>(null);
  const docPdf = useRef<any>(null);

  const [pages, setPages] = useState<PageInfo[]>([]);
  const [numero, setNumero] = useState(1);
  const [rendu, setRendu] = useState<PageRendue | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [choisie, setChoisie] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState("");

  const [boite, setBoite] = useState({ x: 40, y: 40, l: 160, h: 60 });
  const [geste, setGeste] = useState<"deplacer" | "redimensionner" | null>(null);
  const depart = useRef({ sx: 0, sy: 0, bx: 0, by: 0, bl: 0, bh: 0 });

  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [note, setNote] = useState("");

  /* ─────────────────── LE DOCUMENT ET LES SIGNATURES ───────────────── */
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const [rp, rs, rf] = await Promise.all([
          authFetch(`/studio/documents/${documentId}/pages`),
          authFetch("/studio/signatures"),
          authFetch(`/studio/documents/${documentId}/fichier`),
        ]);
        if (!rp.ok) {
          const e = await rp.json().catch(() => ({}));
          throw new Error(e.error || "Ce document ne peut pas être signé.");
        }
        if (!rf.ok) throw new Error("Le document n'a pas pu être lu.");
        const infos = (await rp.json()).pages as PageInfo[];
        const sigs = rs.ok ? ((await rs.json()).signatures as Signature[]) : [];
        const octets = await rf.arrayBuffer();
        if (!vivant) return;

        setPages(infos);
        setSignatures(sigs);
        const defaut = sigs.find((s) => s.is_default && s.est_la_mienne)
          || sigs.find((s) => s.est_la_mienne) || sigs[0];
        setChoisie(defaut?.id ?? null);
        docPdf.current = await ouvrir(octets);
        if (!vivant) return;
        setChargement(false);
      } catch (e) {
        if (vivant) { setErreur((e as Error).message); setChargement(false); }
      }
    })();
    return () => {
      vivant = false;
      docPdf.current?.destroy?.().catch(() => {});
      docPdf.current = null;
    };
  }, [documentId]);

  /* ─────────────────────── L'IMAGE DE LA SIGNATURE ─────────────────── */
  useEffect(() => {
    if (!choisie) { setImageUrl(""); return; }
    let vivant = true; let cree = "";
    authFetch(`/studio/signatures/${choisie}/image`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const b = await r.blob();
        if (!vivant) return;
        cree = URL.createObjectURL(b);
        setImageUrl(cree);
      })
      .catch(() => { if (vivant) setImageUrl(""); });
    return () => { vivant = false; if (cree) URL.revokeObjectURL(cree); };
  }, [choisie]);

  /* ───────────────────────── RENDRE LA PAGE ────────────────────────── */
  const afficher = useCallback(async () => {
    const doc = docPdf.current;
    const hote = zone.current;
    if (!doc || !hote) return;
    try {
      const largeur = Math.min(hote.clientWidth || 600, 900);
      /* Ce qui reste à l'écran une fois l'en-tête, le choix de signature, la
         note et la barre d'actions déduits. On garde un plancher : sur un
         écran très bas, mieux vaut défiler un peu que rendre illisible. */
      const hauteur = Math.max(260, (window.innerHeight || 800) - 430);
      const r = await rendre(doc, numero, largeur, hauteur);
      hote.replaceChildren(r.canvas);
      setRendu(r);
      /* La signature est posée au premier tiers en bas, à droite : là où on
         signe un courrier. On la déplacera, mais autant partir d'un endroit
         plausible plutôt que du coin haut-gauche. */
      const sig = signatures.find((s) => s.id === choisie);
      const rapport = Number(sig?.ratio) || 3;
      const l = Math.round(r.canvas.clientWidth * PART_LARGEUR);
      const h = Math.round(l / rapport);
      setBoite({
        x: Math.max(8, r.canvas.clientWidth - l - 40),
        y: Math.max(8, r.canvas.clientHeight - h - 60),
        l, h,
      });
    } catch (e) {
      setErreur(`La page ${numero} n'a pas pu être affichée : ${(e as Error).message}`);
    }
  }, [numero, choisie, signatures]);

  useEffect(() => { if (!chargement) afficher(); }, [chargement, afficher]);

  /* Tourner le téléphone change la place disponible : on redessine, sinon la
     page reste à l'échelle de l'orientation précédente. */
  useEffect(() => {
    if (chargement) return;
    let minuteur: number | undefined;
    const r = () => {
      window.clearTimeout(minuteur);
      minuteur = window.setTimeout(() => { afficher(); }, 250);
    };
    window.addEventListener("resize", r);
    return () => { window.clearTimeout(minuteur); window.removeEventListener("resize", r); };
  }, [chargement, afficher]);

  /* ───────────────────────── DÉPLACER, ÉTIRER ──────────────────────── */
  const pointer = (e: React.PointerEvent) => {
    const c = rendu?.canvas;
    const r = c?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const prendre = (e: React.PointerEvent, quoi: "deplacer" | "redimensionner") => {
    e.preventDefault(); e.stopPropagation();
    const p = pointer(e);
    depart.current = { sx: p.x, sy: p.y, bx: boite.x, by: boite.y, bl: boite.l, bh: boite.h };
    setGeste(quoi);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const bouger = (e: React.PointerEvent) => {
    if (!geste || !rendu) return;
    const p = pointer(e);
    const dx = p.x - depart.current.sx, dy = p.y - depart.current.sy;
    const maxL = rendu.canvas.clientWidth, maxH = rendu.canvas.clientHeight;
    if (geste === "deplacer") {
      setBoite((b) => ({
        ...b,
        x: Math.max(0, Math.min(maxL - b.l, depart.current.bx + dx)),
        y: Math.max(0, Math.min(maxH - b.h, depart.current.by + dy)),
      }));
    } else {
      /* ON GARDE LES PROPORTIONS DU TRACÉ. Étirer une signature la rend
         fausse : ce n'est plus le paraphe de la personne. */
      const sig = signatures.find((s) => s.id === choisie);
      const rapport = Number(sig?.ratio) || 3;
      const l = Math.max(30, Math.min(maxL - depart.current.bx, depart.current.bl + dx));
      const h = Math.max(12, Math.min(maxH - depart.current.by, l / rapport));
      setBoite((b) => ({ ...b, l: Math.round(h * rapport), h: Math.round(h) }));
    }
  };
  const lacher = () => setGeste(null);

  /* ───────────────────────────── SIGNER ────────────────────────────── */
  async function signer() {
    if (!rendu || !choisie) return;
    setEnvoi(true); setErreur("");
    try {
      /* DEUX COINS OPPOSÉS, CONVERTIS PAR pdf.js. C'est lui qui connaît la
         rotation de la page : convertir à la main donnerait une signature
         couchée sur les pages tournées, et personne ne s'en apercevrait
         avant l'impression. */
      const a = rendu.versPdf(boite.x, boite.y);
      const b = rendu.versPdf(boite.x + boite.l, boite.y + boite.h);
      const corps = {
        signature_id: choisie,
        page: numero,
        x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
        largeur: Math.abs(b.x - a.x), hauteur: Math.abs(b.y - a.y),
        note: note.trim(),
      };
      const r = await authFetch(`/studio/documents/${documentId}/signer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(j.error || "La signature n'a pas pu être apposée."); return; }
      onFini(j.message || "Document signé.");
    } catch { setErreur("Le serveur n'a pas répondu."); }
    finally { setEnvoi(false); }
  }

  const sigChoisie = signatures.find((s) => s.id === choisie);
  const pageInfo = pages.find((p) => p.page === numero);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-0 sm:p-4">
      <div ref={cadre} className="w-full max-w-4xl rounded-none border-gray-800 bg-gray-900 sm:my-6 sm:rounded-xl sm:border min-w-0">
        <div className="flex items-start gap-3 border-b border-gray-800 p-4 min-w-0">
          <PenTool size={18} className="mt-0.5 shrink-0 text-blue-300" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold">Signer « {documentNom} »</h2>
            <p className="truncate text-xs text-gray-500">
              {pages.length
                ? `Page ${numero} sur ${pages.length}${pageInfo?.rotation ? ` · page tournée de ${pageInfo.rotation}°` : ""}`
                : "Préparation…"}
            </p>
          </div>
          <button onClick={onFermer} className="shrink-0 rounded p-1 hover:bg-gray-800" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        {/* CE QUI VA ARRIVER AU DOCUMENT, DIT AVANT LE CLIC. */}
        <p className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-300" />
          <span>
            Signer ne remplace pas l&apos;original : une version de plus sera
            créée, et la version actuelle, non signée, restera intacte et
            téléchargeable dans l&apos;historique du document.
          </span>
        </p>

        {erreur && (
          <p className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">{erreur}</span>
          </p>
        )}

        <div className="p-4">
          {chargement ? (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Ouverture du document…
            </p>
          ) : !signatures.length ? (
            <div className="py-10 text-center">
              <PenTool className="mx-auto mb-3 text-gray-700" size={30} />
              <p className="text-sm text-gray-400">
                Vous n&apos;avez pas encore de signature.
              </p>
              <a href="/studio/signatures"
                className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
                Créer ma signature
              </a>
            </div>
          ) : (
            <>
              {/* ───────────── le choix de la signature ───────────── */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <label className="min-w-0 flex-1">
                  <span className="text-xs text-gray-400">Apposer</span>
                  <select value={choisie ?? ""} onChange={(e) => setChoisie(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-600">
                    {signatures.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.kind === "CACHET" ? "Cachet" : "Signature"}
                        {s.label ? ` — ${s.label}` : ""}
                        {s.is_default ? " (par défaut)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {pages.length > 1 && (
                  <div className="flex shrink-0 items-end gap-1">
                    <button onClick={() => setNumero((n) => Math.max(1, n - 1))} disabled={numero <= 1}
                      className="rounded-lg border border-gray-800 p-2 hover:bg-gray-800 disabled:opacity-30"
                      aria-label="Page précédente">
                      <ChevronLeft size={16} />
                    </button>
                    <span className="px-1 pb-2 text-sm text-gray-400">{numero}/{pages.length}</span>
                    <button onClick={() => setNumero((n) => Math.min(pages.length, n + 1))}
                      disabled={numero >= pages.length}
                      className="rounded-lg border border-gray-800 p-2 hover:bg-gray-800 disabled:opacity-30"
                      aria-label="Page suivante">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* ───────────────── la page et le cadre ───────────── */}
              <div className="flex justify-center overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-2">
                <div className="relative inline-block" style={{ lineHeight: 0 }}>
                  <div ref={zone} />
                  {rendu && (
                    <div
                      className="absolute cursor-move touch-none"
                      style={{ left: boite.x, top: boite.y, width: boite.l, height: boite.h }}
                      onPointerDown={(e) => prendre(e, "deplacer")}
                      onPointerMove={bouger}
                      onPointerUp={lacher}
                      onPointerCancel={lacher}
                    >
                      <div className="h-full w-full rounded border-2 border-dashed border-blue-500 bg-blue-500/10">
                        {imageUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={imageUrl} alt="Signature à apposer"
                            className="pointer-events-none h-full w-full object-contain" />
                        )}
                      </div>
                      {/* La poignée d'étirement, assez grande pour le doigt. */}
                      <span
                        className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-blue-500"
                        onPointerDown={(e) => prendre(e, "redimensionner")}
                        onPointerMove={bouger}
                        onPointerUp={lacher}
                        onPointerCancel={lacher}
                      />
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Faites glisser la signature à sa place ; la poignée bleue
                l&apos;agrandit en gardant ses proportions — une signature
                étirée n&apos;est plus celle de la personne.
              </p>

              <label className="mt-3 block">
                <span className="text-xs text-gray-400">
                  Note pour l&apos;historique (facultative)
                </span>
                {/* L'exemple est DANS le champ, pas seulement à côté : c'est
                    là qu'on le lit au moment d'écrire. */}
                <input value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="ex. bon pour accord"
                  className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-600" />
              </label>
            </>
          )}
        </div>

        {!chargement && signatures.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-gray-800 p-4">
            <button onClick={signer} disabled={envoi || !choisie || !rendu}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-40">
              {envoi ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Apposer {sigChoisie?.kind === "CACHET" ? "le cachet" : "la signature"} en page {numero}
            </button>
            <button onClick={onFermer} disabled={envoi}
              className="rounded-lg border border-gray-800 px-4 py-2 text-sm hover:bg-gray-800 disabled:opacity-50">
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
