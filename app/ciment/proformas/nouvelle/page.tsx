"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../../../lib/api";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

type Line = {
  line_type: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
};

const money = (v: any) =>
  new Intl.NumberFormat("fr-FR").format(Number(v || 0)) + " FCFA";

export default function NewCementProformaPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    customer_id: "",
    destination: "",
    valid_until: "",
    discount: 0,
    tax_amount: 0,
    notes: "",
  });

  const [lines, setLines] = useState<Line[]>([
    {
      line_type: "CIMENT",
      description: "Ciment CPJ 32,5 R",
      quantity: 1,
      unit: "tonne",
      unit_price: 0,
    },
  ]);

  useEffect(() => {
    authFetch("/cement/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(Array.isArray(d) ? d : []));
  }, []);

  const subtotal = useMemo(
    () =>
      lines.reduce(
        (sum, l) =>
          sum + Number(l.quantity || 0) * Number(l.unit_price || 0),
        0
      ),
    [lines]
  );

  const total = Math.max(
    subtotal - Number(form.discount || 0) + Number(form.tax_amount || 0),
    0
  );

  function addLine() {
    setLines([
      ...lines,
      {
        line_type: "AUTRE",
        description: "",
        quantity: 1,
        unit: "unité",
        unit_price: 0,
      },
    ]);
  }

  function updateLine(index: number, key: keyof Line, value: any) {
    setLines((current) =>
      current.map((line, i) =>
        i === index ? { ...line, [key]: value } : line
      )
    );
  }

  function deleteLine(index: number) {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  }

  async function save() {
    setMessage("");

    if (!form.customer_id) {
      return setMessage("Choisis un client.");
    }

    if (lines.some((x) => !x.description.trim())) {
      return setMessage("Toutes les lignes doivent avoir une désignation.");
    }

    setSaving(true);

    try {
      const r = await authFetch("/cement/proformas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: Number(form.customer_id),
          destination: form.destination,
          valid_until: form.valid_until || null,
          discount: Number(form.discount || 0),
          tax_amount: Number(form.tax_amount || 0),
          notes: form.notes,
          lines: lines.map((l, index) => ({
            ...l,
            quantity: Number(l.quantity || 0),
            unit_price: Number(l.unit_price || 0),
            sort_order: index,
          })),
        }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        return setMessage(data.error || "Erreur création proforma.");
      }

      setMessage(
        `Proforma ${data.proforma_number} créée — ${money(
          data.total_amount
        )}`
      );

      setTimeout(() => {
        window.location.href = "/ciment/proformas";
      }, 1200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-black md:p-8">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/ciment/proformas"
          className="mb-4 inline-flex items-center gap-2 text-gray-600"
        >
          <ArrowLeft size={18} />
          Retour aux proformas
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-black">Nouvelle proforma</h1>
          <p className="text-gray-500">
            Ciment, transport, sable, location camion et autres prestations.
          </p>
        </div>

        <section className="mb-6 grid gap-4 rounded-2xl bg-white p-6 shadow-sm md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold">Client</label>
            <select
              value={form.customer_id}
              onChange={(e) =>
                setForm({ ...form, customer_id: e.target.value })
              }
              className="w-full rounded-lg border p-3"
            >
              <option value="">Choisir le client</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">
              Destination
            </label>
            <input
              value={form.destination}
              onChange={(e) =>
                setForm({ ...form, destination: e.target.value })
              }
              className="w-full rounded-lg border p-3"
              placeholder="Ex: Koutiala"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">
              Validité
            </label>
            <input
              type="date"
              value={form.valid_until}
              onChange={(e) =>
                setForm({ ...form, valid_until: e.target.value })
              }
              className="w-full rounded-lg border p-3"
            />
          </div>
        </section>

        <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">Articles / Prestations</h2>

            <button
              onClick={addLine}
              className="flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 font-bold"
            >
              <Plus size={18} />
              Ajouter une ligne
            </button>
          </div>

          <div className="space-y-4">
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-xl border p-4 md:grid-cols-12"
              >
                <select
                  value={line.line_type}
                  onChange={(e) =>
                    updateLine(index, "line_type", e.target.value)
                  }
                  className="rounded-lg border p-3 md:col-span-2"
                >
                  <option value="CIMENT">Ciment</option>
                  <option value="TRANSPORT">Transport</option>
                  <option value="SABLE">Sable</option>
                  <option value="LOCATION">Location camion</option>
                  <option value="AUTRE">Autre</option>
                </select>

                <input
                  value={line.description}
                  onChange={(e) =>
                    updateLine(index, "description", e.target.value)
                  }
                  placeholder="Désignation"
                  className="rounded-lg border p-3 md:col-span-4"
                />

                <input
                  type="number"
                  step="0.001"
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(index, "quantity", Number(e.target.value))
                  }
                  className="rounded-lg border p-3 md:col-span-2"
                  placeholder="Quantité"
                />

                <input
                  value={line.unit}
                  onChange={(e) =>
                    updateLine(index, "unit", e.target.value)
                  }
                  className="rounded-lg border p-3 md:col-span-1"
                  placeholder="Unité"
                />

                <input
                  type="number"
                  value={line.unit_price}
                  onChange={(e) =>
                    updateLine(index, "unit_price", Number(e.target.value))
                  }
                  className="rounded-lg border p-3 md:col-span-2"
                  placeholder="Prix"
                />

                <button
                  onClick={() => deleteLine(index)}
                  className="rounded-lg bg-red-50 p-3 text-red-600 md:col-span-1"
                >
                  <Trash2 size={18} />
                </button>

                <div className="text-right font-bold md:col-span-12">
                  Total ligne :{" "}
                  {money(
                    Number(line.quantity || 0) *
                      Number(line.unit_price || 0)
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 rounded-2xl bg-white p-6 shadow-sm md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold">
              Observation
            </label>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm({ ...form, notes: e.target.value })
              }
              className="min-h-32 w-full rounded-lg border p-3"
            />
          </div>

          <div className="space-y-3 rounded-xl bg-gray-100 p-5">
            <div className="flex justify-between">
              <span>Sous-total</span>
              <strong>{money(subtotal)}</strong>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span>Remise</span>
              <input
                type="number"
                value={form.discount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discount: Number(e.target.value),
                  })
                }
                className="w-40 rounded border p-2 text-right"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <span>Taxes</span>
              <input
                type="number"
                value={form.tax_amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tax_amount: Number(e.target.value),
                  })
                }
                className="w-40 rounded border p-2 text-right"
              />
            </div>

            <div className="border-t pt-3">
              <div className="flex justify-between text-2xl font-black">
                <span>TOTAL</span>
                <span>{money(total)}</span>
              </div>
            </div>

            <button
              disabled={saving}
              onClick={save}
              className="mt-4 w-full rounded-xl bg-black p-4 font-black text-white disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Créer la proforma"}
            </button>
          </div>

          {message && (
            <div className="font-bold md:col-span-2">
              {message}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
