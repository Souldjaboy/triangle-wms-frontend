"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {authFetch} from "../../lib/api";
export default function Page(){
 const [available,setAvailable]=useState<any[]>([]);
 const [history,setHistory]=useState<any[]>([]);
 const [ids,setIds]=useState<number[]>([]);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const fmt=(n:any)=>new Intl.NumberFormat("fr-FR").format(Number(n||0))+" FCFA";
 async function load(){
  try{
   const a=await authFetch("/sand/invoice-statements/eligible");
   const b=await authFetch("/sand/invoice-statements");
   if(!a.ok||!b.ok)throw Error("Accès refusé ou serveur indisponible");
   setAvailable(await a.json());setHistory(await b.json());
  }catch(e:any){setError(e.message);}
 }
 useEffect(()=>{load();},[]);
 async function create(){
  if(busy||!ids.length)return;
  if(!confirm("Créer définitivement un état pour "+ids.length+" facture(s) ?"))return;
  setBusy(true);setError("");
  try{
   const r=await authFetch("/sand/invoice-statements",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({invoice_ids:ids})});
   const d=await r.json();
   if(!r.ok)throw Error(d.error||"Erreur");
   window.location.assign("/sable/etats-factures/"+d.id);
  }catch(e:any){setError(e.message);await load();}finally{setBusy(false);}
 }
 return <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
  <div className="mx-auto max-w-6xl">
   <Link href="/sable/factures">← Factures sable</Link>
   <h1 className="my-4 text-3xl font-bold">États des factures</h1>
   <p>Une facture ne peut appartenir qu’à un seul état. Les états restent consultables.</p>
   {error&&<p role="alert" className="my-3 bg-red-100 p-3">{error}</p>}
   <section className="my-5 rounded-xl bg-white p-4">
    <h2 className="text-xl font-bold">Factures disponibles</h2>
    <div className="overflow-x-auto"><table className="w-full text-sm">
     <thead><tr><th>Choix</th><th>Facture</th><th>Client</th><th>Site</th><th>Total</th><th>Reste</th></tr></thead>
     <tbody>{available.map(x=><tr key={x.id} className="border-t">
      <td className="p-2"><input aria-label={"Sélectionner "+x.invoice_number} type="checkbox" checked={ids.includes(x.id)} onChange={()=>setIds(s=>s.includes(x.id)?s.filter(v=>v!==x.id):[...s,x.id])}/></td>
      <td>{x.invoice_number}</td><td>{x.client_name||"—"}</td><td>{x.site||"—"}</td><td>{fmt(x.total_amount)}</td><td>{fmt(x.remaining_amount)}</td>
     </tr>)}</tbody>
    </table></div>
    <button className="mt-4 rounded bg-gray-700 p-2 text-white" onClick={()=>setIds(ids.length===available.length?[]:available.map(x=>x.id))}>Tout sélectionner / désélectionner</button>
    <button disabled={busy||!ids.length} className="ml-3 rounded bg-blue-700 p-2 text-white disabled:opacity-40" onClick={create}>Générer l’état ({ids.length})</button>
   </section>
   <section className="rounded-xl bg-white p-4"><h2 className="text-xl font-bold">Historique des états</h2>
    {history.map(x=><div key={x.id} className="flex flex-wrap gap-4 border-b p-3">
     <strong>{x.statement_number}</strong><span>{x.invoices_count} factures</span><span>{fmt(x.total_invoiced)}</span>
     <Link className="text-blue-700 underline" href={"/sable/etats-factures/"+x.id}>Voir / PDF</Link>
    </div>)}
   </section>
  </div>
 </main>;
}