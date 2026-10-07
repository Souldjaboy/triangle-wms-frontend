"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { useParams } from "next/navigation";
import { authFetch } from "../../../lib/api";
const money=(v:any)=>new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA";
export default function ProformaDetail(){
 const params=useParams(),id=String(params.id),[p,setP]=useState<any>(null),[error,setError]=useState("");
 useEffect(()=>{authFetch(`/cement/proformas/${id}`).then(async r=>{const d=await r.json().catch(()=>({}));if(r.ok)setP(d);else setError(d.error||"Erreur.");});},[id]);
 if(error)return <main className="p-8">{error}</main>; if(!p)return <main className="p-8">Chargement...</main>;
 return <main className="min-h-screen bg-gray-100 p-4 text-black print:bg-white print:p-0"><div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow print:shadow-none">
  <div className="mb-6 flex justify-between gap-3 print:hidden"><Link href="/ciment/proformas" className="rounded border px-4 py-2 font-bold">← Proformas</Link><div className="flex gap-2">{p.status==="BROUILLON"&&<Link href={`/ciment/proformas/${p.id}/modifier`} className="rounded bg-blue-600 px-4 py-2 font-bold text-white">Modifier</Link>}<button onClick={()=>window.print()} className="rounded bg-black px-4 py-2 font-bold text-white">Imprimer / PDF</button></div></div>
  <div className="border-b pb-5"><div className="text-sm font-bold text-gray-500">PROFORMA</div><h1 className="text-3xl font-black">{p.proforma_number}</h1><div className="mt-2 text-sm">Statut : <b>{p.status}</b></div></div>
  <div className="grid gap-6 py-6 sm:grid-cols-2"><div><div className="text-xs font-bold uppercase text-gray-500">Client</div><div className="text-lg font-bold">{p.customer_name}</div><div>{p.customer_phone||""}</div><div>{p.customer_address||""}</div></div><div className="sm:text-right"><div>Date : {p.proforma_date?new Date(p.proforma_date).toLocaleDateString("fr-FR"):"-"}</div><div>Validité : {p.valid_until?new Date(p.valid_until).toLocaleDateString("fr-FR"):"-"}</div><div>Destination : {p.destination||"-"}</div></div></div>
  <table className="w-full text-sm"><thead className="bg-gray-100"><tr><th className="p-3 text-left">Désignation</th><th className="p-3">Qté</th><th className="p-3">Unité</th><th className="p-3 text-right">P.U.</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{(p.lines||[]).map((l:any)=><tr key={l.id} className="border-b"><td className="p-3">{l.description}</td><td className="p-3 text-center">{l.quantity}</td><td className="p-3 text-center">{l.unit}</td><td className="p-3 text-right">{money(l.unit_price)}</td><td className="p-3 text-right font-bold">{money(l.line_total)}</td></tr>)}</tbody></table>
  <div className="ml-auto mt-6 max-w-sm space-y-2"><div className="flex justify-between"><span>Sous-total</span><b>{money(p.subtotal)}</b></div><div className="flex justify-between"><span>Remise</span><b>{money(p.discount)}</b></div><div className="flex justify-between"><span>Taxes</span><b>{money(p.tax_amount)}</b></div><div className="flex justify-between border-t pt-3 text-xl"><span>TOTAL</span><b>{money(p.total_amount)}</b></div></div>
  {p.notes&&<div className="mt-8 rounded-lg bg-gray-50 p-4"><b>Observation :</b> {p.notes}</div>}
 </div></main>;
}