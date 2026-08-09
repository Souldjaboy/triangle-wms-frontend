"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import { usePermissions } from "../../../lib/permissions";

/**
 * P4-C — Création d'une proforma sable (POST /sand/proformas, créé en P0-2).
 * Le prix vient du tarif de la destination : on affiche le PALIER commercial
 * (10 m³ = 170 000) et le montant calculé, jamais le prix au m³.
 */

type Customer = { id: number; name: string };
type Price = { id: number; destination: string; quantity_reference: string; price: string };

const money = (v: number) => v.toLocaleString("fr-FR");

export default function NouvelleProformaSablePage() {
  const router = useRouter();
  const { can } = usePermissions();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [form, setForm] = useState({
    customer_id: "", destination: "", quantity_m3: "", valid_until: "", notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([authFetch("/sand/customers"), authFetch("/sand/prices")]);
    if (c.ok) setCustomers(await c.json());
    if (p.ok) setPrices(await p.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  // Tarif de la destination choisie : sert à l'aperçu du montant.
  const tariff = prices.find(
    (p) => p.destination?.toLowerCase() === form.destination.trim().toLowerCase()
  );
  const qtyRef = tariff ? Number(tariff.quantity_reference) : 10;
  const refPrice = tariff ? Number(tariff.price) : 0;
  const quantity = Number(form.quantity_m3 || 0);
  const preview = qtyRef > 0 ? (refPrice / qtyRef) * quantity : 0;

  const submit = async () => {
    setMsg("");
    if (!form.destination.trim()) return setMsg("Destination obligatoire.");
    if (!(quantity > 0)) return setMsg("Quantité (m³) invalide.");
    setBusy(true);
    const res = await authFetch("/sand/proformas", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        destination: form.destination.trim(),
        quantity_m3: quantity,
        valid_until: form.valid_until || null,
        notes: form.notes || null,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(`❌ ${d?.error || "Erreur."}`);
    router.push(`/sable/proformas/${d.proforma.id}`);
  };

  if (!can("sand", "create")) {
    return <div className="p-8 font-semibold text-gray-700">Vous n&apos;avez pas la permission de créer une proforma.</div>;
  }

  const inp = "w-full rounded-xl border border-gray-300 p-3 text-gray-900";

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-gray-900">Nouvelle proforma</h1>
          <Link href="/sable/proformas" className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">
            ← Proformas
          </Link>
        </div>

        {msg && <div className="rounded-xl bg-blue-50 p-4 font-semibold text-blue-900">{msg}</div>}

        <section className="grid gap-4 rounded-2xl bg-white p-6 shadow sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold text-gray-700">Client</span>
            <select className={inp} value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">— Client occasionnel —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-gray-700">Destination / Site</span>
            <input className={inp} list="sand-destinations" value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Bamako" />
            <datalist id="sand-destinations">
              {prices.map((p) => <option key={p.id} value={p.destination} />)}
            </datalist>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-gray-700">Quantité (m³)</span>
            <input type="number" step="0.5" min="0" className={inp} value={form.quantity_m3}
              onChange={(e) => setForm({ ...form, quantity_m3: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-gray-700">Valable jusqu&apos;au</span>
            <input type="date" className={inp} value={form.valid_until}
              onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-bold text-gray-700">Observation</span>
            <input className={inp} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </section>

        {/* Aperçu : le palier commercial, pas le prix au m³. */}
        {tariff && quantity > 0 && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <p className="text-sm text-gray-600">
              Prix {qtyRef} m³ : <b className="text-gray-900">{money(refPrice)} FCFA</b>
            </p>
            <p className="mt-1 text-lg font-black text-gray-900">
              Montant estimé : {money(preview)} FCFA
            </p>
          </section>
        )}

        <button onClick={submit} disabled={busy}
          className="rounded-xl bg-yellow-500 px-6 py-3 font-black text-black hover:bg-yellow-400 disabled:opacity-50">
          {busy ? "Création…" : "Créer la proforma"}
        </button>
      </div>
    </main>
  );
}
