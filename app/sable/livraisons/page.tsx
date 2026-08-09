"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";

export default function SandDeliveriesPage() {
  const [rows,setRows] = useState<any[]>([]);

  useEffect(()=>{
    authFetch("/sand/deliveries")
      .then(r=>r.json())
      .then(d=>setRows(Array.isArray(d)?d:[]))
      .catch(()=>setRows([]));
  },[]);

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="mx-auto max-w-7xl">
        <Link href="/sable" className="font-bold">← Retour</Link>
        <h1 className="mt-4 text-3xl font-black">Bons de livraison sable</h1>

        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-3">BL</th>
                <th className="p-3">Date</th>
                <th className="p-3">Destination</th>
                <th className="p-3">Quantité</th>
                <th className="p-3">Camion</th>
                <th className="p-3">Chauffeur</th>
                <th className="p-3">Livré par</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id} className="border-b">
                  <td className="p-3 font-bold">
  <Link
    href={`/sable/livraisons/${r.id}`}
    className="underline"
  >
    {r.delivery_number}
  </Link>
</td>
                  <td className="p-3">{String(r.delivery_date || "").slice(0,10)}</td>
                  <td className="p-3">{r.destination}</td>
                  <td className="p-3">{r.quantity_m3} m³</td>
                  <td className="p-3">{r.truck || "-"}</td>
                  <td className="p-3">{r.driver_name || "-"}</td>
                  <td className="p-3">{r.delivered_by || "-"}</td>
                  <td className="p-3 whitespace-nowrap">
                    <Link href={`/sable/livraisons/${r.id}`} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">Ouvrir</Link>
                    <Link href={`/sable/livraisons/${r.id}?print=1`} className="ml-2 rounded border border-slate-900 px-3 py-1.5 text-xs font-bold text-slate-900">Imprimer</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
