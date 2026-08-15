"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../../lib/api";
import PrintableCompanyHeader from "../../../../components/PrintableCompanyHeader";
import { ReceptionDetail, n, fdate } from "../../shared";

/**
 * BON DE RÉCEPTION — page A4 imprimable.
 *
 * Lecture seule : ouvrir ou imprimer ce document n'écrit rien et ne touche
 * aucun stock. Le document atteste de la marchandise REÇUE, pas de la
 * marchandise disponible : la colonne « reste à ranger » le rend explicite.
 */

export default function BonReceptionPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const search = useSearchParams();
  const [data, setData] = useState<ReceptionDetail | null>(null);
  const [company, setCompany] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await authFetch(`/stock/receptions/${id}`);
    if (r.ok) setData(await r.json());
    else setError(r.status === 404 ? "Réception introuvable." : "Erreur de chargement.");
    const c = await authFetch("/company-settings/current");
    if (c.ok) setCompany(await c.json());
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  useEffect(() => {
    if (!data || search?.get("print") !== "1") return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [data, search]);

  if (error) return <div className="p-8 font-semibold text-red-700">{error}</div>;
  if (!data) return <div className="p-8 text-gray-600">Chargement du bon de réception…</div>;

  const r = data.reception;
  const t = data.totals;
  const byWarehouse = data.lines.reduce<Record<string, number>>((acc, l) => {
    const w = l.warehouse_code || "—";
    acc[w] = (acc[w] || 0) + Number(l.quantity_received);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4 print:hidden">
        <Link href={`/stocks/receptions/${id}`} className="font-bold text-blue-700">← Réception</Link>
        <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">
          Imprimer
        </button>
      </div>

      <div className="doc-sheet mx-auto w-[210mm] min-h-[297mm] bg-white p-[14mm] text-black shadow print:w-auto print:min-h-0 print:p-0 print:shadow-none">
        <PrintableCompanyHeader
          company={company}
          documentTitle="Bon de réception"
          documentNumber={`N° ${r.reception_number}`}
          documentDate={`Date de réception : ${fdate(r.reception_date)}`}
        />

        <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <p><span className="font-bold">Conteneur :</span> {r.container_number || "—"}</p>
          <p><span className="font-bold">Statut :</span> {r.status_label}</p>
          <p><span className="font-bold">Entrepôts desservis :</span> {r.warehouses || "—"}</p>
          <p><span className="font-bold">Réceptionné par :</span> {r.created_by_name || "—"}</p>
          {/* La provenance est indiquée, mais le document est le MÊME que la
              réception vienne d'une saisie manuelle ou d'un import Excel. */}
          <p><span className="font-bold">Origine :</span> {r.source_label || r.source || "—"}</p>
          {r.supplier_name && <p><span className="font-bold">Fournisseur :</span> {r.supplier_name}</p>}
          {r.supplier_reference && <p><span className="font-bold">BL fournisseur :</span> {r.supplier_reference}</p>}
          {r.carrier && <p><span className="font-bold">Transporteur :</span> {r.carrier}</p>}
          {r.source_file && <p><span className="font-bold">Fichier source :</span> {r.source_file}</p>}
          {r.notes && <p className="col-span-2"><span className="font-bold">Notes :</span> {r.notes}</p>}
        </section>

        <table className="mt-5 w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 p-1.5 text-left">#</th>
              <th className="border border-gray-400 p-1.5 text-left">Désignation reçue</th>
              <th className="border border-gray-400 p-1.5 text-left">Produit</th>
              <th className="border border-gray-400 p-1.5 text-left">Entrepôt</th>
              <th className="border border-gray-400 p-1.5 text-right">Qté reçue</th>
              <th className="border border-gray-400 p-1.5 text-left">Unité</th>
              <th className="border border-gray-400 p-1.5 text-right">Rangée</th>
              <th className="border border-gray-400 p-1.5 text-right">Reste</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l) => (
              <tr key={l.id}>
                <td className="border border-gray-400 p-1.5">{l.line_no}</td>
                <td className="border border-gray-400 p-1.5">{l.received_label}</td>
                <td className="border border-gray-400 p-1.5">{l.product_name || "à vérifier"}</td>
                <td className="border border-gray-400 p-1.5">{l.warehouse_code || "—"}</td>
                <td className="border border-gray-400 p-1.5 text-right font-bold">{n(l.quantity_received)}</td>
                <td className="border border-gray-400 p-1.5">{l.unit}</td>
                <td className="border border-gray-400 p-1.5 text-right">{n(l.quantity_putaway)}</td>
                <td className="border border-gray-400 p-1.5 text-right">{n(l.quantity_remaining)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td className="border border-gray-400 p-1.5" colSpan={4}>Total — {n(t.lines)} ligne(s)</td>
              <td className="border border-gray-400 p-1.5 text-right">{n(t.received)}</td>
              <td className="border border-gray-400 p-1.5"></td>
              <td className="border border-gray-400 p-1.5 text-right">{n(t.putaway)}</td>
              <td className="border border-gray-400 p-1.5 text-right">{n(t.pending)}</td>
            </tr>
          </tfoot>
        </table>

        <section className="mt-4 text-[11px]">
          <p className="font-bold">Répartition par entrepôt</p>
          <p>{Object.entries(byWarehouse).map(([w, q]) => `${w} : ${n(q)}`).join("   ·   ")}</p>
        </section>

        <p className="mt-4 text-[10px] italic text-gray-600">
          Ce bon atteste de la marchandise reçue. Les quantités figurant en « reste » ne sont pas
          encore disponibles au stock : elles le deviennent à la mise en stock, qui donne lieu à un
          bon de mise en stock distinct.
        </p>

        <section className="mt-10 grid grid-cols-3 gap-8 text-[11px]">
          {["Réceptionnaire", "Magasinier", "Responsable logistique"].map((role) => (
            <div key={role}>
              <p className="font-bold">{role}</p>
              <div className="mt-12 border-t border-black pt-1 text-gray-600">Nom et signature</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
