"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import BinSelector, { useBinTree, type Bin } from "../../../components/BinSelector";

/**
 * CRÉATION D'UN PRODUIT AVEC SON STOCK INITIAL LOCALISÉ.
 *
 * Le stock initial peut être réparti sur plusieurs bacs dès la création. La
 * somme des lignes doit être exactement égale au stock initial — sinon refus,
 * ici comme côté serveur.
 *
 * Sans emplacement, le produit est créé avec son stock mais reste à localiser :
 * aucune balance n'est inventée pour lui faire une place quelque part.
 */

type Ligne = { key: number; bin: Bin | null; quantity: string };
const n = (v: unknown) => Number(v || 0).toLocaleString("fr-FR");
const INPUT = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

export default function NouveauProduitPage() {
  const router = useRouter();
  const { tree, reload } = useBinTree();
  const [f, setF] = useState({ name: "", reference: "", unit: "EACH", category: "", stock: "" });
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [seq, setSeq] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const stock = Number(f.stock || 0);
  const total = lignes.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const ecart = total - stock;
  const doublon = new Set(lignes.filter((l) => l.bin).map((l) => l.bin!.id)).size
    !== lignes.filter((l) => l.bin).length;
  const incompletes = lignes.filter((l) => !l.bin || !(Number(l.quantity) > 0));
  const valide = f.name.trim() && stock >= 0 && !doublon
    && (lignes.length === 0 || (ecart === 0 && incompletes.length === 0));

  const creer = async () => {
    setBusy(true); setError("");
    const r = await authFetch("/stock/products/with-locations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...f, stock,
        allocations: lignes.map((l) => ({ locationId: l.bin!.id, quantity: Number(l.quantity) })),
      }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d?.error || "Échec de la création.");
    await reload();
    router.push(`/stocks/produits/${d.product.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/stocks/repartition" className="text-sm font-bold text-blue-700">← Répartition</Link>
        <h1 className="mt-1 text-2xl font-black text-gray-900 sm:text-3xl">Nouveau produit</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Le stock initial peut être réparti sur plusieurs bacs dès la création. Sans emplacement,
          le produit est créé avec son stock mais reste <span className="font-bold">à localiser</span>.
        </p>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}

        <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-bold text-gray-700">Nom du produit
              <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={INPUT} />
            </label>
            <label className="text-xs font-bold text-gray-700">Référence <span className="font-normal text-gray-400">(facultative)</span>
              <input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={INPUT} />
            </label>
            <label className="text-xs font-bold text-gray-700">Unité
              <input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className={INPUT} />
            </label>
            <label className="text-xs font-bold text-gray-700">Catégorie <span className="font-normal text-gray-400">(facultative)</span>
              <input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={INPUT} />
            </label>
            <label className="text-xs font-bold text-gray-700">Stock initial
              <input type="number" min={0} value={f.stock}
                     onChange={(e) => setF({ ...f, stock: e.target.value })} className={INPUT} />
            </label>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black text-gray-900">Emplacement du stock initial</h2>
            <button onClick={() => { setLignes((p) => [...p, { key: seq, bin: null, quantity: "" }]); setSeq((x) => x + 1); }}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">
              + Ajouter un emplacement
            </button>
          </div>

          {!lignes.length && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Aucun emplacement : le produit sera créé avec {n(stock)} unité(s) en attente de
              localisation. Vous pourrez le répartir plus tard.
            </p>
          )}

          <div className="mt-3 space-y-3">
            {lignes.map((l, i) => (
              <div key={l.key} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase text-gray-500">Emplacement {i + 1}</span>
                  <button onClick={() => setLignes((p) => p.filter((x) => x.key !== l.key))}
                          className="text-xs font-bold text-red-700">Retirer</button>
                </div>
                <div className="mt-2">
                  <BinSelector tree={tree} value={l.bin} label=""
                               onSelect={(bin) => setLignes((p) => p.map((x) => x.key === l.key ? { ...x, bin } : x))}
                               compact />
                </div>
                <label className="mt-2 block text-xs font-bold text-gray-700">Quantité dans ce bac
                  <input type="number" min={1} value={l.quantity}
                         onChange={(e) => setLignes((p) => p.map((x) => x.key === l.key ? { ...x, quantity: e.target.value } : x))}
                         className="mt-1 w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </label>
              </div>
            ))}
          </div>

          {lignes.length > 0 && (
            <div className={`mt-4 rounded-xl p-4 ${ecart === 0 ? "bg-green-50" : "bg-amber-50"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-gray-800">
                  Somme répartie <span className="text-lg font-black">{n(total)}</span> ·
                  stock initial <span className="text-lg font-black">{n(stock)}</span>
                </p>
                <p className={`text-sm font-black ${ecart === 0 ? "text-green-800" : "text-amber-900"}`}>
                  {ecart === 0 ? "écart 0 — répartition complète"
                    : ecart > 0 ? `${n(ecart)} de trop` : `${n(-ecart)} manquante(s)`}
                </p>
              </div>
              {doublon && (
                <p className="mt-2 text-sm font-semibold text-red-800">
                  Le même emplacement apparaît deux fois : regroupez la quantité sur une seule ligne.
                </p>
              )}
            </div>
          )}
        </section>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Link href="/stocks/repartition" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700">
            Annuler
          </Link>
          <button onClick={creer} disabled={!valide || busy}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {busy ? "Création…" : "Créer le produit"}
          </button>
        </div>
      </div>
    </div>
  );
}
