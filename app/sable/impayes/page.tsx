"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";
import PaiementFactureModal from "../../components/PaiementFactureModal";
import StatutFactureBadge from "../../components/StatutFactureBadge";

const money=(v:any)=>new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA";

export default function SandUnpaidPage() {
  const {can}=usePermissions();
  const [rows,setRows]=useState<any[]>([]);
  const [paying,setPaying]=useState<any>(null);
  const [flash,setFlash]=useState("");

  /* Route dédiée : le serveur ne renvoie que les factures avec un reste dû,
     au lieu de charger toutes les factures puis filtrer côté navigateur.
     Rechargée après encaissement -> une facture soldée disparaît d'elle-même. */
  const load=useCallback(async ()=>{
    const r=await authFetch("/sand/invoices/unpaid");
    if(r.ok){ const d=await r.json(); setRows(Array.isArray(d)?d:[]); }
  },[]);
  useEffect(()=>{ load(); },[load]);

  const total=useMemo(
    ()=>rows.reduce((s,r)=>s+Number(r.remaining_amount||0),0),
    [rows]
  );

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="mx-auto max-w-7xl">
        <Link href="/sable" className="font-bold">← Retour</Link>
        <Link href="/sable/etats" className="ml-4 rounded-lg bg-yellow-500 px-4 py-2 font-black text-black">Générer un état</Link>
        <h1 className="mt-4 text-3xl font-black">État des factures impayées</h1>
        {flash && <p className="mt-3 rounded-lg bg-green-50 p-3 font-semibold text-green-800">{flash}</p>}

        <div className="mt-5 rounded-2xl bg-red-50 p-5">
          <div className="text-sm font-bold">TOTAL IMPAYÉ</div>
          <div className="text-3xl font-black">{money(total)}</div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-3">Facture</th>
                <th className="p-3">Opération</th>
                <th className="p-3">Site</th>
                <th className="p-3">Montant</th>
                <th className="p-3">Payé</th>
                <th className="p-3">Reste</th>
                <th className="p-3">Statut</th>
                  <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id} className="border-b">
                  <td className="p-3 font-bold">{r.invoice_number}</td>
                  {/* Libellé métier ; la référence reste secondaire. */}
                  <td className="p-3">Vente de sable
                    {r.operation_reference && <span className="block text-xs text-gray-400">{r.operation_reference}</span>}
                  </td>
                  <td className="p-3">{r.site || r.destination || "—"}</td>
                  <td className="p-3">{money(r.total_amount)}</td>
                  <td className="p-3">{money(r.paid_amount)}</td>
                  <td className="p-3 font-bold text-red-600">{money(r.remaining_amount)}</td>
                  <td className="p-3"><StatutFactureBadge status={r.status} /></td>
                  <td className="p-3">
                    {can("sand","create") && (
                      <button onClick={()=>setPaying(r)}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white whitespace-nowrap">
                        Enregistrer un paiement
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {paying && (
        <PaiementFactureModal
          module="sand"
          invoice={paying}
          onClose={()=>setPaying(null)}
          onPaid={async (msg)=>{ setPaying(null); setFlash(msg); await load(); }}
        />
      )}
    </main>
  );
}