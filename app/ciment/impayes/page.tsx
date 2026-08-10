"use client";

import { useCallback,useEffect,useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";
import PaiementFactureModal from "../../components/PaiementFactureModal";
import StatutFactureBadge from "../../components/StatutFactureBadge";

const money=(v:any)=>new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA";

export default function CementUnpaidPage(){
  const {can}=usePermissions();
  const [data,setData]=useState<any>({rows:[],totals:{}});
  const [paying,setPaying]=useState<any>(null);
  const [flash,setFlash]=useState("");

  /* Rechargée après chaque encaissement : une facture soldée disparaît d'elle-même
     de cet écran, et le TOTAL IMPAYÉ est recalculé par le serveur. */
  const load=useCallback(async ()=>{
    const r=await authFetch("/cement/invoices/unpaid");
    if(r.ok) setData(await r.json()||{rows:[],totals:{}});
  },[]);
  useEffect(()=>{ load(); },[load]);

  if(!can("cement","view")) return <main className="p-8">Accès refusé.</main>;

  return (
    <main className="min-h-screen bg-white p-8 text-black">
      <div className="print:hidden mb-6 flex items-center justify-between">
        <Link href="/ciment/factures" className="rounded bg-black px-4 py-2 text-white">Retour</Link>
        <button onClick={()=>window.print()} className="rounded bg-yellow-500 px-5 py-2 font-bold">Imprimer l&apos;état</button>
      </div>

      {flash && <p className="print:hidden mb-4 rounded-lg bg-green-50 p-3 font-semibold text-green-800">{flash}</p>}

      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black">ÉTAT DES FACTURES IMPAYÉES</h1>
        <p className="text-sm text-gray-600">Vente de ciment — Triangle Logistics</p>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Facture</th>
            <th className="border p-2">Opération</th>
            <th className="border p-2">Client</th>
            <th className="border p-2">Site</th>
            <th className="border p-2">Montant</th>
            <th className="border p-2">Payé</th>
            <th className="border p-2">Reste</th>
            <th className="border p-2">Statut</th>
            <th className="border p-2 print:hidden">Action</th>
          </tr>
        </thead>
        <tbody>
          {(data.rows||[]).map((r:any)=>(
            <tr key={r.id}>
              <td className="border p-2">{r.invoice_number}</td>
              <td className="border p-2">Vente de ciment
                {r.operation_reference && <span className="block text-xs text-gray-400">{r.operation_reference}</span>}
              </td>
              <td className="border p-2">{r.customer_name}</td>
              <td className="border p-2">{r.destination}</td>
              <td className="border p-2 text-right">{money(r.total_amount)}</td>
              <td className="border p-2 text-right">{money(r.paid_amount)}</td>
              <td className="border p-2 text-right font-bold">{money(r.remaining_amount)}</td>
              <td className="border p-2"><StatutFactureBadge status={r.status} /></td>
              <td className="border p-2 print:hidden">
                {can("cement","create") && (
                  <button onClick={()=>setPaying(r)}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">
                    Enregistrer un paiement
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-md rounded-xl border p-4">
          <div className="flex justify-between">
            <span>Total factures :</span>
            <strong>{data.totals?.invoice_count || 0}</strong>
          </div>
          <div className="mt-2 flex justify-between text-lg">
            <span>Total impayé :</span>
            <strong>{money(data.totals?.total_remaining || data.totals?.total_unpaid || 0)}</strong>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body { background: white !important; }
        }
      `}</style>

      {paying && (
        <PaiementFactureModal
          module="cement"
          invoice={{...paying, client_name: paying.customer_name}}
          onClose={()=>setPaying(null)}
          onPaid={async (msg)=>{ setPaying(null); setFlash(msg); await load(); }}
        />
      )}
    </main>
  );
}