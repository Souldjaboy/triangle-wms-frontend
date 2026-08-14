"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";
import { n } from "../receptions/shared";

/**
 * SITUATION PAR ENTREPÔT.
 *
 * Le stock disponible et la quantité en attente de rangement sont affichés dans
 * deux colonnes DISTINCTES et ne sont jamais additionnés : une marchandise
 * encore sur le quai n'est pas du stock disponible. Un entrepôt sur lequel
 * aucune mise en stock n'a été faite reste donc à 0.
 */

type WarehouseRow = {
  id: number; code: string; name: string | null; status: string | null;
  stock_available: string; product_count: number;
  quantity_putaway: string; quantity_pending: string; receptions_pending: number;
};

type Dashboard = {
  stock_available: string; receptions_pending: number; receptions_partial: number;
  quantity_pending: string;
};

export default function EntrepotsPage() {
  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await authFetch("/stock/warehouses/summary", { cache: "no-store" });
    if (r.ok) setRows(await r.json());
    else setError("Erreur de chargement des entrepôts.");
    const d = await authFetch("/stock/receptions/dashboard", { cache: "no-store" });
    if (d.ok) setDashboard(await d.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Les quantités s'additionnent d'un entrepôt à l'autre — chaque ligne n'a
     qu'une destination. Le NOMBRE de réceptions, lui, ne s'additionne pas :
     une réception desservant deux entrepôts serait comptée deux fois. Il vient
     donc du décompte global, pas de la somme des colonnes. */
  const totals = useMemo(() => ({
    available: rows.reduce((s, w) => s + Number(w.stock_available || 0), 0),
    pending: rows.reduce((s, w) => s + Number(w.quantity_pending || 0), 0),
    receptions: dashboard
      ? Number(dashboard.receptions_pending) + Number(dashboard.receptions_partial)
      : null,
  }), [rows, dashboard]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/stocks" className="text-sm font-bold text-blue-700">← Stocks</Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 sm:text-3xl">Entrepôts</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              Le stock disponible et la quantité en attente de rangement sont deux grandeurs
              distinctes. Elles ne sont jamais additionnées.
            </p>
          </div>
          <Link href="/stocks/receptions" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800">
            Réceptions
          </Link>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Box label="Stock disponible (tous entrepôts)" value={n(totals.available)} tone="text-green-700" />
          <Box label="En attente de rangement" value={n(totals.pending)} tone="text-amber-700" />
          <Box label="Réceptions à ranger" value={totals.receptions == null ? "—" : n(totals.receptions)} tone="text-amber-700" />
        </div>

        {loading && <p className="mt-6 text-gray-500">Chargement…</p>}
        {!loading && !rows.length && (
          <p className="mt-6 rounded-2xl bg-white p-8 text-center text-gray-500 shadow-sm">Aucun entrepôt.</p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((w) => (
            <div key={w.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-black text-gray-900">{w.code}</p>
                  {w.name && w.name !== w.code && <p className="text-sm text-gray-600">{w.name}</p>}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  String(w.status || "").toLowerCase().startsWith("act")
                    ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                  {w.status || "—"}
                </span>
              </div>

              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Stock disponible" value={n(w.stock_available)} tone="text-green-700" />
                <Row label="Produits référencés" value={n(w.product_count)} />
                <Row label="Quantité rangée ici" value={n(w.quantity_putaway)} />
                <Row label="En attente de rangement" value={n(w.quantity_pending)} tone="text-amber-700" />
                <Row label="Réceptions desservant cet entrepôt" value={n(w.receptions_pending)} tone="text-amber-700" />
              </dl>

              {Number(w.quantity_pending) > 0 && (
                <Link href="/stocks/receptions" className="mt-3 inline-block text-sm font-bold text-blue-700">
                  Voir les réceptions à ranger →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Box({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-black ${tone || "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function Row({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-1">
      <dt className="text-gray-600">{label}</dt>
      <dd className={`font-black ${tone || "text-gray-900"}`}>{value}</dd>
    </div>
  );
}
