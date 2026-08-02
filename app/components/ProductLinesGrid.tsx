"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Plus, ScanLine } from "lucide-react";
import ProductSearchSelect, { type ProductHit } from "./ProductSearchSelect";
import { authFetch } from "../lib/api";

/**
 * PHASE 2 — Grille MULTI-PRODUITS réutilisable.
 * Une opération (entrée, sortie, transfert, inventaire, demande, réception)
 * peut contenir 5, 20 ou 50 produits sans 50 formulaires séparés.
 * Chaque ligne embarque ProductSearchSelect (recherche serveur).
 */

export type StockLine = {
  key: string;
  product: ProductHit | null;
  quantity: string;
  unit: string;
  warehouse: string;
  location_code: string;
  unit_price: string;
  observation: string;
};

export type StockLinePayload = {
  product_id: number | null;
  product_reference: string | null;
  product_name: string;
  unit: string | null;
  quantity_requested: number;
  unit_price: number | null;
  warehouse: string | null;
  location_code: string | null;
  observation: string | null;
};

const newLine = (): StockLine => ({
  key: Math.random().toString(36).slice(2),
  product: null, quantity: "", unit: "", warehouse: "", location_code: "", unit_price: "", observation: "",
});

/** Convertit les lignes de la grille en charge utile API (lignes valides seulement). */
export function toPayload(lines: StockLine[]): StockLinePayload[] {
  return lines
    .filter((l) => l.product && Number(l.quantity) > 0)
    .map((l) => ({
      product_id: l.product!.id,
      product_reference: l.product!.reference,
      product_name: l.product!.name,
      unit: l.unit || l.product!.unit || null,
      quantity_requested: Number(l.quantity),
      unit_price: l.unit_price ? Number(l.unit_price) : null,
      warehouse: l.warehouse || null,
      location_code: l.location_code || null,
      observation: l.observation || null,
    }));
}

type Props = {
  lines: StockLine[];
  onChange: (lines: StockLine[]) => void;
  showPrice?: boolean;
  showLocation?: boolean;
  quantityLabel?: string;
  enableScanner?: boolean;
};

export default function ProductLinesGrid({
  lines, onChange, showPrice = true, showLocation = true,
  quantityLabel = "Quantité", enableScanner = true,
}: Props) {
  const [scan, setScan] = useState("");
  const [scanMsg, setScanMsg] = useState("");

  useEffect(() => { if (lines.length === 0) onChange([newLine()]); }, [lines.length, onChange]);

  const update = (key: string, patch: Partial<StockLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () => onChange([...lines, newLine()]);
  const removeLine = (key: string) => onChange(lines.length > 1 ? lines.filter((l) => l.key !== key) : [newLine()]);

  const pick = (key: string, p: ProductHit | null) => {
    // Doublon dans la même opération : on prévient au lieu d'ajouter en silence.
    if (p && lines.some((l) => l.key !== key && l.product?.id === p.id)) {
      if (!window.confirm(`« ${p.name} » est déjà dans cette opération. L'ajouter une seconde fois ?`)) return;
    }
    update(key, { product: p, unit: p?.unit || "", warehouse: p?.warehouse || "" });
  };

  /** Scanner : un code exact ajoute directement l'article à la grille. */
  const onScan = useCallback(async (code: string) => {
    const value = code.trim();
    if (!value) return;
    setScanMsg("Recherche…");
    const res = await authFetch(`/products/search?q=${encodeURIComponent(value)}&limit=2`);
    if (!res.ok) { setScanMsg("Erreur de recherche."); return; }
    const data = await res.json();
    const hit: ProductHit | undefined = (data.items || []).find(
      (p: ProductHit) => p.barcode === value || p.reference === value || p.sku === value
    ) || (data.total === 1 ? data.items[0] : undefined);
    if (!hit) { setScanMsg(`Aucun article exact pour « ${value} ».`); return; }
    const existing = lines.find((l) => l.product?.id === hit.id);
    if (existing) {
      update(existing.key, { quantity: String((Number(existing.quantity) || 0) + 1) });
      setScanMsg(`+1 ${hit.name}`);
    } else {
      const empty = lines.find((l) => !l.product);
      const line: StockLine = { ...(empty || newLine()), product: hit, quantity: "1", unit: hit.unit || "", warehouse: hit.warehouse || "" };
      onChange(empty ? lines.map((l) => (l.key === empty.key ? line : l)) : [...lines, line]);
      setScanMsg(`Ajouté : ${hit.name}`);
    }
    setScan("");
  }, [lines, onChange]);

  const validCount = lines.filter((l) => l.product && Number(l.quantity) > 0).length;

  return (
    <div className="space-y-3">
      {enableScanner && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
          <ScanLine size={18} className="text-slate-600" />
          <input
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onScan(scan); } }}
            placeholder="Scanner ou saisir un code-barres / référence puis Entrée"
            aria-label="Scanner un code-barres"
            className="min-w-[240px] flex-1 rounded-lg border border-gray-300 p-2 text-gray-900"
          />
          {scanMsg && <span className="text-sm font-semibold text-slate-700">{scanMsg}</span>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="p-2 w-8">#</th>
              <th className="p-2 min-w-[260px]">Produit</th>
              <th className="p-2 w-28">{quantityLabel}</th>
              <th className="p-2 w-20">Unité</th>
              <th className="p-2 w-32">Entrepôt</th>
              {showLocation && <th className="p-2 w-28">Emplacement</th>}
              {showPrice && <th className="p-2 w-28">Prix</th>}
              <th className="p-2 min-w-[140px]">Observation</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.key} className="border-t border-gray-100 align-top">
                <td className="p-2 pt-4 text-gray-400">{i + 1}</td>
                <td className="p-2">
                  <ProductSearchSelect value={l.product} onSelect={(p) => pick(l.key, p)} />
                  {l.product && (
                    <p className="mt-1 text-xs text-gray-500">
                      stock actuel : <b>{l.product.stock ?? 0}</b>{l.product.unit ? " " + l.product.unit : ""}
                    </p>
                  )}
                </td>
                <td className="p-2">
                  <input type="number" min="0" step="any" value={l.quantity}
                    onChange={(e) => update(l.key, { quantity: e.target.value })}
                    aria-label={`${quantityLabel} ligne ${i + 1}`}
                    className="w-full rounded-lg border border-gray-300 p-2 text-right text-gray-900" />
                </td>
                <td className="p-2"><input value={l.unit} onChange={(e) => update(l.key, { unit: e.target.value })} className="w-full rounded-lg border border-gray-300 p-2 text-gray-900" /></td>
                <td className="p-2"><input value={l.warehouse} onChange={(e) => update(l.key, { warehouse: e.target.value })} className="w-full rounded-lg border border-gray-300 p-2 text-gray-900" /></td>
                {showLocation && <td className="p-2"><input value={l.location_code} onChange={(e) => update(l.key, { location_code: e.target.value })} className="w-full rounded-lg border border-gray-300 p-2 text-gray-900" /></td>}
                {showPrice && <td className="p-2"><input type="number" min="0" step="any" value={l.unit_price} onChange={(e) => update(l.key, { unit_price: e.target.value })} className="w-full rounded-lg border border-gray-300 p-2 text-right text-gray-900" /></td>}
                <td className="p-2"><input value={l.observation} onChange={(e) => update(l.key, { observation: e.target.value })} className="w-full rounded-lg border border-gray-300 p-2 text-gray-900" /></td>
                <td className="p-2 pt-3">
                  <button type="button" onClick={() => removeLine(l.key)} aria-label={`Supprimer la ligne ${i + 1}`}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={addLine}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
          <Plus size={16} /> Ajouter un produit
        </button>
        <span className="text-sm font-semibold text-gray-600">
          {validCount} produit{validCount > 1 ? "s" : ""} valide{validCount > 1 ? "s" : ""} sur {lines.length} ligne{lines.length > 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

export { newLine };
