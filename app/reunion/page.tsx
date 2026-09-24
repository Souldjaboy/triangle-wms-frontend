"use client";

import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";

type Report = {
  company_id:number;
  from:string;
  to:string;
  chiffre_affaires:number;
  depenses:number;
  resultat:number;
  ventes:any[];
  detail_depenses:any[];
};

const money=(v:any)=>
  new Intl.NumberFormat("fr-FR").format(Number(v||0))+" FCFA";

export default function ReunionPage(){

  const now=new Date();

  const first=
    `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;

  const today=
    `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

  const [from,setFrom]=useState(first);
  const [to,setTo]=useState(today);
  const [data,setData]=useState<Report|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  async function load(){
    setLoading(true);
    setError("");

    try{
      const r=await authFetch(
        `/meeting-presentation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );

      const j=await r.json();

      if(!r.ok) throw new Error(j.error||"Chargement impossible");

      setData(j);
    }catch(e:any){
      setError(e.message||"Erreur");
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{load()},[]);

  const resultPositive=useMemo(
    ()=>Number(data?.resultat||0)>=0,
    [data]
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">

      <div className="mx-auto max-w-7xl space-y-6">

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">
            Présentation réunion
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Présentation financière opérationnelle.
            Les soldes bancaires et la trésorerie sont volontairement exclus.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">

            <input
              type="date"
              value={from}
              onChange={e=>setFrom(e.target.value)}
              className="rounded-xl border px-3 py-2"
            />

            <input
              type="date"
              value={to}
              onChange={e=>setTo(e.target.value)}
              className="rounded-xl border px-3 py-2"
            />

            <button
              onClick={load}
              className="rounded-xl bg-slate-900 px-5 py-2 text-white"
            >
              {loading?"Chargement...":"Actualiser"}
            </button>

            <button
              onClick={()=>window.print()}
              className="rounded-xl border px-5 py-2"
            >
              Imprimer / Présenter
            </button>

          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">
              {error}
            </div>
          )}
        </div>


        {data && (
          <>

            <div className="grid gap-4 md:grid-cols-3">

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">
                  Chiffre d'affaires
                </div>
                <div className="mt-2 text-2xl font-bold">
                  {money(data.chiffre_affaires)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">
                  Dépenses réelles
                </div>
                <div className="mt-2 text-2xl font-bold">
                  {money(data.depenses)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="text-sm text-slate-500">
                  Résultat
                </div>
                <div className={
                  "mt-2 text-2xl font-bold "+
                  (resultPositive?"text-emerald-700":"text-red-700")
                }>
                  {money(data.resultat)}
                </div>
              </div>

            </div>


            <section className="rounded-2xl bg-white p-5 shadow-sm">

              <h2 className="mb-4 text-xl font-semibold">
                Ventes / recettes
              </h2>

              <div className="overflow-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">Date</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Quantité / Tonnage</th>
                      <th className="p-2 text-right">Montant</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(data.ventes||[])
                      .filter((r:any)=>Number(r.total_amount??r.recette??0)>0)
                      .map((r:any,i:number)=>(
                      <tr key={i} className="border-b">
                        <td className="p-2">
                          {r.sale_date||r.op_date||"-"}
                        </td>

                        <td className="p-2">
                          {r.libelle||r.status||"Vente"}
                        </td>

                        <td className="p-2">
                          {r.tonnage??"-"}
                        </td>

                        <td className="p-2 text-right font-medium">
                          {money(r.total_amount??r.recette??0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </section>


            <section className="rounded-2xl bg-white p-5 shadow-sm">

              <h2 className="mb-4 text-xl font-semibold">
                Détail des dépenses
              </h2>

              {data.company_id===5 ? (

                <div className="overflow-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <tbody>
                      {(data.ventes||[])
                        .filter((r:any)=>Number(r.depense||0)>0)
                        .map((r:any,i:number)=>(
                        <tr key={i} className="border-b">
                          <td className="p-2">{r.op_date}</td>
                          <td className="p-2">{r.libelle||"-"}</td>
                          <td className="p-2 text-right">
                            {money(r.depense)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              ) : (

                <div className="overflow-auto">
                  <table className="w-full min-w-[800px] text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="p-2">Date</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Description</th>
                        <th className="p-2 text-right">Montant</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(data.detail_depenses||[]).map((r:any,i:number)=>(
                        <tr key={i} className="border-b">
                          <td className="p-2">{r.date}</td>
                          <td className="p-2">{r.transaction_type}</td>
                          <td className="p-2">
                            {r.description||r.category||"-"}
                          </td>
                          <td className="p-2 text-right">
                            {money(r.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              )}

            </section>

          </>
        )}

      </div>
    </main>
  );
}
