"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { authFetch } from "../../lib/api";
import { formatFCFA } from "../../lib/format";

type Camion = { id: number; code: string; immatriculation: string | null; chauffeur: string | null; statut: string };
type Op = { op_date: string | null; libelle: string | null; recette: string; depense: string; piece_ref: string | null; source_type: string };

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "—");

export default function CamionDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [camion, setCamion] = useState<Camion | null>(null);
  const [ops, setOps] = useState<Op[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ op_date: "", libelle: "", recette: "", depense: "", piece_ref: "" });

  const load = useCallback(async () => {
    const res = await authFetch(`/camions/${id}/operations`);
    if (res.ok) { const d = await res.json(); setCamion(d.camion); setOps(d.operations); }
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  const filtered = ops.filter((o) => {
    if (!o.op_date) return !from && !to;
    const d = o.op_date.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
  const totRec = filtered.reduce((s, o) => s + Number(o.recette), 0);
  const totDep = filtered.reduce((s, o) => s + Number(o.depense), 0);

  const addOp = async () => {
    setMsg("");
    const recette = Number(form.recette) || 0, depense = Number(form.depense) || 0;
    if (recette <= 0 && depense <= 0) return setMsg("Renseignez une recette ou une dépense.");
    const res = await authFetch(`/camions/${id}/operations`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op_date: form.op_date || null, libelle: form.libelle, recette, depense, piece_ref: form.piece_ref }),
    });
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setMsg(d?.error || "Erreur."); }
    setMsg("✅ Opération enregistrée (écriture comptable créée).");
    setForm({ op_date: "", libelle: "", recette: "", depense: "", piece_ref: "" });
    await load();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-gray-900">Camion {camion?.code || ""}</h1>
          <Link href="/camions" className="font-bold text-blue-700">← Camions</Link>
        </div>

        {camion && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Info label="Code" value={camion.code} />
            <Info label="Immatriculation" value={camion.immatriculation || "—"} />
            <Info label="Chauffeur" value={camion.chauffeur || "—"} />
            <Info label="Statut" value={camion.statut} />
          </div>
        )}

        {msg && <div className="rounded-xl bg-blue-50 p-3 font-semibold text-blue-900">{msg}</div>}

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-black text-gray-900">Nouvelle opération</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input type="date" className="rounded-xl border border-gray-300 p-3 text-gray-900" value={form.op_date} onChange={(e) => setForm({ ...form, op_date: e.target.value })} />
            <input className="rounded-xl border border-gray-300 p-3 text-gray-900 lg:col-span-2" placeholder="Libellé (mission, carburant…)" value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} />
            <input type="number" className="rounded-xl border border-gray-300 p-3 text-gray-900" placeholder="Recette" value={form.recette} onChange={(e) => setForm({ ...form, recette: e.target.value })} />
            <input type="number" className="rounded-xl border border-gray-300 p-3 text-gray-900" placeholder="Dépense" value={form.depense} onChange={(e) => setForm({ ...form, depense: e.target.value })} />
          </div>
          <button onClick={addOp} className="mt-4 rounded-xl bg-yellow-500 px-6 py-3 font-black text-black hover:bg-yellow-400">Enregistrer</button>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow">
          <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-3">
            <h2 className="text-lg font-black text-gray-900">Historique</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Du</span>
              <input type="date" className="rounded-lg border border-gray-300 p-1 text-gray-900" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span className="text-gray-500">au</span>
              <input type="date" className="rounded-lg border border-gray-300 p-1 text-gray-900" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="mb-3 flex gap-3 px-2">
            <span className="rounded-lg bg-green-50 px-3 py-1 text-sm font-bold text-green-700">Recettes : {formatFCFA(totRec)}</span>
            <span className="rounded-lg bg-red-50 px-3 py-1 text-sm font-bold text-red-600">Dépenses : {formatFCFA(totDep)}</span>
            <span className="rounded-lg bg-gray-100 px-3 py-1 text-sm font-black text-gray-900">Net : {formatFCFA(totRec - totDep)}</span>
          </div>
          {filtered.length === 0 ? (
            <p className="p-4 text-gray-600">Aucune opération.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="text-left text-gray-500"><th className="p-2">Date</th><th className="p-2">Libellé</th><th className="p-2">Pièce</th><th className="p-2">Recette</th><th className="p-2">Dépense</th><th className="p-2">Origine</th></tr></thead>
                <tbody>
                  {filtered.map((o, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="p-2 text-gray-600">{fmtDate(o.op_date)}</td>
                      <td className="p-2 text-gray-800">{o.libelle || "—"}</td>
                      <td className="p-2 text-gray-500">{o.piece_ref || "—"}</td>
                      <td className="p-2 text-green-700">{Number(o.recette) ? formatFCFA(Number(o.recette)) : "—"}</td>
                      <td className="p-2 text-red-600">{Number(o.depense) ? formatFCFA(Number(o.depense)) : "—"}</td>
                      <td className="p-2 text-xs text-gray-400">{o.source_type}</td>
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

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white p-3 shadow"><p className="text-xs text-gray-500">{label}</p><p className="font-black text-gray-900">{value}</p></div>;
}
