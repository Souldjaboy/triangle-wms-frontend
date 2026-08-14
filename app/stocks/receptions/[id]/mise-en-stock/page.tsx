"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../../lib/api";
import PrintableCompanyHeader from "../../../../components/PrintableCompanyHeader";
import { Putaway, n, fdate, fdatetime } from "../../shared";

/**
 * BONS DE MISE EN STOCK — un document par rangement.
 *
 * Chaque bon porte le stock AVANT et APRÈS l'opération : c'est la pièce qui
 * justifie la variation du stock disponible, et la seule qui en atteste. Les
 * documents sont séparés par un saut de page à l'impression.
 *
 * Lecture seule : cette page n'écrit rien.
 */

export default function BonsMiseEnStockPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const search = useSearchParams();
  const [rows, setRows] = useState<Putaway[]>([]);
  const [company, setCompany] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await authFetch(`/stock/receptions/${id}/putaways`);
    if (r.ok) setRows(await r.json());
    else setError(r.status === 404 ? "Réception introuvable." : "Erreur de chargement.");
    const c = await authFetch("/company-settings/current");
    if (c.ok) setCompany(await c.json());
    setLoaded(true);
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  useEffect(() => {
    if (!loaded || !rows.length || search?.get("print") !== "1") return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [loaded, rows, search]);

  if (error) return <div className="p-8 font-semibold text-red-700">{error}</div>;
  if (!loaded) return <div className="p-8 text-gray-600">Chargement des bons de mise en stock…</div>;

  return (
    <div className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 px-4 print:hidden">
        <Link href={`/stocks/receptions/${id}`} className="font-bold text-blue-700">← Réception</Link>
        <button onClick={() => window.print()} disabled={!rows.length}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          Imprimer {rows.length > 1 ? `les ${rows.length} bons` : "le bon"}
        </button>
      </div>

      {!rows.length && (
        <p className="mx-auto max-w-[210mm] rounded-2xl bg-white p-8 text-center text-gray-600 shadow">
          Aucune mise en stock n&apos;a encore été effectuée pour cette réception.
          La marchandise est reçue mais pas encore disponible au stock.
        </p>
      )}

      {rows.map((p) => (
        <div key={p.id}
             className="doc-sheet mx-auto mb-6 w-[210mm] bg-white p-[14mm] text-black shadow print:mb-0 print:w-auto print:p-0 print:shadow-none print:break-after-page">
          <PrintableCompanyHeader
            company={company}
            documentTitle="Bon de mise en stock"
            documentNumber={`N° MES-${String(p.id).padStart(6, "0")}`}
            documentDate={`Le ${fdatetime(p.created_at)}`}
          />

          <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <p><span className="font-bold">Réception source :</span> {p.reception_number || "—"}</p>
            <p><span className="font-bold">Conteneur :</span> {p.container_number || "—"}</p>
            <p><span className="font-bold">Date de réception :</span> {fdate(p.reception_date)}</p>
            <p><span className="font-bold">Ligne :</span> {p.line_no ?? "—"}</p>
            <p><span className="font-bold">Entrepôt :</span> {p.warehouse_code || "—"}</p>
            <p><span className="font-bold">Emplacement :</span> {p.location_code || "non précisé"}</p>
            <p><span className="font-bold">Rangé par :</span> {p.created_by_name || "—"}</p>
          </section>

          <table className="mt-5 w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-400 p-2 text-left">Produit</th>
                <th className="border border-gray-400 p-2 text-left">Désignation reçue</th>
                <th className="border border-gray-400 p-2 text-right">Quantité</th>
                <th className="border border-gray-400 p-2 text-left">Unité</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-400 p-2">
                  <span className="font-bold">{p.product_name || "—"}</span>
                  {p.product_reference && <span className="block text-xs text-gray-600">{p.product_reference}</span>}
                </td>
                <td className="border border-gray-400 p-2">{p.received_label || "—"}</td>
                <td className="border border-gray-400 p-2 text-right text-lg font-black">{n(p.quantity)}</td>
                <td className="border border-gray-400 p-2">{p.unit || "—"}</td>
              </tr>
            </tbody>
          </table>

          <section className="mt-5 grid grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border border-gray-400 p-3">
              <p className="text-xs uppercase text-gray-600">Stock avant</p>
              <p className="text-xl font-black">{n(p.stock_before)}</p>
            </div>
            <div className="rounded-lg border border-gray-400 p-3">
              <p className="text-xs uppercase text-gray-600">Quantité rangée</p>
              <p className="text-xl font-black">+ {n(p.quantity)}</p>
            </div>
            <div className="rounded-lg border-2 border-black p-3">
              <p className="text-xs uppercase text-gray-600">Stock après</p>
              <p className="text-xl font-black">{n(p.stock_after)}</p>
            </div>
          </section>

          <p className="mt-4 text-[10px] italic text-gray-600">
            Ce bon justifie la variation du stock disponible du produit ci-dessus. Il est émis au
            moment du rangement physique à l&apos;emplacement indiqué.
          </p>

          <section className="mt-10 grid grid-cols-2 gap-8 text-sm">
            {["Magasinier", "Contrôleur"].map((role) => (
              <div key={role}>
                <p className="font-bold">{role}</p>
                <div className="mt-12 border-t border-black pt-1 text-gray-600">Nom et signature</div>
              </div>
            ))}
          </section>
        </div>
      ))}
    </div>
  );
}
