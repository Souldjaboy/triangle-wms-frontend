"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";

/**
 * RÉORGANISER LES EMPLACEMENTS.
 *
 * Le cas réel : un rayon physique est ajouté entre A et B. On veut que
 * l'ancien A reste A, que le nouveau devienne B, et que l'ancien B devienne C.
 *
 * Le piège est le code déjà pris : renommer B en C alors que C existe échoue à
 * mi-chemin et laisse la moitié des bacs renommés. Le serveur passe donc par
 * des codes temporaires et applique tout dans une seule transaction — ou rien.
 *
 * Cet écran ne fait qu'une chose de plus, mais elle est essentielle : il
 * montre le résultat AVANT de l'appliquer, quantités comprises. Un plan de
 * renommage qu'on ne peut pas relire est un plan qu'on n'applique pas.
 */

type Correspondance = { id: string; scope: string; warehouse: string; from: string; to: string };
type Cible = {
  id: number; codeAvant: string; codeApres: string;
  quantite: number; produits: number;
  avant: { row: string; shelf: string; level: string; bin: string };
  apres: { row: string; shelf: string; level: string; bin: string };
};
type Plan = {
  cibles: Cible[];
  resume: {
    bins: number; rayons: number; etageres: number; niveaux: number;
    produits: number; quantiteAvant: number; quantiteApres: number;
  };
  collisions: { code: string; occupePar: number }[];
  doublons: { code: string; ids: number[] }[];
  applicable: boolean;
};

const n = (v: unknown) => Number(v || 0).toLocaleString("fr-FR");
const CHAMP = "w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm";
const ECHELONS = [
  { cle: "ROW", label: "Rayon" },
  { cle: "SHELF", label: "Étagère" },
  { cle: "LEVEL", label: "Niveau" },
  { cle: "BIN", label: "Bac" },
];

const nouvelleLigne = (): Correspondance => ({
  id: Math.random().toString(36).slice(2), scope: "ROW", warehouse: "", from: "", to: "",
});

export default function ReorganiserPage() {
  const [lignes, setLignes] = useState<Correspondance[]>([nouvelleLigne()]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [rayons, setRayons] = useState<{ warehouse: string; row: string }[]>([]);

  /* On propose les rayons réellement présents plutôt que de faire deviner
     leur orthographe exacte. */
  const chargerRayons = useCallback(async () => {
    const r = await authFetch("/stock/locations/hierarchy", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return;
    const out: { warehouse: string; row: string }[] = [];
    for (const w of d.hierarchy || []) {
      for (const ray of w.enfants || []) out.push({ warehouse: w.nom, row: ray.nom });
    }
    setRayons(out);
  }, []);
  useEffect(() => { chargerRayons(); }, [chargerRayons]);

  const majLigne = (id: string, champ: keyof Correspondance, valeur: string) =>
    setLignes((l) => l.map((x) => (x.id === id ? { ...x, [champ]: valeur.toUpperCase() } : x)));

  const mappings = useMemo(
    () => lignes.filter((l) => l.from.trim() && l.to.trim())
      .map((l) => ({ scope: l.scope, warehouse: l.warehouse.trim(), from: l.from.trim(), to: l.to.trim() })),
    [lignes]
  );

  /**
   * INSÉRER UN RAYON — le geste qui motive tout l'écran.
   *
   * On choisit devant quel rayon le nouveau s'installe : tous ceux qui
   * suivent décalent d'une lettre, en partant de la fin pour que la
   * correspondance reste lisible.
   */
  const insererRayon = (warehouse: string, avant: string, nomActuel: string) => {
    const dansEntrepot = rayons.filter((r) => r.warehouse === warehouse).map((r) => r.row).sort();
    const depart = dansEntrepot.indexOf(avant);
    if (depart < 0) return;
    const aDecaler = dansEntrepot.slice(depart);
    const suivante = (lettre: string) =>
      String.fromCharCode(lettre.charCodeAt(0) + 1);
    const plan: Correspondance[] = aDecaler
      .slice()
      .reverse()
      .map((row) => ({
        id: Math.random().toString(36).slice(2),
        scope: "ROW", warehouse, from: row, to: suivante(row),
      }));
    plan.push({
      id: Math.random().toString(36).slice(2),
      scope: "ROW", warehouse, from: nomActuel.toUpperCase(), to: avant,
    });
    setLignes(plan);
    setPlan(null);
  };

  const apercu = async () => {
    setBusy(true); setErreur(""); setSucces("");
    const r = await authFetch("/stock/locations/reorganize/preview", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mappings }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setPlan(null); return setErreur(d?.error || "Aperçu impossible."); }
    setPlan(d);
  };

  const appliquer = async () => {
    setBusy(true); setErreur(""); setSucces("");
    const r = await authFetch("/stock/locations/reorganize/apply", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mappings, reason: motif.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErreur(d?.error || "Application impossible.");
    setSucces(`${d.bins} bac(s) renommé(s). Stock avant ${n(d.quantiteAvant)}, après ${n(d.quantiteApres)} — inchangé.`);
    setPlan(null); setLignes([nouvelleLigne()]); setMotif("");
    chargerRayons();
  };

  /** Le plan avant/après, en CSV, pour le relire ou l'archiver hors ligne. */
  const exporter = () => {
    if (!plan) return;
    const lignesCsv = [
      "id;code_avant;code_apres;quantite;produits",
      ...plan.cibles.map((c) => `${c.id};${c.codeAvant};${c.codeApres};${c.quantite};${c.produits}`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([lignesCsv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "plan-reorganisation.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <header className="mb-5">
        <Link href="/emplacements" className="text-sm font-bold text-indigo-700">← Emplacements</Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">Réorganiser les emplacements</h1>
        <p className="text-sm text-gray-500">
          Renommer des rayons, des étagères, des niveaux ou des bacs sans déplacer le stock.
        </p>
      </header>

      {erreur && <p className="mb-4 rounded-xl bg-red-100 p-3 text-sm font-bold text-red-800">{erreur}</p>}
      {succes && <p className="mb-4 rounded-xl bg-green-100 p-3 text-sm font-bold text-green-800">{succes}</p>}

      {/* ─────────────────────── assistant d'insertion */}
      <section className="mb-4 rounded-2xl bg-white p-4 shadow">
        <p className="text-sm font-bold text-gray-900">Insérer un nouveau rayon</p>
        <p className="mt-1 text-xs text-gray-500">
          Un rayon physique s&apos;installe entre deux autres : les suivants décalent d&apos;une lettre.
          Le plan est préparé, pas appliqué — vous le relisez avant.
        </p>
        <AssistantInsertion rayons={rayons} onPreparer={insererRayon} />
      </section>

      {/* ─────────────────────── table de correspondance */}
      <section className="mb-4 rounded-2xl bg-white p-4 shadow">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-900">Table de correspondance</p>
          <button onClick={() => setLignes((l) => [...l, nouvelleLigne()])}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700">
            + Ajouter une ligne
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr><th className="py-1">Échelon</th><th>Entrepôt</th><th>Nom actuel</th><th>Nouveau nom</th><th /></tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id}>
                  <td className="py-1 pr-2">
                    <select value={l.scope} onChange={(e) => majLigne(l.id, "scope", e.target.value)}
                            className={CHAMP}>
                      {ECHELONS.map((e) => <option key={e.cle} value={e.cle}>{e.label}</option>)}
                    </select>
                  </td>
                  <td className="pr-2">
                    <input value={l.warehouse} onChange={(e) => majLigne(l.id, "warehouse", e.target.value)}
                           placeholder="tous" className={CHAMP} />
                  </td>
                  <td className="pr-2">
                    <input value={l.from} onChange={(e) => majLigne(l.id, "from", e.target.value)}
                           className={CHAMP} />
                  </td>
                  <td className="pr-2">
                    <input value={l.to} onChange={(e) => majLigne(l.id, "to", e.target.value)}
                           className={CHAMP} />
                  </td>
                  <td>
                    <button onClick={() => setLignes((x) => x.filter((y) => y.id !== l.id))}
                            className="px-2 text-gray-400 hover:text-red-600">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={apercu} disabled={busy || mappings.length === 0}
                className="mt-3 w-full rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-800 disabled:opacity-40 sm:w-auto">
          {busy ? "Calcul…" : "Aperçu complet"}
        </button>
      </section>

      {/* ─────────────────────── aperçu */}
      {plan && (
        <section className="rounded-2xl bg-white p-4 shadow">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-gray-900">Résultat attendu</p>
            <button onClick={exporter} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700">
              Exporter le plan (CSV)
            </button>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["Rayons", plan.resume.rayons], ["Étagères", plan.resume.etageres],
              ["Niveaux", plan.resume.niveaux], ["Bacs", plan.resume.bins],
              ["Produits", plan.resume.produits]].map(([label, valeur]) => (
              <div key={String(label)} className="rounded-xl bg-gray-50 p-3">
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="text-lg font-bold text-gray-900">{n(valeur)}</dd>
              </div>
            ))}
            <div className={`rounded-xl p-3 ${
              plan.resume.quantiteAvant === plan.resume.quantiteApres ? "bg-emerald-50" : "bg-red-50"}`}>
              <dt className="text-xs text-gray-600">Quantité avant → après</dt>
              <dd className="text-lg font-bold text-gray-900">
                {n(plan.resume.quantiteAvant)} → {n(plan.resume.quantiteApres)}
              </dd>
              <p className="text-xs text-gray-600">
                {plan.resume.quantiteAvant === plan.resume.quantiteApres
                  ? "identique — un renommage ne déplace rien"
                  : "écart détecté : le plan sera refusé"}
              </p>
            </div>
          </dl>

          {plan.collisions.length > 0 && (
            <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3">
              <p className="text-sm font-bold text-red-900">Conflits de codes</p>
              <ul className="mt-1 text-xs text-red-900">
                {plan.collisions.map((c) => (
                  <li key={c.code}>
                    « {c.code} » est déjà porté par l&apos;emplacement {c.occupePar}, que ce plan ne renomme pas.
                    Ajoutez une ligne pour lui, ou changez le nom visé.
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plan.doublons.length > 0 && (
            <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3">
              <p className="text-sm font-bold text-red-900">Deux bacs viseraient le même code</p>
              <ul className="mt-1 text-xs text-red-900">
                {plan.doublons.map((d) => <li key={d.code}>« {d.code} » — emplacements {d.ids.join(" et ")}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs uppercase text-gray-500">
                <tr><th className="p-2">Avant</th><th>Après</th><th className="text-right">Quantité</th></tr>
              </thead>
              <tbody>
                {plan.cibles.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2 text-gray-600">{c.codeAvant}</td>
                    <td className="font-bold text-gray-900">{c.codeApres}</td>
                    <td className="text-right">{n(c.quantite)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="mt-4 block text-xs font-bold text-gray-700">
            Motif de la réorganisation <span className="text-red-600">— obligatoire</span>
            <input value={motif} onChange={(e) => setMotif(e.target.value)}
                   placeholder="Nouveau rayon physique installé entre A et B"
                   className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={appliquer} disabled={busy || !plan.applicable || !motif.trim()}
                    className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40 sm:flex-none">
              {busy ? "Application…" : `Appliquer à ${plan.resume.bins} bac(s)`}
            </button>
            <button onClick={() => setPlan(null)} disabled={busy}
                    className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold text-gray-700">
              Annuler
            </button>
          </div>
          {!plan.applicable && (
            <p className="mt-2 text-xs text-red-700">
              Résolvez les conflits ci-dessus : tant qu&apos;ils subsistent, rien ne sera appliqué.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function AssistantInsertion({
  rayons, onPreparer,
}: {
  rayons: { warehouse: string; row: string }[];
  onPreparer: (warehouse: string, avant: string, nomActuel: string) => void;
}) {
  const entrepots = useMemo(() => [...new Set(rayons.map((r) => r.warehouse))].sort(), [rayons]);
  const [w, setW] = useState("");
  const [avant, setAvant] = useState("");
  const [nomActuel, setNomActuel] = useState("");
  const disponibles = useMemo(
    () => rayons.filter((r) => r.warehouse === w).map((r) => r.row).sort(), [rayons, w]);

  useEffect(() => { if (!w && entrepots.length === 1) setW(entrepots[0]); }, [entrepots, w]);

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-4">
      <label className="block text-xs font-bold text-gray-700">Entrepôt
        <select value={w} onChange={(e) => { setW(e.target.value); setAvant(""); }} className={`mt-1 ${CHAMP}`}>
          <option value="">—</option>
          {entrepots.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </label>
      <label className="block text-xs font-bold text-gray-700">Le nouveau prend la place de
        <select value={avant} onChange={(e) => setAvant(e.target.value)} disabled={!w} className={`mt-1 ${CHAMP}`}>
          <option value="">—</option>
          {disponibles.map((x) => <option key={x} value={x}>Rayon {x}</option>)}
        </select>
      </label>
      <label className="block text-xs font-bold text-gray-700">Nom actuel du nouveau rayon
        <input value={nomActuel} onChange={(e) => setNomActuel(e.target.value.toUpperCase())}
               placeholder="D" className={`mt-1 ${CHAMP}`} />
      </label>
      <button onClick={() => onPreparer(w, avant, nomActuel)}
              disabled={!w || !avant || !nomActuel.trim()}
              className="mt-auto rounded-lg bg-gray-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">
        Préparer le plan
      </button>
    </div>
  );
}
