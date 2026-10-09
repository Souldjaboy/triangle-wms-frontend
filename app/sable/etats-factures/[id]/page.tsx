"use client";
import {useEffect,useState,use} from "react";
import Link from "next/link";
import {authFetch} from "../../../lib/api";
const money=(n:any)=>new Intl.NumberFormat("fr-FR").format(Number(n||0))+" FCFA";
export default function Page({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);
 const [data,setData]=useState<any>(null);
 const [error,setError]=useState("");
 useEffect(()=>{authFetch("/sand/invoice-statements/"+id).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||"Erreur");setData(d);}).catch(e=>setError(e.message));},[id]);
 if(error)return <main className="p-8 text-red-700">{error}</main>;
 if(!data)return <main className="p-8">Chargement de l’état...</main>;
 const s=data.statement;
 return <main className="bg-white min-h-screen p-6 text-gray-900">
 <style>{`@media print{.no-print{display:none!important}body{background:white!important}main{padding:0!important}}`}</style>
 <div className="mx-auto max-w-5xl">
  <div className="no-print mb-8 flex gap-4"><Link className="underline" href="/sable/etats-factures">← Historique</Link><button className="rounded bg-gray-900 px-4 py-2 text-white" onClick={()=>window.print()}>Imprimer / Enregistrer en PDF</button></div>
  <header className="border-b-2 border-gray-900 pb-5"><h1 className="text-3xl font-bold">ÉTAT DES FACTURES</h1><p className="mt-2 font-semibold">{s.statement_number}</p><p>Date : {new Date(s.generated_at).toLocaleDateString("fr-FR")}</p></header>
  <table className="mt-6 w-full text-sm"><thead><tr className="border-b bg-gray-100"><th className="p-2 text-left">N° facture</th><th className="p-2 text-left">Date</th><th className="p-2 text-left">Client</th><th className="p-2 text-left">Site</th><th className="p-2 text-right">Montant</th><th className="p-2 text-right">Payé</th><th className="p-2 text-right">Reste</th></tr></thead>
   <tbody>{data.items.map((x:any)=><tr key={x.id} className="border-b"><td className="p-2">{x.invoice_number}</td><td className="p-2">{String(x.invoice_date||"").slice(0,10)}</td><td className="p-2">{x.client_name||"—"}</td><td className="p-2">{x.site||"—"}</td><td className="p-2 text-right">{money(x.total_amount_snapshot)}</td><td className="p-2 text-right">{money(x.paid_amount_snapshot)}</td><td className="p-2 text-right">{money(x.remaining_amount_snapshot)}</td></tr>)}</tbody>
  </table>
  <footer className="mt-6 border-t-2 border-gray-900 pt-4 text-right font-bold"><p>{s.invoices_count} facture(s)</p><p>Total facturé : {money(s.total_invoiced)}</p><p>Total payé : {money(s.total_paid)}</p><p>Solde : {money(s.total_remaining)}</p></footer>
  <p className="mt-8 text-xs text-gray-500">État historique : les montants correspondent aux valeurs enregistrées lors de sa création.</p>
 </div></main>;
}