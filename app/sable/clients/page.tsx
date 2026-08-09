"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";

export default function SandCustomersPage() {
  const [rows,setRows] = useState<any[]>([]);
  const [message,setMessage] = useState("");

  const [form,setForm] = useState({
    name:"",
    phone:"",
    email:"",
    address:"",
    nif:"",
    rccm:""
  });

  async function load() {
    const r = await authFetch("/sand/customers");
    const d = await r.json().catch(()=>[]);
    setRows(Array.isArray(d) ? d : []);
  }

  useEffect(()=>{ load(); },[]);

  async function save() {
    setMessage("");

    const r = await authFetch("/sand/customers",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(form)
    });

    const data = await r.json().catch(()=>({}));

    if (!r.ok) {
      setMessage(data.error || "Erreur.");
      return;
    }

    setForm({
      name:"",
      phone:"",
      email:"",
      address:"",
      nif:"",
      rccm:""
    });

    setMessage("Client créé.");
    load();
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="mx-auto max-w-6xl">
        <Link href="/sable" className="text-sm font-bold">← Retour</Link>

        <h1 className="mt-4 text-3xl font-black">Clients sable</h1>

        <section className="mt-6 grid gap-3 rounded-2xl bg-white p-5 shadow md:grid-cols-3">
          <input
            className="rounded border p-3"
            placeholder="Nom"
            value={form.name}
            onChange={e=>setForm({...form,name:e.target.value})}
          />

          <input
            className="rounded border p-3"
            placeholder="Téléphone"
            value={form.phone}
            onChange={e=>setForm({...form,phone:e.target.value})}
          />

          <input
            className="rounded border p-3"
            placeholder="Adresse"
            value={form.address}
            onChange={e=>setForm({...form,address:e.target.value})}
          />

          <input
            className="rounded border p-3"
            placeholder="Email"
            value={form.email}
            onChange={e=>setForm({...form,email:e.target.value})}
          />

          <input
            className="rounded border p-3"
            placeholder="NIF"
            value={form.nif}
            onChange={e=>setForm({...form,nif:e.target.value})}
          />

          <input
            className="rounded border p-3"
            placeholder="RCCM"
            value={form.rccm}
            onChange={e=>setForm({...form,rccm:e.target.value})}
          />

          <button
            onClick={save}
            className="rounded bg-black p-3 font-bold text-white md:col-span-3"
          >
            Ajouter client
          </button>

          {message && <div className="md:col-span-3 font-bold">{message}</div>}
        </section>

        <div className="mt-6 rounded-2xl bg-white p-5 shadow">
          {rows.map(c=>(
            <div key={c.id} className="border-b py-3">
              <div className="font-bold">{c.name}</div>
              <div className="text-sm text-gray-500">
                {c.phone || "-"} · {c.address || "-"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
