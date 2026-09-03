"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";

const money = (v:any) =>
  new Intl.NumberFormat("fr-FR").format(Number(v || 0)) + " FCFA";

export default function SandSalesPage() {
  const [rows,setRows] = useState<any[]>([]);

  async function load() {
    const r = await authFetch("/sand/sales");
    const d = await r.json().catch(()=>[]);
    setRows(Array.isArray(d)?d:[]);
  }

  useEffect(()=>{ load(); },[]);

  async function validateSale(id:number) {
    if (!confirm("Valider cette vente ? Le BL et la facture seront créés automatiquement.")) {
      return;
    }

    const r = await authFetch(`/sand/sales/${id}/validate`,{
      method:"POST"
    });

    const d = await r.json().catch(()=>({}));

    if (!r.ok) {
      alert(d.error || "Erreur validation.");
      return;
    }

    alert(
      `Vente validée.\nBL : ${d.delivery?.delivery_number}\nFacture : ${d.invoice?.invoice_number}`
    );

    load();
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-black">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/sable" className="text-sm font-bold">← Retour</Link>
            <h1 className="mt-3 text-3xl font-black">Ventes de sable</h1>
          </div>

          <Link
            href="/sable/ventes/nouvelle"
            className="rounded-xl bg-black px-5 py-3 font-bold text-white"
          >
            Nouvelle vente
          </Link>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="p-3">N°</th>
                <th className="p-3">Client</th>
                <th className="p-3">Destination</th>
                <th className="p-3">m³</th>
                <th className="p-3">Total</th>
                <th className="p-3">Reste</th>
                <th className="p-3">Statut</th>
                <th className="p-3"></th>
              </tr>
            </thead>

            <tbody>
              {rows.map(v=>(
                <tr key={v.id} className="border-b">
                  <td className="p-3 font-bold">{v.sale_number}</td>
                  <td className="p-3">{v.customer_name}</td>
                  <td className="p-3">{v.destination}</td>
                  <td className="p-3">{v.quantity_m3}</td>
                  <td className="p-3">{money(v.total_amount)}</td>
                  <td className="p-3">{money(v.remaining_amount)}</td>
                  <td className="p-3">{v.status}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {v.status === "BROUILLON" && (
                        <button
                          onClick={()=>validateSale(v.id)}
                          className="min-h-[40px] rounded bg-green-600 px-3 py-2 font-bold text-white"
                        >
                          Valider
                        </button>
                      )}
                      <Link
                        href={`/sable/ventes/${v.id}`}
                        className="flex min-h-[40px] items-center rounded border-2 border-black px-3 py-2 font-bold"
                      >
                        Voir
                      </Link>
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
