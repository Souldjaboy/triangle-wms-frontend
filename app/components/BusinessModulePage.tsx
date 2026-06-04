"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";
import { formatFCFA } from "../lib/format";

type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select";
  options?: string[];
};

type Column = {
  key: string;
  label: string;
  money?: boolean;
};

type NavLink = {
  href: string;
  label: string;
};

type Props = {
  title: string;
  description: string;
  endpoint?: string;
  dashboardEndpoint?: string;
  createTitle?: string;
  fields?: Field[];
  columns?: Column[];
  navLinks?: NavLink[];
};

export default function BusinessModulePage({
  title,
  description,
  endpoint,
  dashboardEndpoint,
  createTitle = "Créer",
  fields = [],
  columns = [],
  navLinks = [],
}: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setMessage("");
    if (!endpoint && !dashboardEndpoint) return;
    setLoading(true);
    try {
      const requests = [];
      if (endpoint) requests.push(authFetch(endpoint).then((r) => r.json()));
      if (dashboardEndpoint) requests.push(authFetch(dashboardEndpoint).then((r) => r.json()));
      const results = await Promise.all(requests);
      if (endpoint) setItems(Array.isArray(results[0]) ? results[0] : []);
      if (dashboardEndpoint) setDashboard(endpoint ? results[1] : results[0]);
    } catch {
      setMessage("Impossible de charger les données.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [endpoint, dashboardEndpoint]);

  const cards = useMemo(() => {
    if (!dashboard) return [];
    const flat: Array<{ label: string; value: any }> = [];
    Object.entries(dashboard).forEach(([group, value]: any) => {
      if (value && typeof value === "object") {
        Object.entries(value).forEach(([key, amount]) => {
          flat.push({ label: `${group} ${key}`.replaceAll("_", " "), value: amount });
        });
      }
    });
    return flat.slice(0, 8);
  }, [dashboard]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!endpoint) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Erreur enregistrement");
      setForm({});
      setMessage("Enregistrement effectué.");
      await load();
    } catch (error: any) {
      setMessage(error?.message || "Erreur enregistrement");
    } finally {
      setLoading(false);
    }
  };

  const displayValue = (item: any, column: Column) => {
    const value = item?.[column.key];
    if (column.money) return formatFCFA(value);
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl bg-black p-6 text-white shadow md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-yellow-400">Triangle WMS Pro</p>
            <h1 className="mt-2 text-3xl font-black">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-300">{description}</p>
          </div>
          <button
            onClick={load}
            className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-black shadow"
            disabled={loading}
          >
            Actualiser
          </button>
        </header>

        {navLinks.length > 0 && (
          <nav className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-xl bg-white p-4 font-black shadow hover:bg-yellow-50">
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {cards.length > 0 && (
          <section className="grid gap-4 md:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="rounded-xl bg-white p-5 shadow">
                <p className="text-xs font-bold uppercase text-gray-500">{card.label}</p>
                <p className="mt-2 text-2xl font-black text-black">
                  {String(card.label).includes("amount") || String(card.label).includes("paid")
                    ? formatFCFA(card.value)
                    : String(card.value || 0)}
                </p>
              </div>
            ))}
          </section>
        )}

        {fields.length > 0 && endpoint && (
          <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow">
            <h2 className="text-xl font-black">{createTitle}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {fields.map((field) => (
                <label key={field.name} className="text-sm font-bold text-gray-700">
                  {field.label}
                  {field.type === "select" ? (
                    <select
                      className="mt-1 w-full rounded-xl border p-3"
                      value={form[field.name] || ""}
                      onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                    >
                      <option value="">Choisir</option>
                      {(field.options || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="mt-1 w-full rounded-xl border p-3"
                      type={field.type || "text"}
                      value={form[field.name] || ""}
                      onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                    />
                  )}
                </label>
              ))}
            </div>
            <button className="mt-4 rounded-xl bg-black px-6 py-3 font-black text-white" disabled={loading}>
              {loading ? "Enregistrement..." : createTitle}
            </button>
          </form>
        )}

        {message && (
          <div className="rounded-xl bg-yellow-50 p-4 font-bold text-black shadow">{message}</div>
        )}

        {columns.length > 0 && (
          <section className="overflow-x-auto rounded-2xl bg-white shadow">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-900 text-white">
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className="p-3">{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b">
                    {columns.map((column) => (
                      <td key={column.key} className="p-3 font-semibold">{displayValue(item, column)}</td>
                    ))}
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td className="p-6 text-center font-bold text-gray-500" colSpan={columns.length}>
                      Aucun enregistrement.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </main>
  );
}
