"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "../lib/api";
import { usePermissions } from "../lib/permissions";
import ProductLinesGrid, { newLine, toPayload, type StockLine } from "../components/ProductLinesGrid";

/**
 * PHASES 2-4 + 11 — Demandes stock multi-produits.
 * Le stock n'est JAMAIS modifié ici : ni à la création, ni à la validation.
 * Il ne bouge qu'à la confirmation de réception (bouton « Confirmer »).
 * Boutons pilotés par le RBAC (can()) — miroir exact du backend.
 */

type Request = {
  id: number; reference: string; request_type: string; status: string; supplier_name: string | null;
  source_warehouse: string | null; target_warehouse: string | null; lines_count: number;
  requested_by_name: string; validated_by_name: string; requested_at: string; reject_reason: string | null;
};
type Line = {
  id: number; line_no: number; product_name: string; product_reference: string | null; unit: string | null;
  quantity_requested: string; quantity_received: string; observation: string | null;
};
type Detail = Request & { lines: Line[]; document: { id: number; doc_number: string; status: string; print_count: number } | null };

const TYPES = [
  { key: "entree", label: "Demande d'entrée" },
  { key: "sortie", label: "Demande de sortie" },
  { key: "transfert", label: "Transfert" },
  { key: "inventaire", label: "Inventaire" },
];
const STATUS_COLOR: Record<string, string> = {
  BROUILLON: "bg-gray-200 text-gray-700", EN_ATTENTE: "bg-amber-100 text-amber-800",
  VALIDEE: "bg-blue-100 text-blue-800", REFUSEE: "bg-red-100 text-red-800",
  PARTIELLEMENT_RECUE: "bg-orange-100 text-orange-800", RECUE: "bg-green-100 text-green-800",
  ANNULEE: "bg-gray-300 text-gray-600",
};
const fmt = (d: string) => new Date(d).toLocaleDateString("fr-FR");

export default function DemandesStockPage() {
  const { can } = usePermissions();
  const [items, setItems] = useState<Request[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [lines, setLines] = useState<StockLine[]>([newLine()]);
  const [head, setHead] = useState({ request_type: "entree", supplier_name: "", source_warehouse: "", target_warehouse: "", motif: "" });

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    const res = await authFetch(`/stock-requests?${p.toString()}`);
    if (res.ok) setItems(await res.json());
  }, [status, q]);

  useEffect(() => { load(); }, [load]);

  const payload = useMemo(() => toPayload(lines), [lines]);

  const create = async (submit: boolean) => {
    setMsg("");
    if (payload.length === 0) return setMsg("Ajoutez au moins un produit avec une quantité.");
    setBusy(true);
    const res = await authFetch("/stock-requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...head, submit, lines: payload }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(data?.error || "Erreur.");
    setMsg(`✅ ${data.reference} créée avec ${data.lines_count} produit(s). Le stock n'est pas encore modifié.`);
    setLines([newLine()]); setShowForm(false); await load();
  };

  const act = async (id: number, action: string, body?: Record<string, unknown>) => {
    setBusy(true); setMsg("");
    const res = await authFetch(`/stock-requests/${id}/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(`❌ ${data?.error || "Erreur."}`); return; }
    if (action === "confirm") setMsg(`✅ Réception confirmée : ${data.moved_lines} ligne(s), stock mis à jour. Bon ${data.document?.doc_number || ""}`);
    else setMsg(`✅ Demande ${data.status}. ${action === "validate" ? "Le stock n'est pas encore modifié." : ""}`);
    await load();
    if (detail?.id === id) await openDetail(id);
  };

  const openDetail = async (id: number) => {
    const res = await authFetch(`/stock-requests/${id}`);
    if (res.ok) setDetail(await res.json());
  };

  const reject = async (id: number) => {
    const reason = window.prompt("Motif du refus (obligatoire) :");
    if (!reason) return;
    await act(id, "reject", { reason });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-yellow-600">TRIANGLE WMS PRO</p>
            <h1 className="text-3xl font-black text-gray-900">Demandes stock</h1>
          </div>
          <div className="flex gap-2">
            {can("stock", "create") && (
              <button onClick={() => setShowForm((v) => !v)} className="rounded-xl bg-yellow-500 px-4 py-2 font-black text-black hover:bg-yellow-400">
                + Nouvelle demande
              </button>
            )}
            <Link href="/dashboard" className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">← Tableau de bord</Link>
          </div>
        </div>

        {msg && <div className="rounded-xl bg-blue-50 p-4 font-semibold text-blue-900">{msg}</div>}

        {showForm && can("stock", "create") && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-black text-gray-900">Nouvelle demande (multi-produits)</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <select className="rounded-xl border border-gray-300 p-3 text-gray-900" value={head.request_type}
                onChange={(e) => setHead({ ...head, request_type: e.target.value })}>
                {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <input className="rounded-xl border border-gray-300 p-3 text-gray-900" placeholder="Fournisseur / client"
                value={head.supplier_name} onChange={(e) => setHead({ ...head, supplier_name: e.target.value })} />
              {(head.request_type === "sortie" || head.request_type === "transfert") && (
                <input className="rounded-xl border border-gray-300 p-3 text-gray-900" placeholder="Entrepôt source"
                  value={head.source_warehouse} onChange={(e) => setHead({ ...head, source_warehouse: e.target.value })} />
              )}
              <input className="rounded-xl border border-gray-300 p-3 text-gray-900"
                placeholder={head.request_type === "transfert" ? "Entrepôt destination" : "Entrepôt"}
                value={head.target_warehouse} onChange={(e) => setHead({ ...head, target_warehouse: e.target.value })} />
            </div>

            <div className="mt-5">
              <ProductLinesGrid lines={lines} onChange={setLines} />
            </div>

            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              Le stock ne sera pas modifié par cette demande ni par sa validation — uniquement à la confirmation de réception.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button disabled={busy} onClick={() => create(false)} className="rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700">Enregistrer en brouillon</button>
              <button disabled={busy} onClick={() => create(true)} className="rounded-xl bg-emerald-600 px-6 py-3 font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                {busy ? "Envoi…" : "Soumettre la demande"}
              </button>
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-white p-4 shadow">
          <div className="flex flex-wrap gap-2 p-2">
            <select className="rounded-xl border border-gray-300 p-2 text-gray-900" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tous les statuts</option>
              {Object.keys(STATUS_COLOR).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
            <input className="min-w-[220px] flex-1 rounded-xl border border-gray-300 p-2 text-gray-900"
              placeholder="Rechercher (numéro, produit, fournisseur)" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {items.length === 0 ? (
            <p className="p-4 text-gray-600">Aucune demande.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead><tr className="text-left text-gray-500">
                  <th className="p-2">Numéro</th><th className="p-2">Type</th><th className="p-2">Demandeur</th>
                  <th className="p-2">Produits</th><th className="p-2">Date</th><th className="p-2">Statut</th>
                  <th className="p-2">Validateur</th><th className="p-2">Actions</th>
                </tr></thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="p-2 font-mono text-xs text-gray-900">{r.reference}</td>
                      <td className="p-2 text-gray-700">{TYPES.find((t) => t.key === r.request_type)?.label || r.request_type}</td>
                      <td className="p-2 text-gray-600">{r.requested_by_name || "—"}</td>
                      <td className="p-2 font-bold text-gray-900">{r.lines_count}</td>
                      <td className="p-2 text-gray-600">{fmt(r.requested_at)}</td>
                      <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLOR[r.status] || "bg-gray-200"}`}>{r.status.replace(/_/g, " ")}</span></td>
                      <td className="p-2 text-gray-600">{r.validated_by_name || "—"}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <button onClick={() => openDetail(r.id)} className="rounded-lg bg-gray-200 px-2 py-1 text-xs font-bold text-gray-800">Détail</button>
                          {r.status === "EN_ATTENTE" && can("stock", "validate") && (
                            <>
                              <button disabled={busy} onClick={() => act(r.id, "validate")} className="rounded-lg bg-blue-700 px-2 py-1 text-xs font-bold text-white">Valider</button>
                              <button disabled={busy} onClick={() => reject(r.id)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Refuser</button>
                            </>
                          )}
                          {["VALIDEE", "PARTIELLEMENT_RECUE"].includes(r.status) && can("stock", "validate") && (
                            <button disabled={busy} onClick={() => act(r.id, "confirm")} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white">Confirmer réception</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {detail && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setDetail(null)}>
            <div className="mt-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-black text-gray-900">{detail.reference}</h3>
                  <p className="text-xs text-gray-500">{detail.status.replace(/_/g, " ")} · {detail.lines?.length || 0} produit(s)</p>
                  {detail.reject_reason && <p className="mt-1 text-sm font-semibold text-red-700">Motif du refus : {detail.reject_reason}</p>}
                </div>
                <button onClick={() => setDetail(null)} className="text-2xl font-black text-gray-400">×</button>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead><tr className="text-left text-gray-500"><th className="p-2">#</th><th className="p-2">Produit</th><th className="p-2">Demandé</th><th className="p-2">Reçu</th></tr></thead>
                  <tbody>
                    {(detail.lines || []).map((l) => (
                      <tr key={l.id} className="border-t border-gray-100">
                        <td className="p-2 text-gray-400">{l.line_no}</td>
                        <td className="p-2 text-gray-900">{l.product_name}<span className="ml-2 text-xs text-gray-500">{l.product_reference}</span></td>
                        <td className="p-2 text-gray-700">{Number(l.quantity_requested)}</td>
                        <td className={`p-2 font-bold ${Number(l.quantity_received) >= Number(l.quantity_requested) ? "text-green-700" : "text-amber-700"}`}>{Number(l.quantity_received)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail.document && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                  <span>Bon <b>{detail.document.doc_number}</b> — statut {detail.document.status} · {detail.document.print_count} impression(s)</span>
                  <Link href={`/bons/reception/${detail.document.id}`} className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                    Ouvrir le bon A4
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
