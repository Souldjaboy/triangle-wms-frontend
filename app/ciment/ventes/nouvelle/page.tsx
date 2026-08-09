"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import { usePermissions } from "../../../lib/permissions";

const money=(v:any)=>new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA";

export default function NewCementSalePage(){
  const {can}=usePermissions();
  const [customers,setCustomers]=useState<any[]>([]);
  const [products,setProducts]=useState<any[]>([]);
  const [prices,setPrices]=useState<any[]>([]);
  const [message,setMessage]=useState("");
  const [form,setForm]=useState({
    customer_id:"",
    cement_product_id:"",
    destination:"",
    tonnage:"",
    unit_price:"",
    transport_price:"",
    paid_amount:"0",
    tonnage_voucher_number:"",
    truck:"",
    driver_name:"",
    notes:"",
  });

  useEffect(()=>{
    Promise.all([
      authFetch("/cement/customers").then(r=>r.json()),
      authFetch("/cement/products").then(r=>r.json()),
      authFetch("/cement/prices").then(r=>r.json())
    ]).then(([c,p,pr])=>{
      setCustomers(Array.isArray(c)?c:[]);
      setProducts(Array.isArray(p)?p:[]);
      setPrices(Array.isArray(pr)?pr:[]);
    });
  },[]);

  useEffect(()=>{
    const match=prices.find((x:any)=>
      String(x.cement_product_id)===String(form.cement_product_id) &&
      String(x.destination).toLowerCase()===String(form.destination).toLowerCase()
    );
    if(match){
      setForm(f=>({...f,unit_price:String(match.cement_price),transport_price:String(match.transport_price)}));
    }
  },[form.cement_product_id,form.destination,prices]);

  const total=useMemo(()=>{
    const t=Number(form.tonnage||0);
    return t*(Number(form.unit_price||0)+Number(form.transport_price||0));
  },[form.tonnage,form.unit_price,form.transport_price]);

  const save=async()=>{
    const r=await authFetch("/cement/sales",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        customer_id:Number(form.customer_id),
        cement_product_id:Number(form.cement_product_id),
        destination:form.destination,
        delivery_place:form.destination,
        tonnage:Number(form.tonnage),
        unit_price:Number(form.unit_price),
        transport_price:Number(form.transport_price),
        transport_mode:"PAR_TONNE",
        paid_amount:Number(form.paid_amount||0),
        tonnage_voucher_number:form.tonnage_voucher_number,
        truck:form.truck,
        driver_name:form.driver_name,
        notes:form.notes
      })
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok) return setMessage(d.error||"Erreur création vente.");
    setMessage(`Vente ${d.sale_number} créée. Total ${money(d.total_amount)}.`);
  };

  if(!can("cement","create")) return <main className="p-8">Accès refusé.</main>;

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">Nouvelle vente de ciment</h1>
          <p className="text-gray-600">Le tarif est rempli automatiquement selon le produit et la destination.</p>
        </div>
        <Link href="/ciment" className="rounded-lg bg-black px-4 py-2 text-white">Retour</Link>
      </div>

      <section className="grid gap-4 rounded-2xl bg-white p-6 shadow md:grid-cols-2">
        <select className="rounded-lg border p-3" value={form.customer_id} onChange={e=>setForm({...form,customer_id:e.target.value})}>
          <option value="">Choisir client</option>
          {customers.map((x:any)=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>

        <select className="rounded-lg border p-3" value={form.cement_product_id} onChange={e=>setForm({...form,cement_product_id:e.target.value})}>
          <option value="">Choisir ciment</option>
          {products.map((x:any)=><option key={x.id} value={x.id}>{x.cement_type} {x.strength}</option>)}
        </select>

        <select className="rounded-lg border p-3" value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})}>
          <option value="">Destination</option>
          {[...new Set(prices.map((x:any)=>x.destination))].map((d:any)=><option key={d} value={d}>{d}</option>)}
        </select>

        <input className="rounded-lg border p-3" type="number" placeholder="Tonnage" value={form.tonnage} onChange={e=>setForm({...form,tonnage:e.target.value})}/>

        <input className="rounded-lg border p-3" type="number" placeholder="Prix / tonne" value={form.unit_price} onChange={e=>setForm({...form,unit_price:e.target.value})}/>
        <input className="rounded-lg border p-3" type="number" placeholder="Transport / tonne" value={form.transport_price} onChange={e=>setForm({...form,transport_price:e.target.value})}/>

        <input className="rounded-lg border p-3" placeholder="N° bon de tonnage" value={form.tonnage_voucher_number} onChange={e=>setForm({...form,tonnage_voucher_number:e.target.value})}/>
        <input className="rounded-lg border p-3" placeholder="Camion" value={form.truck} onChange={e=>setForm({...form,truck:e.target.value})}/>
        <input className="rounded-lg border p-3" placeholder="Chauffeur" value={form.driver_name} onChange={e=>setForm({...form,driver_name:e.target.value})}/>
        <input className="rounded-lg border p-3" type="number" placeholder="Montant payé" value={form.paid_amount} onChange={e=>setForm({...form,paid_amount:e.target.value})}/>

        <textarea className="rounded-lg border p-3 md:col-span-2" placeholder="Observation" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>

        <div className="rounded-xl bg-gray-100 p-4 md:col-span-2">
          <div className="text-sm text-gray-500">Total calculé</div>
          <div className="text-3xl font-black">{money(total)}</div>
        </div>

        <button onClick={save} className="rounded-xl bg-yellow-500 px-5 py-4 font-black md:col-span-2">
          Enregistrer la vente
        </button>

        {message && <div className="font-bold md:col-span-2">{message}</div>}
      </section>
    </main>
  );
}
