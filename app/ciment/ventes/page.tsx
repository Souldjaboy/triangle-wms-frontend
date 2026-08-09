"use client";

import { useEffect,useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";

const money=(v:any)=>new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA";

export default function CementSalesPage(){
  const {can}=usePermissions();
  const [rows,setRows]=useState<any[]>([]);
  const [q,setQ]=useState("");

  const load=async()=>{
    const r=await authFetch("/cement/sales?q="+encodeURIComponent(q));
    const d=await r.json().catch(()=>[]);
    setRows(Array.isArray(d)?d:[]);
  };

  useEffect(()=>{load();},[]);

  const validate=async(id:any)=>{
    const r=await authFetch(`/cement/sales/${id}/validate`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({})
    });
    if(r.ok) load();
  };

  if(!can("cement","view")) return <main className="p-8">Accès refusé.</main>;

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-black">Ventes ciment</h1>
        <Link href="/ciment/ventes/nouvelle" className="rounded-lg bg-yellow-500 px-4 py-2 font-bold">Nouvelle vente</Link>
      </div>

      <div className="mb-4 flex gap-2">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Client, numéro, destination..." className="flex-1 rounded-lg border p-3"/>
        <button onClick={load} className="rounded-lg bg-black px-5 text-white">Rechercher</button>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full">
          <thead className="bg-black text-white">
            <tr>
              <th className="p-3 text-left">N°</th>
              <th className="p-3 text-left">Client</th>
              <th className="p-3">Destination</th>
              <th className="p-3">Tonnage</th>
              <th className="p-3">Total</th>
              <th className="p-3">Reste</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r:any)=>(
              <tr key={r.id} className="border-t">
                <td className="p-3 font-semibold">{r.sale_number}</td>
                <td className="p-3">{r.customer_name}</td>
                <td className="p-3 text-center">{r.destination}</td>
                <td className="p-3 text-center">{r.tonnage} t</td>
                <td className="p-3 text-right">{money(r.total_amount)}</td>
                <td className="p-3 text-right">{money(r.remaining_amount)}</td>
                <td className="p-3 text-center">{r.status}</td>
                <td className="p-3 text-center">
                  {r.status==="BROUILLON" && can("cement","validate") && (
                    <button onClick={()=>validate(r.id)} className="rounded bg-green-600 px-3 py-2 text-white">Valider</button>
                  )}
                  {/* Documents créés par la validation : on les ouvre, on ne les régénère pas. */}
                  {r.invoice_id && (
                    <Link href={`/ciment/factures/${r.invoice_id}`} className="ml-2 rounded bg-slate-900 px-3 py-2 text-xs font-bold text-white">Voir facture</Link>
                  )}
                  {r.delivery_id && (
                    <Link href={`/ciment/livraisons/${r.delivery_id}`} className="ml-2 rounded border border-slate-900 px-3 py-2 text-xs font-bold text-slate-900">Voir BL</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
