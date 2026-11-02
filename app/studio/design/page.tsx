"use client";

/**
 * LE STUDIO GRAPHIQUE — la porte d'entrée.
 *
 * Choisir un modèle, ou rouvrir une création déjà faite.
 *
 * LES MODÈLES SONT ORIGINAUX. Ce sont des mises en page écrites ici, pas des
 * modèles repris d'ailleurs : le cahier des charges l'exige, et un modèle
 * sous licence recopié exposerait l'entreprise.
 *
 * CHAQUE MODÈLE DIT SON FORMAT EN MILLIMÈTRES. « Carte de visite » ne veut
 * rien dire à l'imprimeur ; « 85 × 55 mm » si.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";
import { MODELES, rendre, type Modele } from "../../lib/creation";
import {
  AlertTriangle, ArrowLeft, Loader2, Lock, Palette, Plus, X,
} from "lucide-react";

type Creation = {
  id: number; name: string; design_format: string;
  design_mm_width: string; design_mm_height: string;
  version: number; visibility: string; owner_name: string;
  updated_at: string; size_bytes: number; je_suis_proprietaire: boolean;
};

const moment = (s: string) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—"
    : d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit" });
};

export default function StudioGraphique() {
  const { can, loading: droitsEnCours } = usePermissions();
  const router = useRouter();
  const [creations, setCreations] = useState<Creation[]>([]);
  const [apercus, setApercus] = useState<Record<string, string>>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState("");

  const peutCreer = can("studio.design", "create");

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const r = await authFetch("/studio/creations");
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setErreur(r.status === 404
          ? "Le studio graphique n'est pas ouvert pour votre compte dans cette société."
          : (e.error || "Lecture impossible."));
        return;
      }
      setCreations((await r.json()).creations || []);
      setErreur("");
    } catch { setErreur("Le serveur n'a pas répondu."); }
    finally { setChargement(false); }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  /* Les aperçus des modèles sont dessinés par le MÊME code que l'éditeur et
     l'impression : ce qu'on voit sur la vignette est ce qu'on obtiendra. */
  useEffect(() => {
    const faits: Record<string, string> = {};
    for (const m of MODELES) {
      try {
        const c = rendre(m.plan, m.largeurMm, m.hauteurMm,
          Math.min(3, 240 / m.largeurMm));
        faits[m.cle] = c.toDataURL("image/png");
      } catch { /* un modèle qui ne se dessine pas n'empêche pas les autres */ }
    }
    setApercus(faits);
  }, []);

  async function creer(modele: Modele) {
    setEnCours(modele.cle); setErreur("");
    try {
      /* On enregistre d'emblée l'image en pleine finesse : la création doit
         être utilisable — partageable, imprimable — avant même d'être
         retouchée. */
      const canvas = rendre(modele.plan, modele.largeurMm, modele.hauteurMm, 300 / 25.4);
      const blob = await new Promise<Blob | null>((ok) =>
        canvas.toBlob((b) => ok(b), "image/png"));
      if (!blob) { setErreur("L'image n'a pas pu être produite."); return; }

      const form = new FormData();
      form.append("image", blob, `${modele.nom}.png`);
      form.append("nom", modele.nom);
      form.append("plan", JSON.stringify(modele.plan));
      form.append("largeur_mm", String(modele.largeurMm));
      form.append("hauteur_mm", String(modele.hauteurMm));
      form.append("format", modele.nom);
      const r = await authFetch("/studio/creations", { method: "POST", body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(j.error || "Création impossible."); return; }
      router.push(`/studio/design/${j.creation.id}`);
    } catch { setErreur("Le serveur n'a pas répondu."); }
    finally { setEnCours(""); }
  }

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
          <p className="text-sm text-gray-400">
            Votre compte n&apos;a pas l&apos;accès au studio graphique pour
            cette société.
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
      <header className="border-b border-gray-800">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 min-w-0">
          <Link href="/studio" className="shrink-0 rounded-lg p-2 hover:bg-gray-800" aria-label="Retour au Studio">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-semibold">Studio graphique</h1>
            <p className="truncate text-xs text-gray-500">
              Cartes, badges, certificats, étiquettes — aux vraies dimensions.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5 min-w-0">
        {erreur && (
          <p className="mb-3 flex items-start gap-2 rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">{erreur}</span>
            <button onClick={() => setErreur("")} className="shrink-0" aria-label="Fermer"><X size={14} /></button>
          </p>
        )}

        {/* ─────────────────────── LES MODÈLES ──────────────────────── */}
        {peutCreer && (
          <section className="mb-8">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <Plus size={16} /> Commencer
            </h2>
            <p className="mb-3 text-xs text-gray-500">
              Des mises en page simples, à modifier entièrement. Le format est
              donné en millimètres : c&apos;est ce qu&apos;attend un imprimeur.
            </p>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MODELES.map((m) => (
                <li key={m.cle}>
                  <button
                    onClick={() => creer(m)}
                    disabled={!!enCours}
                    className="w-full overflow-hidden rounded-xl border border-gray-800 bg-gray-900/50 text-left hover:border-blue-700 disabled:opacity-50 min-w-0"
                  >
                    <div className="flex h-32 items-center justify-center bg-gray-800/60 p-2">
                      {apercus[m.cle] ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={apercus[m.cle]} alt={`Aperçu du modèle ${m.nom}`}
                          className="max-h-full max-w-full object-contain shadow-lg" />
                      ) : (
                        <Palette size={22} className="text-gray-600" />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {m.nom}
                        {enCours === m.cle && <Loader2 size={13} className="animate-spin" />}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">{m.description}</p>
                      <p className="mt-1 text-[11px] text-gray-600">
                        {m.largeurMm} × {m.hauteurMm} mm
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ───────────────────── LES CRÉATIONS ──────────────────────── */}
        <section>
          <h2 className="mb-2 text-sm font-semibold">Mes créations</h2>
          {chargement ? (
            <p className="flex items-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Lecture…
            </p>
          ) : !creations.length ? (
            <p className="rounded-xl border border-dashed border-gray-800 px-4 py-6 text-center text-xs text-gray-600">
              Aucune création pour l&apos;instant.
            </p>
          ) : (
            <ul className="space-y-2">
              {creations.map((c) => (
                <li key={c.id}>
                  <Link href={`/studio/design/${c.id}`}
                    className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-3 hover:border-gray-700 min-w-0">
                    <Palette size={18} className="shrink-0 text-blue-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="truncate text-xs text-gray-500">
                        {c.design_format || "sur mesure"} ·{" "}
                        {Number(c.design_mm_width)} × {Number(c.design_mm_height)} mm ·
                        version {c.version} · {c.owner_name} · {moment(c.updated_at)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
