"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";

const money=(v:any)=>new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA";

export default function CementPricesPage() {
  const { can } = usePermissions();
  const [rows,setRows]=useState<any[]>([]);
  const [products,setProducts]=useState<any[]>([]);
  const [form,setForm]=useState({
    cement_product_id:"",
    destination:"",
    cement_price:"",
    transport_price:"",
  });

  const load=async()=>{
    const [a,b]=await Promise.all([
      authFetch("/cement/prices"),
      authFetch("/cement/products")
    ]);
    setRows(await a.json().catch(()=>[]));
    setProducts(await b.json().catch(()=>[]));
  };

  useEffect(()=>{load();},[]);

  const save=async()=>{
    const r=await authFetch("/cement/prices",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        ...form,
        cement_product_id:Number(form.cement_product_id),
        cement_price:Number(form.cement_price),
        transport_price:Number(form.transport_price),
      })
    });
    if(r.ok){
      setForm({cement_product_id:"",destination:"",cement_price:"",transport_price:""});
      load();
    }
  };


  const modifier=async(r:any)=>{
    const destination=prompt("Destination",r.destination);
    if(destination===null) return;

    const cement_price=prompt(
      "Prix ciment",
      String(r.cement_price)
    );
    if(cement_price===null) return;

    const transport_price=prompt(
      "Transport",
      String(r.transport_price)
    );
    if(transport_price===null) return;

    const rep=await authFetch(`/cement/prices/${r.id}`,{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        destination,
        cement_price:Number(cement_price),
        transport_price:Number(transport_price)
      })
    });

    const d=await rep.json().catch(()=>({}));

    if(!rep.ok){
      alert(d.error || "Modification impossible.");
      return;
    }

    await load();
  };

  const supprimer=async(r:any)=>{
    if(!confirm(
      `Supprimer définitivement le tarif ${r.destination} ?`
    )) return;

    const rep=await authFetch(`/cement/prices/${r.id}`,{
      method:"DELETE"
    });

    const d=await rep.json().catch(()=>({}));

    if(!rep.ok){
      alert(d.error || "Suppression impossible.");
      return;
    }

    await load();
  };

  if(!can("cement","view")) return <main className="p-8">Accès refusé.</main>;

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-black">Tarifs ciment</h1>
        <Link href="/ciment" className="rounded-lg bg-black px-4 py-2 text-white">Retour</Link>
      </div>

      {can("cement","create") && (
        <section className="mb-6 grid gap-3 rounded-2xl bg-white p-5 shadow md:grid-cols-4">
          <select value={form.cement_product_id} onChange={e=>setForm({...form,cement_product_id:e.target.value})} className="rounded-lg border p-3">
            <option value="">Produit</option>
            {products.map((p:any)=><option key={p.id} value={p.id}>{p.cement_type} {p.strength}</option>)}
          </select>
          <input placeholder="Destination" value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})} className="rounded-lg border p-3"/>
          <input type="number" placeholder="Prix ciment" value={form.cement_price} onChange={e=>setForm({...form,cement_price:e.target.value})} className="rounded-lg border p-3"/>
          <input type="number" placeholder="Transport" value={form.transport_price} onChange={e=>setForm({...form,transport_price:e.target.value})} className="rounded-lg border p-3"/>
          <button onClick={save} className="rounded-lg bg-yellow-500 px-4 py-3 font-bold md:col-span-4">Ajouter tarif</button>
        </section>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full">
          <thead className="bg-black text-white">
            <tr>
              <th className="p-3 text-left">Destination</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Classe</th>
              <th className="p-3 text-left">Prix</th>
              <th className="p-3 text-left">Transport</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r:any)=>(
              <tr key={r.id} className="border-t">
                <td className="p-3 font-semibold">{r.destination}</td>
                <td className="p-3">{r.cement_type}</td>
                <td className="p-3">{r.strength}</td>
                <td className="p-3">{money(r.cement_price)}</td>
                <td className="p-3">{money(r.transport_price)}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    {can("cement","update") && (
                      <button
                        onClick={()=>modifier(r)}
                        className="rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Modifier
                      </button>
                    )}

                    {can("cement","delete") && (
                      <button
                        onClick={()=>supprimer(r)}
                        className="rounded bg-red-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
