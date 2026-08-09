"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch, apiUrl } from "../lib/api";
import { usePermissions } from "../lib/permissions";

/**
 * PHASES 1-4 — Espace du DEMANDEUR (Assistant(e) de Direction et tout profil
 * disposant de finance.request). Aucun nom codé en dur : le backend restreint
 * automatiquement la liste aux demandes de l'utilisateur (périmètre RBAC +
 * company_id), sans exiger finance.direction.
 */

type Req = {
  id: number; request_number: string; created_at: string; reason: string; category: string | null;
  amount: string; amount_disbursed: string | null; urgency: string | null; status: string;
  payment_method: string | null; approval_comment: string | null; approved_by_name: string | null;
  approved_at: string | null; disbursed_by_name: string | null; disbursed_at: string | null;
  disbursement_comment: string | null; voucher_number: string | null; closed_at: string | null;
  requester_name: string | null;
};
type Receipt = { id: number; file_url: string; file_name: string | null; amount: string; label: string | null; review_status: string; uploaded_at: string };
type Refund = { id: number; amount: string; created_at: string };
type Amounts = { disbursed: number; justified: number; refunded: number; remaining: number; fully_justified: boolean };

const S = {
  DRAFT: "BROUILLON", WAITING: "EN_ATTENTE_DIRECTION", WAITING_DISB: "EN_ATTENTE_DECAISSEMENT",
  REJECTED: "REFUSEE_DIRECTION", WAITING_RECEIPTS: "EN_ATTENTE_JUSTIFICATIFS",
  RECEIPTS: "JUSTIFICATIFS_DEPOSES", REVIEW: "EN_CONTROLE", CLOSED: "CLOTUREE",
};
const FILTERS = [
  { key: "", label: "Toutes" }, { key: S.DRAFT, label: "Mes brouillons" },
  { key: S.WAITING, label: "En attente Direction" }, { key: S.WAITING_DISB, label: "Validées" },
  { key: S.REJECTED, label: "Refusées" }, { key: S.WAITING_RECEIPTS, label: "Décaissées" },
  { key: S.RECEIPTS, label: "Justificatifs déposés" }, { key: S.REVIEW, label: "En contrôle" },
  { key: S.CLOSED, label: "Clôturées" },
];
const COLOR: Record<string, string> = {
  [S.DRAFT]: "bg-gray-200 text-gray-700", [S.WAITING]: "bg-amber-100 text-amber-800",
  [S.WAITING_DISB]: "bg-blue-100 text-blue-800", [S.REJECTED]: "bg-red-100 text-red-800",
  [S.WAITING_RECEIPTS]: "bg-orange-100 text-orange-800", [S.RECEIPTS]: "bg-purple-100 text-purple-800",
  [S.REVIEW]: "bg-indigo-100 text-indigo-800", [S.CLOSED]: "bg-green-100 text-green-800",
};
// Étapes de la timeline (PHASE 3).
const STEPS = [
  { key: "created", label: "Demande créée" }, { key: "submitted", label: "Soumise" },
  { key: "direction", label: "Direction" }, { key: "disbursed", label: "Décaissement" },
  { key: "receipts", label: "Justificatifs" }, { key: "review", label: "Contrôle" },
  { key: "closed", label: "Clôture" },
];
function stepIndex(status: string): number {
  if (status === S.DRAFT) return 0;
  if (status === S.WAITING) return 2;
  if (status === S.REJECTED) return 2;
  if (status === S.WAITING_DISB) return 3;
  if (status === S.WAITING_RECEIPTS) return 4;
  if (status === S.RECEIPTS) return 4;
  if (status === S.REVIEW) return 5;
  if (status === S.CLOSED) return 6;
  return 1;
}
const fcfa = (v: string | number | null) => (v == null || v === "" ? "—" : Number(v).toLocaleString("fr-FR") + " FCFA");
const fdate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

const EMPTY = {
  beneficiary: "", service: "", reason: "", description: "", amount: "", currency: "FCFA",
  category: "", project: "", urgency: "normale", desired_date: "", payment_method: "especes", observation: "",
};

export default function MesDemandesPage() {
  const { can, loading } = usePermissions();
  const allowed = can("finance.request", "view");
  const [items, setItems] = useState<Req[]>([]);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [attach, setAttach] = useState<File | null>(null);
  const [detail, setDetail] = useState<Req | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [amounts, setAmounts] = useState<Amounts | null>(null);
  const [rec, setRec] = useState({ amount: "", label: "" });
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const q = filter ? `?status=${filter}` : "";
    const r = await authFetch(`/disbursements${q}`);
    if (r.ok) setItems(await r.json());
  }, [filter]);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  const openDetail = async (r: Req) => {
    setDetail(r); setMsg("");
    const res = await authFetch(`/disbursements/${r.id}/details`);
    if (res.ok) { const d = await res.json(); setDetail(d.request); setReceipts(d.receipts || []); setRefunds(d.refunds || []); setAmounts(d.amounts); }
  };

  const create = async (submit: boolean) => {
    setMsg("");
    if (!(Number(form.amount) > 0)) return setMsg("Montant invalide.");
    if (!form.reason.trim()) return setMsg("L'objet de la demande est obligatoire.");
    setBusy(true);
    // La pièce initiale est envoyée après création (l'API accepte une URL).
    const body = {
      amount: Number(form.amount), reason: form.reason, category: form.category || null,
      beneficiary_name: form.beneficiary.trim() || null,
      urgency: form.urgency, payment_method: form.payment_method, submit,
      // Champs complémentaires regroupés dans la description.
      description: [form.description,
        form.service && `Service : ${form.service}`, form.project && `Projet : ${form.project}`,
        form.desired_date && `Souhaitée le ${form.desired_date}`, form.observation]
        .filter(Boolean).join(" · ") || null,
    };
    const res = await authFetch("/disbursements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setBusy(false); return setMsg(`❌ ${d?.error || "Erreur."}`); }
    if (attach) {
      const fd = new FormData(); fd.append("file", attach); fd.append("amount", "0"); fd.append("label", "Pièce initiale");
      await authFetch(`/disbursements/${d.id}/receipts`, { method: "POST", body: fd });
    }
    setBusy(false);
    setMsg(submit ? `✅ ${d.request_number} soumise à la Direction.` : `✅ ${d.request_number} enregistrée en brouillon (non transmise).`);
    setForm({ ...EMPTY }); setAttach(null); setShowForm(false); await load();
  };

  const submitDraft = async (id: number) => {
    setBusy(true);
    const res = await authFetch(`/disbursements/${id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? `✅ ${d.request_number} soumise à la Direction.` : `❌ ${d?.error || "Erreur."}`);
    await load();
  };

  const addReceipt = async () => {
    if (!detail) return;
    if (!file) return setMsg("Choisissez ou photographiez un justificatif.");
    setBusy(true); setMsg("");
    const fd = new FormData();
    fd.append("file", file); fd.append("amount", rec.amount || "0");
    if (rec.label) fd.append("label", rec.label);
    const res = await authFetch(`/disbursements/${detail.id}/receipts`, { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(`❌ ${d?.error || "Erreur."}`);
    setMsg("✅ Justificatif envoyé.");
    setFile(null); setRec({ amount: "", label: "" });
    await openDetail(detail); await load();
  };

  if (!loading && !allowed) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow">
          <h1 className="text-xl font-black text-gray-900">Mes demandes</h1>
          <p className="mt-2 font-semibold text-red-600">Vous n&apos;avez pas accès au module financier.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-yellow-600">TRIANGLE WMS PRO</p>
            <h1 className="text-3xl font-black text-gray-900">Mes demandes de décaissement</h1>
          </div>
          <div className="flex gap-2">
            {can("finance.request", "create") && (
              <button onClick={() => setShowForm((v) => !v)} className="rounded-xl bg-yellow-500 px-4 py-2 font-black text-black hover:bg-yellow-400">
                + Nouvelle demande
              </button>
            )}
            <Link href="/dashboard" className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">← Tableau de bord</Link>
          </div>
        </div>

        {msg && <div className="rounded-xl bg-blue-50 p-4 font-semibold text-blue-900">{msg}</div>}

        {/* Formulaire (PHASE 2) */}
        {showForm && can("finance.request", "create") && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-black text-gray-900">Nouvelle demande de décaissement</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Bénéficiaire"><input className={inp} value={form.beneficiary} onChange={(e) => setForm({ ...form, beneficiary: e.target.value })} /></Field>
              <Field label="Service"><input className={inp} value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} /></Field>
              <Field label="Objet *"><input className={inp} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ex. Achat fournitures chantier" /></Field>
              <Field label="Montant *"><input type="number" min="0" className={inp} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
              <Field label="Devise"><input className={inp} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
              <Field label="Catégorie"><input className={inp} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
              <Field label="Projet / chantier / site"><input className={inp} value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} /></Field>
              <Field label="Urgence">
                <select className={inp} value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
                  <option value="basse">Basse</option><option value="normale">Normale</option><option value="haute">Haute</option><option value="critique">Critique</option>
                </select>
              </Field>
              <Field label="Date souhaitée"><input type="date" className={inp} value={form.desired_date} onChange={(e) => setForm({ ...form, desired_date: e.target.value })} /></Field>
              <Field label="Mode de paiement souhaité">
                <select className={inp} value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                  <option value="especes">Espèces</option><option value="virement">Virement</option><option value="cheque">Chèque</option><option value="mobile">Mobile money</option>
                </select>
              </Field>
              <Field label="Description" wide><textarea rows={2} className={inp} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
              <Field label="Observation" wide><input className={inp} value={form.observation} onChange={(e) => setForm({ ...form, observation: e.target.value })} /></Field>
              <Field label="Pièce jointe initiale">
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,image/*" capture="environment" className="text-sm" onChange={(e) => setAttach(e.target.files?.[0] || null)} />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button disabled={busy} onClick={() => create(false)} className="rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700">Enregistrer brouillon</button>
              <button disabled={busy} onClick={() => create(true)} className="rounded-xl bg-emerald-600 px-6 py-3 font-black text-white disabled:opacity-60">
                {busy ? "Envoi…" : "Soumettre à la Direction"}
              </button>
              <span className="self-center text-xs text-gray-500">Un brouillon n&apos;est pas transmis à la Direction.</span>
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.key || "all"} onClick={() => setFilter(f.key)}
              className={`rounded-xl px-3 py-1.5 text-sm font-bold ${filter === f.key ? "bg-slate-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
              {f.label}
            </button>
          ))}
        </div>

        <section className="rounded-2xl bg-white p-4 shadow">
          {items.length === 0 ? (
            <p className="p-4 text-gray-600">Aucune demande.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead><tr className="text-left text-gray-500">
                  <th className="p-2">N°</th><th className="p-2">Date</th><th className="p-2">Objet</th>
                  <th className="p-2">Montant</th><th className="p-2">Décaissé</th><th className="p-2">Statut</th><th className="p-2">Actions</th>
                </tr></thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="p-2 font-mono text-xs text-gray-900">{r.request_number}</td>
                      <td className="p-2 text-gray-600">{fdate(r.created_at)}</td>
                      <td className="p-2 text-gray-700">{r.reason}</td>
                      <td className="p-2 font-bold text-gray-900">{fcfa(r.amount)}</td>
                      <td className="p-2 text-gray-700">{fcfa(r.amount_disbursed)}</td>
                      <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${COLOR[r.status] || "bg-gray-200"}`}>{r.status.replace(/_/g, " ")}</span></td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <button onClick={() => openDetail(r)} className="rounded-lg bg-gray-200 px-2 py-1 text-xs font-bold text-gray-800">Suivre</button>
                          {r.status === S.DRAFT && can("finance.request", "update") && (
                            <button disabled={busy} onClick={() => submitDraft(r.id)} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white">Soumettre</button>
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

      {/* Détail + timeline (PHASE 3) + justificatifs (PHASE 4) */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setDetail(null)}>
          <div className="mt-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-900">{detail.request_number}</h3>
                <p className="text-sm text-gray-600">{detail.reason}</p>
                {detail.voucher_number && <p className="text-xs text-gray-500">Bon de décaissement : <b>{detail.voucher_number}</b></p>}
              </div>
              <button onClick={() => setDetail(null)} className="text-2xl font-black text-gray-400">×</button>
            </div>

            {/* Timeline */}
            <ol className="mt-4 flex flex-wrap items-center gap-1 text-xs">
              {STEPS.map((s, i) => {
                const done = i <= stepIndex(detail.status);
                const rejected = detail.status === S.REJECTED && i === 2;
                return (
                  <li key={s.key} className="flex items-center gap-1">
                    <span className={`rounded-full px-2 py-1 font-bold ${rejected ? "bg-red-100 text-red-800" : done ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500"}`}>
                      {rejected ? "Refusée" : s.label}
                    </span>
                    {i < STEPS.length - 1 && <span className="text-gray-300">→</span>}
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Box label="Demandé" value={fcfa(detail.amount)} />
              <Box label="Décaissé" value={fcfa(detail.amount_disbursed)} />
              <Box label="Justifié" value={fcfa(amounts?.justified ?? 0)} c="text-green-700" />
              <Box label="Remboursé" value={fcfa(amounts?.refunded ?? 0)} c="text-blue-700" />
              <Box label="Reste à justifier" value={fcfa(amounts?.remaining ?? 0)} c={(amounts?.remaining ?? 0) > 0 ? "text-red-600" : "text-green-700"} />
              <Box label="Statut" value={detail.status.replace(/_/g, " ")} />
            </div>
            {amounts?.fully_justified && amounts.disbursed > 0 && (
              <p className="mt-2 rounded-lg bg-green-50 p-2 text-center text-sm font-black text-green-800">ENTIÈREMENT JUSTIFIÉ</p>
            )}

            {(detail.approval_comment || detail.disbursement_comment) && (
              <div className="mt-4 space-y-1 text-sm">
                {detail.approval_comment && <p><b>Direction :</b> {detail.approval_comment} <span className="text-xs text-gray-500">({detail.approved_by_name} · {fdate(detail.approved_at)})</span></p>}
                {detail.disbursement_comment && <p><b>Comptable :</b> {detail.disbursement_comment} <span className="text-xs text-gray-500">({detail.disbursed_by_name} · {fdate(detail.disbursed_at)})</span></p>}
              </div>
            )}

            {/* Justificatifs (photo mobile) */}
            {Number(detail.amount_disbursed) > 0 && can("finance.request", "update") && (
              <div className="mt-5 rounded-xl border border-gray-200 p-4">
                <p className="font-black text-gray-900">+ Ajouter un justificatif</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,image/*" capture="environment"
                    onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-gray-700" />
                  <input type="number" className={inp} placeholder="Montant justifié" value={rec.amount} onChange={(e) => setRec({ ...rec, amount: e.target.value })} />
                  <input className={inp} placeholder="Libellé (facture, reçu…)" value={rec.label} onChange={(e) => setRec({ ...rec, label: e.target.value })} />
                </div>
                <button disabled={busy} onClick={addReceipt} className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Envoyer</button>
              </div>
            )}

            {(receipts.length > 0 || refunds.length > 0) && (
              <div className="mt-4 space-y-2">
                {receipts.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 p-2 text-sm">
                    <a href={apiUrl(r.file_url)} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 hover:underline">
                      {r.file_name || "Justificatif"}
                    </a>
                    <span className="text-gray-700">{fcfa(r.amount)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.review_status === "ACCEPTE" ? "bg-green-100 text-green-800" : r.review_status === "REFUSE" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{r.review_status}</span>
                  </div>
                ))}
                {refunds.map((r) => (
                  <div key={`r-${r.id}`} className="rounded-xl bg-blue-50 p-2 text-sm text-blue-900">Remboursement {fcfa(r.amount)} · {fdate(r.created_at)}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "w-full rounded-xl border border-gray-300 p-3 text-gray-900";
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2 lg:col-span-3" : ""}><label className="mb-1 block text-sm font-semibold text-gray-700">{label}</label>{children}</div>;
}
function Box({ label, value, c }: { label: string; value: string; c?: string }) {
  return <div className="rounded-lg bg-gray-50 p-2 text-center"><p className={`font-black ${c || "text-gray-900"}`}>{value}</p><p className="text-xs text-gray-500">{label}</p></div>;
}
