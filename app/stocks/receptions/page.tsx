"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";
import { ReceptionRow, STATUS_TONE, n, fdate } from "./shared";

/**
 * RÉCEPTIONS CONTENEUR.
 *
 * Une réception est une marchandise ARRIVÉE, pas une marchandise DISPONIBLE.
 * L'écran sépare donc systématiquement « reçu », « rangé » et « reste à
 * ranger » : seule la mise en stock rend la marchandise disponible.
 *
 * L'analyse du fichier Excel n'écrit rien et peut être relancée sans risque ;
 * l'import ne crée que des réceptions, aucun mouvement de stock.
 */

type PreviewLine = {
  label: string; warehouse: string; quantity: number; unit: string;
  productId: number | null; productName: string | null;
  matchStatus: string; reviewReason: string | null;
};
type PreviewReception = {
  container: string | null; containerRaw: string | null; date: string | null;
  warehouses: Record<string, number>; lineCount: number; quantity: number;
  toReview: number; alreadyImported: string | null; status: string | null;
  lines: PreviewLine[];
};
type Preview = {
  fileName: string;
  receptions: PreviewReception[];
  totals: { receptions: number; lines: number; quantity: number; multiWarehouse: number; stockImpact: number };
};

export default function ReceptionsPage() {
  const { can } = usePermissions();
  const [rows, setRows] = useState<ReceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canImport = can("stock", "create");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await authFetch("/stock/receptions", { cache: "no-store" });
    if (r.ok) setRows(await r.json());
    else setError("Erreur de chargement des réceptions.");
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const warehouses = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => String(r.warehouses || "").split(",").map((w) => w.trim()).filter(Boolean).forEach((w) => set.add(w)));
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (warehouseFilter && !String(r.warehouses || "").includes(warehouseFilter)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${r.reception_number} ${r.container_number || ""} ${r.source || ""}`.toLowerCase().includes(q);
  }), [rows, query, statusFilter, warehouseFilter]);

  /* Une réception annulée n'attend plus rien : ses quantités sortent des
     totaux, sans quoi l'écran annoncerait un travail de rangement qui n'existe
     pas. Elle reste visible dans la liste, pour l'historique. */
  const totals = useMemo(() => filtered
    .filter((r) => r.status !== "CANCELLED")
    .reduce((acc, r) => ({
      received: acc.received + Number(r.quantity_received || 0),
      putaway: acc.putaway + Number(r.quantity_putaway || 0),
      pending: acc.pending + Number(r.quantity_pending || 0),
      review: acc.review + Number(r.to_review || 0),
    }), { received: 0, putaway: 0, pending: 0, review: 0 }), [filtered]);

  const analyse = async () => {
    if (!file) return setError("Choisissez d'abord un fichier.");
    setError(""); setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await authFetch("/stock/receptions/import-preview", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d?.error || "Échec de l'analyse.");
    setPreview(d);
  };

  const runImport = async () => {
    if (!file || !preview) return;
    setError(""); setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await authFetch("/stock/receptions/import", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(d?.error || "Échec de l'import.");
    setNotice(
      `${d.created.length} réception(s) créée(s), ${d.skipped.length} déjà présente(s) et ignorée(s). ` +
      `Aucun stock modifié : les marchandises sont en attente de mise en stock.`
    );
    setImportOpen(false); setPreview(null); setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    await load();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/stocks" className="text-sm font-bold text-blue-700">← Stocks</Link>
            <h1 className="mt-1 text-2xl font-black text-gray-900 sm:text-3xl">Réceptions conteneur</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">
              Conteneur reçu → réception → contrôle → emplacement → mise en stock → stock disponible.
              Une réception ne modifie aucun stock : seule la mise en stock le fait.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/stocks/entrepots" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800">
              Entrepôts
            </Link>
            {canImport && (
              <>
                {/* Deux moyens d'alimenter le MÊME modèle : saisie et import. */}
                <Link href="/stocks/receptions/new"
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">
                  + Nouvelle réception
                </Link>
                <button onClick={() => setImportOpen((v) => !v)}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">
                  {importOpen ? "Fermer l'import" : "Importer les réceptions Excel"}
                </button>
              </>
            )}
          </div>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
        {notice && (
          <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">
            {notice} <button onClick={() => setNotice("")} className="underline">fermer</button>
          </p>
        )}

        {/* ---------- IMPORT EXCEL ---------- */}
        {importOpen && canImport && (
          <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black text-gray-900">Import des réceptions depuis Excel</h2>
            <p className="mt-1 text-sm text-gray-600">
              L&apos;analyse n&apos;écrit rien. L&apos;import crée les réceptions et leurs lignes —
              <span className="font-bold"> aucun mouvement de stock n&apos;est généré</span>.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input ref={fileRef} type="file" accept=".xlsx,.xls"
                     onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); }}
                     className="text-sm" />
              <button onClick={analyse} disabled={!file || busy}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
                {busy ? "Analyse…" : "Analyser le fichier"}
              </button>
            </div>

            {preview && (
              <div className="mt-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <Box label="Réceptions" value={n(preview.totals.receptions)} />
                  <Box label="Lignes" value={n(preview.totals.lines)} />
                  <Box label="Quantité reçue" value={n(preview.totals.quantity)} />
                  <Box label="Multi-entrepôts" value={n(preview.totals.multiWarehouse)} />
                  <Box label="Impact stock" value={n(preview.totals.stockImpact)} tone="text-green-700" />
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="p-2">Conteneur</th><th className="p-2">Date</th>
                        <th className="p-2">Entrepôts</th><th className="p-2 text-right">Lignes</th>
                        <th className="p-2 text-right">Quantité</th><th className="p-2 text-right">À vérifier</th>
                        <th className="p-2">État</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.receptions.map((g, i) => (
                        <tr key={i}>
                          <td className="p-2 font-bold">{g.container || <span className="text-amber-700">conteneur illisible</span>}</td>
                          <td className="p-2">{fdate(g.date)}</td>
                          <td className="p-2 text-xs">
                            {Object.entries(g.warehouses).map(([w, q]) => `${w} : ${n(q)}`).join(" · ")}
                          </td>
                          <td className="p-2 text-right">{n(g.lineCount)}</td>
                          <td className="p-2 text-right font-bold">{n(g.quantity)}</td>
                          <td className="p-2 text-right">{g.toReview ? <span className="font-bold text-amber-700">{n(g.toReview)}</span> : "—"}</td>
                          <td className="p-2">
                            {g.alreadyImported
                              ? <span className="rounded-full bg-gray-200 px-2 py-1 text-xs font-bold text-gray-700">déjà importée ({g.alreadyImported})</span>
                              : <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800">à créer</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={runImport} disabled={busy}
                        className="mt-4 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                  {busy ? "Import en cours…" : `Créer les ${preview.receptions.filter((g) => !g.alreadyImported).length} réception(s)`}
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  Les réceptions déjà enregistrées seront ignorées : un rejeu ne peut pas créer de doublon.
                </p>
              </div>
            )}
          </section>
        )}

        {/* ---------- FILTRES ---------- */}
        <section className="mt-4 flex flex-wrap items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Rechercher un n° de réception ou un conteneur…"
                 className="min-w-[240px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Tous les statuts</option>
            <option value="RECEIVED_PENDING_PUTAWAY">En attente de mise en stock</option>
            <option value="PARTIALLY_PUTAWAY">Mise en stock partielle</option>
            <option value="PUTAWAY_COMPLETED">Mise en stock terminée</option>
          </select>
          <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Tous les entrepôts</option>
            {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Box label="Quantité reçue" value={n(totals.received)} />
          <Box label="Rangée en stock" value={n(totals.putaway)} tone="text-green-700" />
          <Box label="En attente de rangement" value={n(totals.pending)} tone="text-amber-700" />
          <Box label="Lignes à vérifier" value={n(totals.review)} tone="text-amber-700" />
        </div>

        {/* ---------- TABLEAU (desktop) ---------- */}
        <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3">N° réception</th><th className="p-3">Conteneur</th>
                <th className="p-3">Date</th><th className="p-3">Entrepôts desservis</th>
                <th className="p-3 text-right">Lignes</th><th className="p-3 text-right">Reçu</th>
                <th className="p-3 text-right">Rangé</th><th className="p-3 text-right">Reste</th>
                <th className="p-3">Statut</th><th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && <tr><td colSpan={10} className="p-6 text-center text-gray-500">Chargement…</td></tr>}
              {!loading && !filtered.length && (
                <tr><td colSpan={10} className="p-6 text-center text-gray-500">Aucune réception.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <p className="font-bold text-gray-900">{r.reception_number}</p>
                    <p className="text-[11px] text-gray-500">{r.source_label || "—"}</p>
                  </td>
                  <td className="p-3">{r.container_number || "—"}</td>
                  <td className="p-3">{fdate(r.reception_date)}</td>
                  <td className="p-3 text-xs">{r.warehouses || "—"}</td>
                  <td className="p-3 text-right">{n(r.line_count)}</td>
                  <td className="p-3 text-right font-bold">{n(r.quantity_received)}</td>
                  <td className="p-3 text-right text-green-700">{n(r.quantity_putaway)}</td>
                  {/* Une réception annulée n'a plus de reste à ranger. */}
                  <td className={`p-3 text-right font-bold ${r.status === "CANCELLED" ? "text-gray-400" : "text-amber-700"}`}>
                    {r.status === "CANCELLED" ? "—" : n(r.quantity_pending)}
                  </td>
                  <td className="p-3">
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[r.status] || "bg-gray-100 text-gray-700"}`}>
                      {r.status_label}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2 whitespace-nowrap text-xs font-bold">
                      <Link href={`/stocks/receptions/${r.id}`} className="text-blue-700">Voir</Link>
                      <Link href={`/stocks/receptions/${r.id}#mise-en-stock`} className="text-slate-900">Mettre en stock</Link>
                      <Link href={`/stocks/receptions/${r.id}/print`} className="text-gray-600">Bon</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---------- CARTES (mobile) ---------- */}
        <div className="mt-4 space-y-3 md:hidden">
          {loading && <p className="text-center text-gray-500">Chargement…</p>}
          {!loading && !filtered.length && <p className="text-center text-gray-500">Aucune réception.</p>}
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-black text-gray-900">{r.reception_number}</p>
                  <p className="text-sm text-gray-600">{r.container_number || "sans conteneur"} · {fdate(r.reception_date)}</p>
                </div>
                <span className={`whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold ${STATUS_TONE[r.status] || "bg-gray-100 text-gray-700"}`}>
                  {r.status_label}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">Entrepôts : {r.warehouses || "—"}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-gray-50 p-2"><p className="text-[11px] text-gray-500">Reçu</p><p className="font-black">{n(r.quantity_received)}</p></div>
                <div className="rounded-lg bg-gray-50 p-2"><p className="text-[11px] text-gray-500">Rangé</p><p className="font-black text-green-700">{n(r.quantity_putaway)}</p></div>
                <div className="rounded-lg bg-gray-50 p-2"><p className="text-[11px] text-gray-500">Reste</p>
                  <p className={`font-black ${r.status === "CANCELLED" ? "text-gray-400" : "text-amber-700"}`}>
                    {r.status === "CANCELLED" ? "—" : n(r.quantity_pending)}
                  </p></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
                <Link href={`/stocks/receptions/${r.id}`} className="text-blue-700">Voir</Link>
                <Link href={`/stocks/receptions/${r.id}#mise-en-stock`} className="text-slate-900">Mettre en stock</Link>
                <Link href={`/stocks/receptions/${r.id}/print`} className="text-gray-600">Bon de réception</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
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
