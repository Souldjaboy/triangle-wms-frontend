"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";

const money=(v:any)=>new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA";

export default function SandInvoicesPage() {
  const [rows,setRows] = useState<any[]>([]);

  useEffect(()=>{
    authFetch("/sand/invoices")
      .then(r=>r.json())
      .then(d=>setRows(Array.isArray(d)?d:[]))
      .catch(()=>setRows([]));
  },[]);

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="mx-auto max-w-7xl">
        <Link href="/sable" className="font-bold">← Retour</Link>
        <h1 className="mt-4 text-3xl font-black">Factures sable</h1>

        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-3">Facture</th>
                <th className="p-3">Référence</th>
                <th className="p-3">Destination</th>
                <th className="p-3">Total</th>
                <th className="p-3">Payé</th>
                <th className="p-3">Reste</th>
                <th className="p-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id} className="border-b">
                  <td className="p-3 font-bold">
  <Link
    href={`/sable/factures/${r.id}`}
    className="underline"
  >
    {r.invoice_number}
  </Link>
</td>
                  <td className="p-3">{r.operation_reference}</td>
                  <td className="p-3">{r.destination}</td>
                  <td className="p-3">{money(r.total_amount)}</td>
                  <td className="p-3">{money(r.paid_amount)}</td>
                  <td className="p-3 font-bold">{money(r.remaining_amount)}</td>
                  <td className="p-3">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
