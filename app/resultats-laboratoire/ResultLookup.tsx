"use client";

import { useState } from "react";
import { apiUrl } from "../lib/api";

export default function ResultLookup() {
  const [form, setForm] = useState({ result_code: "", verifier: "" });
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setPayload(null);
    const response = await fetch(apiUrl("/laboratory/public/results/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || "Résultat introuvable.");
      return;
    }
    setPayload(data);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <section className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow">
        <h1 className="text-4xl font-black">Résultats laboratoire</h1>
        <p className="mt-2 text-gray-500">Saisissez votre code résultat et votre téléphone ou date de naissance.</p>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          <input required className="rounded-xl border p-4" placeholder="Code résultat, ex : LAB-2026-8F72X9" value={form.result_code} onChange={(e) => setForm({ ...form, result_code: e.target.value })} />
          <input required className="rounded-xl border p-4" placeholder="Téléphone ou date naissance YYYY-MM-DD" value={form.verifier} onChange={(e) => setForm({ ...form, verifier: e.target.value })} />
          <button className="rounded-xl bg-yellow-500 py-4 font-black text-black">Consulter le résultat</button>
        </form>
        {error && <div className="mt-5 rounded-xl bg-red-50 p-4 font-bold text-red-700">{error}</div>}
        {payload?.result && (
          <div className="mt-6 rounded-xl border p-5">
            <h2 className="text-2xl font-black">{payload.result.patient_name}</h2>
            <p className="text-gray-500">{payload.result.lab_name}</p>
            <p className="mt-4 whitespace-pre-line">{payload.result.result_summary || "Résultat publié."}</p>
            {payload.result.result_file_url && <a href={payload.result.result_file_url} className="mt-4 inline-block rounded-xl bg-black px-5 py-3 font-bold text-white">Télécharger PDF</a>}
            <div className="mt-5 space-y-2">
              {(payload.analyses || []).map((analysis: any) => (
                <div key={analysis.id} className="rounded-lg bg-gray-50 p-3">
                  <p className="font-bold">{analysis.analysis_name}</p>
                  <p>{analysis.result_value || analysis.result_notes || "-"}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
