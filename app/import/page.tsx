"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch, apiUrl } from "../lib/api";
import { appProduct } from "../lib/product-config";
import { usePermissions } from "../lib/permissions";

type Profile = { key: string; name: string; module_key: string; requiredFields: string[]; optionalFields: string[] };
type Column = { header: string; suggestedField: string | null; valueType: string; confidence: number; level: string };
type Summary = { total: number; valid: number; invalid: number; warnings: number; duplicates: number; existing?: number; new?: number };
type SimRow = { __row: number; product_name: string; movementType: string; stockBefore: number; delta: number; stockAfter: number; willCreateProduct: boolean; blocked: boolean };

const LEVEL_COLOR: Record<string, string> = { high: "text-green-700", medium: "text-amber-600", low: "text-red-600" };
const FIELD_LABEL = (f: string) => f.replace(/_/g, " ");

export default function ImportWizardPage() {
  const { can, loading: permLoading } = usePermissions();
  const allowed = can("import", "create");

  const [step, setStep] = useState(1);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileKey, setProfileKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<string>("");
  const [analysis, setAnalysis] = useState<{ sheets: { name: string; rows: number }[]; rowCount: number } | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [allowNegative, setAllowNegative] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sim, setSim] = useState<{ totals: Record<string, number>; rows: SimRow[]; executable?: boolean; note?: string } | null>(null);
  const [report, setReport] = useState<Record<string, number> | null>(null);
  const [alreadyImported, setAlreadyImported] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [savedMappings, setSavedMappings] = useState<{ id: number; name: string; mapping: Record<string, string>; is_default: boolean }[]>([]);
  const [appliedMapping, setAppliedMapping] = useState<string | null>(null);
  const [headerSig, setHeaderSig] = useState("");

  const profile = useMemo(() => profiles.find((p) => p.key === profileKey) || null, [profiles, profileKey]);
  const fields = useMemo(() => (profile ? ["", ...profile.requiredFields, ...profile.optionalFields] : [""]), [profile]);

  const [backPath, setBackPath] = useState("");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    authFetch("/company-settings/current").then(async (r) => { if (r.ok) { const d = await r.json(); setCompanyName(d.company_name || ""); } });
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const preType = sp.get("type");
    const back = sp.get("back");
    if (back) setBackPath(back);
    authFetch(`/import/profiles?product_code=${appProduct}`).then(async (r) => {
      if (!r.ok) return;
      const list = await r.json();
      setProfiles(list);
      if (preType && list.some((p: Profile) => p.key === preType)) { setProfileKey(preType); setStep(2); }
    });
  }, []);

  const reset = () => { setStep(1); setFile(null); setJob(""); setAnalysis(null); setColumns([]); setMapping({}); setSummary(null); setSim(null); setReport(null); setAlreadyImported(null); setMsg(""); setSavedMappings([]); setAppliedMapping(null); };

  const downloadBlob = async (path: string, filename: string) => {
    const res = await authFetch(path);
    if (!res.ok) { setMsg("Erreur téléchargement."); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const upload = useCallback(async () => {
    if (!file || !profileKey) return;
    setBusy(true); setMsg("");
    const fd = new FormData();
    fd.append("import_type", profileKey);
    fd.append("file", file);
    const res = await authFetch("/import/jobs", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(data?.error || "Échec de l'analyse.");
    setJob(data.job_uid);
    setAnalysis(data.analysis);
    setColumns(data.columns || []);
    setMapping(data.suggestedMapping || {});
    setAlreadyImported(data.alreadyImported || null);
    setAppliedMapping(data.appliedMapping || null);
    setHeaderSig(data.headerSignature || "");
    const mres = await authFetch(`/import/mappings?profile_key=${encodeURIComponent(profileKey)}`);
    if (mres.ok) setSavedMappings(await mres.json());
    setStep(3);
  }, [file, profileKey]);

  const saveMapping = async () => {
    const name = window.prompt("Nom du mapping à enregistrer :");
    if (!name) return;
    const res = await authFetch("/import/mappings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_key: profileKey, name, mapping, header_signature: headerSig, is_default: false }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setMsg(d?.error || "Échec de l'enregistrement."); }
    setMsg(`✅ Mapping « ${name} » enregistré.`);
    const mres = await authFetch(`/import/mappings?profile_key=${encodeURIComponent(profileKey)}`);
    if (mres.ok) setSavedMappings(await mres.json());
  };

  const downloadReport = (fmt: "xlsx" | "csv") => downloadBlob(`/import/jobs/${job}/report?format=${fmt}`, `rapport-import-${job}.${fmt}`);

  const validate = async () => {
    setBusy(true); setMsg("");
    const res = await authFetch(`/import/jobs/${job}/mapping`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapping, options: { allowNegative } }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(data?.error || "Échec de la validation.");
    setSummary(data.summary);
    setStep(5);
  };

  const simulate = async () => {
    setBusy(true); setMsg("");
    const res = await authFetch(`/import/jobs/${job}/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(data?.error || "Échec de la simulation.");
    setSim({ totals: data.totals || {}, rows: data.rows || [], executable: data.executable, note: data.note });
    setStep(6);
  };

  const confirm = async () => {
    setBusy(true); setMsg("");
    const res = await authFetch(`/import/jobs/${job}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(data?.error || "Échec de l'importation.");
    setReport(data.report);
    setStep(7);
  };

  const rollback = async () => {
    setBusy(true);
    const res = await authFetch(`/import/jobs/${job}/rollback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? `Importation annulée (${data.reverted} lignes inversées).` : data?.error || "Rollback impossible.");
  };

  if (!permLoading && !allowed) {
    return <div className="min-h-screen bg-gray-100 p-8"><div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow"><h1 className="text-xl font-black text-gray-900">Centre d&apos;importation</h1><p className="mt-2 text-red-600 font-semibold">Vous n&apos;avez pas la permission d&apos;importer des fichiers.</p></div></div>;
  }

  const STEPS = ["Type", "Fichier", "Feuilles & mapping", "—", "Validation", "Simulation", "Résultat"];

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-gray-900">Centre d&apos;importation</h1>
          <div className="flex gap-3">
            <Link href="/import/historique" className="font-bold text-blue-700">Historique</Link>
            <Link href="/dashboard" className="font-bold text-blue-700">← Tableau de bord</Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-bold">
          {[1, 2, 3, 5, 6, 7].map((s, i) => (
            <span key={s} className={`rounded-full px-3 py-1 ${step >= s ? "bg-slate-900 text-white" : "bg-gray-200 text-gray-500"}`}>{i + 1}. {STEPS[s - 1]}</span>
          ))}
        </div>

        {msg && <div className="rounded-xl bg-amber-50 p-4 font-semibold text-amber-900">{msg}</div>}

        {/* Étape 1 — type */}
        {step === 1 && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-black text-gray-900">1. Type d&apos;importation</h2>
            <p className="mt-1 text-sm text-gray-500">Produit : <b>{appProduct}</b></p>

            <button onClick={() => setProfileKey("auto")} className={`mt-3 w-full rounded-xl border-2 p-4 text-left transition ${profileKey === "auto" ? "border-emerald-600 bg-emerald-50" : "border-gray-200 hover:border-gray-300"}`}>
              <p className="font-black text-gray-900">🔍 Détection automatique <span className="ml-1 rounded bg-emerald-600 px-2 py-0.5 text-xs text-white">recommandé</span></p>
              <p className="text-sm text-gray-500">Le logiciel reconnaît seul le type (factures, trésorerie, suivi…) et les colonnes.</p>
            </button>

            <p className="mt-4 mb-1 text-sm font-semibold text-gray-600">…ou choisir manuellement :</p>
            <select className="w-full rounded-xl border border-gray-300 p-3 text-gray-900" value={profileKey === "auto" ? "" : profileKey} onChange={(e) => setProfileKey(e.target.value)}>
              <option value="">Choisir un type…</option>
              {profiles.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
            {profile && (
              <div className="mt-3 flex items-center gap-3">
                <a href={apiUrl(`/import/template/${profile.key}`)} className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-bold text-white">⬇ Télécharger le modèle Excel</a>
                <span className="text-xs text-gray-500">Requis : {profile.requiredFields.map(FIELD_LABEL).join(", ")}</span>
              </div>
            )}
            <button disabled={!profileKey} onClick={() => setStep(2)} className="mt-5 rounded-xl bg-yellow-500 px-6 py-3 font-black text-black disabled:opacity-50">Continuer</button>
          </section>
        )}

        {/* Étape 2 — fichier */}
        {step === 2 && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-black text-gray-900">2. Sélection du fichier</h2>
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              🏢 Entreprise destinataire : <b>{companyName || "votre entreprise"}</b>. Les données seront enregistrées uniquement dans cette entreprise.
            </div>
            <input type="file" accept=".xlsx,.xls,.csv" className="mt-3 w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file && <p className="mt-2 text-sm text-gray-600">{file.name} — {(file.size / 1024).toFixed(0)} Ko</p>}
            <div className="mt-5 flex gap-3">
              <button onClick={() => setStep(1)} className="rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700">Retour</button>
              <button disabled={!file || busy} onClick={upload} className="rounded-xl bg-yellow-500 px-6 py-3 font-black text-black disabled:opacity-50">{busy ? "Analyse…" : "Analyser le fichier"}</button>
            </div>
          </section>
        )}

        {/* Étape 3 — feuilles & mapping */}
        {step === 3 && analysis && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-black text-gray-900">3. Feuilles & correspondance des champs</h2>
            <p className="mt-1 text-sm text-gray-500">Feuilles : {analysis.sheets.map((s) => `${s.name} (${s.rows})`).join(", ")} · {analysis.rowCount} lignes de données</p>
            {alreadyImported && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">⚠ Ce fichier a déjà été importé le {new Date(String(alreadyImported.created_at)).toLocaleString("fr-FR")}. Continuez seulement si c&apos;est volontaire.</div>}
            {appliedMapping && <div className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">✓ Mapping enregistré « {appliedMapping} » appliqué automatiquement.</div>}
            {savedMappings.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-600">Mappings enregistrés :</span>
                {savedMappings.map((sm) => (
                  <button key={sm.id} onClick={() => { setMapping(sm.mapping); setAppliedMapping(sm.name); }} className="rounded-lg bg-gray-200 px-3 py-1 text-xs font-bold text-gray-800 hover:bg-gray-300">{sm.name}{sm.is_default ? " ★" : ""}</button>
                ))}
              </div>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead><tr className="text-left text-gray-500"><th className="p-2">Colonne du fichier</th><th className="p-2">Type détecté</th><th className="p-2">Confiance</th><th className="p-2">Champ cible</th></tr></thead>
                <tbody>
                  {columns.map((c) => (
                    <tr key={c.header} className="border-t border-gray-100">
                      <td className="p-2 font-semibold text-gray-900">{c.header}</td>
                      <td className="p-2 text-gray-600">{c.valueType}</td>
                      <td className={`p-2 font-bold ${LEVEL_COLOR[c.level]}`}>{c.level}</td>
                      <td className="p-2">
                        <select className="w-full rounded-lg border border-gray-300 p-2 text-gray-900" value={mapping[c.header] || ""} onChange={(e) => setMapping({ ...mapping, [c.header]: e.target.value })}>
                          {fields.map((f) => <option key={f} value={f}>{f ? FIELD_LABEL(f) : "— ignorer —"}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {profile?.module_key === "logistique" && (
              <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input type="checkbox" checked={allowNegative} onChange={(e) => setAllowNegative(e.target.checked)} /> Autoriser le stock négatif
              </label>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={reset} className="rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700">Recommencer</button>
              <button onClick={saveMapping} className="rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700">Enregistrer le mapping</button>
              <button disabled={busy} onClick={validate} className="rounded-xl bg-yellow-500 px-6 py-3 font-black text-black disabled:opacity-50">{busy ? "Validation…" : "Valider les données"}</button>
            </div>
          </section>
        )}

        {/* Étape 5 — validation */}
        {step === 5 && summary && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-black text-gray-900">5. Validation</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Total" value={summary.total} />
              <Stat label="Nouvelles" value={summary.new ?? summary.valid} color="text-green-700" />
              <Stat label="Déjà importées" value={summary.existing ?? 0} color="text-blue-700" />
              <Stat label="Invalides" value={summary.invalid} color="text-red-600" />
              <Stat label="Doublons" value={summary.duplicates} color="text-amber-600" />
            </div>
            {(summary.existing ?? 0) > 0 && (
              <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-900">Import incrémental : {summary.existing} ligne(s) déjà importée(s) seront ignorées ; seules les {summary.new ?? summary.valid} nouvelles lignes seront ajoutées.</p>
            )}
            <div className="mt-5 flex gap-3">
              <button onClick={() => setStep(3)} className="rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700">Corriger le mapping</button>
              <button disabled={busy || summary.valid === 0} onClick={simulate} className="rounded-xl bg-yellow-500 px-6 py-3 font-black text-black disabled:opacity-50">{busy ? "Simulation…" : "Simuler les conséquences"}</button>
            </div>
          </section>
        )}

        {/* Étape 6 — simulation + confirmation */}
        {step === 6 && sim && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-black text-gray-900">6. Simulation</h2>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {Object.entries(sim.totals).map(([k, v]) => <span key={k} className="rounded-full bg-gray-100 px-3 py-1 font-bold text-gray-800">{k}: {v}</span>)}
            </div>
            {sim.note && <p className="mt-2 text-sm text-gray-500">{sim.note}</p>}
            {sim.rows.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead><tr className="text-left text-gray-500"><th className="p-2">Produit</th><th className="p-2">Type</th><th className="p-2">Avant</th><th className="p-2">Δ</th><th className="p-2">Après</th><th className="p-2">Note</th></tr></thead>
                  <tbody>
                    {sim.rows.filter((r) => !("skip" in r)).map((r) => (
                      <tr key={r.__row} className={`border-t border-gray-100 ${r.blocked ? "bg-red-50" : ""}`}>
                        <td className="p-2 font-semibold text-gray-900">{r.product_name}{r.willCreateProduct && <span className="ml-1 rounded bg-blue-100 px-1 text-xs text-blue-700">nouveau</span>}</td>
                        <td className="p-2 text-gray-600">{r.movementType}</td>
                        <td className="p-2 text-gray-600">{r.stockBefore}</td>
                        <td className={`p-2 font-bold ${r.delta >= 0 ? "text-green-700" : "text-red-600"}`}>{r.delta >= 0 ? "+" : ""}{r.delta}</td>
                        <td className="p-2 font-black text-gray-900">{r.stockAfter}</td>
                        <td className="p-2 text-xs text-red-600">{r.blocked ? "bloqué" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-4 rounded-xl bg-blue-50 p-3 font-semibold text-blue-900">Aucune modification ne sera effectuée tant que vous ne confirmez pas.</p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setStep(5)} className="rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700">Retour</button>
              {sim.executable ? (
                <button disabled={busy} onClick={confirm} className="rounded-xl bg-emerald-600 px-6 py-3 font-black text-white disabled:opacity-50">{busy ? "Importation…" : "Confirmer et importer"}</button>
              ) : (
                <span className="self-center text-sm text-gray-500">Exécution non disponible pour ce profil (simulation uniquement).</span>
              )}
            </div>
          </section>
        )}

        {/* Étape 7 — résultat */}
        {step === 7 && report && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-black text-gray-900">7. Résultat de l&apos;importation</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(report).map(([k, v]) => <Stat key={k} label={k} value={v} />)}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => downloadReport("xlsx")} className="rounded-xl bg-blue-700 px-4 py-3 font-bold text-white">Rapport Excel</button>
              <button onClick={() => downloadReport("csv")} className="rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700">Rapport CSV</button>
              <button onClick={rollback} disabled={busy} className="rounded-xl bg-red-100 px-4 py-3 font-bold text-red-700">Annuler l&apos;importation (rollback)</button>
              <Link href="/import/historique" className="rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700">Voir l&apos;historique</Link>
              {backPath && <Link href={backPath} className="rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700">Revenir au module</Link>}
              <button onClick={reset} className="rounded-xl bg-yellow-500 px-6 py-3 font-black text-black">Nouvelle importation</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 text-center">
      <p className={`text-2xl font-black ${color || "text-gray-900"}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
