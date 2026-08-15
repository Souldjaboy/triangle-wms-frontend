"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";

/**
 * SÉLECTEUR D'EMPLACEMENT EN CASCADE.
 *
 * Entrepôt → Rayon → Location → Level → BIN. Chaque niveau ne propose que ce
 * qui existe SOUS le niveau choisi : un bin d'un autre rayon n'apparaît jamais.
 *
 * L'arborescence vient du serveur, qui n'y met que les bacs exploitables. Les
 * emplacements de rebut, les bins non précisés, les plages « BIN1-2 » et les
 * composantes générées en sont absents — ils ne sont pas des destinations.
 */

export type Bin = {
  id: number; bin: string; code: string;
  quantity: number; reserved: number; available: number;
  status: "EMPTY" | "OCCUPIED";
};
type Tree = Record<string, Record<string, Record<string, Record<string, Bin[]>>>>;

const n = (v: unknown) => Number(v || 0).toLocaleString("fr-FR");
const SELECT = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400";

export function useBinTree() {
  const [tree, setTree] = useState<Tree>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await authFetch("/stock/locations/tree", { cache: "no-store" });
    if (r.ok) setTree((await r.json()).tree || {});
    else setError("Erreur de chargement des emplacements.");
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return { tree, loading, error, reload: load };
}

export default function BinSelector({
  tree, value, onSelect, label = "Emplacement", disabled = false, compact = false,
}: {
  tree: Tree;
  value: Bin | null;
  onSelect: (bin: Bin | null) => void;
  label?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [w, setW] = useState("");
  const [r, setR] = useState("");
  const [l, setL] = useState("");
  const [lv, setLv] = useState("");

  /* Un emplacement choisi ailleurs (ou rechargé) repositionne les sélecteurs,
     sinon l'écran afficherait un bin sans son chemin. */
  useEffect(() => {
    if (!value) return;
    for (const [kw, rows] of Object.entries(tree)) {
      for (const [kr, locs] of Object.entries(rows)) {
        for (const [kl, levels] of Object.entries(locs)) {
          for (const [klv, bins] of Object.entries(levels)) {
            if (bins.some((b) => b.id === value.id)) {
              setW(kw); setR(kr); setL(kl); setLv(klv);
              return;
            }
          }
        }
      }
    }
  }, [value, tree]);

  const entrepots = useMemo(() => Object.keys(tree).sort(), [tree]);
  const rayons = useMemo(() => (w && tree[w] ? Object.keys(tree[w]).sort() : []), [tree, w]);
  const locations = useMemo(
    () => (w && r && tree[w]?.[r] ? Object.keys(tree[w][r]).sort() : []), [tree, w, r]);
  const levels = useMemo(
    () => (w && r && l && tree[w]?.[r]?.[l] ? Object.keys(tree[w][r][l]).sort() : []), [tree, w, r, l]);
  const bins: Bin[] = useMemo(
    () => (w && r && l && lv ? tree[w]?.[r]?.[l]?.[lv] || [] : []), [tree, w, r, l, lv]);

  /* Changer un niveau invalide tout ce qui est en dessous : on ne garde jamais
     un bin qui n'appartient plus au chemin affiché. */
  const set = (niveau: "w" | "r" | "l" | "lv", v: string) => {
    onSelect(null);
    if (niveau === "w") { setW(v); setR(""); setL(""); setLv(""); }
    if (niveau === "r") { setR(v); setL(""); setLv(""); }
    if (niveau === "l") { setL(v); setLv(""); }
    if (niveau === "lv") setLv(v);
  };

  const grille = compact ? "grid gap-2 sm:grid-cols-5" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-5";

  return (
    <div>
      {label && <p className="text-xs font-bold text-gray-700">{label}</p>}
      <div className={grille}>
        <label className="block text-xs text-gray-500">Entrepôt
          <select value={w} disabled={disabled} onChange={(e) => set("w", e.target.value)} className={SELECT}>
            <option value="">—</option>
            {entrepots.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="block text-xs text-gray-500">Rayon / ROW
          <select value={r} disabled={disabled || !w} onChange={(e) => set("r", e.target.value)} className={SELECT}>
            <option value="">—</option>
            {rayons.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="block text-xs text-gray-500">Location
          <select value={l} disabled={disabled || !r} onChange={(e) => set("l", e.target.value)} className={SELECT}>
            <option value="">—</option>
            {locations.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="block text-xs text-gray-500">Level
          <select value={lv} disabled={disabled || !l} onChange={(e) => set("lv", e.target.value)} className={SELECT}>
            <option value="">—</option>
            {levels.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="block text-xs text-gray-500">BIN
          <select value={value?.id || ""} disabled={disabled || !lv}
                  onChange={(e) => onSelect(bins.find((b) => String(b.id) === e.target.value) || null)}
                  className={SELECT}>
            <option value="">—</option>
            {bins.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bin} — {b.status === "EMPTY" ? "VIDE" : `OCCUPÉ ${n(b.quantity)}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {value && (
        <p className="mt-1 text-xs text-gray-600">
          <span className="font-bold">{value.code}</span> — {value.status === "EMPTY" ? "vide" : "occupé"} ·
          quantité {n(value.quantity)} · réservé {n(value.reserved)} ·
          <span className="font-bold"> disponible {n(value.available)}</span>
        </p>
      )}
    </div>
  );
}
