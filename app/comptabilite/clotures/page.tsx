"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch, apiUrl } from "../../lib/api";
import { formatFCFA } from "../../lib/format";

type Closure = { period_month: number; period_year: number; status: string; opening_balance: string; total_income: string; total_expense: string; closing_balance: string; closed_at: string | null };
type Preview = { opening_balance: number; total_income: number; total_expense: number; result: number; closing_balance: number; not_validated: number; anomalies: string[]; status: string; closed_by: number | null; closed_at: string | null };

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function CloturesPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [closures, setClosures] = useState<Record<number, Closure>>({});
  const [open, setOpen] = useState<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch(`/accounting/closures?year=${year}`);
    if (res.ok) {
      const rows: Closure[] = await res.json();
      const map: Record<number, Closure> = {};
      for (const c of rows) map[c.period_month] = c;
      setClosures(map);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const previewMonth = async (m: number) => {
    setOpen(m); setPreview(null); setMsg("");
    const res = await authFetch(`/accounting/closures/${year}/${m}/preview`);
    if (res.ok) setPreview(await res.json());
  };

  const act = async (m: number, action: "close" | "reopen") => {
    setBusy(true); setMsg("");
    const res = await authFetch(`/accounting/closures/${year}/${m}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(data?.error || "Action refusée (permission ?).");
    setMsg(action === "close" ? "✅ Mois clôturé." : "✅ Mois rouvert.");
    await load(); if (open === m) await previewMonth(m);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-gray-900">Clôtures mensuelles</h1>
          <Link href="/comptabilite" className="font-bold text-blue-700">← Comptabilité</Link>
        </div>

        <div className="flex items-center gap-3">
          <label className="font-semibold text-gray-700">Année</label>
          <select className="rounded-xl border border-gray-300 p-2 text-gray-900" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year + 1, year, year - 1, year - 2].filter((v, i, a) => a.indexOf(v) === i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {msg && <div className="rounded-xl bg-blue-50 p-4 font-semibold text-blue-900">{msg}</div>}

        <section className="rounded-2xl bg-white p-4 shadow">
          <div className="divide-y divide-gray-100">
            {MONTHS.map((name, i) => {
              const m = i + 1;
              const c = closures[m];
              const closed = c?.status === "closed";
              return (
                <div key={m}>
                  <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-24 font-black text-gray-900">{name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${closed ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>{closed ? "Clôturé" : "Ouvert"}</span>
                      {closed && <span className="text-sm text-gray-500">Solde final {formatFCFA(Number(c.closing_balance))}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => previewMonth(m)} className="rounded-lg bg-gray-200 px-3 py-1 text-xs font-bold text-gray-800">Prévisualiser</button>
                      {closed ? (
                        <button onClick={() => act(m, "reopen")} disabled={busy} className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Rouvrir</button>
                      ) : (
                        <button onClick={() => act(m, "close")} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white">Clôturer</button>
                      )}
                      <a href={apiUrl(`/accounting/closures/${year}/${m}/report`)} className="rounded-lg bg-blue-700 px-3 py-1 text-xs font-bold text-white">Rapport</a>
                    </div>
                  </div>
                  {open === m && preview && (
                    <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-3 text-sm sm:grid-cols-3">
                      <Cell label="Solde initial" value={formatFCFA(preview.opening_balance)} />
                      <Cell label="Recettes" value={formatFCFA(preview.total_income)} c="text-green-700" />
                      <Cell label="Dépenses" value={formatFCFA(preview.total_expense)} c="text-red-600" />
                      <Cell label="Résultat" value={formatFCFA(preview.result)} />
                      <Cell label="Solde final" value={formatFCFA(preview.closing_balance)} />
                      <Cell label="Non validées" value={String(preview.not_validated)} c={preview.not_validated ? "text-amber-600" : ""} />
                      {preview.anomalies.length > 0 && <p className="col-span-full text-xs font-semibold text-amber-700">⚠ {preview.anomalies.join(" ")}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Cell({ label, value, c }: { label: string; value: string; c?: string }) {
  return <div className="rounded-lg bg-white p-2 text-center"><p className="text-xs text-gray-500">{label}</p><p className={`font-black ${c || "text-gray-900"}`}>{value}</p></div>;
}
