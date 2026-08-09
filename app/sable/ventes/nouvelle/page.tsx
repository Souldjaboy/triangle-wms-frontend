"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../../lib/api";

const money = (v:any) =>
  new Intl.NumberFormat("fr-FR").format(Number(v || 0)) + " FCFA";

export default function NewSandSalePage() {
  const [customers,setCustomers] = useState<any[]>([]);
  const [products,setProducts] = useState<any[]>([]);
  const [prices,setPrices] = useState<any[]>([]);
  const [message,setMessage] = useState("");

  const [form,setForm] = useState({
    customer_id:"",
    sand_product_id:"",
    destination:"Bamako",
    quantity_m3:10,
    reference_qty:10,
    reference_price:170000,
    transport_price:0,
    transport_mode:"PAR_OPERATION",
    discount:0,
    tax_amount:0,
    paid_amount:0,
    truck:"",
    driver_name:"",
    voucher_number:"",
    notes:""
  });

  useEffect(()=>{
    Promise.all([
      authFetch("/sand/customers"),
      authFetch("/sand/products"),
      authFetch("/sand/prices")
    ]).then(async ([a,b,c])=>{
      const ca = await a.json().catch(()=>[]);
      const pr = await b.json().catch(()=>[]);
      const ta = await c.json().catch(()=>[]);

      setCustomers(Array.isArray(ca)?ca:[]);
      setProducts(Array.isArray(pr)?pr:[]);
      setPrices(Array.isArray(ta)?ta:[]);

      setForm(f=>({
        ...f,
        sand_product_id: pr?.[0]?.id ? String(pr[0].id) : f.sand_product_id
      }));
    });
  },[]);

  useEffect(()=>{
    const tariff = prices.find(
      p =>
        String(p.sand_product_id) === String(form.sand_product_id) &&
        String(p.destination).toLowerCase() === form.destination.toLowerCase()
    );

    if (tariff) {
      setForm(f=>({
        ...f,
        reference_qty:Number(tariff.quantity_reference || 10),
        reference_price:Number(tariff.price),
        transport_price:Number(tariff.transport_price || 0)
      }));
    }
  },[form.destination,form.sand_product_id,prices]);

  /* Le prix au m³ est DÉRIVÉ du palier — il n'est plus saisissable.
     Auparavant le champ « Prix/m³ » était libre : un utilisateur y saisissait
     le prix du palier (170 000) et la vente partait à 10 × 170 000. */
  const refQty = Number(form.reference_qty || 10) || 10;
  const unitPriceM3 = refQty > 0 ? Number(form.reference_price || 0) / refQty : 0;
  const subtotal = Number(form.quantity_m3 || 0) * unitPriceM3;

  const transport =
    form.transport_mode === "PAR_M3"
      ? Number(form.quantity_m3 || 0) *
        Number(form.transport_price || 0)
      : Number(form.transport_price || 0);

  const total = useMemo(
    ()=>Math.max(
      subtotal +
      transport -
      Number(form.discount || 0) +
      Number(form.tax_amount || 0),
      0
    ),
    [subtotal,transport,form.discount,form.tax_amount]
  );

  const remaining =
    Math.max(total - Number(form.paid_amount || 0),0);

  async function save() {
    setMessage("");

    const r = await authFetch("/sand/sales",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        ...form,
        customer_id:Number(form.customer_id),
        sand_product_id:Number(form.sand_product_id),
        quantity_m3:Number(form.quantity_m3),
        unit_price:unitPriceM3,
        price_reference_qty:refQty,
        transport_price:Number(form.transport_price),
        discount:Number(form.discount),
        tax_amount:Number(form.tax_amount),
        paid_amount:Number(form.paid_amount)
      })
    });

    const data = await r.json().catch(()=>({}));

    if (!r.ok) {
      setMessage(data.error || "Erreur création vente.");
      return;
    }

    setMessage(`Vente ${data.sale_number} créée avec succès.`);

    setTimeout(()=>{
      window.location.href="/sable/ventes";
    },1200);
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="mx-auto max-w-5xl">
        <Link href="/sable" className="text-sm font-bold">← Retour</Link>

        <h1 className="mt-4 text-3xl font-black">
          Nouvelle vente de sable
        </h1>

        <section className="mt-6 grid gap-4 rounded-2xl bg-white p-6 shadow md:grid-cols-2">
          <select
            className="rounded border p-3"
            value={form.customer_id}
            onChange={e=>setForm({...form,customer_id:e.target.value})}
          >
            <option value="">Choisir client</option>
            {customers.map(c=>(
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

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
            placeholder="Destination"
            value={form.destination}
            onChange={e=>setForm({...form,destination:e.target.value})}
          />

          <input
            type="number"
            step="0.001"
            className="rounded border p-3"
            value={form.quantity_m3}
            onChange={e=>setForm({...form,quantity_m3:Number(e.target.value)})}
            placeholder="Quantité m³"
          />

          <div>
            <input
              type="number"
              className="w-full rounded border p-3"
              value={form.reference_price}
              onChange={e=>setForm({...form,reference_price:Number(e.target.value)})}
              placeholder={`Prix ${refQty} m³`}
            />
            <p className="mt-1 text-xs text-gray-500">
              Prix {refQty} m³ — soit {unitPriceM3.toLocaleString("fr-FR")} FCFA/m³
            </p>
          </div>

          <input
            type="number"
            className="rounded border p-3"
            value={form.transport_price}
            onChange={e=>setForm({...form,transport_price:Number(e.target.value)})}
            placeholder="Transport"
          />

          <input
            type="number"
            className="rounded border p-3"
            value={form.discount}
            onChange={e=>setForm({...form,discount:Number(e.target.value)})}
            placeholder="Remise"
          />

          <input
            type="number"
            className="rounded border p-3"
            value={form.paid_amount}
            onChange={e=>setForm({...form,paid_amount:Number(e.target.value)})}
            placeholder="Montant payé"
          />

          <input
            className="rounded border p-3"
            value={form.truck}
            onChange={e=>setForm({...form,truck:e.target.value})}
            placeholder="Camion"
          />

          <input
            className="rounded border p-3"
            value={form.driver_name}
            onChange={e=>setForm({...form,driver_name:e.target.value})}
            placeholder="Chauffeur"
          />

          <input
            className="rounded border p-3"
            value={form.voucher_number}
            onChange={e=>setForm({...form,voucher_number:e.target.value})}
            placeholder="Référence bon"
          />

          <textarea
            className="rounded border p-3"
            value={form.notes}
            onChange={e=>setForm({...form,notes:e.target.value})}
            placeholder="Observation"
          />
        </section>

        <section className="mt-5 rounded-2xl bg-black p-6 text-white">
          <div className="flex justify-between">
            <span>Sable</span>
            <b>{money(subtotal)}</b>
          </div>

          <div className="mt-2 flex justify-between">
            <span>Transport</span>
            <b>{money(transport)}</b>
          </div>

          <div className="mt-4 flex justify-between text-2xl font-black">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>

          <div className="mt-2 flex justify-between text-lg">
            <span>Reste</span>
            <span>{money(remaining)}</span>
          </div>

          <button
            onClick={save}
            className="mt-6 w-full rounded-xl bg-white p-4 font-black text-black"
          >
            Enregistrer la vente
          </button>

          {message && (
            <div className="mt-4 font-bold">
              {message}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
