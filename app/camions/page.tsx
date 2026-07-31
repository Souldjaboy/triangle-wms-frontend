"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "../lib/api";
import { formatFCFA } from "../lib/format";
import ImportButton from "../components/ImportButton";

type Camion = {
  id: number; code: string; immatriculation: string | null; chauffeur: string | null; statut: string;
  total_recette: string; total_depense: string; operations: string;
};

export default function CamionsPage() {
  const [items, setItems] = useState<Camion[]>([]);
  const [form, setForm] = useState({ code: "", immatriculation: "", chauffeur: "" });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await authFetch("/camions");
    if (res.ok) setItems(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setMsg("");
    if (!form.code.trim()) return setMsg("Code camion requis.");
    const res = await authFetch("/camions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setMsg(d?.error || "Erreur."); }
    setForm({ code: "", immatriculation: "", chauffeur: "" });
    await load();
  };

  const net = (c: Camion) => Number(c.total_recette) - Number(c.total_depense);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black text-gray-900">Camions</h1>
          <div className="flex gap-2">
            <ImportButton profile="auto" label="Importer un suivi (camions)" />
            <Link href="/dashboard" className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">← Tableau de bord</Link>
          </div>
        </div>

        {msg && <div className="rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">{msg}</div>}

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-black text-gray-900">Ajouter un camion</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input className="rounded-xl border border-gray-300 p-3 text-gray-900" placeholder="Code (ex. 10R CH0578)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input className="rounded-xl border border-gray-300 p-3 text-gray-900" placeholder="Immatriculation" value={form.immatriculation} onChange={(e) => setForm({ ...form, immatriculation: e.target.value })} />
            <input className="rounded-xl border border-gray-300 p-3 text-gray-900" placeholder="Chauffeur" value={form.chauffeur} onChange={(e) => setForm({ ...form, chauffeur: e.target.value })} />
          </div>
          <button onClick={create} className="mt-4 rounded-xl bg-yellow-500 px-6 py-3 font-black text-black hover:bg-yellow-400">Ajouter</button>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow">
          {items.length === 0 ? (
            <p className="p-4 text-gray-600">Aucun camion. Importez un suivi comptable ou ajoutez-en un.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="text-left text-gray-500"><th className="p-2">Code</th><th className="p-2">Immat.</th><th className="p-2">Chauffeur</th><th className="p-2">Opérations</th><th className="p-2">Recettes</th><th className="p-2">Dépenses</th><th className="p-2">Net</th></tr></thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} className="border-t border-gray-100">
                      <td className="p-2 font-bold text-blue-700"><Link href={`/camions/${c.id}`} className="hover:underline">{c.code}</Link></td>
                      <td className="p-2 text-gray-600">{c.immatriculation || "—"}</td>
                      <td className="p-2 text-gray-600">{c.chauffeur || "—"}</td>
                      <td className="p-2 text-gray-600">{c.operations}</td>
                      <td className="p-2 text-green-700">{formatFCFA(Number(c.total_recette))}</td>
                      <td className="p-2 text-red-600">{formatFCFA(Number(c.total_depense))}</td>
                      <td className={`p-2 font-black ${net(c) >= 0 ? "text-gray-900" : "text-red-600"}`}>{formatFCFA(net(c))}</td>
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
