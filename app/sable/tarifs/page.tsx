"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";

const money = (v:any) =>
  new Intl.NumberFormat("fr-FR").format(Number(v || 0)) + " FCFA";

export default function SandPricesPage() {
  const [prices,setPrices] = useState<any[]>([]);
  const [products,setProducts] = useState<any[]>([]);
  const [message,setMessage] = useState("");

  const [form,setForm] = useState({
    sand_product_id:"",
    destination:"Bamako",
    quantity_reference:10,
    price:170000,
    transport_price:0
  });

  async function load() {
    const [p1,p2] = await Promise.all([
      authFetch("/sand/prices"),
      authFetch("/sand/products")
    ]);

    const d1 = await p1.json().catch(()=>[]);
    const d2 = await p2.json().catch(()=>[]);

    setPrices(Array.isArray(d1) ? d1 : []);
    setProducts(Array.isArray(d2) ? d2 : []);

    if (!form.sand_product_id && d2?.[0]?.id) {
      setForm(f => ({...f,sand_product_id:String(d2[0].id)}));
    }
  }

  useEffect(()=>{ load(); },[]);

  async function save() {
    setMessage("");

    const r = await authFetch("/sand/prices",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        ...form,
        sand_product_id:Number(form.sand_product_id),
        quantity_reference:Number(form.quantity_reference),
        price:Number(form.price),
        transport_price:Number(form.transport_price)
      })
    });

    const data = await r.json().catch(()=>({}));

    if (!r.ok) {
      setMessage(data.error || "Erreur.");
      return;
    }

    setMessage("Tarif ajouté.");
    load();
  }


  async function modifierTarif(p:any) {

    const destination=prompt("Destination",p.destination);
    if(destination===null) return;

    const quantity_reference=prompt(
      "Référence m³",
      String(p.quantity_reference)
    );
    if(quantity_reference===null) return;

    const price=prompt(
      "Prix",
      String(p.price)
    );
    if(price===null) return;

    const transport_price=prompt(
      "Transport",
      String(p.transport_price)
    );
    if(transport_price===null) return;

    const r=await authFetch(`/sand/prices/${p.id}`,{
      method:"PATCH",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        destination,
        quantity_reference:Number(quantity_reference),
        price:Number(price),
        transport_price:Number(transport_price)
      })
    });

    const d=await r.json().catch(()=>({}));

    if(!r.ok){
      alert(d.error || "Modification impossible.");
      return;
    }

    await load();
  }

  async function supprimerTarif(p:any) {

    if(!confirm(
      `Supprimer définitivement le tarif ${p.destination} ?`
    )) return;

    const r=await authFetch(`/sand/prices/${p.id}`,{
      method:"DELETE"
    });

    const d=await r.json().catch(()=>({}));

    if(!r.ok){
      alert(d.error || "Suppression impossible.");
      return;
    }

    await load();
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="mx-auto max-w-6xl">
        <Link href="/sable" className="text-sm font-bold">← Retour</Link>

        <h1 className="mt-4 text-3xl font-black">Tarifs sable</h1>

        <section className="mt-6 grid gap-3 rounded-2xl bg-white p-5 shadow md:grid-cols-5">
          <select
            className="rounded border p-3"
            value={form.sand_product_id}
            onChange={e=>setForm({...form,sand_product_id:e.target.value})}
          >
            <option value="">Produit</option>
            {products.map(p=>(
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <input
            className="rounded border p-3"
            value={form.destination}
            onChange={e=>setForm({...form,destination:e.target.value})}
            placeholder="Destination"
          />

          <input
            type="number"
            className="rounded border p-3"
            value={form.quantity_reference}
            onChange={e=>setForm({...form,quantity_reference:Number(e.target.value)})}
            placeholder="m³"
          />

          <input
            type="number"
            className="rounded border p-3"
            value={form.price}
            onChange={e=>setForm({...form,price:Number(e.target.value)})}
            placeholder="Prix"
          />

          <button
            onClick={save}
            className="rounded bg-black p-3 font-bold text-white"
          >
            Ajouter
          </button>

          {message && <div className="md:col-span-5 font-bold">{message}</div>}
        </section>

        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-3">Destination</th>
                <th className="p-3">Référence</th>
                <th className="p-3">Prix</th>
                <th className="p-3">Prix/m³</th>
                <th className="p-3">Transport</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {prices.map(p=>(
                <tr key={p.id} className="border-b">
                  <td className="p-3">{p.destination}</td>
                  <td className="p-3">{p.quantity_reference} m³</td>
                  <td className="p-3 font-bold">{money(p.price)}</td>
                  <td className="p-3">{money(p.unit_price_m3)}</td>
                  <td className="p-3">{money(p.transport_price)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={()=>modifierTarif(p)}
                        className="rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Modifier
                      </button>

                      <button
                        onClick={()=>supprimerTarif(p)}
                        className="rounded bg-red-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
