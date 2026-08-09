"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";

const money=(v:any)=>new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA";

export default function SandReportsPage() {
  const [sales,setSales]=useState<any[]>([]);

  useEffect(()=>{
    authFetch("/sand/sales")
      .then(r=>r.json())
      .then(d=>setSales(Array.isArray(d)?d:[]))
      .catch(()=>setSales([]));
  },[]);

  const totals=useMemo(()=>sales.reduce((a,r)=>{
    if(r.status!=="ANNULEE"){
      a.count++;
      a.volume+=Number(r.quantity_m3||0);
      a.amount+=Number(r.total_amount||0);
      a.paid+=Number(r.paid_amount||0);
      a.remaining+=Number(r.remaining_amount||0);
    }
    return a;
  },{count:0,volume:0,amount:0,paid:0,remaining:0}),[sales]);

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="mx-auto max-w-7xl">
        <Link href="/sable" className="font-bold">← Retour</Link>
        <h1 className="mt-4 text-3xl font-black">Rapports Vente de Sable</h1>

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <Card title="Ventes" value={totals.count}/>
          <Card title="Volume vendu" value={`${totals.volume} m³`}/>
          <Card title="Chiffre d'affaires" value={money(totals.amount)}/>
          <Card title="Encaissé" value={money(totals.paid)}/>
          <Card title="Impayé" value={money(totals.remaining)}/>
        </div>

        <button
          onClick={()=>window.print()}
          className="mt-6 rounded-xl bg-black px-5 py-3 font-bold text-white"
        >
          Imprimer le rapport
        </button>
      </div>
    </main>
  );
}

function Card({title,value}:{title:string,value:any}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-2 text-xl font-black">{value}</div>
    </div>
  );
}
