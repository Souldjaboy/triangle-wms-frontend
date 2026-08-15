"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authFetch, apiUrl, authHeaders } from "../../../lib/api";
import { usePermissions } from "../../../lib/permissions";
import ProductSearchSelect, { type ProductHit } from "../../../components/ProductSearchSelect";
import {
  ReceptionDetail, ReceptionLine, Suggestion, Putaway, WAREHOUSE_CODES,
  n, fdate, fdatetime, STATUS_TONE, MATCH_TONE, MATCH_LABEL, buildLocationCode,
} from "../shared";

/**
 * DÉTAIL D'UNE RÉCEPTION — rapprochement produit puis mise en stock.
 *
 * Deux garanties tenues par cet écran :
 *   1. consulter, filtrer, ouvrir les suggestions ne modifie AUCUN stock ;
 *      seule l'action « Mettre en stock » crée un mouvement ;
 *   2. aucune association n'est appliquée sur la seule foi d'un score. Les
 *      suggestions sont classées, l'utilisateur confirme. Une confirmation ne
 *      peut être étendue qu'aux lignes de libellé STRICTEMENT identique.
 */

type Filter = "ALL" | "TO_REVIEW" | "MATCHED" | "READY" | "DONE";

export default function ReceptionDetailPage() {
  const params = useParams();
  const search = useSearchParams();
  const id = String(params?.id || "");
  const { can } = usePermissions();
  const canMatch = can("stock", "create");
  const canPutaway = can("stock", "validate");
  const [editHeader, setEditHeader] = useState(false);
  const [editLine, setEditLine] = useState<number | null>(null);
  const [addingLine, setAddingLine] = useState(false);

  const [data, setData] = useState<ReceptionDetail | null>(null);
  const [putaways, setPutaways] = useState<Putaway[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [query, setQuery] = useState("");
  const [openLine, setOpenLine] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [putawayTarget, setPutawayTarget] = useState<ReceptionLine[] | null>(null);

  const load = useCallback(async () => {
    const r = await authFetch(`/stock/receptions/${id}`, { cache: "no-store" });
    if (!r.ok) return setError(r.status === 404 ? "Réception introuvable." : "Erreur de chargement.");
    setData(await r.json());
    const p = await authFetch(`/stock/receptions/${id}/putaways`, { cache: "no-store" });
    if (p.ok) setPutaways(await p.json());
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  const lines = data?.lines || [];
  const warehouses = useMemo(
    () => [...new Set(lines.map((l) => l.warehouse_code || "").filter(Boolean))].sort(),
    [lines]
  );

  const isReady = (l: ReceptionLine) =>
    Boolean(l.product_id) && l.match_status !== "TO_REVIEW" && Number(l.quantity_remaining) > 0;

  const filtered = useMemo(() => lines.filter((l) => {
    if (warehouseFilter && l.warehouse_code !== warehouseFilter) return false;
    const q = query.trim().toLowerCase();
    if (q && !`${l.received_label} ${l.product_name || ""}`.toLowerCase().includes(q)) return false;
    if (filter === "TO_REVIEW") return l.match_status === "TO_REVIEW";
    if (filter === "MATCHED") return l.match_status !== "TO_REVIEW";
    if (filter === "READY") return isReady(l);
    if (filter === "DONE") return Number(l.quantity_remaining) <= 0;
    return true;
  }), [lines, filter, warehouseFilter, query]);

  const counts = useMemo(() => ({
    all: lines.length,
    review: lines.filter((l) => l.match_status === "TO_REVIEW").length,
    matched: lines.filter((l) => l.match_status !== "TO_REVIEW").length,
    ready: lines.filter(isReady).length,
    done: lines.filter((l) => Number(l.quantity_remaining) <= 0).length,
  }), [lines]);

  const selectedLines = useMemo(
    () => lines.filter((l) => selected.has(l.id) && isReady(l)),
    [lines, selected]
  );

  const toggle = (lineId: number) => setSelected((prev) => {
    const s = new Set(prev);
    if (s.has(lineId)) s.delete(lineId);
    else s.add(lineId);
    return s;
  });
  const toggleAllVisible = () => {
    const ready = filtered.filter(isReady).map((l) => l.id);
    setSelected((prev) => ready.every((x) => prev.has(x)) ? new Set() : new Set(ready));
  };

  const afterWrite = async (message: string) => {
    setNotice(message); setError(""); setSelected(new Set()); setOpenLine(null);
    setEditHeader(false); setEditLine(null); setAddingLine(false);
    await load();
  };

  /* Message d'arrivée depuis la saisie manuelle : on rappelle explicitement que
     rien n'a bougé côté stock. */
  useEffect(() => {
    if (search?.get("created") !== "1") return;
    setNotice(search.get("merged") === "1"
      ? "Les lignes ont rejoint la réception existante de ce conteneur — un conteneur ne donne jamais deux réceptions. Aucun stock modifié."
      : "Réception enregistrée. Aucun stock modifié : la marchandise est en attente de mise en stock.");
  }, [search]);

  const cancelReception = async () => {
    const reason = window.prompt(
      "Annuler cette réception ?\n\nElle restera visible avec le statut « Annulée » — rien n'est supprimé.\n\nMotif (facultatif) :"
    );
    if (reason === null) return;
    const r = await authFetch(`/stock/receptions/${id}/cancel`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason || null }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setError(d?.error || "Échec de l'annulation.");
    await afterWrite("Réception annulée. Aucun stock n'a été modifié.");
  };

  const removeLine = async (line: ReceptionLine) => {
    if (!window.confirm(`Supprimer la ligne ${line.line_no} « ${line.received_label} » ?`)) return;
    const r = await authFetch(`/stock/receptions/${id}/lines/${line.id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setError(d?.error || "Échec de la suppression.");
    await afterWrite(`Ligne ${line.line_no} supprimée. Aucun stock modifié.`);
  };

  const downloadCsv = async () => {
    const res = await fetch(apiUrl(`/stock/receptions/${id}/report`), { headers: authHeaders() });
    if (!res.ok) return setError("Erreur de génération du rapport.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `reception-${data?.reception.reception_number || id}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  if (error && !data) return <div className="p-8 font-semibold text-red-700">{error}</div>;
  if (!data) return <div className="p-8 text-gray-600">Chargement de la réception…</div>;

  const r = data.reception;
  const t = data.totals;
  const cancelled = r.status === "CANCELLED";
  const nothingPutaway = Number(t.putaway) <= 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <Link href="/stocks/receptions" className="text-sm font-bold text-blue-700">← Réceptions</Link>

        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 sm:text-3xl">{r.reception_number}</h1>
            <p className="mt-1 text-sm text-gray-600">
              Conteneur <span className="font-bold">{r.container_number || "—"}</span> ·
              reçu le <span className="font-bold">{fdate(r.reception_date)}</span> ·
              entrepôts <span className="font-bold">{r.warehouses || "—"}</span>
              {r.created_by_name ? <> · saisi par <span className="font-bold">{r.created_by_name}</span></> : null}
              {r.source_label ? <> · <span className="font-bold">{r.source_label}</span></> : null}
            </p>
            {(r.supplier_name || r.supplier_reference || r.carrier) && (
              <p className="text-sm text-gray-600">
                {r.supplier_name && <>Fournisseur <span className="font-bold">{r.supplier_name}</span> · </>}
                {r.supplier_reference && <>BL <span className="font-bold">{r.supplier_reference}</span> · </>}
                {r.carrier && <>Transporteur <span className="font-bold">{r.carrier}</span></>}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`self-center rounded-full px-3 py-1 text-xs font-bold ${STATUS_TONE[r.status] || "bg-gray-100 text-gray-700"}`}>
              {r.status_label}
            </span>
            <button onClick={downloadCsv} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-800">
              Rapport CSV
            </button>
            <Link href={`/stocks/receptions/${id}/print`} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-800">
              Bon de réception
            </Link>
            {putaways.length > 0 && (
              <Link href={`/stocks/receptions/${id}/mise-en-stock`} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-800">
                Bons de mise en stock
              </Link>
            )}
            {canMatch && !cancelled && (
              <button onClick={() => setEditHeader((v) => !v)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-800">
                {editHeader ? "Fermer" : "Corriger l'en-tête"}
              </button>
            )}
            {canPutaway && !cancelled && nothingPutaway && (
              <button onClick={cancelReception}
                      className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-700">
                Annuler la réception
              </button>
            )}
          </div>
        </div>

        {cancelled && (
          <p className="mt-4 rounded-xl bg-gray-200 p-3 text-sm font-semibold text-gray-800">
            Réception annulée{r.cancel_reason ? ` — ${r.cancel_reason}` : ""}. Elle reste conservée
            pour l&apos;historique ; aucune mise en stock n&apos;a été effectuée et aucun stock n&apos;a été modifié.
          </p>
        )}

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
        {notice && (
          <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">
            {notice} <button onClick={() => setNotice("")} className="underline">fermer</button>
          </p>
        )}

        {editHeader && canMatch && !cancelled && (
          <HeaderForm reception={r} lockedIdentity={!nothingPutaway} receptionId={id}
                      onDone={afterWrite} onError={setError} onClose={() => setEditHeader(false)} />
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Box label="Lignes" value={n(t.lines)} />
          <Box label="Total reçu" value={n(t.received)} />
          <Box label="Total rangé (en stock)" value={n(t.putaway)} tone="text-green-700" />
          <Box label="Reste à ranger" value={n(t.pending)} tone="text-amber-700" />
        </div>

        {/* ---------- FILTRES ---------- */}
        <section id="mise-en-stock" className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Chip on={filter === "ALL"} onClick={() => setFilter("ALL")}>Toutes ({counts.all})</Chip>
            <Chip on={filter === "TO_REVIEW"} onClick={() => setFilter("TO_REVIEW")} tone="amber">À vérifier ({counts.review})</Chip>
            <Chip on={filter === "MATCHED"} onClick={() => setFilter("MATCHED")} tone="green">Associé ({counts.matched})</Chip>
            <Chip on={filter === "READY"} onClick={() => setFilter("READY")} tone="blue">Prêt à ranger ({counts.ready})</Chip>
            <Chip on={filter === "DONE"} onClick={() => setFilter("DONE")}>Rangé ({counts.done})</Chip>
            <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
              <option value="">Tous les entrepôts</option>
              {warehouses.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un produit…"
                   className="min-w-[200px] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
          </div>

          {counts.review > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <span className="font-bold">{n(counts.review)} ligne(s) restent à vérifier.</span>{" "}
              Associez chaque libellé reçu à une fiche produit — ou créez la fiche manquante — avant la mise en stock.
              Les suggestions sont une aide au classement, jamais une décision automatique.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={toggleAllVisible} className="text-sm font-bold text-blue-700">
              Sélectionner les lignes prêtes affichées
            </button>
            {canMatch && !cancelled && (
              <button onClick={() => setAddingLine((v) => !v)} className="text-sm font-bold text-indigo-700">
                {addingLine ? "Fermer l'ajout" : "+ Ajouter un produit"}
              </button>
            )}
            {selectedLines.length > 0 && canPutaway && (
              <button onClick={() => setPutawayTarget(selectedLines)}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">
                Mettre en stock les {selectedLines.length} ligne(s) sélectionnée(s)
              </button>
            )}
          </div>

          {addingLine && canMatch && !cancelled && (
            <AddLineForm receptionId={id} onDone={afterWrite} onError={setError}
                         onClose={() => setAddingLine(false)} />
          )}

          {/* ---------- LIGNES ---------- */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-2 w-8"></th>
                  <th className="p-2">#</th>
                  <th className="p-2">Libellé reçu</th>
                  <th className="p-2">Produit Triangle</th>
                  <th className="p-2">Entrepôt</th>
                  <th className="p-2 text-right">Reçu</th>
                  <th className="p-2 text-right">Rangé</th>
                  <th className="p-2 text-right">Reste</th>
                  <th className="p-2">Unité</th>
                  <th className="p-2">Statut</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!filtered.length && <tr><td colSpan={11} className="p-6 text-center text-gray-500">Aucune ligne pour ce filtre.</td></tr>}
                {filtered.map((l) => (
                  <Fragment key={l.id}>
                    <tr className={selected.has(l.id) ? "bg-blue-50" : "hover:bg-gray-50"}>
                      <td className="p-2">
                        <input type="checkbox" disabled={!isReady(l)} checked={selected.has(l.id)}
                               onChange={() => toggle(l.id)} aria-label={`Sélectionner ligne ${l.line_no}`} />
                      </td>
                      <td className="p-2 text-gray-500">{l.line_no}</td>
                      <td className="p-2 font-semibold text-gray-900">{l.received_label}</td>
                      <td className="p-2">
                        {l.product_name
                          ? <span className="text-gray-800">{l.product_name}{l.product_stock != null && <span className="text-xs text-gray-500"> (stock {n(l.product_stock)})</span>}</span>
                          : <span className="text-amber-700">non associé</span>}
                      </td>
                      <td className="p-2 text-xs font-bold">{l.warehouse_code || "—"}</td>
                      <td className="p-2 text-right font-bold">{n(l.quantity_received)}</td>
                      <td className="p-2 text-right text-green-700">{n(l.quantity_putaway)}</td>
                      <td className="p-2 text-right font-bold text-amber-700">{n(l.quantity_remaining)}</td>
                      <td className="p-2 text-xs">{l.unit}</td>
                      <td className="p-2">
                        <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${MATCH_TONE[l.match_status] || "bg-gray-100 text-gray-700"}`}>
                          {MATCH_LABEL[l.match_status] || l.match_status}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="flex justify-end gap-2 whitespace-nowrap text-xs font-bold">
                          {canMatch && !cancelled && (
                            <button onClick={() => setOpenLine(openLine === l.id ? null : l.id)} className="text-blue-700">
                              {openLine === l.id ? "Fermer" : l.product_id ? "Changer" : "Associer"}
                            </button>
                          )}
                          {/* Une ligne déjà rangée n'est plus corrigible ni supprimable :
                              le mouvement de stock passé ne lui correspondrait plus. */}
                          {canMatch && !cancelled && Number(l.quantity_putaway) <= 0 && (
                            <>
                              <button onClick={() => setEditLine(editLine === l.id ? null : l.id)} className="text-gray-700">
                                {editLine === l.id ? "Fermer" : "Corriger"}
                              </button>
                              <button onClick={() => removeLine(l)} className="text-red-700">Supprimer</button>
                            </>
                          )}
                          {canPutaway && !cancelled && isReady(l) && (
                            <button onClick={() => setPutawayTarget([l])} className="text-slate-900">Ranger</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {openLine === l.id && (
                      <tr>
                        <td colSpan={11} className="bg-gray-50 p-0">
                          <MatchPanel line={l} receptionId={id}
                                      onDone={afterWrite} onError={setError}
                                      onClose={() => setOpenLine(null)} />
                        </td>
                      </tr>
                    )}
                    {editLine === l.id && (
                      <tr>
                        <td colSpan={11} className="bg-gray-50 p-0">
                          <LineForm line={l} receptionId={id} onDone={afterWrite}
                                    onError={setError} onClose={() => setEditLine(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- HISTORIQUE DES MISES EN STOCK ---------- */}
        {putaways.length > 0 && (
          <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black text-gray-900">Mises en stock effectuées</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="p-2">Date</th><th className="p-2">Produit</th>
                    <th className="p-2 text-right">Quantité</th><th className="p-2">Entrepôt</th>
                    <th className="p-2">Emplacement</th><th className="p-2 text-right">Stock avant</th>
                    <th className="p-2 text-right">Stock après</th><th className="p-2">Par</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {putaways.map((p) => (
                    <tr key={p.id}>
                      <td className="p-2 text-xs">{fdatetime(p.created_at)}</td>
                      <td className="p-2 font-semibold">{p.product_name}</td>
                      <td className="p-2 text-right font-bold">{n(p.quantity)}</td>
                      <td className="p-2 text-xs font-bold">{p.warehouse_code || "—"}</td>
                      <td className="p-2 text-xs">{p.location_code || "—"}</td>
                      <td className="p-2 text-right text-gray-600">{n(p.stock_before)}</td>
                      <td className="p-2 text-right font-bold text-green-700">{n(p.stock_after)}</td>
                      <td className="p-2 text-xs">{p.created_by_name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {putawayTarget && (
        <PutawayModal lines={putawayTarget} receptionId={id}
                      onClose={() => setPutawayTarget(null)}
                      onDone={async (m) => { setPutawayTarget(null); await afterWrite(m); }}
                      onError={setError} />
      )}
    </div>
  );
}

/* ========================= CORRECTION AVANT MISE EN STOCK ========================= */

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

/**
 * En-tête corrigible. Conteneur et date se figent dès qu'une ligne est rangée :
 * ils figurent sur des bons de mise en stock déjà émis. Fournisseur, BL,
 * transporteur et notes restent corrigibles — ils n'ont aucun effet sur le stock.
 */
function HeaderForm({ reception, lockedIdentity, receptionId, onDone, onError, onClose }: {
  reception: ReceptionDetail["reception"]; lockedIdentity: boolean; receptionId: string;
  onDone: (m: string) => void; onError: (m: string) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    containerNumber: reception.container_number || "",
    receptionDate: (reception.reception_date || "").slice(0, 10),
    supplierName: reception.supplier_name || "",
    supplierReference: reception.supplier_reference || "",
    carrier: reception.carrier || "",
    notes: reception.notes || "",
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const patch: Record<string, string> = {
      supplierName: form.supplierName, supplierReference: form.supplierReference,
      carrier: form.carrier, notes: form.notes,
    };
    if (!lockedIdentity) {
      patch.containerNumber = form.containerNumber;
      patch.receptionDate = form.receptionDate;
    }
    const r = await authFetch(`/stock/receptions/${receptionId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return onError(d?.error || "Échec de la correction.");
    onDone("En-tête corrigé. Aucun stock modifié.");
  };

  return (
    <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <h2 className="text-lg font-black text-gray-900">Corriger l&apos;en-tête</h2>
      {lockedIdentity && (
        <p className="mt-1 rounded-lg bg-white p-2 text-xs text-gray-700">
          Une partie de cette réception est déjà rangée : le conteneur et la date sont
          <span className="font-bold"> figés</span>, car ils figurent sur des bons de mise en stock
          déjà émis. Les autres champs restent corrigibles.
        </p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Numéro de conteneur">
          <input value={form.containerNumber} disabled={lockedIdentity}
                 onChange={(e) => setForm({ ...form, containerNumber: e.target.value.toUpperCase() })}
                 className={`${INPUT} disabled:bg-gray-100 disabled:text-gray-500`} />
        </Field>
        <Field label="Date de réception">
          <input type="date" value={form.receptionDate} disabled={lockedIdentity}
                 onChange={(e) => setForm({ ...form, receptionDate: e.target.value })}
                 className={`${INPUT} disabled:bg-gray-100 disabled:text-gray-500`} />
        </Field>
        <Field label="Fournisseur">
          <input value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} className={INPUT} />
        </Field>
        <Field label="Référence / BL fournisseur">
          <input value={form.supplierReference} onChange={(e) => setForm({ ...form, supplierReference: e.target.value })} className={INPUT} />
        </Field>
        <Field label="Transporteur">
          <input value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} className={INPUT} />
        </Field>
        <Field label="Notes">
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={INPUT} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700">
          Annuler
        </button>
        <button onClick={save} disabled={busy}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {busy ? "Enregistrement…" : "Enregistrer les corrections"}
        </button>
      </div>
    </section>
  );
}

/** Correction d'une ligne non rangée. Le serveur refuse toute ligne déjà rangée. */
function LineForm({ line, receptionId, onDone, onError, onClose }: {
  line: ReceptionLine; receptionId: string;
  onDone: (m: string) => void; onError: (m: string) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    label: line.received_label, quantity: String(Number(line.quantity_received)),
    unit: line.unit || "EACH", warehouseCode: line.warehouse_code || WAREHOUSE_CODES[0],
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!(Number(form.quantity) > 0)) return onError("Quantité invalide.");
    setBusy(true);
    const r = await authFetch(`/stock/receptions/${receptionId}/lines/${line.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: form.label, quantity: Number(form.quantity),
        unit: form.unit, warehouseCode: form.warehouseCode,
        ...(form.notes ? { notes: form.notes } : {}),
      }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return onError(d?.error || "Échec de la correction.");
    onDone(`Ligne ${line.line_no} corrigée. Aucun stock modifié.`);
  };

  return (
    <div className="border-l-4 border-gray-400 p-4">
      <p className="text-sm font-bold text-gray-900">Corriger la ligne {line.line_no}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Désignation reçue">
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={INPUT} />
        </Field>
        <Field label="Quantité reçue">
          <input type="number" min={1} value={form.quantity}
                 onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={INPUT} />
        </Field>
        <Field label="Unité">
          <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={INPUT} />
        </Field>
        <Field label="Entrepôt destination">
          <select value={form.warehouseCode}
                  onChange={(e) => setForm({ ...form, warehouseCode: e.target.value })} className={INPUT}>
            {[...new Set([...WAREHOUSE_CODES, form.warehouseCode])].map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2 lg:col-span-4">
          <Field label="Notes" hint="facultatif">
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={INPUT} />
          </Field>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={save} disabled={busy}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700">
          Annuler
        </button>
      </div>
    </div>
  );
}

/** Ajout d'une ligne à une réception existante — aucun effet sur le stock. */
function AddLineForm({ receptionId, onDone, onError, onClose }: {
  receptionId: string; onDone: (m: string) => void; onError: (m: string) => void; onClose: () => void;
}) {
  const [product, setProduct] = useState<ProductHit | null>(null);
  const [form, setForm] = useState({
    label: "", quantity: "", unit: "EACH", warehouseCode: WAREHOUSE_CODES[0], notes: "",
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const label = (form.label || product?.name || "").trim();
    if (!label) return onError("Désignation reçue obligatoire.");
    if (!(Number(form.quantity) > 0)) return onError("Quantité invalide.");
    setBusy(true);
    const r = await authFetch(`/stock/receptions/${receptionId}/lines`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: [{
          label, productId: product?.id || null, quantity: Number(form.quantity),
          unit: form.unit || product?.unit || "EACH",
          warehouseCode: form.warehouseCode, notes: form.notes || null,
        }],
      }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return onError(d?.error || "Échec de l'ajout.");
    onDone(`Ligne ajoutée : ${n(form.quantity)} × « ${label} » sur ${form.warehouseCode}. Aucun stock modifié.`);
  };

  return (
    <section className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
      <p className="text-sm font-bold text-gray-900">Ajouter un produit à cette réception</p>
      <div className="mt-2">
        <ProductSearchSelect
          value={product}
          onSelect={(p) => {
            setProduct(p);
            setForm((f) => ({ ...f, label: p ? p.name : f.label, unit: p?.unit || f.unit }));
          }}
          placeholder="Rechercher un produit… (laissez vide si le produit n'existe pas encore)"
        />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Désignation reçue">
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className={INPUT} />
        </Field>
        <Field label="Quantité reçue">
          <input type="number" min={1} value={form.quantity}
                 onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={INPUT} />
        </Field>
        <Field label="Unité">
          <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={INPUT} />
        </Field>
        <Field label="Entrepôt destination">
          <select value={form.warehouseCode}
                  onChange={(e) => setForm({ ...form, warehouseCode: e.target.value })} className={INPUT}>
            {WAREHOUSE_CODES.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </Field>
      </div>
      {!product && form.label.trim() && (
        <p className="mt-2 rounded-lg bg-white p-2 text-xs text-amber-900">
          Sans produit Triangle, la ligne sera enregistrée <span className="font-bold">à vérifier</span> :
          elle appartient à la réception mais pas au stock disponible.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={save} disabled={busy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {busy ? "Ajout…" : "Ajouter la ligne"}
        </button>
        <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700">
          Fermer
        </button>
      </div>
    </section>
  );
}

/* ============================ AIDE AU RAPPROCHEMENT ============================ */

function MatchPanel({ line, receptionId, onDone, onError, onClose }: {
  line: ReceptionLine; receptionId: string;
  onDone: (m: string) => void; onError: (m: string) => void; onClose: () => void;
}) {
  const [sug, setSug] = useState<Suggestion[]>([]);
  const [exactCount, setExactCount] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [applyAll, setApplyAll] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: line.received_label, unit: line.unit || "EACH", category: "" });

  const fetchSug = useCallback(async (q: string) => {
    setLoading(true);
    const url = `/stock/receptions/lines/${line.id}/suggestions?limit=${q ? 8 : 3}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
    const r = await authFetch(url, { cache: "no-store" });
    if (r.ok) { const d = await r.json(); setSug(d.suggestions || []); setExactCount(d.exactCount || 0); }
    setLoading(false);
  }, [line.id]);
  useEffect(() => { fetchSug(""); }, [fetchSug]);

  const associate = async (productId: number) => {
    setBusy(true);
    const r = await authFetch(`/stock/receptions/lines/${line.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, applyToIdentical: applyAll, receptionId: Number(receptionId) }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return onError(d?.error || "Échec de l'association.");
    onDone(d.count > 1
      ? `Produit « ${d.product.name} » associé à ${d.count} lignes de libellé identique. Aucun stock modifié.`
      : `Produit « ${d.product.name} » associé à la ligne ${line.line_no}. Aucun stock modifié.`);
  };

  const createProduct = async () => {
    setBusy(true);
    const r = await authFetch(`/stock/receptions/lines/${line.id}/product`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return onError(d?.error || "Échec de la création du produit.");
    onDone(`Fiche produit « ${d.product.name} » créée (référence ${d.product.reference}, stock initial 0) et associée à la ligne ${line.line_no}.`);
  };

  return (
    <div className="border-l-4 border-blue-400 p-4">
      <p className="text-sm text-gray-700">
        Libellé reçu : <span className="font-bold text-gray-900">{line.received_label}</span>
        {line.excel_sheet && <span className="text-xs text-gray-500"> · {line.excel_sheet} ligne {line.excel_row}</span>}
      </p>
      {exactCount > 1 && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-800">
          {exactCount} fiches portent exactement ce nom. Choisissez laquelle est la bonne — deux produits
          ne sont jamais fusionnés automatiquement.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
               onKeyDown={(e) => { if (e.key === "Enter") fetchSug(search); }}
               placeholder="Rechercher un autre produit…"
               className="min-w-[240px] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
        <button onClick={() => fetchSug(search)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-bold">
          Rechercher
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {loading && <p className="text-sm text-gray-500">Recherche des correspondances…</p>}
        {!loading && !sug.length && <p className="text-sm text-gray-500">Aucun produit approchant.</p>}
        {sug.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3">
            <div className="min-w-0">
              <p className="font-bold text-gray-900">{s.name}</p>
              <p className="text-xs text-gray-500">
                {s.reference || "sans référence"} · stock {n(s.stock)} · {s.unit || "—"}
                {s.warehouse ? ` · ${s.warehouse}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ${
                s.score >= 90 ? "bg-green-100 text-green-800"
                : s.score >= 70 ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-gray-600"}`}>
                {s.score}%
              </span>
              <button onClick={() => associate(s.id)} disabled={busy}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">
                Associer à ce produit
              </button>
            </div>
          </div>
        ))}
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
        Appliquer cette correspondance aux lignes de libellé <span className="font-bold">strictement identique</span> de cette réception
      </label>

      <div className="mt-3 flex flex-wrap gap-3">
        <button onClick={() => setCreating((v) => !v)} className="text-sm font-bold text-indigo-700">
          {creating ? "Annuler la création" : "Créer ce produit"}
        </button>
        <button onClick={onClose} className="text-sm font-bold text-gray-600">Laisser à vérifier</button>
      </div>

      {creating && (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-xs text-indigo-900">
            La fiche est créée avec un <span className="font-bold">stock initial de 0</span> : la quantité
            n&apos;entrera en stock qu&apos;à la mise en stock. L&apos;emplacement est demandé à ce moment-là.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-bold text-gray-700">Nom
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                     className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-bold text-gray-700">Unité
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                     className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-normal" />
            </label>
            <label className="text-xs font-bold text-gray-700">Catégorie (facultative)
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                     className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-normal" />
            </label>
          </div>
          <button onClick={createProduct} disabled={busy || !form.name.trim()}
                  className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
            {busy ? "Création…" : "Créer la fiche et associer"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================== MISE EN STOCK ============================== */

function PutawayModal({ lines, receptionId, onClose, onDone, onError }: {
  lines: ReceptionLine[]; receptionId: string;
  onClose: () => void; onDone: (m: string) => void; onError: (m: string) => void;
}) {
  const [qty, setQty] = useState<Record<number, string>>(
    () => Object.fromEntries(lines.map((l) => [l.id, String(Number(l.quantity_remaining))]))
  );
  const [loc, setLoc] = useState({ row: "", location: "", level: "", bin: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const total = lines.reduce((s, l) => s + Number(qty[l.id] || 0), 0);
  const warehouses = [...new Set(lines.map((l) => l.warehouse_code || "—"))];
  const invalid = lines.filter((l) => {
    const q = Number(qty[l.id] || 0);
    return !(q > 0) || q > Number(l.quantity_remaining);
  });

  const submit = async () => {
    if (invalid.length) return onError("Quantité invalide : elle doit être positive et ne pas dépasser le reste à ranger.");
    setBusy(true);
    const items = lines.map((l) => ({
      lineId: l.id, quantity: Number(qty[l.id]), productId: l.product_id,
      locationCode: buildLocationCode(l.warehouse_code || "", loc) || null,
    }));
    const url = items.length === 1
      ? `/stock/receptions/${receptionId}/putaway`
      : `/stock/receptions/${receptionId}/putaway-bulk`;
    const body = items.length === 1 ? items[0] : { items };
    const r = await authFetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok && !d?.done?.length) return onError(d?.error || d?.failed?.[0]?.error || "Échec de la mise en stock.");
    if (items.length === 1) {
      return onDone(`Mise en stock effectuée : ${n(items[0].quantity)} unité(s), stock ${n(d.stockBefore)} → ${n(d.stockAfter)}.`);
    }
    const failed = (d.failed || []).length;
    onDone(`${d.done.length} ligne(s) mises en stock (${n(d.quantityPutaway)} unités)`
      + (failed ? `, ${failed} en échec : ${d.failed.map((f: { error: string }) => f.error).join(" | ")}` : "."));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-gray-900">Mise en stock</h2>
            <p className="text-sm text-gray-600">
              C&apos;est la seule action de cet écran qui modifie le stock disponible.
            </p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-gray-400">×</button>
        </div>

        {/* Résumé avant validation */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Box label="Lignes" value={n(lines.length)} />
          <Box label="Quantité à ranger" value={n(total)} tone="text-blue-700" />
          <Box label="Entrepôts" value={warehouses.join(", ")} />
          <Box label="Produits" value={n(new Set(lines.map((l) => l.product_id)).size)} />
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-2">Produit</th><th className="p-2">Entrepôt</th>
                <th className="p-2 text-right">Reste</th><th className="p-2 text-right">À ranger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((l) => (
                <tr key={l.id}>
                  <td className="p-2">
                    <p className="font-semibold text-gray-900">{l.product_name || l.received_label}</p>
                    <p className="text-xs text-gray-500">{l.received_label}</p>
                  </td>
                  <td className="p-2 text-xs font-bold">{l.warehouse_code || "—"}</td>
                  <td className="p-2 text-right">{n(l.quantity_remaining)}</td>
                  <td className="p-2 text-right">
                    <input type="number" min={1} max={Number(l.quantity_remaining)} value={qty[l.id] ?? ""}
                           onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })}
                           className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Mise en stock partielle possible : rangez une partie maintenant, le reste plus tard.
          Le reste à ranger est recalculé à chaque opération.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["row", "location", "level", "bin"] as const).map((k) => (
            <label key={k} className="text-xs font-bold uppercase text-gray-600">
              {k === "row" ? "Row" : k === "location" ? "Location" : k === "level" ? "Level" : "Bin"}
              <input value={loc[k]} onChange={(e) => setLoc({ ...loc, [k]: e.target.value })}
                     className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-normal normal-case" />
            </label>
          ))}
        </div>
        {buildLocationCode(lines[0]?.warehouse_code || "", loc) && (
          <p className="mt-2 text-xs text-gray-600">
            Emplacement : <span className="font-bold">{buildLocationCode(lines[0]?.warehouse_code || "", loc)}</span>
            {lines.length > 1 && " — appliqué à toutes les lignes sélectionnées."}
          </p>
        )}

        {invalid.length > 0 && (
          <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-800">
            {invalid.length} ligne(s) ont une quantité invalide (doit être &gt; 0 et ≤ reste à ranger).
          </p>
        )}

        <label className="mt-4 flex items-start gap-2 text-sm text-gray-800">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
          Je confirme la mise en stock de <span className="font-bold">{n(total)} unité(s)</span> sur{" "}
          <span className="font-bold">{warehouses.join(", ")}</span> — le stock disponible sera augmenté d&apos;autant.
        </label>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700">
            Annuler
          </button>
          <button onClick={submit} disabled={!confirmed || busy || invalid.length > 0}
                  className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-40">
            {busy ? "Mise en stock…" : "Mettre en stock"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================ ÉLÉMENTS ================================ */

function Box({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`truncate text-lg font-black ${tone || "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function Chip({ on, onClick, children, tone = "slate" }: {
  on: boolean; onClick: () => void; children: React.ReactNode; tone?: string;
}) {
  const active: Record<string, string> = {
    slate: "bg-slate-900 text-white", amber: "bg-amber-500 text-white",
    green: "bg-green-600 text-white", blue: "bg-blue-600 text-white",
  };
  return (
    <button onClick={onClick}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${on ? (active[tone] || active.slate) : "bg-gray-100 text-gray-700"}`}>
      {children}
    </button>
  );
}
