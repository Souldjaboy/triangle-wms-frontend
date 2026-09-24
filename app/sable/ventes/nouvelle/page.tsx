"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../../lib/api";

import MultiTruckSelector, { TruckLine } from "../../../components/MultiTruckSelector";
const money = (v:any) =>
  new Intl.NumberFormat("fr-FR").format(Number(v || 0)) + " FCFA";

export default function NewSandSalePage() {
  const [customers,setCustomers] = useState<any[]>([]);
  const [products,setProducts] = useState<any[]>([]);
  // SAND_TRUCK_SELECTOR_V2
  const [prices,setPrices] = useState<any[]>([]);
  const [camions,setCamions] = useState<any[]>([]);
  const [message,setMessage] = useState("");

  const [form,setForm] = useState({
    customer_id:"",
    sand_product_id:"",
    destination:"Bamako",
    quantity_m3:0,
    reference_qty:10,
    reference_price:170000,
    transport_price:0,
    transport_mode:"PAR_OPERATION",
    discount:0,
    tax_amount:0,
    paid_amount:0,
    camion_id:"",
    truck:"",
    driver_name:"",
    trucks:[
      {
        camion_id:"",
        driver_name:"",
        quantity:""
      }
    ] as TruckLine[],
    voucher_number:"",
    notes:"Vente de sable de fleuve"
  });

  useEffect(()=>{
    Promise.all([
      authFetch("/sand/customers"),
      authFetch("/sand/products"),
      authFetch("/sand/prices"),
      authFetch("/sand/camions")
    ]).then(async ([a,b,c,d])=>{
      const ca = await a.json().catch(()=>[]);
      const pr = await b.json().catch(()=>[]);
      const ta = await c.json().catch(()=>[]);
      const cams = await d.json().catch(()=>[]);

      setCustomers(Array.isArray(ca)?ca:[]);
      setProducts(Array.isArray(pr)?pr:[]);
      setPrices(Array.isArray(ta)?ta:[]);
      setCamions(Array.isArray(cams)?cams:[]);

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
        camion_id:Number(form.camion_id),
        trucks:form.trucks.map((x:TruckLine)=>({
          camion_id:Number(x.camion_id),
          driver_name:String(x.driver_name || "").trim(),
          quantity:Number(x.quantity || 0)
        })),
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

          {/* SAND_SALE_REQUIRED_FIELDS_V1 */}
          <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">

            <div className="mb-4">
              <h2 className="text-xl font-black text-gray-900">
                Informations de la vente
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Sélectionnez le client, le produit et la destination avant d’affecter les camions.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">

              {/* CLIENT */}
              <label className="block">
                <span className="mb-1 block text-sm font-black text-gray-700">
                  Client *
                </span>

                <select
                  value={form.customer_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      customer_id: e.target.value
                    })
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900"
                >
                  <option value="">
                    Choisir un client
                  </option>

                  {customers.map((c:any) => (
                    <option
                      key={c.id}
                      value={c.id}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>


              {/* PRODUIT */}
              <label className="block">
                <span className="mb-1 block text-sm font-black text-gray-700">
                  Produit sable *
                </span>

                <select
                  value={form.sand_product_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sand_product_id: e.target.value,
                      destination: ""
                    })
                  }
                  className="w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900"
                >
                  <option value="">
                    Choisir un produit
                  </option>

                  {products.map((prod:any) => (
                    <option
                      key={prod.id}
                      value={prod.id}
                    >
                      {prod.name}
                    </option>
                  ))}
                </select>
              </label>


              {/* DESTINATION */}
              <label className="block">
                <span className="mb-1 block text-sm font-black text-gray-700">
                  Destination *
                </span>

                <select
                  value={form.destination}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      destination: e.target.value
                    })
                  }
                  disabled={!form.sand_product_id}
                  className="w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {form.sand_product_id
                      ? "Choisir une destination"
                      : "Choisir d’abord le produit"}
                  </option>

                  {Array.from(
                    new Set(
                      prices
                        .filter(
                          (x:any) =>
                            String(x.sand_product_id) ===
                            String(form.sand_product_id)
                        )
                        .map((x:any) => x.destination)
                        .filter(Boolean)
                    )
                  ).map((destination:any) => (
                    <option
                      key={String(destination)}
                      value={String(destination)}
                    >
                      {String(destination)}
                    </option>
                  ))}
                </select>
              </label>

            </div>


            {form.customer_id &&
             form.sand_product_id &&
             form.destination && (

              <div className="mt-4 rounded-xl bg-emerald-50 p-3 font-bold text-emerald-800">
                ✅ Client, produit et destination renseignés.
              </div>

            )}

          </div>

          <MultiTruckSelector
          camions={camions}
          quantityTotal={Number(form.quantity_m3 || 0)}
          value={form.trucks}
          onChange={(rows:TruckLine[]) => {

            const first = rows[0];

            const totalTruckQuantity =
              rows.reduce(
                (sum,row) =>
                  sum +
                  Number(row.quantity || 0),
                0
              );

            setForm({
              ...form,

              // La quantité réelle de la vente
              // est maintenant la somme des camions.
              quantity_m3: totalTruckQuantity,

              trucks: rows,

              camion_id:
                first?.camion_id || "",

              truck:
                camions.find(
                  (c:any) =>
                    String(c.id) ===
                    String(first?.camion_id || "")
                )?.code || "",

              driver_name:
                rows
                  .map(x => x.driver_name)
                  .filter(Boolean)
                  .join(" / ")
            });

          }}
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
