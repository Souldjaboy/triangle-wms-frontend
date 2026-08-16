"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";
import BinSelector, { useBinTree, type Bin } from "../../components/BinSelector";

/**
 * RÉPARTITION MANUELLE DU STOCK PAR EMPLACEMENT.
 *
 * Le stock global existe déjà ; ce qui manque, c'est de savoir OÙ il se trouve.
 * Cet écran ne crée, ne supprime et ne déplace donc AUCUNE unité : il dit
 * seulement dans quels bacs elles sont.
 *
 * Garde-fou : la somme saisie doit être EXACTEMENT égale au stock du produit.
 * Un écart, même d'une unité, bloque la validation — côté écran comme côté
 * serveur, qui refuse de son côté par ALLOCATION_SUM_MISMATCH.
 */

type Pending = {
  id: number; name: string; reference: string | null;
  stock: number; unit: string | null;
  location_code: string | null; warehouse: string | null;
  reparti: number; aLocaliser: number;
  allocation_priority: number | null;
};
type Tri = "priorite" | "produit" | "quantite" | "emplacement";
type Ligne = { key: number; bin: Bin | null; quantity: string };

const n = (v: unknown) => Number(v || 0).toLocaleString("fr-FR");

export default function RepartitionPage() {
  const { can } = usePermissions();
  const canAllocate = can("stock", "validate");
  const { tree, reload: reloadTree } = useBinTree();

  const [items, setItems] = useState<Pending[]>([]);
  const [totals, setTotals] = useState({ produits: 0, unites: 0, aLocaliser: 0, stockNul: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [seulementStock, setSeulementStock] = useState(true);
  const [actif, setActif] = useState<Pending | null>(null);
  const [tri, setTri] = useState<Tri>("priorite");
  const [glisse, setGlisse] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await authFetch(`/stock/allocation/pending?sort=${tri}`, { cache: "no-store" });
    if (r.ok) { const d = await r.json(); setItems(d.items); setTotals(d.totals); }
    else setError("Erreur de chargement des produits à localiser.");
    setLoading(false);
  }, [tri]);
  useEffect(() => { load(); }, [load]);

  /* L'ordre de rangement appartient au magasinier : il est enregistré en base
     pour survivre à un rechargement. Une priorité ne touche aucun stock. */
  const enregistrerOrdre = useCallback(async (ordre: Pending[]) => {
    setItems(ordre);
    const r = await authFetch("/stock/allocation/order", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: ordre.map((i) => i.id) }),
    });
    if (!r.ok) { setError("Ordre non enregistré."); await load(); return; }
    setItems(ordre.map((i, k) => ({ ...i, allocation_priority: k + 1 })));
  }, [load]);

  const deplacer = (index: number, delta: number) => {
    const cible = index + delta;
    if (cible < 0 || cible >= items.length) return;
    const copie = [...items];
    [copie[index], copie[cible]] = [copie[cible], copie[index]];
    enregistrerOrdre(copie);
  };

  const deposer = (surIndex: number) => {
    if (glisse === null || glisse === surIndex) return setGlisse(null);
    const copie = [...items];
    const [pris] = copie.splice(glisse, 1);
    copie.splice(surIndex, 0, pris);
    setGlisse(null);
    enregistrerOrdre(copie);
  };

  const filtres = useMemo(() => items.filter((i) => {
    if (seulementStock && i.stock <= 0) return false;
    const q = query.trim().toLowerCase();
    return !q || `${i.name} ${i.reference || ""}`.toLowerCase().includes(q);
  }), [items, query, seulementStock]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <Link href="/stocks" className="text-sm font-bold text-blue-700">← Stocks</Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-black text-gray-900 sm:text-3xl">Répartition par emplacement</h1>
          <Link href="/stocks/produits/nouveau"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">
            + Nouveau produit
          </Link>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          Ces produits ont déjà leur stock ; il reste à dire <span className="font-bold">où</span> il se
          trouve. Répartir ne crée ni ne supprime aucune unité — la somme saisie doit être exactement
          égale au stock du produit.
        </p>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
        {notice && (
          <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">
            {notice} <button onClick={() => setNotice("")} className="underline">fermer</button>
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Box label="Produits à localiser" value={n(totals.produits)} />
          <Box label="Unités concernées" value={n(totals.unites)} />
          <Box label="Restant à localiser" value={n(totals.aLocaliser)} tone="text-amber-700" />
          <Box label="Produits à stock nul" value={n(totals.stockNul)} />
        </div>

        <section className="mt-4 flex flex-wrap items-center gap-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Rechercher un produit…"
                 className="min-w-[240px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={seulementStock} onChange={(e) => setSeulementStock(e.target.checked)} />
            Masquer les produits à stock nul
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            Trier par
            <select value={tri} onChange={(e) => setTri(e.target.value as Tri)}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
              <option value="priorite">Ordre de rangement</option>
              <option value="produit">Produit</option>
              <option value="quantite">Quantité</option>
              <option value="emplacement">Emplacement</option>
            </select>
          </label>
        </section>
        {tri === "priorite" && (
          <p className="mt-2 text-xs text-gray-500">
            Glissez une ligne pour la déplacer, ou utilisez ▲ ▼. L&apos;ordre est enregistré
            immédiatement et conservé après actualisation.
          </p>
        )}

        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3 w-24">Ordre</th>
                <th className="p-3">Produit</th><th className="p-3">Référence</th>
                <th className="p-3">Ancien code</th>
                <th className="p-3 text-right">Stock</th><th className="p-3 text-right">Réparti</th>
                <th className="p-3 text-right">À localiser</th><th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan={8} className="p-6 text-center text-gray-500">Chargement…</td></tr>}
              {!loading && !filtres.length && (
                <tr><td colSpan={8} className="p-6 text-center text-gray-500">Aucun produit à localiser.</td></tr>
              )}
              {filtres.map((i, index) => (
                <tr key={i.id}
                    draggable={tri === "priorite"}
                    onDragStart={() => setGlisse(index)}
                    onDragOver={(e) => { if (glisse !== null) e.preventDefault(); }}
                    onDrop={() => deposer(index)}
                    className={`${glisse === index ? "opacity-40" : ""} hover:bg-gray-50`}>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <span className="w-7 text-xs font-black text-gray-500">
                        {i.allocation_priority ?? "—"}
                      </span>
                      {tri === "priorite" && (
                        <span className="flex flex-col leading-none">
                          <button onClick={() => deplacer(index, -1)} disabled={index === 0}
                                  aria-label="Monter"
                                  className="px-1 text-xs text-gray-500 disabled:opacity-25">▲</button>
                          <button onClick={() => deplacer(index, 1)} disabled={index === filtres.length - 1}
                                  aria-label="Descendre"
                                  className="px-1 text-xs text-gray-500 disabled:opacity-25">▼</button>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-semibold text-gray-900">{i.name}</td>
                  <td className="p-3 text-xs">{i.reference || "—"}</td>
                  <td className="p-3 text-xs text-gray-500">{i.location_code || "—"}</td>
                  <td className="p-3 text-right font-bold">{n(i.stock)}</td>
                  <td className="p-3 text-right text-green-700">{n(i.reparti)}</td>
                  <td className="p-3 text-right font-bold text-amber-700">{n(i.aLocaliser)}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-3 whitespace-nowrap text-xs font-bold">
                      {i.stock > 0 && canAllocate && (
                        <button onClick={() => setActif(i)} className="text-blue-700">Répartir</button>
                      )}
                      <Link href={`/stocks/produits/${i.id}`} className="text-gray-600">Emplacements</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {actif && (
        <RepartirModal
          produit={actif} tree={tree}
          onClose={() => setActif(null)}
          onDone={async (m) => { setActif(null); setNotice(m); setError(""); await load(); await reloadTree(); }}
          onError={setError}
          onBinCree={reloadTree}
        />
      )}
    </div>
  );
}

/* ========================== RÉPARTITION D'UN PRODUIT ========================== */

function RepartirModal({ produit, tree, onClose, onDone, onError, onBinCree }: {
  produit: Pending;
  tree: ReturnType<typeof useBinTree>["tree"];
  onClose: () => void;
  onDone: (m: string) => void;
  onError: (m: string) => void;
  onBinCree: () => Promise<void> | void;
}) {
  const [lignes, setLignes] = useState<Ligne[]>([{ key: 1, bin: null, quantity: "" }]);
  const [seq, setSeq] = useState(2);
  const [busy, setBusy] = useState(false);
  const [creation, setCreation] = useState(false);

  const total = lignes.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const ecart = total - produit.stock;
  const doublon = new Set(lignes.filter((l) => l.bin).map((l) => l.bin!.id)).size
    !== lignes.filter((l) => l.bin).length;
  const incompletes = lignes.filter((l) => !l.bin || !(Number(l.quantity) > 0));
  const valide = ecart === 0 && !doublon && incompletes.length === 0 && lignes.length > 0;

  const set = (key: number, patch: Partial<Ligne>) =>
    setLignes((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const enregistrer = async () => {
    setBusy(true);
    const r = await authFetch(`/stock/products/${produit.id}/allocate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        allocations: lignes.map((l) => ({ locationId: l.bin!.id, quantity: Number(l.quantity) })),
      }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return onError(d?.error || "Échec de la répartition.");
    onDone(`« ${produit.name} » réparti sur ${d.lignes.length} emplacement(s), ${n(d.total)} unité(s). Stock global inchangé.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-gray-900">{produit.name}</h2>
            <p className="text-sm text-gray-600">
              Stock global <span className="font-bold">{n(produit.stock)}</span>{" "}
              {produit.unit || ""}{" "}— à répartir intégralement. Aucune unité n&apos;est créée ni supprimée.
            </p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-gray-400">×</button>
        </div>

        <div className="mt-4 space-y-3">
          {lignes.map((l, i) => (
            <div key={l.key} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase text-gray-500">Emplacement {i + 1}</span>
                {lignes.length > 1 && (
                  <button onClick={() => setLignes((p) => p.filter((x) => x.key !== l.key))}
                          className="text-xs font-bold text-red-700">Retirer</button>
                )}
              </div>
              <div className="mt-2">
                <BinSelector tree={tree} value={l.bin} label=""
                             onSelect={(bin) => set(l.key, { bin })} compact />
              </div>
              <label className="mt-2 block text-xs font-bold text-gray-700">
                Quantité dans ce bac
                <input type="number" min={1} value={l.quantity}
                       onChange={(e) => set(l.key, { quantity: e.target.value })}
                       className="mt-1 w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </label>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <button onClick={() => { setLignes((p) => [...p, { key: seq, bin: null, quantity: "" }]); setSeq((s) => s + 1); }}
                  className="text-sm font-bold text-blue-700">+ Ajouter un emplacement</button>
          <button onClick={() => setCreation((v) => !v)} className="text-sm font-bold text-indigo-700">
            {creation ? "Fermer la création" : "Créer un nouveau BIN"}
          </button>
        </div>

        {creation && <CreerBin onCree={async (m) => { await onBinCree(); onError(""); setCreation(false); alertInline(m); }} onError={onError} />}

        {/* ---------- CONTRÔLE DE LA SOMME ---------- */}
        <div className={`mt-4 rounded-xl p-4 ${ecart === 0 ? "bg-green-50" : "bg-amber-50"}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-gray-800">
              Somme saisie <span className="text-lg font-black">{n(total)}</span> ·
              stock du produit <span className="text-lg font-black">{n(produit.stock)}</span>
            </p>
            <p className={`text-sm font-black ${ecart === 0 ? "text-green-800" : "text-amber-900"}`}>
              {ecart === 0 ? "écart 0 — répartition complète"
                : ecart > 0 ? `${n(ecart)} unité(s) de trop` : `${n(-ecart)} unité(s) manquante(s)`}
            </p>
          </div>
          {doublon && (
            <p className="mt-2 text-sm font-semibold text-red-800">
              Le même emplacement apparaît deux fois : regroupez la quantité sur une seule ligne.
            </p>
          )}
          {incompletes.length > 0 && (
            <p className="mt-2 text-sm text-amber-900">
              {incompletes.length} ligne(s) incomplète(s) : chaque ligne doit avoir un BIN et une quantité &gt; 0.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700">
            Annuler
          </button>
          <button onClick={enregistrer} disabled={!valide || busy}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {busy ? "Enregistrement…" : "Valider la répartition"}
          </button>
        </div>
        <p className="mt-2 text-right text-xs text-gray-500">
          La validation reste impossible tant que la somme diffère du stock.
        </p>
      </div>
    </div>
  );
}

function alertInline(m: string) {
  if (typeof window !== "undefined") window.alert(m);
}

/* ============================== CRÉATION D'UN BIN ============================== */

function CreerBin({ onCree, onError }: { onCree: (m: string) => void; onError: (m: string) => void }) {
  const [f, setF] = useState({ warehouse: "", row: "", location: "", level: "", bin: "" });
  const [busy, setBusy] = useState(false);
  const champs: [keyof typeof f, string][] = [
    ["warehouse", "Entrepôt"], ["row", "Rayon / ROW"], ["location", "Location"],
    ["level", "Level"], ["bin", "BIN"],
  ];

  const creer = async () => {
    setBusy(true);
    const r = await authFetch("/stock/locations/bins", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return onError(d?.error || "Échec de la création du bac.");
    onCree(d.created ? `Bac ${d.full_code} créé, vide. Aucun stock n'y a été placé.`
                     : `Le bac ${d.full_code} existait déjà.`);
  };

  return (
    <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
      <p className="text-sm font-bold text-gray-900">Créer un vrai BIN</p>
      <p className="mt-1 text-xs text-indigo-900">
        Pour remplacer une plage « BIN1-2 » par de vrais bacs. Le bac est créé <span className="font-bold">vide</span> :
        savoir que deux bacs existent ne dit pas lequel contient quoi.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-5">
        {champs.map(([k, label]) => (
          <label key={k} className="block text-xs font-bold text-gray-700">{label}
            <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value.toUpperCase() })}
                   className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-normal" />
          </label>
        ))}
      </div>
      <button onClick={creer} disabled={busy || Object.values(f).some((v) => !v.trim())}
              className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
        {busy ? "Création…" : "Créer le bac"}
      </button>
    </div>
  );
}

function Box({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-black ${tone || "text-gray-900"}`}>{value}</p>
    </div>
  );
}
