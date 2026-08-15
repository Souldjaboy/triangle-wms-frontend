"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import ProductSearchSelect, { type ProductHit } from "../../../components/ProductSearchSelect";
import { WAREHOUSE_CODES, n } from "../shared";

/**
 * SAISIE MANUELLE D'UNE RÉCEPTION.
 *
 * Toutes les réceptions ne viennent pas d'un fichier Excel. Cet écran alimente
 * EXACTEMENT le même modèle que l'import : même service serveur, même bon de
 * réception, même parcours ensuite. Seule la provenance est tracée.
 *
 * Règle absolue rappelée à l'écran : enregistrer une réception ne modifie
 * AUCUN stock. La marchandise est sur le quai, pas dans les rayons. Le stock
 * n'augmente qu'à la mise en stock, écran par écran, ligne par ligne.
 *
 * Le numéro Triangle (BR-AAMMJJ-XXX) est généré par le serveur : il n'est
 * jamais saisi ni deviné ici.
 */

type Draft = {
  key: number;
  product: ProductHit | null;
  label: string;
  quantity: string;
  unit: string;
  warehouseCode: string;
  supplierReference: string;
  notes: string;
};

const emptyLine = (key: number): Draft => ({
  key, product: null, label: "", quantity: "", unit: "EACH",
  warehouseCode: WAREHOUSE_CODES[0], supplierReference: "", notes: "",
});

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function NouvelleReceptionPage() {
  const router = useRouter();
  const [head, setHead] = useState({
    containerNumber: "", receptionDate: today(), supplierName: "",
    supplierReference: "", carrier: "", notes: "",
  });
  const [lines, setLines] = useState<Draft[]>([emptyLine(1)]);
  const [seq, setSeq] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setLine = (key: number, patch: Partial<Draft>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine(seq)]);
    setSeq((s) => s + 1);
  };
  const removeLine = (key: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.key !== key)));

  /* Une ligne est valable dès qu'elle a une désignation et une quantité : le
     produit Triangle n'est PAS obligatoire. Une marchandise peut arriver avant
     que sa fiche existe — la ligne reste alors à vérifier, hors du stock. */
  const filled = useMemo(
    () => lines.filter((l) => String(l.label || l.product?.name || "").trim() && Number(l.quantity) > 0),
    [lines]
  );
  const totals = useMemo(() => {
    const byWarehouse: Record<string, number> = {};
    let quantity = 0, toReview = 0;
    for (const l of filled) {
      const q = Number(l.quantity);
      quantity += q;
      byWarehouse[l.warehouseCode] = (byWarehouse[l.warehouseCode] || 0) + q;
      if (!l.product) toReview += 1;
    }
    return { quantity, byWarehouse, toReview, count: filled.length };
  }, [filled]);

  const save = async () => {
    if (!filled.length) return setError("Ajoutez au moins un produit reçu, avec une quantité.");
    const invalid = lines.find(
      (l) => (String(l.label || l.product?.name || "").trim() || l.quantity) && !filled.includes(l)
    );
    if (invalid) {
      return setError("Une ligne est incomplète : chaque ligne doit avoir une désignation et une quantité supérieure à 0.");
    }
    setError(""); setBusy(true);
    const res = await authFetch("/stock/receptions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...head,
        warehouseCode: filled[0].warehouseCode,
        lines: filled.map((l) => ({
          label: (l.label || l.product?.name || "").trim(),
          productId: l.product?.id || null,
          quantity: Number(l.quantity),
          unit: l.unit || l.product?.unit || "EACH",
          warehouseCode: l.warehouseCode,
          supplierReference: l.supplierReference || null,
          notes: l.notes || null,
        })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d?.error || "Échec de l'enregistrement.");
    router.push(`/stocks/receptions/${d.reception.id}?created=1${d.merged ? "&merged=1" : ""}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/stocks/receptions" className="text-sm font-bold text-blue-700">← Réceptions</Link>
        <h1 className="mt-1 text-2xl font-black text-gray-900 sm:text-3xl">Nouvelle réception</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          Le numéro Triangle <span className="font-bold">BR-AAMMJJ-XXX</span>{" "}
          est attribué automatiquement à l&apos;enregistrement. Enregistrer cette réception{" "}
          <span className="font-bold">ne modifie aucun stock</span> : la marchandise sera comptée
          « en attente de rangement » jusqu&apos;à sa mise en stock.
        </p>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}

        {/* ---------- EN-TÊTE ---------- */}
        <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-gray-900">Réception</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Numéro de conteneur" hint="ex. ABCU 123456/7">
              <input value={head.containerNumber}
                     onChange={(e) => setHead({ ...head, containerNumber: e.target.value.toUpperCase() })}
                     placeholder="ABCU 123456/7" className={INPUT} />
            </Field>
            <Field label="Date de réception">
              <input type="date" value={head.receptionDate}
                     onChange={(e) => setHead({ ...head, receptionDate: e.target.value })} className={INPUT} />
            </Field>
            <Field label="Fournisseur" hint="facultatif">
              <input value={head.supplierName}
                     onChange={(e) => setHead({ ...head, supplierName: e.target.value })} className={INPUT} />
            </Field>
            <Field label="Référence / BL fournisseur" hint="facultatif">
              <input value={head.supplierReference}
                     onChange={(e) => setHead({ ...head, supplierReference: e.target.value })} className={INPUT} />
            </Field>
            <Field label="Transporteur" hint="facultatif">
              <input value={head.carrier}
                     onChange={(e) => setHead({ ...head, carrier: e.target.value })} className={INPUT} />
            </Field>
            <Field label="Notes" hint="facultatif">
              <input value={head.notes}
                     onChange={(e) => setHead({ ...head, notes: e.target.value })} className={INPUT} />
            </Field>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Si ce conteneur a déjà été réceptionné à cette date, les lignes rejoindront la réception
            existante : un conteneur ne donne jamais deux réceptions.
          </p>
        </section>

        {/* ---------- LIGNES ---------- */}
        <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black text-gray-900">Produits reçus</h2>
            <button onClick={addLine} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">
              + Ajouter un produit
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {lines.map((l, i) => (
              <div key={l.key} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase text-gray-500">Ligne {i + 1}</span>
                  {lines.length > 1 && (
                    <button onClick={() => removeLine(l.key)} className="text-xs font-bold text-red-700">
                      Retirer
                    </button>
                  )}
                </div>

                <div className="mt-2">
                  <label className="text-xs font-bold text-gray-700">Produit Triangle existant</label>
                  <ProductSearchSelect
                    value={l.product}
                    onSelect={(p) => setLine(l.key, {
                      product: p,
                      label: p ? p.name : l.label,
                      unit: p?.unit || l.unit,
                      warehouseCode: p?.warehouse && WAREHOUSE_CODES.includes(p.warehouse)
                        ? p.warehouse : l.warehouseCode,
                    })}
                    placeholder="Rechercher un produit… (laissez vide si le produit n'existe pas encore)"
                  />
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Désignation reçue" hint={l.product ? "reprise du produit" : "produit inconnu : à vérifier"}>
                    <input value={l.label} onChange={(e) => setLine(l.key, { label: e.target.value })}
                           placeholder="Libellé exact du document reçu" className={INPUT} />
                  </Field>
                  <Field label="Quantité reçue">
                    <input type="number" min={1} value={l.quantity}
                           onChange={(e) => setLine(l.key, { quantity: e.target.value })} className={INPUT} />
                  </Field>
                  <Field label="Unité">
                    <input value={l.unit} onChange={(e) => setLine(l.key, { unit: e.target.value })} className={INPUT} />
                  </Field>
                  <Field label="Entrepôt destination">
                    <select value={l.warehouseCode}
                            onChange={(e) => setLine(l.key, { warehouseCode: e.target.value })} className={INPUT}>
                      {WAREHOUSE_CODES.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </Field>
                  <Field label="Référence fournisseur" hint="facultatif">
                    <input value={l.supplierReference}
                           onChange={(e) => setLine(l.key, { supplierReference: e.target.value })} className={INPUT} />
                  </Field>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Field label="Notes" hint="facultatif">
                      <input value={l.notes} onChange={(e) => setLine(l.key, { notes: e.target.value })} className={INPUT} />
                    </Field>
                  </div>
                </div>

                {!l.product && String(l.label).trim() && (
                  <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                    Aucun produit Triangle choisi : cette ligne sera enregistrée <span className="font-bold">à vérifier</span>.
                    Elle fait partie de la réception mais <span className="font-bold">pas du stock disponible</span>, et
                    ne pourra être rangée qu&apos;après confirmation du produit.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ---------- RÉSUMÉ ET ENREGISTREMENT ---------- */}
        <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Box label="Lignes" value={n(totals.count)} />
            <Box label="Quantité reçue" value={n(totals.quantity)} />
            <Box label="Entrepôts"
                 value={Object.keys(totals.byWarehouse).join(", ") || "—"} />
            <Box label="Impact stock" value="0" tone="text-green-700" />
          </div>
          {Object.keys(totals.byWarehouse).length > 1 && (
            <p className="mt-3 rounded-lg bg-blue-50 p-2 text-xs text-blue-900">
              Réception multi-entrepôts : {Object.entries(totals.byWarehouse).map(([w, q]) => `${w} ${n(q)}`).join(" · ")}.
              Elle restera <span className="font-bold">une seule réception</span>, chaque ligne portant sa destination.
            </p>
          )}
          {totals.toReview > 0 && (
            <p className="mt-2 text-xs text-amber-800">
              {totals.toReview} ligne(s) sans produit Triangle seront enregistrées à vérifier.
            </p>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Link href="/stocks/receptions" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700">
              Annuler
            </Link>
            <button onClick={save} disabled={busy || !filled.length}
                    className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {busy ? "Enregistrement…" : "Enregistrer la réception"}
            </button>
          </div>
          <p className="mt-2 text-right text-xs text-gray-500">
            Le stock disponible restera inchangé après cet enregistrement.
          </p>
        </section>
      </div>
    </div>
  );
}

const INPUT = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-gray-700">{label}</span>
      {hint && <span className="ml-1 text-xs font-normal text-gray-400">({hint})</span>}
      {children}
    </label>
  );
}

function Box({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`truncate text-lg font-black ${tone || "text-gray-900"}`}>{value}</p>
    </div>
  );
}
