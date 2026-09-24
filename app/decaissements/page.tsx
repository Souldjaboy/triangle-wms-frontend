"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch, apiUrl } from "../lib/api";
import { usePermissions } from "../lib/permissions";

import CameraReceiptCapture from "../components/CameraReceiptCapture";
/**
 * PHASES 2-8 — Espace COMPTABLE : décaissement, justificatifs, contrôle,
 * remboursement du reliquat et clôture. Le comptable NE RECRÉE PAS la demande :
 * elle arrive automatiquement après validation Direction.
 * La trésorerie n'est impactée qu'au décaissement (et au remboursement, en
 * sens inverse). Boutons pilotés par le RBAC comptabilite.validate.
 */

type RequestLine = {
  id?: number;
  line_no: number;
  category: string | null;
  label: string;
  amount: string | number;
};

type Req = {
  id: number; request_number: string; created_at: string; requester_name: string | null;
  beneficiary_name: string | null;
  reason: string; amount: string; amount_disbursed: string | null; category: string | null;
  status: string; payment_method: string | null; approved_by_name: string | null;
  approved_at: string | null; disbursed_by_name: string | null; disbursed_at: string | null;
  disbursement_comment: string | null;
  camion_id: number | null;
  camion_code: string | null;
  lines?: RequestLine[];
};
type Receipt = {
  id: number;
  file_url: string | null;
  file_name: string | null;
  amount: string;
  label: string | null;
  review_status: string;
  review_comment: string | null;
  uploaded_by_name: string;
  uploaded_at: string;
  receipt_type?: "FILE" | "PENDING" | "DECLARATION";
  expected_date?: string | null;
  declaration_text?: string | null;
  supplier_name?: string | null;
};
type Refund = { id: number; amount: string; method: string | null; created_at: string };
type Amounts = { disbursed: number; justified: number; refunded: number; remaining: number; fully_justified: boolean };

const S = {
  WAITING_DISB: "EN_ATTENTE_DECAISSEMENT", WAITING_RECEIPTS: "EN_ATTENTE_JUSTIFICATIFS",
  RECEIPTS: "JUSTIFICATIFS_DEPOSES", REVIEW: "EN_CONTROLE", CLOSED: "CLOTUREE",
};
const FILTERS = [
  { key: S.WAITING_DISB, label: "À décaisser" },
  { key: S.WAITING_RECEIPTS, label: "Justificatifs en attente" },
  { key: S.RECEIPTS, label: "Déposés" },
  { key: S.REVIEW, label: "En contrôle" },
  { key: S.CLOSED, label: "Clôturées" },
  { key: "", label: "Toutes" },
];
const fcfa = (v: string | number | null) => (v == null ? "—" : Number(v).toLocaleString("fr-FR") + " FCFA");
const fdate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

export default function DecaissementsPage() {
  const { can } = usePermissions();
  const [items, setItems] = useState<Req[]>([]);
  const [filter, setFilter] = useState(S.WAITING_DISB);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Req | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [amounts, setAmounts] = useState<Amounts | null>(null);
  const [form, setForm] = useState({ amount_disbursed: "", account_label: "Caisse", payment_method: "especes", payment_reference: "", justification: "" });
  const [rec, setRec] = useState({ amount: "", label: "" });
  const [file, setFile] = useState<File | null>(null);
  const [receiptMode, setReceiptMode] = useState<"FILE" | "PENDING" | "DECLARATION">("FILE");
  const [expectedDate, setExpectedDate] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [declarationText, setDeclarationText] = useState("");

  const load = useCallback(async () => {
    const q = filter ? `?status=${filter}` : "";
    const r = await authFetch(`/disbursements${q}`);
    if (r.ok) setItems(await r.json());
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const openDetail = useCallback(async (r: Req) => {
    setDetail(r); setMsg("");
    setForm((f) => ({ ...f, amount_disbursed: String(Number(r.amount)) }));
    const res = await authFetch(`/disbursements/${r.id}/details`);
    if (res.ok) { const d = await res.json(); setReceipts(d.receipts || []); setRefunds(d.refunds || []); setAmounts(d.amounts); setDetail(d.request); }
  }, []);

  // Ouverture directe depuis une notification (?id=).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    authFetch(`/disbursements/${id}`).then(async (r) => { if (r.ok) openDetail(await r.json()); });
  }, [openDetail]);

  const refresh = async (id: number) => {
    const res = await authFetch(`/disbursements/${id}/details`);
    if (res.ok) { const d = await res.json(); setReceipts(d.receipts || []); setRefunds(d.refunds || []); setAmounts(d.amounts); setDetail(d.request); }
    await load();
  };

  const disburse = async () => {
    if (!detail || busy) return;

    const real = Number(form.amount_disbursed);
    const validated = Number(detail.amount);

    if (!(real > 0)) {
      return setMsg("❌ Montant à décaisser invalide.");
    }

    if (real > validated) {
      return setMsg(
        `❌ Le montant à décaisser (${fcfa(real)}) dépasse le montant validé (${fcfa(validated)}).`
      );
    }

    if (
      real !== validated &&
      !String(form.justification || "").trim()
    ) {
      return setMsg(
        `❌ Le montant est différent du montant validé (${fcfa(validated)}). Ajoutez une justification.`
      );
    }

    setBusy(true);
    setMsg("⏳ Décaissement en cours...");

    try {
      const res = await authFetch(
        `/disbursements/${detail.id}/disburse`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ...form,
            amount_disbursed: real
          })
        }
      );

      const d = await res.json().catch(() => ({}));

      if (!res.ok) {
        return setMsg(
          `❌ Décaissement refusé : ${
            d?.error ||
            `Erreur HTTP ${res.status}`
          }`
        );
      }

      setMsg(
        `✅ Décaissement effectué — bon ${
          d.voucher_number || ""
        }. Trésorerie diminuée de ${fcfa(real)}.`
      );

      await refresh(detail.id);

    } catch (error: any) {

      console.error(
        "DISBURSE_FRONTEND_ERROR:",
        error
      );

      setMsg(
        `❌ Impossible d'envoyer le décaissement : ${
          error?.message ||
          "erreur de communication avec le serveur"
        }`
      );

    } finally {

      setBusy(false);

    }
  };

  const uploadReceipt = async () => {
    if (!detail) return;

    if (receiptMode === "FILE" && !file) {
      return setMsg("Prenez une photo ou choisissez le fichier du reçu.");
    }

    if (receiptMode === "FILE" && !(Number(rec.amount) > 0)) {
      return setMsg("Indiquez le montant justifié.");
    }

    if (receiptMode === "PENDING" && !expectedDate) {
      return setMsg("Indiquez la date prévue de remise du reçu.");
    }

    if (receiptMode === "DECLARATION") {
      if (!(Number(rec.amount) > 0)) {
        return setMsg("Indiquez le montant concerné.");
      }

      if (supplierName.trim().length < 2) {
        return setMsg("Indiquez le nom de la personne ou du fournisseur.");
      }

      if (declarationText.trim().length < 10) {
        return setMsg("Rédigez la déclaration expliquant l'achat et l'absence de reçu.");
      }
    }

    setBusy(true);
    setMsg("");

    const fd = new FormData();

    if (receiptMode === "FILE" && file) {
      fd.append("file", file);
    }

    fd.append("receipt_type", receiptMode);
    fd.append("amount", rec.amount || "0");

    if (rec.label) {
      fd.append("label", rec.label);
    }

    if (receiptMode === "PENDING") {
      fd.append("expected_date", expectedDate);
    }

    if (receiptMode === "DECLARATION") {
      fd.append("supplier_name", supplierName.trim());
      fd.append("declaration_text", declarationText.trim());
    }

    const res = await authFetch(
      `/disbursements/${detail.id}/receipts`,
      {
        method: "POST",
        body: fd
      }
    );

    const d = await res.json().catch(() => ({}));

    setBusy(false);

    if (!res.ok) {
      return setMsg(`❌ ${d?.error || "Erreur."}`);
    }

    setMsg(
      receiptMode === "PENDING"
        ? "✅ Reçu enregistré comme attendu plus tard."
        : receiptMode === "DECLARATION"
          ? "✅ Déclaration sans reçu enregistrée."
          : "✅ Justificatif ajouté."
    );

    setFile(null);
    setRec({ amount: "", label: "" });
    setExpectedDate("");
    setSupplierName("");
    setDeclarationText("");
    setReceiptMode("FILE");

    await refresh(detail.id);
  };

  const review = async (id: number, decision: string) => {
    setBusy(true);
    const res = await authFetch(`/disbursement-receipts/${id}/review`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ review_status: decision }),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setMsg(`❌ ${d?.error || "Erreur."}`); }
    if (detail) await refresh(detail.id);
  };

  const refund = async () => {
    if (!detail || !amounts) return;
    const value = window.prompt(`Montant remboursé (reste à justifier : ${amounts.remaining}) :`, String(amounts.remaining));
    if (!value) return;
    setBusy(true); setMsg("");
    const res = await authFetch(`/disbursements/${detail.id}/refund`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(value), method: "especes" }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(`❌ ${d?.error || "Erreur."}`);
    setMsg(`✅ Remboursement enregistré — entrée de trésorerie créée.`);
    await refresh(detail.id);
  };

  const close = async () => {
    if (!detail) return;
    setBusy(true); setMsg("");
    const res = await authFetch(`/disbursements/${detail.id}/close`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comment: "Contrôle terminé" }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(`❌ ${d?.error || "Clôture impossible."}`);
    setMsg("✅ Demande clôturée.");
    await refresh(detail.id);
  };

  const canClose = amounts?.fully_justified && detail && detail.status !== S.CLOSED;

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-yellow-600">TRIANGLE WMS PRO</p>
            <h1 className="text-3xl font-black text-gray-900">Décaissements</h1>
          </div>
          <Link href="/dashboard" className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">← Tableau de bord</Link>
        </div>

        {msg && <div className="rounded-xl bg-blue-50 p-4 font-semibold text-blue-900">{msg}</div>}

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
            <p className="p-4 text-gray-600">Aucune demande dans cette catégorie.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead><tr className="text-left text-gray-500">
                  <th className="p-2">N°</th><th className="p-2">Bénéficiaire</th><th className="p-2">Validé</th>
                  <th className="p-2">Décaissé</th><th className="p-2">Date validation</th><th className="p-2">Statut</th><th className="p-2">Actions</th>
                </tr></thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="p-2 font-mono text-xs text-gray-900">{r.request_number}</td>
                      <td className="p-2 text-gray-700">{r.beneficiary_name || r.requester_name || "—"}
                        <span className="block text-xs text-gray-400">{r.reason}</span>
                        {r.camion_code && (
                          <span className="block text-xs font-black text-blue-700">
                            🚚 {r.camion_code}
                          </span>
                        )}</td>
                      <td className="p-2 font-bold text-gray-900">{fcfa(r.amount)}</td>
                      <td className="p-2 text-gray-700">{fcfa(r.amount_disbursed)}</td>
                      <td className="p-2 text-gray-600">{fdate(r.approved_at)}</td>
                      <td className="p-2"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-700">{r.status.replace(/_/g, " ")}</span></td>
                      <td className="p-2"><button onClick={() => openDetail(r)} className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-bold text-white">Ouvrir</button></td>
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
          <div className="mt-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black text-gray-900">{detail.request_number}</h3>
                <p className="text-sm text-gray-600">{detail.reason} · demandé par {detail.requester_name || "—"}</p>
                  {detail.camion_code && (
                    <p className="mt-1 font-black text-blue-700">
                      🚚 Camion : {detail.camion_code}
                    </p>
                  )}
                <p className="text-xs text-gray-500">Validé par {detail.approved_by_name || "—"} le {fdate(detail.approved_at)}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-2xl font-black text-gray-400">×</button>
            </div>


            {detail.lines && detail.lines.length > 0 && (
              <div className="mt-4 rounded-xl border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-black text-gray-900">
                    Détail de la demande
                  </p>
                  <p className="font-black text-emerald-700">
                    Total validé : {fcfa(detail.amount)}
                  </p>
                </div>

                <div className="space-y-2">
                  {detail.lines.map((line) => (
                    <div
                      key={line.id ?? line.line_no}
                      className="grid gap-2 rounded-lg bg-gray-50 p-2 text-sm sm:grid-cols-[auto_1fr_auto]"
                    >
                      <span className="font-bold text-gray-500">
                        #{line.line_no}
                      </span>

                      <div>
                        <p className="font-black text-gray-800">
                          {line.category || "Non catégorisé"}
                        </p>
                        <p className="text-gray-600">
                          {line.label}
                        </p>
                      </div>

                      <span className="font-black text-gray-900">
                        {fcfa(line.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Montants (PHASE 6) */}
            {amounts && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Box label="Décaissé" value={fcfa(amounts.disbursed)} />
                <Box label="Justifié" value={fcfa(amounts.justified)} c="text-green-700" />
                <Box label="Remboursé" value={fcfa(amounts.refunded)} c="text-blue-700" />
                <Box label="Reste à justifier" value={fcfa(amounts.remaining)} c={amounts.remaining > 0 ? "text-red-600" : "text-green-700"} />
                {amounts.fully_justified && amounts.disbursed > 0 && (
                  <p className="col-span-full rounded-lg bg-green-50 p-2 text-center text-sm font-black text-green-800">ENTIÈREMENT JUSTIFIÉ</p>
                )}
              </div>
            )}

            {/* Formulaire de décaissement (PHASE 3) */}
            {detail.status === S.WAITING_DISB && can("comptabilite", "validate") && (
              <div className="mt-5 rounded-xl border border-gray-200 p-4">
                <p className="font-black text-gray-900">Décaisser</p>
                <p className="text-xs text-gray-500">Montant autorisé : <b>{fcfa(detail.amount)}</b></p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <input type="number" className="rounded-lg border border-gray-300 p-2 text-gray-900" placeholder="Montant à décaisser"
                    value={form.amount_disbursed} onChange={(e) => setForm({ ...form, amount_disbursed: e.target.value })} />
                  <select className="rounded-lg border border-gray-300 p-2 text-gray-900" value={form.account_label} onChange={(e) => setForm({ ...form, account_label: e.target.value })}>
                    <option>Caisse</option><option>Banque</option>
                  </select>
                  <select className="rounded-lg border border-gray-300 p-2 text-gray-900" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                    <option value="especes">Espèces</option><option value="virement">Virement</option><option value="cheque">Chèque</option><option value="mobile">Mobile money</option>
                  </select>
                  {/* Bénéficiaire figé à la demande et validé par la Direction :
                      lecture seule. Le backend ignore déjà toute autre valeur —
                      un champ modifiable laissait croire au comptable qu'il
                      pouvait le changer. */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                    <span className="block text-xs text-gray-500">Bénéficiaire</span>
                    <span className="font-semibold text-gray-900">{detail.beneficiary_name || detail.requester_name || "—"}</span>
                  </div>
                  <input className="rounded-lg border border-gray-300 p-2 text-gray-900" placeholder="Référence paiement" value={form.payment_reference} onChange={(e) => setForm({ ...form, payment_reference: e.target.value })} />
                  <input className="rounded-lg border border-gray-300 p-2 text-gray-900" placeholder="Observation / justification d'écart" value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} />
                </div>
                <button disabled={busy} onClick={disburse} className="mt-3 rounded-xl bg-emerald-600 px-6 py-2 font-black text-white disabled:opacity-60">
                  {busy ? "Traitement…" : "Décaisser"}
                </button>
              </div>
            )}

            {/* Justificatifs */}
            {Number(detail.amount_disbursed) > 0 && (
              <div className="mt-5 rounded-2xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-black text-gray-900">Justificatifs</p>
                    <p className="text-xs text-gray-500">
                      Photo du reçu, fichier, reçu à fournir plus tard ou déclaration sans reçu.
                    </p>
                  </div>

                  {detail.disbursement_comment && (
                    <span className="text-xs text-gray-500">
                      {detail.disbursement_comment}
                    </span>
                  )}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setReceiptMode("FILE")}
                    className={`rounded-xl border p-3 text-left text-sm font-bold ${
                      receiptMode === "FILE"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-gray-300 bg-white text-gray-800"
                    }`}
                  >
                    📷 Reçu disponible
                    <span className="mt-1 block text-xs font-normal">
                      Photographier ou importer
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceiptMode("PENDING")}
                    className={`rounded-xl border p-3 text-left text-sm font-bold ${
                      receiptMode === "PENDING"
                        ? "border-amber-600 bg-amber-50 text-amber-900"
                        : "border-gray-300 bg-white text-gray-800"
                    }`}
                  >
                    ⏳ Reçu plus tard
                    <span className="mt-1 block text-xs font-normal">
                      Indiquer la date prévue
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceiptMode("DECLARATION")}
                    className={`rounded-xl border p-3 text-left text-sm font-bold ${
                      receiptMode === "DECLARATION"
                        ? "border-blue-700 bg-blue-50 text-blue-900"
                        : "border-gray-300 bg-white text-gray-800"
                    }`}
                  >
                    📝 Aucun reçu
                    <span className="mt-1 block text-xs font-normal">
                      Créer une déclaration signable
                    </span>
                  </button>
                </div>

                {receiptMode === "FILE" && (
                  <div className="mt-4 rounded-xl bg-gray-50 p-4">
                    <p className="mb-2 text-sm font-black text-gray-900">
                      Photo ou fichier du reçu
                    </p>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="rounded-xl border border-dashed border-gray-400 bg-white p-3">
                        <span className="mb-2 block text-sm font-bold text-gray-800">
                          📷 Prendre une photo / choisir un fichier
                        </span>

                        <input
                          type="file"
                          accept="image/*,.pdf,application/pdf"
                          onChange={(e) =>
                            setFile(e.target.files?.[0] || null)
                          }
                          className="w-full text-sm text-gray-700"
                        />

                        <div className="mt-3">
                          <CameraReceiptCapture
                            onCapture={(capturedFile) => {
                              setFile(capturedFile);
                            }}
                          />
                        </div>

                        {file && (
                          <span className="mt-2 block text-xs font-semibold text-green-700">
                            {file.name}
                          </span>
                        )}
                      </label>

                      <input
                        type="number"
                        className="rounded-lg border border-gray-300 p-3 text-gray-900"
                        placeholder="Montant justifié"
                        value={rec.amount}
                        onChange={(e) =>
                          setRec({ ...rec, amount: e.target.value })
                        }
                      />

                      <input
                        className="rounded-lg border border-gray-300 p-3 text-gray-900"
                        placeholder="Libellé (reçu, facture...)"
                        value={rec.label}
                        onChange={(e) =>
                          setRec({ ...rec, label: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}

                {receiptMode === "PENDING" && (
                  <div className="mt-4 rounded-xl bg-amber-50 p-4">
                    <p className="font-black text-amber-900">
                      Reçu à fournir plus tard
                    </p>

                    <p className="mt-1 text-xs text-amber-800">
                      Cette option ne justifie pas encore le montant.
                      La demande restera en attente jusqu'au dépôt réel du reçu.
                    </p>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label>
                        <span className="mb-1 block text-xs font-bold text-gray-700">
                          Date prévue du reçu
                        </span>

                        <input
                          type="date"
                          className="w-full rounded-lg border border-gray-300 bg-white p-3"
                          value={expectedDate}
                          onChange={(e) =>
                            setExpectedDate(e.target.value)
                          }
                        />
                      </label>

                      <label>
                        <span className="mb-1 block text-xs font-bold text-gray-700">
                          Observation
                        </span>

                        <input
                          className="w-full rounded-lg border border-gray-300 bg-white p-3"
                          placeholder="Ex. fournisseur remettra le reçu vendredi"
                          value={rec.label}
                          onChange={(e) =>
                            setRec({ ...rec, label: e.target.value })
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}

                {receiptMode === "DECLARATION" && (
                  <div className="mt-4 rounded-xl bg-blue-50 p-4">
                    <p className="font-black text-blue-900">
                      Déclaration interne — aucun reçu
                    </p>

                    <p className="mt-1 text-xs text-blue-800">
                      Cette déclaration sera visible sur le bon de décaissement
                      et pourra être imprimée puis signée.
                    </p>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <input
                        className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
                        placeholder="Nom du fournisseur / bénéficiaire"
                        value={supplierName}
                        onChange={(e) =>
                          setSupplierName(e.target.value)
                        }
                      />

                      <input
                        type="number"
                        className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900"
                        placeholder="Montant concerné"
                        value={rec.amount}
                        onChange={(e) =>
                          setRec({ ...rec, amount: e.target.value })
                        }
                      />

                      <input
                        className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900 sm:col-span-2"
                        placeholder="Libellé de l'achat"
                        value={rec.label}
                        onChange={(e) =>
                          setRec({ ...rec, label: e.target.value })
                        }
                      />

                      <textarea
                        rows={4}
                        className="rounded-lg border border-gray-300 bg-white p-3 text-gray-900 sm:col-span-2"
                        placeholder="Ex. Je confirme avoir effectué l'achat de ... pour le compte de l'entreprise. Le vendeur ne délivre pas de reçu..."
                        value={declarationText}
                        onChange={(e) =>
                          setDeclarationText(e.target.value)
                        }
                      />
                    </div>
                  </div>
                )}

                <button
                  disabled={busy}
                  onClick={uploadReceipt}
                  className="mt-3 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  {busy
                    ? "Enregistrement…"
                    : receiptMode === "FILE"
                      ? "Enregistrer le reçu"
                      : receiptMode === "PENDING"
                        ? "Enregistrer l'attente du reçu"
                        : "Créer la déclaration sans reçu"}
                </button>

                <div className="mt-4 space-y-2">
                  {receipts.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-gray-200 p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          {r.receipt_type === "PENDING" ? (
                            <p className="font-black text-amber-800">
                              ⏳ Reçu attendu
                            </p>
                          ) : r.receipt_type === "DECLARATION" ? (
                            <p className="font-black text-blue-800">
                              📝 Déclaration sans reçu
                            </p>
                          ) : r.file_url ? (
                            <a
                              href={apiUrl(r.file_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-blue-700 hover:underline"
                            >
                              {r.file_name || "Justificatif"}
                            </a>
                          ) : (
                            <p className="font-bold">Justificatif</p>
                          )}

                          {r.receipt_type !== "PENDING" && (
                            <span className="ml-2 text-gray-700">
                              {fcfa(r.amount)}
                            </span>
                          )}

                          <span className="block text-xs text-gray-500">
                            {r.label || ""}
                            {r.uploaded_by_name
                              ? ` · ${r.uploaded_by_name}`
                              : ""}
                            {r.uploaded_at
                              ? ` · ${new Date(r.uploaded_at).toLocaleString("fr-FR")}`
                              : ""}
                          </span>

                          {r.receipt_type === "PENDING" && r.expected_date && (
                            <p className="mt-1 text-xs font-bold text-amber-700">
                              À fournir avant le {fdate(r.expected_date)}
                            </p>
                          )}

                          {r.receipt_type === "DECLARATION" && (
                            <div className="mt-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-900">
                              <p>
                                <b>Personne / fournisseur :</b>{" "}
                                {r.supplier_name || "—"}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap">
                                {r.declaration_text || ""}
                              </p>
                            </div>
                          )}
                        </div>

                        {r.receipt_type !== "PENDING" && (
                          <div className="flex items-center gap-1">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                r.review_status === "ACCEPTE"
                                  ? "bg-green-100 text-green-800"
                                  : r.review_status === "REFUSE"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {r.review_status}
                            </span>

                            {can("comptabilite", "validate") &&
                              r.review_status === "EN_ATTENTE" && (
                                <>
                                  <button
                                    onClick={() =>
                                      review(r.id, "ACCEPTE")
                                    }
                                    className="rounded bg-green-600 px-2 py-1 text-xs font-bold text-white"
                                  >
                                    Accepter
                                  </button>

                                  <button
                                    onClick={() =>
                                      review(r.id, "REFUSE")
                                    }
                                    className="rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-700"
                                  >
                                    Refuser
                                  </button>
                                </>
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {refunds.map((r) => (
                    <div
                      key={`ref-${r.id}`}
                      className="rounded-xl bg-blue-50 p-2 text-sm text-blue-900"
                    >
                      Remboursement {fcfa(r.amount)} — {r.method || "—"} ·{" "}
                      {new Date(r.created_at).toLocaleString("fr-FR")}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {Number(detail.amount_disbursed) > 0 && (
                <Link href={`/bons/decaissement/${detail.id}`} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Voir le bon</Link>
              )}
              {amounts && amounts.remaining > 0 && can("comptabilite", "validate") && (
                <button disabled={busy} onClick={refund} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white">Enregistrer un remboursement</button>
              )}
              {can("comptabilite", "validate") && detail.status !== S.CLOSED && (
                <button disabled={busy || !canClose} onClick={close}
                  title={canClose ? "" : `Clôture bloquée : reste à justifier ${amounts?.remaining ?? "?"} FCFA`}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  Clôturer
                </button>
              )}
              {!canClose && detail.status !== S.CLOSED && amounts && (
                <span className="self-center text-xs font-semibold text-amber-700">
                  Clôture bloquée : reste à justifier {fcfa(amounts.remaining)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Box({ label, value, c }: { label: string; value: string; c?: string }) {
  return <div className="rounded-lg bg-gray-50 p-2 text-center"><p className={`font-black ${c || "text-gray-900"}`}>{value}</p><p className="text-xs text-gray-500">{label}</p></div>;
}
