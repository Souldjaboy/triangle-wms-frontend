"use client";

import { useEffect,useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";

const money=(v:any)=>new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA";

export default function CementInvoicesPage(){
  const {can}=usePermissions();
  const [rows,setRows]=useState<any[]>([]);

  useEffect(()=>{
    authFetch("/cement/invoices")
      .then(r=>r.json())
      .then(d=>setRows(Array.isArray(d)?d:[]));
  },[]);

  if(!can("cement","view")) return <main className="p-8">Accès refusé.</main>;

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-black">Factures ciment</h1>
        <Link href="/ciment/impayes" className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white">État des impayés</Link>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full">
          <thead className="bg-black text-white">
            <tr>
              <th className="p-3 text-left">Facture</th>
              <th className="p-3 text-left">Client</th>
              <th className="p-3">Opération</th>
              <th className="p-3">Destination</th>
              <th className="p-3">Total</th>
              <th className="p-3">Payé</th>
              <th className="p-3">Reste</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r:any)=>(
              <tr key={r.id} className="border-t">
                <td className="p-3 font-semibold">{r.invoice_number}</td>
                <td className="p-3">{r.customer_name}</td>
                <td className="p-3 text-center">{r.operation_reference}</td>
                <td className="p-3 text-center">{r.destination}</td>
                <td className="p-3 text-right">{money(r.total_amount)}</td>
                <td className="p-3 text-right">{money(r.paid_amount)}</td>
                <td className="p-3 text-right">{money(r.remaining_amount)}</td>
                <td className="p-3 text-center">{r.status}</td>
                {/* Ouvre le document DÉJÀ créé par la validation — aucune génération. */}
                <td className="p-3 text-center whitespace-nowrap">
                  <Link href={`/ciment/factures/${r.id}`} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">Ouvrir</Link>
                  <Link href={`/ciment/factures/${r.id}?print=1`} className="ml-2 rounded border border-slate-900 px-3 py-1.5 text-xs font-bold text-slate-900">Imprimer</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
