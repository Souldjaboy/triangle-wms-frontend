"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "../../lib/api";
import PrintableCompanyHeader from "../../components/PrintableCompanyHeader";

/**
 * P4-E / P4-F — ÉTAT DES FACTURES SABLE.
 *
 * Deux usages sur le même écran :
 *  - ÉTAT SUR SÉLECTION : on coche des factures, on génère un état imprimable
 *    (POST /sand/reports/statement) — les totaux ne portent que sur la sélection.
 *  - ÉTAT GLOBAL FILTRÉ : période, client, site, statut (GET /sand/reports/summary).
 *
 * « Opération » affiche « Vente de sable », pas la référence VS-xxxx (elle reste
 * en information secondaire). La colonne s'appelle « Site », jamais « Lieu ».
 */

type Invoice = {
  id: number; invoice_number: string; invoice_date: string | null;
  client_name: string | null; site: string | null; operation: string;
  total_amount: string; paid_amount: string; remaining_amount: string;
  status: string; operation_reference: string | null;
};
type Line = {
  invoice_number: string; invoice_date: string; operation: string;
  client: string; site: string; quantity_m3: string | null;
  amount: string; paid: string; remaining: string; status: string;
};
type Statement = {
  company: { id: number; name: string } | null;
  period: { from: string | null; to: string | null };
  invoices_count: number; clients: string[]; sites: string[];
  totals: { total_invoiced: number; total_paid: number; total_remaining: number; total_m3: number };
  lines: Line[];
};
type Summary = {
  summary: {
    invoices_count: number; sales_count: number; total_m3: string;
    total_invoiced: string; total_paid: string; total_remaining: string;
    unpaid_count: number; paid_count: number; partial_count: number;
  };
};
type Company = Record<string, unknown>;

const fdate = (d: string | null) => {
  if (!d) return "";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
};
const money = (v: string | number | null) =>
  v == null || v === "" ? "0" : Number(v).toLocaleString("fr-FR");

export default function EtatsSablePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [statement, setStatement] = useState<Statement | null>(null);
  const [summary, setSummary] = useState<Summary["summary"] | null>(null);
  const [company, setCompany] = useState<Company>({});
  const [filters, setFilters] = useState({ date_from: "", date_to: "", site: "", status: "" });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await authFetch("/sand/invoices");
    if (r.ok) setInvoices(await r.json());
    const c = await authFetch("/company-settings/current");
    if (c.ok) setCompany(await c.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const allSelected = invoices.length > 0 && selected.size === invoices.length;
  const toggle = (id: number) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };
  const selectAll = () => setSelected(new Set(invoices.map((i) => i.id)));
  const clearAll = () => setSelected(new Set());

  const generate = async () => {
    setMsg(""); setStatement(null);
    if (selected.size === 0) return setMsg("Cochez au moins une facture.");
    const res = await authFetch("/sand/reports/statement", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice_ids: [...selected] }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(`❌ ${d?.error || "Erreur."}`);
    setStatement(d);
  };

  const applyFilters = async () => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
    const res = await authFetch(`/sand/reports/summary?${p.toString()}`);
    if (res.ok) setSummary((await res.json()).summary);
  };

  const sites = useMemo(
    () => [...new Set(invoices.map((i) => i.site).filter(Boolean))] as string[],
    [invoices]
  );

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8 print:bg-white print:p-0">
      {/* ---------- Écran de travail : jamais imprimé ---------- */}
      <div className="mx-auto max-w-6xl space-y-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-black text-gray-900">États — Vente de sable</h1>
          <Link href="/sable" className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">← Sable</Link>
        </div>

        {msg && <div className="rounded-xl bg-red-50 p-4 font-semibold text-red-800">{msg}</div>}

        {/* État global filtré */}
        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-black text-gray-900">État global</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input type="date" className="rounded-xl border border-gray-300 p-3 text-gray-900" value={filters.date_from}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
            <input type="date" className="rounded-xl border border-gray-300 p-3 text-gray-900" value={filters.date_to}
              onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
            <select className="rounded-xl border border-gray-300 p-3 text-gray-900" value={filters.site}
              onChange={(e) => setFilters({ ...filters, site: e.target.value })}>
              <option value="">Tous les sites</option>
              {sites.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="rounded-xl border border-gray-300 p-3 text-gray-900" value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Tous les statuts</option>
              <option value="IMPAYEE">Impayée</option>
              <option value="PARTIELLEMENT_PAYEE">Partiellement payée</option>
              <option value="PAYEE">Payée</option>
            </select>
            <button onClick={applyFilters} className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">Appliquer</button>
          </div>

          {summary && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Box label="Ventes" value={String(summary.sales_count)} />
              <Box label="Quantité totale" value={`${Number(summary.total_m3).toLocaleString("fr-FR")} m³`} />
              <Box label="Total facturé" value={`${money(summary.total_invoiced)} F`} />
              <Box label="Total payé" value={`${money(summary.total_paid)} F`} />
              <Box label="Total restant" value={`${money(summary.total_remaining)} F`} />
              <Box label="Impayées" value={String(summary.unpaid_count)} />
              <Box label="Partielles" value={String(summary.partial_count)} />
              <Box label="Payées" value={String(summary.paid_count)} />
            </div>
          )}
        </section>

        {/* Sélection de factures */}
        <section className="rounded-2xl bg-white p-6 shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black text-gray-900">État sur factures sélectionnées</h2>
            <div className="flex flex-wrap gap-2">
              <button onClick={selectAll} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700">Tout sélectionner</button>
              <button onClick={clearAll} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700">Tout désélectionner</button>
              <button onClick={generate} className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-black text-black">
                Générer l&apos;état ({selected.size})
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="p-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={() => (allSelected ? clearAll() : selectAll())} />
                  </th>
                  <th className="p-3">Facture</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Opération</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Site</th>
                  <th className="p-3 text-right">Montant</th>
                  <th className="p-3 text-right">Payé</th>
                  <th className="p-3 text-right">Reste</th>
                  <th className="p-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="p-3"><input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} /></td>
                    <td className="p-3 font-semibold">{i.invoice_number}</td>
                    <td className="p-3">{fdate(i.invoice_date)}</td>
                    {/* Libellé métier ; la référence reste en information secondaire. */}
                    <td className="p-3">
                      Vente de sable
                      {i.operation_reference && <span className="block text-xs text-gray-400">{i.operation_reference}</span>}
                    </td>
                    <td className="p-3">{i.client_name || "—"}</td>
                    <td className="p-3">{i.site || "—"}</td>
                    <td className="p-3 text-right">{money(i.total_amount)}</td>
                    <td className="p-3 text-right">{money(i.paid_amount)}</td>
                    <td className="p-3 text-right">{money(i.remaining_amount)}</td>
                    <td className="p-3">{i.status}</td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr><td className="p-6 text-center text-gray-500" colSpan={10}>Aucune facture.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ---------- État imprimable ---------- */}
      {statement && (
        <>
          <div className="mx-auto mt-6 flex max-w-[297mm] justify-end px-4 print:hidden">
            <button onClick={() => window.print()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">
              Imprimer l&apos;état
            </button>
          </div>
          <div className="doc-sheet mx-auto mt-3 w-[297mm] max-w-full bg-white p-[12mm] text-black shadow print:w-auto print:p-0 print:shadow-none">
            <PrintableCompanyHeader
              company={{ ...company, email: undefined }}
              documentTitle="État des factures"
              documentNumber={`${statement.invoices_count} facture(s)`}
              documentDate={
                statement.period.from
                  ? `Période : ${fdate(statement.period.from)} — ${fdate(statement.period.to)}`
                  : undefined
              }
            />
            <p className="mt-3 text-sm">
              <span className="font-bold">Opération :</span> Vente de sable
              {statement.sites.length > 0 && <> · <span className="font-bold">Site(s) :</span> {statement.sites.join(", ")}</>}
            </p>

            <table className="mt-4 w-full border-collapse text-xs">
              <thead>
                <tr className="border-y-2 border-black">
                  <th className="p-2 text-left">Facture</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Opération</th>
                  <th className="p-2 text-left">Client</th>
                  <th className="p-2 text-left">Site</th>
                  <th className="p-2 text-right">Montant</th>
                  <th className="p-2 text-right">Payé</th>
                  <th className="p-2 text-right">Reste</th>
                  <th className="p-2 text-left">Statut</th>
                </tr>
              </thead>
              <tbody>
                {statement.lines.map((l) => (
                  <tr key={l.invoice_number} className="border-b border-gray-300">
                    <td className="p-2 font-semibold">{l.invoice_number}</td>
                    <td className="p-2">{fdate(l.invoice_date)}</td>
                    <td className="p-2">{l.operation}</td>
                    <td className="p-2">{l.client}</td>
                    <td className="p-2">{l.site}</td>
                    <td className="p-2 text-right">{money(l.amount)}</td>
                    <td className="p-2 text-right">{money(l.paid)}</td>
                    <td className="p-2 text-right">{money(l.remaining)}</td>
                    <td className="p-2">{l.status}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-y-2 border-black">
                  <td className="p-2 font-black" colSpan={5}>TOTAUX</td>
                  <td className="p-2 text-right font-black">{money(statement.totals.total_invoiced)}</td>
                  <td className="p-2 text-right font-black">{money(statement.totals.total_paid)}</td>
                  <td className="p-2 text-right font-black">{money(statement.totals.total_remaining)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>

            <section className="signature-zone mt-10 flex justify-end text-sm">
              <div className="w-64">
                <p className="border-b border-black pb-1 text-center font-black">DIRECTION</p>
                <div className="h-24" />
              </div>
            </section>
          </div>
        </>
      )}

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: #fff; }
          .doc-sheet tr { break-inside: avoid; page-break-inside: avoid; }
          .signature-zone { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </main>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-black text-gray-900">{value}</p>
    </div>
  );
}
