"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";

const money=(v:any)=>new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA";

export default function SandProformasPage() {
  const [rows,setRows]=useState<any[]>([]);

  useEffect(()=>{
    authFetch("/sand/proformas")
      .then(r=>r.json())
      .then(d=>setRows(Array.isArray(d)?d:[]))
      .catch(()=>setRows([]));
  },[]);

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="mx-auto max-w-7xl">
        <Link href="/sable" className="font-bold">← Retour</Link>
        <h1 className="mt-4 text-3xl font-black">Proformas sable</h1>

        <div className="mt-6 rounded-2xl bg-white p-5 shadow">
          {rows.length===0 && (
            <div className="text-gray-500">Aucune proforma.</div>
          )}

          {rows.map(r=>(
            <div key={r.id} className="flex justify-between border-b py-4">
              <div>
                <Link
  href={`/sable/proformas/${r.id}`}
  className="font-bold underline"
>
  {r.proforma_number}
</Link>
                <div>{r.customer_name}</div>
              </div>
              <div className="font-black">{money(r.total_amount)}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
