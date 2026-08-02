"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "../lib/api";
import { usePermissions } from "../lib/permissions";

/**
 * PHASE 1 — Espace DIRECTION : réception, validation et refus des demandes de
 * décaissement. Aucune action ne touche la trésorerie (elle ne bouge qu'au
 * décaissement effectué par le comptable). Boutons pilotés par le RBAC
 * finance.direction — miroir exact du backend.
 */

type Req = {
  id: number; request_number: string; created_at: string; requester_name: string | null;
  requester_role: string | null; reason: string; amount: string; amount_disbursed: string | null;
  category: string | null; urgency: string | null; status: string;
  approval_comment: string | null; approved_by_name: string | null; approved_at: string | null;
  receipt_url: string | null;
};
type Dash = {
  by_status: Record<string, { n: number; total: string; total_disbursed: string }>;
  missing_receipts: number; treasury_balance: number;
};

const S = {
  DRAFT: "BROUILLON", WAITING: "EN_ATTENTE_DIRECTION", WAITING_DISB: "EN_ATTENTE_DECAISSEMENT",
  REJECTED: "REFUSEE_DIRECTION", WAITING_RECEIPTS: "EN_ATTENTE_JUSTIFICATIFS",
  RECEIPTS: "JUSTIFICATIFS_DEPOSES", REVIEW: "EN_CONTROLE", CLOSED: "CLOTUREE",
};
const COLOR: Record<string, string> = {
  [S.DRAFT]: "bg-gray-200 text-gray-700", [S.WAITING]: "bg-amber-100 text-amber-800",
  [S.WAITING_DISB]: "bg-blue-100 text-blue-800", [S.REJECTED]: "bg-red-100 text-red-800",
  [S.WAITING_RECEIPTS]: "bg-orange-100 text-orange-800", [S.RECEIPTS]: "bg-purple-100 text-purple-800",
  [S.REVIEW]: "bg-indigo-100 text-indigo-800", [S.CLOSED]: "bg-green-100 text-green-800",
};
const SECTIONS = [
  { key: "", label: "Réception des demandes" },
  { key: S.WAITING, label: "En attente" },
  { key: S.WAITING_DISB, label: "Validées" },
  { key: S.REJECTED, label: "Refusées" },
  { key: S.WAITING_RECEIPTS, label: "Décaissements" },
  { key: S.RECEIPTS, label: "Justificatifs" },
  { key: S.CLOSED, label: "Clôturées" },
];
const fcfa = (v: string | number | null) => (v == null ? "—" : Number(v).toLocaleString("fr-FR") + " FCFA");
const fdate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

export default function DirectionPage() {
  const { can } = usePermissions();
  const [dash, setDash] = useState<Dash | null>(null);
  const [items, setItems] = useState<Req[]>([]);
  const [section, setSection] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Req | null>(null);
  const [history, setHistory] = useState<{ action: string; user_name: string; created_at: string }[]>([]);

  const load = useCallback(async () => {
    const d = await authFetch("/direction/dashboard");
    if (d.ok) setDash(await d.json());
    const q = section ? `?status=${section}` : "";
    const r = await authFetch(`/disbursements${q}`);
    if (r.ok) setItems(await r.json());
  }, [section]);
  useEffect(() => { load(); }, [load]);

  const act = async (id: number, action: "approve" | "reject", body?: Record<string, unknown>) => {
    setBusy(true); setMsg("");
    const res = await authFetch(`/disbursements/${id}/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(`❌ ${data?.error || "Erreur."}`); return; }
    setMsg(action === "approve"
      ? `✅ ${data.request_number} validée — transmise au comptable. La trésorerie n'est pas encore impactée.`
      : `✅ ${data.request_number} refusée.`);
    setDetail(null); await load();
  };

  const reject = (id: number) => {
    const reason = window.prompt("Motif du refus (obligatoire) :");
    if (!reason) return;
    act(id, "reject", { reason });
  };
  const askCorrection = (id: number) => {
    const comment = window.prompt("Correction demandée (motif) :");
    if (!comment) return;
    act(id, "reject", { reason: `CORRECTION DEMANDÉE : ${comment}` });
  };

  const open = async (r: Req) => {
    setDetail(r);
    const res = await authFetch(`/disbursements/${r.id}/details`);
    if (res.ok) { const d = await res.json(); setHistory(d.history || []); }
  };

  const pending = dash?.by_status?.[S.WAITING];
  const stat = (k: string) => dash?.by_status?.[k];

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-yellow-600">TRIANGLE WMS PRO</p>
            <h1 className="text-3xl font-black text-gray-900">Direction</h1>
          </div>
          <Link href="/dashboard" className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">← Tableau de bord</Link>
        </div>

        {msg && <div className="rounded-xl bg-blue-50 p-4 font-semibold text-blue-900">{msg}</div>}

        {/* Tableau de bord */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card label="Demandes en attente" value={String(pending?.n ?? 0)} sub={fcfa(pending?.total ?? 0)} color="text-amber-700" />
          <Card label="Validées (à décaisser)" value={String(stat(S.WAITING_DISB)?.n ?? 0)} sub={fcfa(stat(S.WAITING_DISB)?.total ?? 0)} color="text-blue-700" />
          <Card label="Refusées" value={String(stat(S.REJECTED)?.n ?? 0)} color="text-red-600" />
          <Card label="Décaissements effectués" value={String((stat(S.WAITING_RECEIPTS)?.n ?? 0) + (stat(S.RECEIPTS)?.n ?? 0) + (stat(S.CLOSED)?.n ?? 0))}
            sub={fcfa(stat(S.WAITING_RECEIPTS)?.total_disbursed ?? 0)} color="text-emerald-700" />
          <Card label="Justificatifs manquants" value={String(dash?.missing_receipts ?? 0)} color="text-orange-600" />
          <Card label="Clôturées" value={String(stat(S.CLOSED)?.n ?? 0)} color="text-green-700" />
          <Card label="Trésorerie" value={fcfa(dash?.treasury_balance ?? 0)} color={(dash?.treasury_balance ?? 0) < 0 ? "text-red-600" : "text-gray-900"} />
        </div>

        {/* Sections */}
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <button key={s.key || "all"} onClick={() => setSection(s.key)}
              className={`rounded-xl px-3 py-1.5 text-sm font-bold ${section === s.key ? "bg-slate-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
              {s.label}
            </button>
          ))}
        </div>

        <section className="rounded-2xl bg-white p-4 shadow">
          {items.length === 0 ? (
            <p className="p-4 text-gray-600">Aucune demande dans cette section.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead><tr className="text-left text-gray-500">
                  <th className="p-2">N°</th><th className="p-2">Date</th><th className="p-2">Demandeur</th>
                  <th className="p-2">Motif</th><th className="p-2">Montant</th><th className="p-2">Urgence</th>
                  <th className="p-2">Statut</th><th className="p-2">Actions</th>
                </tr></thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="p-2 font-mono text-xs text-gray-900">{r.request_number}</td>
                      <td className="p-2 text-gray-600">{fdate(r.created_at)}</td>
                      <td className="p-2 text-gray-700">{r.requester_name || "—"}<span className="block text-xs text-gray-400">{r.requester_role}</span></td>
                      <td className="p-2 text-gray-700">{r.reason}</td>
                      <td className="p-2 font-bold text-gray-900">{fcfa(r.amount)}</td>
                      <td className="p-2 text-gray-600">{r.urgency || "normale"}</td>
                      <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${COLOR[r.status] || "bg-gray-200"}`}>{r.status.replace(/_/g, " ")}</span></td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <button onClick={() => open(r)} className="rounded-lg bg-gray-200 px-2 py-1 text-xs font-bold text-gray-800">Voir</button>
                          {r.status === S.WAITING && can("finance.direction", "validate") && (
                            <>
                              <button disabled={busy} onClick={() => act(r.id, "approve", { comment: "Accord Direction" })} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white">Valider</button>
                              <button disabled={busy} onClick={() => reject(r.id)} className="rounded-lg bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Refuser</button>
                              <button disabled={busy} onClick={() => askCorrection(r.id)} className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">Correction</button>
                            </>
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
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setDetail(null)}>
          <div className="mt-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-900">{detail.request_number}</h3>
                <p className="text-sm text-gray-600">{detail.reason}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-2xl font-black text-gray-400">×</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <p><b>Demandeur :</b> {detail.requester_name || "—"}</p>
              <p><b>Montant demandé :</b> {fcfa(detail.amount)}</p>
              <p><b>Catégorie :</b> {detail.category || "—"}</p>
              <p><b>Urgence :</b> {detail.urgency || "normale"}</p>
              <p><b>Statut :</b> {detail.status.replace(/_/g, " ")}</p>
              <p><b>Décaissé :</b> {fcfa(detail.amount_disbursed)}</p>
              {detail.approval_comment && <p className="col-span-2"><b>Commentaire Direction :</b> {detail.approval_comment}</p>}
            </div>
            <div className="mt-4">
              <p className="mb-2 font-black text-gray-900">Historique</p>
              {history.length === 0 ? <p className="text-sm text-gray-500">Aucun événement.</p> : (
                <ul className="space-y-1 text-sm">
                  {history.map((h, i) => (
                    <li key={i} className="flex justify-between border-b border-gray-100 py-1">
                      <span className="font-semibold text-gray-800">{h.action}</span>
                      <span className="text-gray-500">{h.user_name} · {new Date(h.created_at).toLocaleString("fr-FR")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {detail.status === S.WAITING && can("finance.direction", "validate") && (
              <div className="mt-5 flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => act(detail.id, "approve", { comment: "Accord Direction" })} className="rounded-xl bg-emerald-600 px-5 py-2 font-black text-white">Valider</button>
                <button disabled={busy} onClick={() => reject(detail.id)} className="rounded-xl bg-red-100 px-4 py-2 font-bold text-red-700">Refuser</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow">
      <p className={`text-xl font-black ${color || "text-gray-900"}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
      {sub && <p className="text-xs font-semibold text-gray-600">{sub}</p>}
    </div>
  );
}
