"use client";

/**
 * SIGNATURES ET CACHETS.
 *
 * On trace sa signature au doigt ou à la souris, ou on importe une photo du
 * paraphe. On y revient pour la remplacer, en désigner une par défaut, ou la
 * révoquer.
 *
 * CE QUE CET ÉCRAN DIT SANS QU'ON LE DEMANDE.
 *
 * 1. QUE CETTE SIGNATURE N'EST QU'À SOI. Personne d'autre ne la voit, pas
 *    même la direction. C'est écrit, parce que c'est la question que tout le
 *    monde se pose avant de dessiner son paraphe dans un logiciel.
 *
 * 2. QU'UN CACHET N'EST PAS UNE SIGNATURE. Le tampon de la maison engage la
 *    maison : il est visible de tous, et seul un responsable peut le poser.
 *
 * 3. QU'ON NE SUPPRIME PAS, ON RÉVOQUE. Les documents déjà signés restent
 *    signés — sinon on ne pourrait plus expliquer ce qui a été apposé.
 *
 * 4. CE QU'UNE SIGNATURE A SERVI À SIGNER. Le compte d'appositions est
 *    affiché : révoquer une signature qui a servi quarante fois n'est pas le
 *    même geste que révoquer un essai.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";
import {
  ArrowLeft, Check, Eraser, Loader2, Lock, PenTool, Stamp, Star,
  Trash2, Upload, X, AlertTriangle, Eye,
} from "lucide-react";

type Signature = {
  id: number; kind: "SIGNATURE" | "CACHET";
  owner_id: number | null; owner_name: string; label: string;
  mime: string; size_bytes: number; sha256: string;
  width_px: number | null; height_px: number | null; ratio: string | null;
  is_default: boolean; created_by_name: string; created_at: string;
  revoked_at: string | null; revoked_by_name: string; revoke_reason: string;
  est_la_mienne: boolean; appositions: number;
};

const moment = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—"
    : d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit" });
};

export default function Signatures() {
  const { can, loading: droitsEnCours } = usePermissions();
  const [liste, setListe] = useState<Signature[]>([]);
  const [revoquees, setRevoquees] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  const [tracer, setTracer] = useState<"SIGNATURE" | "CACHET" | null>(null);

  const peutPoserUnCachet = can("studio.signature", "validate");
  const peutCreer = can("studio.signature", "create");
  const peutModifier = can("studio.signature", "update");

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const r = await authFetch(`/studio/signatures${revoquees ? "?revoquees=1" : ""}`);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setErreur(r.status === 404
          ? "Les signatures ne sont pas ouvertes pour votre compte dans cette société."
          : (e.error || "Lecture impossible."));
        setListe([]);
        return;
      }
      setListe((await r.json()).signatures || []);
      setErreur("");
    } catch { setErreur("Le serveur n'a pas répondu."); }
    finally { setChargement(false); }
  }, [revoquees]);

  useEffect(() => { charger(); }, [charger]);

  if (droitsEnCours) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!can("studio.signature", "view")) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Lock className="mx-auto mb-4 text-gray-500" size={40} />
          <h1 className="mb-2 text-xl font-semibold">Signatures non accessibles</h1>
          <p className="text-sm text-gray-400">
            Votre compte n&apos;a pas l&apos;accès aux signatures pour cette société.
          </p>
          <Link href="/studio" className="mt-6 inline-block text-sm text-blue-400 hover:underline">
            Retour au Studio
          </Link>
        </div>
      </div>
    );
  }

  const miennes = liste.filter((s) => s.kind === "SIGNATURE");
  const cachets = liste.filter((s) => s.kind === "CACHET");

  return (
    <div className="min-h-screen bg-gray-950 text-white min-w-0 w-full">
      <header className="border-b border-gray-800">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4 min-w-0">
          <Link href="/studio" className="shrink-0 rounded-lg p-2 hover:bg-gray-800" aria-label="Retour au Studio">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">Signatures et cachets</h1>
            <p className="truncate text-xs text-gray-500">
              Votre signature n&apos;est visible que de vous.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-5 min-w-0">
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

        {/* ─────────────────────── MA SIGNATURE ─────────────────────── */}
        <section className="mb-8">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <PenTool size={16} /> Ma signature
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            Elle n&apos;est visible que de vous : ni vos collègues, ni la
            direction, ni un administrateur n&apos;y ont accès. Quiconque
            l&apos;obtiendrait pourrait signer à votre place — c&apos;est
            pourquoi elle ne sort jamais d&apos;ici.
          </p>

          {chargement ? (
            <p className="flex items-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Lecture…
            </p>
          ) : (
            <Cartes
              signatures={miennes}
              peutModifier={peutModifier}
              vide="Vous n'avez pas encore de signature."
              onChange={(m) => { setMessage(m); charger(); }}
              onErreur={setErreur}
            />
          )}

          {peutCreer && (
            <button onClick={() => setTracer("SIGNATURE")}
              className="mt-3 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500">
              <PenTool size={16} /> {miennes.length ? "Ajouter une signature" : "Créer ma signature"}
            </button>
          )}
        </section>

        {/* ──────────────────── LES CACHETS DE LA MAISON ───────────── */}
        <section className="mb-8">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Stamp size={16} /> Cachets de l&apos;entreprise
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            Un cachet engage la maison : il est visible de tous ceux qui ont
            accès au Studio dans cette société, et il ne passe jamais à
            l&apos;autre société. Seul un responsable peut en poser un.
          </p>

          {chargement ? null : (
            <Cartes
              signatures={cachets}
              peutModifier={peutPoserUnCachet}
              vide="Aucun cachet d'entreprise."
              onChange={(m) => { setMessage(m); charger(); }}
              onErreur={setErreur}
            />
          )}

          {peutPoserUnCachet ? (
            <button onClick={() => setTracer("CACHET")}
              className="mt-3 flex items-center gap-2 rounded-lg border border-gray-800 px-4 py-2 text-sm hover:bg-gray-800">
              <Stamp size={16} /> Ajouter un cachet
            </button>
          ) : (
            <p className="mt-2 text-xs text-gray-600">
              Votre compte peut utiliser les cachets mais pas en créer. Un
              responsable peut le faire depuis cet écran.
            </p>
          )}
        </section>

        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input type="checkbox" checked={revoquees} onChange={(e) => setRevoquees(e.target.checked)}
            className="h-4 w-4 rounded border-gray-700 bg-gray-900" />
          Montrer aussi les signatures révoquées
        </label>
      </div>

      {tracer && (
        <Tracer
          nature={tracer}
          onFermer={() => setTracer(null)}
          onEnregistree={(m) => { setTracer(null); setMessage(m); charger(); }}
          onErreur={setErreur}
        />
      )}
    </div>
  );
}

/* ──────────────────────────── LES CARTES ───────────────────────────────── */

function Cartes({ signatures, peutModifier, vide, onChange, onErreur }: {
  signatures: Signature[]; peutModifier: boolean; vide: string;
  onChange: (m: string) => void; onErreur: (e: string) => void;
}) {
  if (!signatures.length) {
    return (
      <p className="rounded-xl border border-dashed border-gray-800 px-4 py-6 text-center text-xs text-gray-600">
        {vide}
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {signatures.map((s) => (
        <Carte key={s.id} s={s} peutModifier={peutModifier}
          onChange={onChange} onErreur={onErreur} />
      ))}
    </ul>
  );
}

function Carte({ s, peutModifier, onChange, onErreur }: {
  s: Signature; peutModifier: boolean;
  onChange: (m: string) => void; onErreur: (e: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [echec, setEchec] = useState("");
  const [revoquer, setRevoquer] = useState(false);
  const [motif, setMotif] = useState("");
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    let vivant = true; let cree = "";
    authFetch(`/studio/signatures/${s.id}/image`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || "Image indisponible.");
        }
        const b = await r.blob();
        if (!vivant) return;
        cree = URL.createObjectURL(b);
        setUrl(cree);
      })
      .catch((e) => { if (vivant) setEchec(e.message); });
    return () => { vivant = false; if (cree) URL.revokeObjectURL(cree); };
  }, [s.id]);

  async function agir(chemin: string, options: RequestInit, succes: string) {
    setOccupe(true);
    try {
      const r = await authFetch(chemin, options);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { onErreur(j.error || "Action impossible."); return; }
      onChange(j.message || succes);
    } catch { onErreur("Le serveur n'a pas répondu."); }
    finally { setOccupe(false); }
  }

  return (
    <li className={`overflow-hidden rounded-xl border min-w-0 ${
      s.revoked_at ? "border-gray-800 bg-gray-950 opacity-70" : "border-gray-800 bg-gray-900/50"
    }`}>
      <div className="flex h-28 items-center justify-center bg-white">
        {echec ? (
          <p className="px-3 text-center text-[11px] text-amber-700">{echec}</p>
        ) : url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt={s.label || (s.kind === "CACHET" ? "Cachet" : "Signature")}
            className="max-h-full max-w-full object-contain p-2" />
        ) : (
          <Loader2 size={16} className="animate-spin text-gray-400" />
        )}
      </div>

      <div className="p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium">
            {s.label || (s.kind === "CACHET" ? "Cachet sans nom" : "Signature")}
          </span>
          {s.is_default && !s.revoked_at && (
            <span className="flex items-center gap-1 rounded bg-blue-900/60 px-1.5 py-0.5 text-[10px] text-blue-200">
              <Star size={9} /> par défaut
            </span>
          )}
          {s.revoked_at && (
            <span className="rounded bg-red-900/60 px-1.5 py-0.5 text-[10px] text-red-200">révoquée</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          {moment(s.created_at)}
          {s.width_px ? ` · ${s.width_px}×${s.height_px}` : ""}
        </p>
        {/* RÉVOQUER CE QUI A SERVI QUARANTE FOIS N'EST PAS RÉVOQUER UN ESSAI. */}
        <p className="mt-0.5 text-xs text-gray-500">
          {s.appositions === 0
            ? "Jamais utilisée."
            : `A servi ${s.appositions} fois.`}
        </p>
        {s.revoked_at && (
          <p className="mt-1 break-words text-xs text-gray-400">
            Révoquée le {moment(s.revoked_at)} par {s.revoked_by_name} — {s.revoke_reason}
          </p>
        )}

        {peutModifier && !s.revoked_at && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {!s.is_default && (
              <button disabled={occupe}
                onClick={() => agir(`/studio/signatures/${s.id}/defaut`, { method: "POST" },
                  "Désignée par défaut.")}
                className="flex items-center gap-1 rounded border border-gray-800 px-2 py-1 text-xs hover:bg-gray-800 disabled:opacity-50">
                <Star size={11} /> Par défaut
              </button>
            )}
            <button disabled={occupe} onClick={() => setRevoquer(true)}
              className="flex items-center gap-1 rounded border border-red-900 px-2 py-1 text-xs text-red-300 hover:bg-red-950/50 disabled:opacity-50">
              <Trash2 size={11} /> Révoquer
            </button>
          </div>
        )}

        {revoquer && (
          /* LA CONFIRMATION ÉNONCE CE QUI CHANGE ET CE QUI NE CHANGE PAS. */
          <div className="mt-2 rounded-lg border border-red-900 bg-red-950/40 p-2">
            <p className="text-xs text-red-100">
              Révoquer la rend inutilisable pour de nouvelles signatures.
              {s.appositions > 0
                ? ` Les ${s.appositions} document${s.appositions > 1 ? "s" : ""} déjà signé${s.appositions > 1 ? "s" : ""} avec elle restent signé${s.appositions > 1 ? "s" : ""} : leur trace garde son sens.`
                : " Elle n'a jamais servi."}
            </p>
            <input value={motif} onChange={(e) => setMotif(e.target.value)}
              placeholder="Pourquoi ? — dix caractères minimum"
              className="mt-2 w-full rounded border border-red-900 bg-gray-950 px-2 py-1.5 text-xs outline-none focus:border-red-600" />
            <div className="mt-2 flex gap-1.5">
              <button disabled={occupe || motif.trim().length < 10}
                onClick={() => agir(`/studio/signatures/${s.id}`, {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ motif }),
                }, "Signature révoquée.")}
                className="rounded bg-red-700 px-2 py-1 text-xs hover:bg-red-600 disabled:opacity-50">
                Révoquer
              </button>
              <button onClick={() => { setRevoquer(false); setMotif(""); }}
                className="rounded border border-gray-700 px-2 py-1 text-xs hover:bg-gray-800">
                Garder
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

/* ─────────────────────── TRACER OU IMPORTER ────────────────────────────── */

function Tracer({ nature, onFermer, onEnregistree, onErreur }: {
  nature: "SIGNATURE" | "CACHET";
  onFermer: () => void;
  onEnregistree: (m: string) => void;
  onErreur: (e: string) => void;
}) {
  const toile = useRef<HTMLCanvasElement | null>(null);
  const fichier = useRef<HTMLInputElement | null>(null);
  const dessine = useRef(false);
  const vide = useRef(true);
  const dernier = useRef<{ x: number; y: number } | null>(null);

  const [nom, setNom] = useState("");
  const [parDefaut, setParDefaut] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [importee, setImportee] = useState<{ url: string; blob: Blob } | null>(null);
  const [aQuelqueChose, setAQuelqueChose] = useState(false);

  /* La toile est préparée à sa taille réelle d'affichage, sinon le tracé
     est décalé du doigt — l'erreur la plus visible d'un champ de signature. */
  const preparer = useCallback(() => {
    const c = toile.current;
    if (!c) return;
    const largeur = c.clientWidth || 600;
    const hauteur = c.clientHeight || 200;
    const densite = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    c.width = Math.round(largeur * densite);
    c.height = Math.round(hauteur * densite);
    const g = c.getContext("2d");
    if (!g) return;
    g.scale(densite, densite);
    g.lineCap = "round"; g.lineJoin = "round";
    g.lineWidth = 2.6;
    g.strokeStyle = "#111827";
    /* PAS DE FOND : l'image gardera sa transparence, sans quoi un rectangle
       blanc recouvrirait le texte du document au moment de signer. */
    g.clearRect(0, 0, largeur, hauteur);
  }, []);

  useEffect(() => { preparer(); }, [preparer]);
  useEffect(() => {
    const r = () => { preparer(); vide.current = true; setAQuelqueChose(false); };
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, [preparer]);

  useEffect(() => () => { if (importee) URL.revokeObjectURL(importee.url); }, [importee]);

  const point = (e: React.PointerEvent) => {
    const c = toile.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const commencer = (e: React.PointerEvent) => {
    if (importee) return;
    dessine.current = true;
    dernier.current = point(e);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const tracerTrait = (e: React.PointerEvent) => {
    if (!dessine.current || importee) return;
    const c = toile.current!;
    const g = c.getContext("2d");
    if (!g) return;
    const p = point(e);
    const d = dernier.current || p;
    g.beginPath();
    g.moveTo(d.x, d.y);
    g.lineTo(p.x, p.y);
    g.stroke();
    dernier.current = p;
    if (vide.current) { vide.current = false; setAQuelqueChose(true); }
  };
  const finir = () => { dessine.current = false; dernier.current = null; };

  function effacer() {
    preparer();
    vide.current = true;
    setAQuelqueChose(false);
    if (importee) { URL.revokeObjectURL(importee.url); setImportee(null); }
  }

  /* Le tracé occupe rarement toute la toile : on le RECADRE sur ce qui a été
     dessiné. Sans cela, la signature apposée serait minuscule au milieu d'un
     grand vide transparent, et impossible à placer précisément. */
  async function versBlob(): Promise<Blob | null> {
    if (importee) return importee.blob;
    const c = toile.current;
    if (!c) return null;
    const g = c.getContext("2d");
    if (!g) return null;
    const px = g.getImageData(0, 0, c.width, c.height).data;
    let gx = c.width, dx = 0, hy = c.height, by = 0;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (px[(y * c.width + x) * 4 + 3] > 12) {
          if (x < gx) gx = x; if (x > dx) dx = x;
          if (y < hy) hy = y; if (y > by) by = y;
        }
      }
    }
    if (dx <= gx || by <= hy) return null;
    const marge = Math.round(Math.min(c.width, c.height) * 0.03);
    gx = Math.max(0, gx - marge); hy = Math.max(0, hy - marge);
    dx = Math.min(c.width - 1, dx + marge); by = Math.min(c.height - 1, by + marge);

    const recadre = document.createElement("canvas");
    recadre.width = dx - gx + 1; recadre.height = by - hy + 1;
    recadre.getContext("2d")?.drawImage(c, gx, hy, recadre.width, recadre.height,
      0, 0, recadre.width, recadre.height);
    return new Promise((ok) => recadre.toBlob((b) => ok(b), "image/png"));
  }

  async function enregistrer() {
    setEnvoi(true);
    try {
      const blob = await versBlob();
      if (!blob) { onErreur("Tracez votre signature, ou importez une image."); return; }
      const form = new FormData();
      form.append("image", blob, nature === "CACHET" ? "cachet.png" : "signature.png");
      form.append("nature", nature);
      if (nom.trim()) form.append("nom", nom.trim());
      if (parDefaut) form.append("defaut", "1");
      const r = await authFetch("/studio/signatures", { method: "POST", body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { onErreur(j.error || "Enregistrement impossible."); return; }
      onEnregistree(nature === "CACHET" ? "Cachet enregistré." : "Signature enregistrée.");
    } catch { onErreur("Le serveur n'a pas répondu."); }
    finally { setEnvoi(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
      <div className="my-8 w-full max-w-xl rounded-xl border border-gray-800 bg-gray-900 p-4 min-w-0">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">
            {nature === "CACHET" ? "Nouveau cachet d'entreprise" : "Nouvelle signature"}
          </h2>
          <button onClick={onFermer} className="rounded p-1 hover:bg-gray-800" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        {nature === "CACHET" && (
          <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Ce cachet sera visible et utilisable par tous ceux qui ont accès
              au Studio dans cette société. Il ne passera jamais à
              l&apos;autre société.
            </span>
          </p>
        )}

        <div className="overflow-hidden rounded-lg border border-gray-700 bg-white">
          {importee ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={importee.url} alt="Signature importée"
              className="mx-auto block h-40 w-auto max-w-full object-contain" />
          ) : (
            <canvas
              ref={toile}
              className="block h-40 w-full touch-none"
              onPointerDown={commencer}
              onPointerMove={tracerTrait}
              onPointerUp={finir}
              onPointerCancel={finir}
              onPointerLeave={finir}
            />
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {importee
            ? "Image importée. Le fond transparent est conservé."
            : "Tracez avec le doigt ou la souris. Le tracé sera recadré sur ce que vous aurez dessiné."}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={effacer}
            className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-800">
            <Eraser size={14} /> Effacer
          </button>
          <button onClick={() => fichier.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-800">
            <Upload size={14} /> Importer une image
          </button>
          <input ref={fichier} type="file" accept="image/png,image/jpeg" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (importee) URL.revokeObjectURL(importee.url);
              setImportee({ url: URL.createObjectURL(f), blob: f });
              setAQuelqueChose(true);
            }} />
        </div>

        <div className="mt-3 space-y-2 text-sm">
          <label className="block">
            <span className="text-xs text-gray-400">
              Nom {nature === "CACHET" ? "du cachet" : "(facultatif)"}
            </span>
            <input value={nom} onChange={(e) => setNom(e.target.value)}
              placeholder={nature === "CACHET" ? "ex. Tampon Triangle Logistique" : "ex. Paraphe"}
              className="mt-1 w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 outline-none focus:border-blue-600" />
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={parDefaut} onChange={(e) => setParDefaut(e.target.checked)}
              className="h-4 w-4 rounded border-gray-700 bg-gray-900" />
            S&apos;en servir par défaut
          </label>
        </div>

        <p className="mt-3 flex items-start gap-2 rounded-lg bg-gray-950 px-3 py-2 text-xs text-gray-500">
          <Eye size={14} className="mt-0.5 shrink-0" />
          <span>
            {nature === "CACHET"
              ? "Le cachet est rangé hors du dossier public, comme les documents : aucune URL ne l'atteint."
              : "Votre signature est rangée hors du dossier public et n'est servie qu'à vous. Aucune URL ne l'atteint, et elle n'est jamais mise en cache."}
          </span>
        </p>

        <div className="mt-4 flex gap-2">
          <button onClick={enregistrer} disabled={envoi || !aQuelqueChose}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-40">
            {envoi ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Enregistrer
          </button>
          <button onClick={onFermer} disabled={envoi}
            className="rounded-lg border border-gray-800 px-4 py-2 text-sm hover:bg-gray-800 disabled:opacity-50">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
