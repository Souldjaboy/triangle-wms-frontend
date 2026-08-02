"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authFetch } from "../lib/api";

/**
 * PHASE 1 — Sélecteur de produit à recherche serveur.
 *
 * Ne charge JAMAIS le catalogue complet : chaque frappe interroge
 * /products/search (debounce 250 ms, 20 résultats, pagination « Charger plus »).
 * Recherche multi-mots, insensible casse/accents : « plaf met d » trouve
 * « FAUX PLAFOND MÉTALLIQUE D ».
 * Navigation clavier ↑ ↓ Entrée Échap + souris.
 */

export type ProductHit = {
  id: number;
  reference: string | null;
  name: string;
  category: string | null;
  unit: string | null;
  stock: number | null;
  warehouse: string | null;
  location_code: string | null;
  barcode: string | null;
  sku: string | null;
  sale_price: string | number | null;
};

type Props = {
  value?: ProductHit | null;
  onSelect: (product: ProductHit | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
};

const LIMIT = 20;

export default function ProductSearchSelect({
  value = null, onSelect, placeholder = "Rechercher un produit (nom, référence, code-barres…)",
  autoFocus = false, disabled = false, className = "",
}: Props) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ProductHit[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [offset, setOffset] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  const search = useCallback(async (q: string, nextOffset: number, append: boolean) => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, limit: String(LIMIT), offset: String(nextOffset) });
      const res = await authFetch(`/products/search?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (id !== reqId.current) return; // réponse obsolète (course) -> ignorée
      setItems((prev) => (append ? [...prev, ...(data.items || [])] : data.items || []));
      setTotal(data.total || 0);
      setHighlight(append ? highlight : 0);
    } catch { /* réseau : on garde l'état précédent */ }
    finally { if (id === reqId.current) setLoading(false); }
  }, [highlight]);

  // Debounce 250 ms sur la saisie.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { setOffset(0); search(query, 0, false); }, 250);
    return () => clearTimeout(t);
  }, [query, open, search]);

  // Fermeture au clic extérieur.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const choose = (p: ProductHit) => { onSelect(p); setOpen(false); setQuery(""); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) { setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[highlight]) choose(items[highlight]); }
    else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  };

  const label = useMemo(() => (value ? `${value.reference ? value.reference + " — " : ""}${value.name}` : ""), [value]);

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      {value && !open ? (
        <button
          type="button" disabled={disabled}
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white p-3 text-left text-gray-900 disabled:opacity-60"
        >
          <span className="truncate">
            <span className="font-semibold">{label}</span>
            {value.stock != null && <span className="ml-2 text-xs text-gray-500">stock {value.stock}{value.unit ? " " + value.unit : ""}</span>}
          </span>
          <span className="ml-2 shrink-0 text-xs text-blue-700">changer</span>
        </button>
      ) : (
        <input
          ref={inputRef} type="text" value={query} disabled={disabled} autoFocus={autoFocus}
          placeholder={placeholder} aria-label="Rechercher un produit" autoComplete="off"
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-xl border border-gray-300 p-3 text-gray-900 disabled:opacity-60"
        />
      )}

      {open && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
          {loading && items.length === 0 && <p className="p-3 text-sm text-gray-500">Recherche…</p>}
          {!loading && items.length === 0 && (
            <p className="p-3 text-sm text-gray-500">{query ? "Aucun produit trouvé." : "Tapez pour rechercher un produit."}</p>
          )}
          <ul role="listbox">
            {items.map((p, i) => (
              <li key={p.id} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(p)}
                  className={`flex w-full items-center justify-between gap-3 p-2.5 text-left ${i === highlight ? "bg-yellow-50" : "hover:bg-gray-50"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-gray-900">{p.name}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {p.reference || p.sku || "—"}
                      {p.category ? ` · ${p.category}` : ""}
                      {p.warehouse ? ` · ${p.warehouse}` : ""}
                      {p.location_code ? ` · ${p.location_code}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block text-sm font-black ${Number(p.stock) > 0 ? "text-gray-900" : "text-red-600"}`}>
                      {p.stock ?? 0}
                    </span>
                    <span className="block text-xs text-gray-500">{p.unit || ""}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {items.length > 0 && items.length < total && (
            <button
              type="button"
              onClick={() => { const n = offset + LIMIT; setOffset(n); search(query, n, true); }}
              className="w-full border-t border-gray-100 p-2 text-sm font-bold text-blue-700 hover:bg-gray-50"
            >
              Charger plus ({items.length}/{total})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
