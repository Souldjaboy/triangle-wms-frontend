"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";

export default function CementClientsPage() {
  const { can } = usePermissions();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    nif: "",
    rccm: "",
  });
  const [message, setMessage] = useState("");

  const load = async () => {
    const r = await authFetch("/cement/customers");
    const d = await r.json().catch(() => []);
    setRows(Array.isArray(d) ? d : []);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    const r = await authFetch("/cement/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setMessage(d.error || "Erreur");
    setMessage("Client créé.");
    setForm({ name:"", phone:"", email:"", address:"", nif:"", rccm:"" });
    load();
  };

  if (!can("cement","view")) return <main className="p-8">Accès refusé.</main>;

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">Clients ciment</h1>
          <p className="text-gray-600">Gestion des clients acheteurs.</p>
        </div>
        <Link href="/ciment" className="rounded-lg bg-black px-4 py-2 text-white">Retour</Link>
      </div>

      {can("cement","create") && (
        <section className="mb-8 rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-4 text-xl font-bold">Nouveau client</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {["name","phone","email","address","nif","rccm"].map((k) => (
              <input
                key={k}
                placeholder={k.toUpperCase()}
                value={(form as any)[k]}
                onChange={(e)=>setForm({...form,[k]:e.target.value})}
                className="rounded-lg border p-3"
              />
            ))}
          </div>
          <button onClick={save} className="mt-4 rounded-lg bg-yellow-500 px-5 py-3 font-bold">
            Enregistrer
          </button>
          {message && <p className="mt-3 font-semibold">{message}</p>}
        </section>
      )}

      <section className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full">
          <thead className="bg-black text-white">
            <tr>
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-left">Nom</th>
              <th className="p-3 text-left">Téléphone</th>
              <th className="p-3 text-left">Adresse</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r:any)=>(
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.customer_code}</td>
                <td className="p-3 font-semibold">{r.name}</td>
                <td className="p-3">{r.phone}</td>
                <td className="p-3">{r.address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
