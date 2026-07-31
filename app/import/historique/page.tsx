"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";
import { appProduct } from "../../lib/product-config";

type Job = {
  job_uid: string; product_code: string; module_key: string; import_type: string; original_filename: string;
  status: string; total_rows: number; valid_rows: number; invalid_rows: number; imported_rows: number;
  duplicate_rows: number; created_at: string; executed_at: string | null; rolled_back_at: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  imported: "bg-green-100 text-green-800", validated: "bg-blue-100 text-blue-800",
  analyzed: "bg-gray-200 text-gray-700", simulated: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800", rolled_back: "bg-red-50 text-red-600",
};

export default function ImportHistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const q = new URLSearchParams({ product_code: appProduct });
    if (status) q.set("status", status);
    const res = await authFetch(`/import/jobs?${q.toString()}`);
    if (res.ok) setJobs(await res.json());
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const downloadReport = async (uid: string) => {
    const res = await authFetch(`/import/jobs/${uid}/report?format=xlsx`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `rapport-import-${uid}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-gray-900">Historique des importations</h1>
          <Link href="/import" className="font-bold text-blue-700">+ Nouvelle importation</Link>
        </div>

        <div className="flex gap-2">
          <select className="rounded-xl border border-gray-300 p-2 text-gray-900" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="imported">Importés</option>
            <option value="validated">Validés</option>
            <option value="analyzed">Analysés</option>
            <option value="rolled_back">Annulés</option>
            <option value="failed">Échoués</option>
          </select>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow">
          {jobs.length === 0 ? (
            <p className="text-gray-600">Aucune importation.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead><tr className="text-left text-gray-500"><th className="p-2">Fichier</th><th className="p-2">Type</th><th className="p-2">Date</th><th className="p-2">Lignes</th><th className="p-2">Importées</th><th className="p-2">Doublons</th><th className="p-2">Statut</th><th className="p-2">Rapport</th></tr></thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.job_uid} className="border-t border-gray-100">
                      <td className="p-2 font-semibold text-gray-900">{j.original_filename}</td>
                      <td className="p-2 text-gray-600">{j.import_type}</td>
                      <td className="p-2 text-gray-600">{new Date(j.created_at).toLocaleString("fr-FR")}</td>
                      <td className="p-2 text-gray-600">{j.total_rows} ({j.valid_rows}✓/{j.invalid_rows}✗)</td>
                      <td className="p-2 font-bold text-gray-900">{j.imported_rows}</td>
                      <td className="p-2 text-gray-600">{j.duplicate_rows}</td>
                      <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLOR[j.status] || "bg-gray-200"}`}>{j.status}</span></td>
                      <td className="p-2"><button onClick={() => downloadReport(j.job_uid)} className="rounded-lg bg-blue-700 px-3 py-1 text-xs font-bold text-white hover:bg-blue-800">Excel</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
