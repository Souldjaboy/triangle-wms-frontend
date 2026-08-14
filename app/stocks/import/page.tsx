"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { authFetch, apiUrl, authHeaders } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";

/**
 * ASSISTANT D'IMPORT D'INVENTAIRE EXCEL — 7 étapes.
 *
 * L'analyse (preview) n'écrit RIEN : elle peut être relancée sans risque.
 * Seule l'étape 6 applique quoi que ce soit, et uniquement sur confirmation
 * explicite. Les cas ambigus, TO_REVIEW et DB_ONLY sont affichés comme
 * PROTÉGÉS : leur stock n'est jamais modifié, et l'écran le dit clairement
 * plutôt que de laisser croire qu'ils seront traités.
 */

type Preview = {
  fileName: string; hash: string; rowsRead: number;
  alreadyImported: { id: number; imported_at: string } | null;
  totals: Record<string, number | Record<string, number>>;
  documents: Record<string, number>;
  preAdjustments: { product: { id: number | null; name: string }; stockBefore: number; counted: number; delta: number; out?: number }[];
  entries: { product: { name: string }; quantity: number }[];
  exits: { product: { name: string }; quantity: number }[];
  writeOffs: { product: { name: string }; quantity: number }[];
  transfers: unknown[];
  blockingErrors: { product: { name: string }; failingStep: string; stockAtFailure: number;
                    dbStock: number; in: number; out: number; message: string }[];
  newProducts: { desc: string; unit: string; initialStock: number }[];
  blocked: { desc: string; reason: string; suggestions?: string[] }[];
  toReview: { desc: string; action: string; reason: string | null; dbStock: number | null; suggestions?: string[] }[];
  dbOnly: { name: string; stock: number }[];
};
type Result = {
  importId: number;
  created: {
    products: { name: string }[]; entries: unknown[]; exits: unknown[];
    writeOffs: unknown[]; priorAdjustments: unknown[];
    documents: { type: string; number: string; id: number }[];
    skipped: { product: string; reason: string }[];
  };
};

const STEPS = ["Fichier", "Analyse", "Correspondances", "Mouvements", "Vérification", "Confirmation", "Résultat"];
const n = (v: unknown) => Number(v || 0).toLocaleString("fr-FR");
const signed = (v: number) => (v >= 0 ? "+" : "−") + n(Math.abs(v));

const BADGE: Record<string, string> = {
  MATCH: "bg-green-100 text-green-800",
  MOVEMENT_ONLY: "bg-blue-100 text-blue-800",
  NEW_PRODUCT: "bg-indigo-100 text-indigo-800",
  QUANTITY_CONFLICT: "bg-orange-100 text-orange-800",
  TO_REVIEW: "bg-amber-100 text-amber-900",
  AMBIGUOUS_PRODUCT: "bg-red-100 text-red-800",
  DB_ONLY: "bg-gray-200 text-gray-700",
};
function Badge({ action }: { action: string }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${BADGE[action] || "bg-gray-100 text-gray-700"}`}>
      {action.replace(/_/g, " ")}
    </span>
  );
}
function Box({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-black ${tone || "text-gray-900"}`}>{value}</p>
    </div>
  );
}

export default function ImportInventairePage() {
  const { can } = usePermissions();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canApply = can("stock", "validate");

  const loadHistory = useCallback(async () => {
    const r = await authFetch("/inventory-import/history");
    if (r.ok) setHistory(await r.json());
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const analyse = async () => {
    if (!file) return setError("Choisissez d'abord un fichier.");
    setError(""); setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await authFetch("/inventory-import/preview", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d?.error || "Échec de l'analyse.");
    setPreview(d);
    setStep(1);
  };

  const execute = async () => {
    if (!file || !preview) return;
    setError(""); setBusy(true);                 // désactive le bouton : pas de double-clic
    const fd = new FormData();
    fd.append("file", file);
    fd.append("confirmedHash", preview.hash);    // refuse un autre fichier que celui analysé
    const res = await authFetch("/inventory-import/execute", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d?.error || "Échec de l'import.");
    setResult(d);
    setStep(6);
    await loadHistory();
  };

  /* Le rapport est un téléchargement authentifié : on passe par fetch pour
     porter le jeton, puis on déclenche l'enregistrement du blob. */
  const downloadReport = async (importId: number) => {
    const res = await fetch(apiUrl(`/inventory-import/${importId}/report`), { headers: authHeaders() });
    if (!res.ok) return setError("Rapport indisponible.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `import-inventaire-${importId}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const t = (preview?.totals || {}) as Record<string, number>;
  const byAction = (preview?.totals?.byAction || {}) as Record<string, number>;
  const protectedCount = (preview?.blocked.length || 0) + (preview?.toReview.length || 0) + (preview?.dbOnly.length || 0);
  /* Une seule erreur bloquante interdit la confirmation : l'utilisateur doit
     l'apprendre AVANT de cliquer, pas par un 409 après coup. */
  const blocking = preview?.blockingErrors || [];
  const hasBlocking = blocking.length > 0;

  const matchRows = useMemo(() => {
    if (!preview) return [];
    return [
      ...preview.toReview.map((r) => ({ desc: r.desc, action: r.action, dbStock: r.dbStock, note: r.reason || "", sugg: r.suggestions || [] })),
      ...preview.newProducts.map((p) => ({ desc: p.desc, action: "NEW_PRODUCT", dbStock: null, note: `stock initial ${n(p.initialStock)}`, sugg: [] })),
      ...preview.dbOnly.map((p) => ({ desc: p.name, action: "DB_ONLY", dbStock: p.stock, note: "Absent du fichier — stock conservé", sugg: [] })),
    ];
  }, [preview]);

  if (!can("stock", "view")) {
    return <main className="p-8 font-semibold text-gray-700">Vous n&apos;avez pas accès aux stocks.</main>;
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-yellow-600">TRIANGLE WMS PRO</p>
            <h1 className="text-3xl font-black text-gray-900">Importer / Actualiser depuis Excel</h1>
          </div>
          <Link href="/stocks" className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">← Stocks</Link>
        </div>

        {/* Fil des étapes */}
        <ol className="flex flex-wrap gap-2 text-xs font-bold">
          {STEPS.map((s, i) => (
            <li key={s} className={`rounded-full px-3 py-1.5 ${
              i === step ? "bg-yellow-500 text-black" : i < step ? "bg-green-100 text-green-800" : "bg-white text-gray-500"}`}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>

        {error && <div className="rounded-xl bg-red-50 p-4 font-semibold text-red-800">{error}</div>}

        {/* ÉTAPE 1 — fichier */}
        {step === 0 && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-black text-gray-900">1. Choisir le fichier</h2>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setError(""); }}
              className="mt-4 block w-full rounded-xl border border-gray-300 p-3 text-gray-900" />
            {file && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Box label="Fichier" value={file.name} />
                <Box label="Taille" value={`${(file.size / 1024).toFixed(0)} Ko`} />
                <Box label="Sélectionné le" value={new Date().toLocaleString("fr-FR")} />
              </div>
            )}
            <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-900">
              L&apos;analyse ne modifie rien : elle peut être relancée autant de fois que nécessaire.
            </p>
            <button onClick={analyse} disabled={!file || busy}
              className="mt-4 rounded-xl bg-slate-900 px-6 py-3 font-black text-white disabled:opacity-50">
              {busy ? "Analyse en cours…" : "Analyser le fichier"}
            </button>
          </section>
        )}

        {/* ÉTAPE 2 — analyse */}
        {step === 1 && preview && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-black text-gray-900">2. Analyse</h2>
            {preview.alreadyImported && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">
                Ce fichier a déjà été importé (import #{preview.alreadyImported.id}). Un nouvel import sera refusé.
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Box label="Lignes lues" value={n(preview.rowsRead)} />
              <Box label="Produits en base" value={n(t.dbProducts)} />
              <Box label="Stock actuel" value={n(t.dbStock)} />
              <Box label="Nouveaux produits" value={n(preview.newProducts.length)} />
              <Box label="Entrées" value={signed(t.totalIn)} tone="text-green-700" />
              <Box label="Sorties" value={signed(-t.totalOut)} tone="text-red-700" />
              <Box label="Ajustements préalables" value={signed(t.totalPriorAdjustments)} />
              <Box label="Stock final prévu" value={n(t.stockAfter)} tone="text-blue-800" />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(0)} className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">← Retour</button>
              <button onClick={() => setStep(2)} className="rounded-xl bg-slate-900 px-5 py-2 font-bold text-white">Voir les correspondances →</button>
            </div>
          </section>
        )}

        {/* ÉTAPE 3 — correspondances */}
        {step === 2 && preview && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-black text-gray-900">3. Correspondance des produits</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(byAction).map(([k, v]) => (
                <span key={k} className="flex items-center gap-2 text-xs">
                  <Badge action={k} /><b className="text-gray-900">{v}</b>
                </span>
              ))}
              <span className="flex items-center gap-2 text-xs"><Badge action="DB_ONLY" /><b>{preview.dbOnly.length}</b></span>
            </div>
            <div className="mt-4 max-h-[26rem] overflow-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 text-left">
                  <tr>
                    <th className="p-3">Produit</th><th className="p-3">Action</th>
                    <th className="p-3 text-right">Stock DB</th><th className="p-3">Note / suggestion</th>
                  </tr>
                </thead>
                <tbody>
                  {matchRows.map((r, i) => (
                    <tr key={`${r.desc}-${i}`} className="border-t">
                      <td className="p-3 font-semibold text-gray-900">{r.desc}</td>
                      <td className="p-3"><Badge action={r.action} /></td>
                      <td className="p-3 text-right">{r.dbStock == null ? "—" : n(r.dbStock)}</td>
                      <td className="p-3 text-gray-600">{r.note}{r.sugg.length ? ` — ${r.sugg.join(", ")}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(1)} className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">← Retour</button>
              <button onClick={() => setStep(3)} className="rounded-xl bg-slate-900 px-5 py-2 font-bold text-white">Voir les mouvements →</button>
            </div>
          </section>
        )}

        {/* ÉTAPE 4 — mouvements et documents */}
        {step === 3 && preview && (
          <section className="space-y-4">
            <div className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-lg font-black text-gray-900">4. Mouvements prévus</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Box label="Ajust. préalables" value={n(preview.preAdjustments.length)} />
                <Box label="Entrées" value={n(preview.entries.length)} />
                <Box label="Sorties" value={n(preview.exits.length)} />
                <Box label="Write-off" value={n(preview.writeOffs.length)} />
                <Box label="Transferts" value={n(preview.transfers.length)} />
                <Box label="Nouveaux produits" value={n(preview.newProducts.length)} />
              </div>
              {preview.preAdjustments.length > 0 && (
                <>
                  <h3 className="mt-5 font-black text-gray-900">Ajustements préalables</h3>
                  <p className="text-xs text-gray-500">
                    Le stock est aligné sur la quantité physiquement constatée AVANT d&apos;appliquer les mouvements.
                  </p>
                  <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 text-left"><tr>
                        <th className="p-2">Produit</th><th className="p-2 text-right">Stock DB</th>
                        <th className="p-2 text-right">Constaté</th><th className="p-2 text-right">Écart</th>
                        <th className="p-2 text-right">Puis sortie</th></tr></thead>
                      <tbody>
                        {preview.preAdjustments.map((a, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{a.product.name}</td>
                            <td className="p-2 text-right">{n(a.stockBefore)}</td>
                            <td className="p-2 text-right font-semibold">{n(a.counted)}</td>
                            <td className="p-2 text-right">{signed(a.delta)}</td>
                            <td className="p-2 text-right">{a.out ? `− ${n(a.out)}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="rounded-2xl bg-white p-6 shadow">
              <h3 className="font-black text-gray-900">Documents qui seront créés</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {Object.entries(preview.documents).map(([k, v]) => <Box key={k} label={k} value={n(v)} />)}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">← Retour</button>
              <button onClick={() => setStep(4)} className="rounded-xl bg-slate-900 px-5 py-2 font-bold text-white">Vérification →</button>
            </div>
          </section>
        )}

        {/* ÉTAPE 5 — vérification */}
        {step === 4 && preview && (
          <section className="space-y-4">
            <div className="rounded-2xl bg-white p-6 shadow">
              <h2 className="text-lg font-black text-gray-900">5. Vérification</h2>
              <table className="mt-4 w-full max-w-lg text-sm">
                <tbody>
                  <tr className="border-b"><td className="py-2">Stock avant</td><td className="py-2 text-right font-bold">{n(t.dbStock)}</td></tr>
                  <tr className="border-b"><td className="py-2">Ajustements préalables</td><td className="py-2 text-right">{signed(t.totalPriorAdjustments)}</td></tr>
                  <tr className="border-b"><td className="py-2">Entrées</td><td className="py-2 text-right text-green-700">{signed(t.totalIn)}</td></tr>
                  <tr className="border-b"><td className="py-2">Sorties</td><td className="py-2 text-right text-red-700">{signed(-t.totalOut)}</td></tr>
                  <tr className="border-b"><td className="py-2">Write-off</td><td className="py-2 text-right text-red-700">{signed(-(t.totalWriteOff || 0))}</td></tr>
                  <tr className="border-b"><td className="py-2">Ajustements finaux</td><td className="py-2 text-right">{signed(t.totalAdjustments)}</td></tr>
                  <tr className="border-t-2 border-black"><td className="py-3 font-black">Stock final prévu</td>
                    <td className="py-3 text-right text-lg font-black">{n(t.stockAfter)}</td></tr>
                </tbody>
              </table>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Box label="Produits avant" value={n(t.dbProducts)} />
                <Box label="Nouveaux produits" value={n(preview.newProducts.length)} />
                <Box label="Produits après" value={n(Number(t.dbProducts) + preview.newProducts.length)} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Box label="Erreurs bloquantes" value={n(blocking.length)} tone={hasBlocking ? "text-red-700" : "text-green-700"} />
              <Box label="Cas à vérifier" value={n(preview.toReview.length)} tone="text-amber-700" />
              <Box label="Produits ambigus" value={n(preview.blocked.length)} tone="text-amber-700" />
            </div>

            {hasBlocking && (
              <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-6">
                <h3 className="text-lg font-black text-red-800">
                  Import impossible — {blocking.length} produit(s) produiraient un stock négatif
                </h3>
                <p className="mt-1 text-sm font-semibold text-red-800">
                  Corrigez le fichier ou les quantités avant de relancer l&apos;analyse.
                  La confirmation restera désactivée tant que ces erreurs subsistent.
                </p>
                <div className="mt-3 max-h-60 overflow-auto rounded-xl border border-red-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-red-100 text-left"><tr>
                      <th className="p-2">Produit</th><th className="p-2 text-right">Stock DB</th>
                      <th className="p-2 text-right">Entrées</th><th className="p-2 text-right">Sorties</th>
                      <th className="p-2">Étape en échec</th><th className="p-2 text-right">Stock atteint</th>
                    </tr></thead>
                    <tbody>
                      {blocking.map((b, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 font-semibold">{b.product.name}</td>
                          <td className="p-2 text-right">{n(b.dbStock)}</td>
                          <td className="p-2 text-right">{n(b.in)}</td>
                          <td className="p-2 text-right">{n(b.out)}</td>
                          <td className="p-2">{b.failingStep.replace(/_/g, " ")}</td>
                          <td className="p-2 text-right font-black text-red-700">{n(b.stockAtFailure)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Cas protégés : dire explicitement qu'ils ne seront PAS modifiés. */}
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-6">
              <h3 className="font-black text-amber-900">À vérifier avant validation — {protectedCount} cas protégés</h3>
              <p className="mt-1 text-sm font-semibold text-amber-900">
                Ces éléments ne seront PAS modifiés par l&apos;import : leur stock actuel est conservé tel quel.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Box label="Produits ambigus (bloqués)" value={n(preview.blocked.length)} />
                <Box label="À vérifier (quantité absente)" value={n(preview.toReview.length)} />
                <Box label="Absents du fichier (intouchés)" value={n(preview.dbOnly.length)} />
              </div>
              {preview.blocked.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
                  {preview.blocked.map((b, i) => (
                    <li key={i}><b>{b.desc}</b> — {b.reason}{b.suggestions?.length ? ` (proche de : ${b.suggestions.join(", ")})` : ""}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">← Retour</button>
              <button onClick={() => setStep(5)} disabled={hasBlocking}
                className="rounded-xl bg-slate-900 px-5 py-2 font-bold text-white disabled:opacity-40">
                {hasBlocking ? "Confirmation bloquée" : "Confirmation →"}
              </button>
            </div>
          </section>
        )}

        {/* ÉTAPE 6 — confirmation */}
        {step === 5 && preview && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-black text-gray-900">6. Confirmation</h2>
            <p className="mt-3 text-sm text-gray-700">
              L&apos;import créera de vrais mouvements et documents, dans une transaction unique.
              En cas d&apos;erreur, tout est annulé. Le stock passera de{" "}
              <b>{n(t.dbStock)}</b> à <b>{n(t.stockAfter)}</b>.
            </p>
            {hasBlocking && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 font-semibold text-red-800">
                {blocking.length} erreur(s) bloquante(s) : l&apos;import ne peut pas être appliqué.
              </p>
            )}
            {!canApply && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 font-semibold text-red-800">
                Vous n&apos;avez pas la permission de valider un import.
              </p>
            )}
            <label className="mt-4 flex items-start gap-3 text-sm font-semibold text-gray-900">
              <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              Je confirme avoir vérifié les mouvements et le stock final prévu.
            </label>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(4)} disabled={busy} className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700 disabled:opacity-50">← Retour</button>
              <button onClick={execute} disabled={!confirmed || busy || !canApply || hasBlocking}
                className="rounded-xl bg-emerald-600 px-6 py-3 font-black text-white disabled:opacity-50">
                {busy ? "Import en cours…" : "Appliquer la mise à jour"}
              </button>
            </div>
          </section>
        )}

        {/* ÉTAPE 7 — résultat */}
        {step === 6 && result && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-black text-green-800">7. Import terminé — #{result.importId}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Box label="Produits créés" value={n(result.created.products.length)} />
              <Box label="Entrées" value={n(result.created.entries.length)} />
              <Box label="Sorties" value={n(result.created.exits.length)} />
              <Box label="Write-off" value={n(result.created.writeOffs.length)} />
              <Box label="Ajust. préalables" value={n(result.created.priorAdjustments.length)} />
            </div>
            <h3 className="mt-5 font-black text-gray-900">Documents créés</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {result.created.documents.map((d) => (
                <li key={d.id} className="text-gray-900">
                  <b>{d.type.replace(/_/g, " ")}</b> — {d.number}
                </li>
              ))}
            </ul>
            {result.created.skipped.length > 0 && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                {result.created.skipped.length} élément(s) ignoré(s) volontairement.
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={() => downloadReport(result.importId)} className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white">
                Télécharger le rapport final
              </button>
              <Link href="/inventaires" className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">Voir l&apos;inventaire</Link>
              <Link href="/stocks" className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">Voir les mouvements</Link>
              <button onClick={() => { setStep(0); setFile(null); setPreview(null); setResult(null); setConfirmed(false); }}
                className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">Nouvel import</button>
            </div>
          </section>
        )}

        {/* Historique */}
        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-black text-gray-900">Historique des imports</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="p-3">Date</th><th className="p-3">Fichier</th><th className="p-3">Par</th>
                  <th className="p-3">Statut</th><th className="p-3 text-right">Lignes</th><th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={String(h.id)} className="border-t">
                    <td className="p-3">{h.imported_at ? new Date(String(h.imported_at)).toLocaleString("fr-FR") : "—"}</td>
                    <td className="p-3 font-semibold">{String(h.file_name)}</td>
                    <td className="p-3">{String(h.imported_by_name || "—")}</td>
                    <td className="p-3"><Badge action={String(h.status)} /></td>
                    <td className="p-3 text-right">{n(h.rows_imported)}</td>
                    <td className="p-3">
                      <button onClick={() => downloadReport(Number(h.id))} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
                        Rapport
                      </button>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && <tr><td className="p-6 text-center text-gray-500" colSpan={6}>Aucun import.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
