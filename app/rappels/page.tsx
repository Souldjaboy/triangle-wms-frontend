"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { authFetch } from "../lib/api";


type Reminder = {
  id: number;
  title: string;
  category: string;
  description: string;
  amount: number | string;
  currency: string;
  due_date: string;
  recurrence: string;
  remind_days: number[];
  email_enabled: boolean;
  email_to: string;
  status: string;
};


type Settings = {
  large_withdrawal_threshold: number | string;
  supplier_unpaid_after_days: number;
  supplier_alerts_enabled: boolean;
  withdrawal_alerts_enabled: boolean;
  email_enabled: boolean;
  default_email: string;
};


type SupplierDebt = {
  id: number;
  purchase_number: string;
  supplier_name: string;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  status: string;
  created_at: string;
};


const categories = [
  ["loyer", "Location / Loyer"],
  ["impot", "Impôt"],
  ["visa", "Recharge carte Visa"],
  ["nourriture", "Nourriture"],
  ["fournisseur", "Fournisseur"],
  ["charge", "Autre charge"],
  ["autre", "Autre"],
];


const formatMoney = (value: unknown) =>
  Number(value || 0).toLocaleString(
    "fr-FR",
    { maximumFractionDigits: 0 }
  );


export default function RappelsPage() {
  const [rows,setRows] =
    useState<Reminder[]>([]);

  const [debts,setDebts] =
    useState<SupplierDebt[]>([]);

  const [debtTotal,setDebtTotal] =
    useState(0);

  const [loading,setLoading] =
    useState(true);

  const [message,setMessage] =
    useState("");

  const [form,setForm] = useState({
    title:"",
    category:"loyer",
    description:"",
    amount:"",
    due_date:"",
    recurrence:"monthly",
    remind_days:[5,3,0] as number[],
    email_enabled:true,
    email_to:"diallogcif@gmail.com",
  });

  const [settings,setSettings] =
    useState<Settings>({
      large_withdrawal_threshold:5000000,
      supplier_unpaid_after_days:7,
      supplier_alerts_enabled:true,
      withdrawal_alerts_enabled:true,
      email_enabled:true,
      default_email:"diallogcif@gmail.com",
    });


  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [
        remindersRes,
        settingsRes,
        debtRes
      ] = await Promise.all([
        authFetch("/reminders"),
        authFetch("/reminders/settings/current"),
        authFetch("/reminders/supplier-debts/current"),
      ]);

      if (!remindersRes.ok) {
        throw new Error(
          "Impossible de charger les rappels"
        );
      }

      const reminders =
        await remindersRes.json();

      setRows(
        Array.isArray(reminders)
          ? reminders
          : []
      );

      if (settingsRes.ok) {
        const s =
          await settingsRes.json();

        setSettings(prev => ({
          ...prev,
          ...s,
        }));
      }

      if (debtRes.ok) {
        const d =
          await debtRes.json();

        setDebts(
          Array.isArray(d.rows)
            ? d.rows
            : []
        );

        setDebtTotal(
          Number(d.total || 0)
        );
      }

      setMessage("");
    } catch (error:any) {
      setMessage(
        error?.message ||
        "Erreur de chargement."
      );
    } finally {
      setLoading(false);
    }
  },[]);


  useEffect(() => {
    load();
  },[load]);


  const activeRows =
    useMemo(
      () =>
        rows.filter(
          r => r.status === "active"
        ),
      [rows]
    );


  const overdue =
    useMemo(
      () => {
        const today =
          new Date()
            .toISOString()
            .slice(0,10);

        return activeRows.filter(
          r =>
            String(r.due_date)
              .slice(0,10) < today
        ).length;
      },
      [activeRows]
    );


  function toggleDay(day:number) {
    setForm(prev => {
      const exists =
        prev.remind_days.includes(day);

      return {
        ...prev,
        remind_days:
          exists
            ? prev.remind_days.filter(
                d => d !== day
              )
            : [
                ...prev.remind_days,
                day
              ].sort(
                (a,b) => b-a
              ),
      };
    });
  }


  async function createReminder(
    e:React.FormEvent
  ) {
    e.preventDefault();

    setMessage("");

    const r =
      await authFetch(
        "/reminders",
        {
          method:"POST",
          headers:{
            "Content-Type":
              "application/json",
          },
          body:JSON.stringify({
            ...form,
            amount:
              Number(form.amount || 0),
          }),
        }
      );

    const data =
      await r.json()
        .catch(() => ({}));

    if (!r.ok) {
      setMessage(
        data.error ||
        "Création impossible."
      );
      return;
    }

    setForm(prev => ({
      ...prev,
      title:"",
      description:"",
      amount:"",
      due_date:"",
    }));

    setMessage("✅ Rappel créé.");
    await load();
  }


  async function markPaid(id:number) {
    const r =
      await authFetch(
        `/reminders/${id}/pay`,
        { method:"POST" }
      );

    if (!r.ok) {
      const d =
        await r.json()
          .catch(() => ({}));

      setMessage(
        d.error ||
        "Erreur paiement."
      );

      return;
    }

    setMessage(
      "✅ Rappel marqué payé."
    );

    await load();
  }


  async function removeReminder(
    id:number
  ) {
    if (
      !window.confirm(
        "Supprimer ce rappel ?"
      )
    ) {
      return;
    }

    const r =
      await authFetch(
        `/reminders/${id}`,
        { method:"DELETE" }
      );

    if (!r.ok) {
      setMessage(
        "Suppression impossible."
      );
      return;
    }

    setMessage("✅ Rappel supprimé.");
    await load();
  }


  async function saveSettings() {
    const r =
      await authFetch(
        "/reminders/settings/current",
        {
          method:"PUT",
          headers:{
            "Content-Type":
              "application/json",
          },
          body:JSON.stringify({
            ...settings,
            large_withdrawal_threshold:
              Number(
                settings.large_withdrawal_threshold ||
                0
              ),
            supplier_unpaid_after_days:
              Number(
                settings.supplier_unpaid_after_days ||
                7
              ),
          }),
        }
      );

    if (!r.ok) {
      setMessage(
        "Erreur sauvegarde paramètres."
      );
      return;
    }

    setMessage(
      "✅ Paramètres enregistrés."
    );

    await load();
  }


  async function runNow() {
    setMessage(
      "Traitement des rappels..."
    );

    const r =
      await authFetch(
        "/reminders/run-now",
        { method:"POST" }
      );

    const d =
      await r.json()
        .catch(() => ({}));

    if (!r.ok) {
      setMessage(
        d.error ||
        "Traitement impossible."
      );
      return;
    }

    setMessage(
      "✅ Rappels contrôlés. Les notifications nécessaires ont été générées."
    );

    await load();
  }


  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-blue-700"
            >
              ← Tableau de bord
            </Link>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              ⏰ Rappels & échéances
            </h1>

            <p className="mt-1 text-slate-600">
              Loyers, impôts, carte Visa,
              nourriture, fournisseurs et
              autres charges.
            </p>
          </div>

          <button
            onClick={runNow}
            className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
          >
            Vérifier maintenant
          </button>
        </div>


        {message && (
          <div className="rounded-xl border bg-white p-4 font-medium">
            {message}
          </div>
        )}


        <section className="grid gap-4 md:grid-cols-4">
          <Card
            title="Rappels actifs"
            value={activeRows.length}
          />

          <Card
            title="En retard"
            value={overdue}
          />

          <Card
            title="Fournisseurs impayés"
            value={debts.length}
          />

          <Card
            title="Dette fournisseurs"
            value={`${formatMoney(debtTotal)} FCFA`}
          />
        </section>


        <section className="grid gap-6 lg:grid-cols-[420px_1fr]">

          <form
            onSubmit={createReminder}
            className="space-y-4 rounded-2xl bg-white p-5 shadow-sm"
          >
            <h2 className="text-xl font-bold">
              Nouveau rappel
            </h2>

            <Field label="Titre">
              <input
                required
                value={form.title}
                onChange={e =>
                  setForm({
                    ...form,
                    title:e.target.value,
                  })
                }
                placeholder="Ex : Loyer bureau Sotuba"
                className="w-full rounded-xl border p-3"
              />
            </Field>

            <Field label="Catégorie">
              <select
                value={form.category}
                onChange={e =>
                  setForm({
                    ...form,
                    category:e.target.value,
                  })
                }
                className="w-full rounded-xl border p-3"
              >
                {categories.map(
                  ([value,label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Montant FCFA">
              <input
                type="number"
                min="0"
                value={form.amount}
                onChange={e =>
                  setForm({
                    ...form,
                    amount:e.target.value,
                  })
                }
                className="w-full rounded-xl border p-3"
                placeholder="0"
              />
            </Field>

            <Field label="Date d'échéance">
              <input
                required
                type="date"
                value={form.due_date}
                onChange={e =>
                  setForm({
                    ...form,
                    due_date:e.target.value,
                  })
                }
                className="w-full rounded-xl border p-3"
              />
            </Field>

            <Field label="Récurrence">
              <select
                value={form.recurrence}
                onChange={e =>
                  setForm({
                    ...form,
                    recurrence:e.target.value,
                  })
                }
                className="w-full rounded-xl border p-3"
              >
                <option value="none">
                  Une seule fois
                </option>

                <option value="weekly">
                  Chaque semaine
                </option>

                <option value="monthly">
                  Chaque mois
                </option>

                <option value="quarterly">
                  Tous les 3 mois
                </option>

                <option value="yearly">
                  Chaque année
                </option>
              </select>
            </Field>

            <Field label="Notifications avant échéance">
              <div className="flex flex-wrap gap-2">
                {[5,4,3,1,0].map(
                  day => (
                    <button
                      type="button"
                      key={day}
                      onClick={() =>
                        toggleDay(day)
                      }
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                        form.remind_days.includes(day)
                          ? "bg-blue-600 text-white"
                          : "bg-white"
                      }`}
                    >
                      {day === 0
                        ? "Jour J"
                        : `J-${day}`}
                    </button>
                  )
                )}
              </div>
            </Field>

            <Field label="Email de rappel">
              <input
                type="email"
                value={form.email_to}
                onChange={e =>
                  setForm({
                    ...form,
                    email_to:e.target.value,
                  })
                }
                className="w-full rounded-xl border p-3"
              />
            </Field>

            <Field label="Description">
              <textarea
                value={form.description}
                onChange={e =>
                  setForm({
                    ...form,
                    description:e.target.value,
                  })
                }
                rows={3}
                className="w-full rounded-xl border p-3"
                placeholder="Description, référence, bénéficiaire..."
              />
            </Field>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"
            >
              Créer le rappel
            </button>
          </form>


          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-xl font-bold">
                Échéances
              </h2>

              {loading ? (
                <p>Chargement...</p>
              ) : rows.length === 0 ? (
                <p className="text-slate-500">
                  Aucun rappel pour le moment.
                </p>
              ) : (
                <div className="space-y-3">
                  {rows.map(r => (
                    <article
                      key={r.id}
                      className="rounded-xl border p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:justify-between">

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900">
                              {r.title}
                            </h3>

                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">
                              {r.category}
                            </span>

                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              r.status === "active"
                                ? "bg-green-100 text-green-800"
                                : "bg-slate-100"
                            }`}>
                              {r.status}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-600">
                            Échéance :{" "}
                            {String(r.due_date).slice(0,10)}
                            {" · "}
                            {r.recurrence}
                          </p>

                          {Number(r.amount || 0) > 0 && (
                            <p className="mt-1 font-bold">
                              {formatMoney(r.amount)} FCFA
                            </p>
                          )}

                          {r.description && (
                            <p className="mt-2 text-sm">
                              {r.description}
                            </p>
                          )}

                          <p className="mt-2 text-xs text-slate-500">
                            Alertes :{" "}
                            {(r.remind_days || [])
                              .map(d =>
                                d === 0
                                  ? "Jour J"
                                  : `J-${d}`
                              )
                              .join(", ")}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          {r.status === "active" && (
                            <button
                              onClick={() =>
                                markPaid(r.id)
                              }
                              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white"
                            >
                              Payé
                            </button>
                          )}

                          <button
                            onClick={() =>
                              removeReminder(r.id)
                            }
                            className="rounded-lg border px-3 py-2 text-sm font-semibold text-red-600"
                          >
                            Supprimer
                          </button>
                        </div>

                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>


        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">
            Fournisseurs non payés
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            Triangle surveille automatiquement les achats avec un montant restant.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">
                    Achat
                  </th>
                  <th className="p-3">
                    Fournisseur
                  </th>
                  <th className="p-3">
                    Total
                  </th>
                  <th className="p-3">
                    Payé
                  </th>
                  <th className="p-3">
                    Reste
                  </th>
                </tr>
              </thead>

              <tbody>
                {debts.map(row => (
                  <tr
                    key={row.id}
                    className="border-b"
                  >
                    <td className="p-3">
                      {row.purchase_number || `#${row.id}`}
                    </td>

                    <td className="p-3">
                      {row.supplier_name || "—"}
                    </td>

                    <td className="p-3">
                      {formatMoney(row.total_amount)}
                    </td>

                    <td className="p-3">
                      {formatMoney(row.amount_paid)}
                    </td>

                    <td className="p-3 font-bold text-red-700">
                      {formatMoney(row.amount_due)}
                    </td>
                  </tr>
                ))}

                {!debts.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-6 text-center text-slate-500"
                    >
                      Aucun fournisseur impayé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>


        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">
            Paramètres automatiques
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">

            <Field label="Gros retrait à partir de">
              <input
                type="number"
                value={
                  settings.large_withdrawal_threshold
                }
                onChange={e =>
                  setSettings({
                    ...settings,
                    large_withdrawal_threshold:
                      e.target.value,
                  })
                }
                className="w-full rounded-xl border p-3"
              />
            </Field>

            <Field label="Fournisseur impayé après">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={
                    settings.supplier_unpaid_after_days
                  }
                  onChange={e =>
                    setSettings({
                      ...settings,
                      supplier_unpaid_after_days:
                        Number(e.target.value),
                    })
                  }
                  className="w-full rounded-xl border p-3"
                />
                <span>jours</span>
              </div>
            </Field>

            <Field label="Email par défaut">
              <input
                type="email"
                value={
                  settings.default_email || ""
                }
                onChange={e =>
                  setSettings({
                    ...settings,
                    default_email:e.target.value,
                  })
                }
                className="w-full rounded-xl border p-3"
              />
            </Field>

          </div>

          <div className="mt-4 flex flex-wrap gap-5">

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  settings.supplier_alerts_enabled
                }
                onChange={e =>
                  setSettings({
                    ...settings,
                    supplier_alerts_enabled:
                      e.target.checked,
                  })
                }
              />
              Rappeler fournisseurs non payés
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  settings.withdrawal_alerts_enabled
                }
                onChange={e =>
                  setSettings({
                    ...settings,
                    withdrawal_alerts_enabled:
                      e.target.checked,
                  })
                }
              />
              Alerter après gros retrait bancaire
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={
                  settings.email_enabled
                }
                onChange={e =>
                  setSettings({
                    ...settings,
                    email_enabled:
                      e.target.checked,
                  })
                }
              />
              Envoyer les emails
            </label>

          </div>

          <button
            onClick={saveSettings}
            className="mt-5 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white"
          >
            Enregistrer les paramètres
          </button>
        </section>

      </div>
    </main>
  );
}


function Card({
  title,
  value,
}:{
  title:string;
  value:string|number;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}


function Field({
  label,
  children,
}:{
  label:string;
  children:React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}
