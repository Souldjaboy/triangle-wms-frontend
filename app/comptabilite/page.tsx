"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { authFetch } from "../lib/api";
import { formatFCFA } from "../lib/format";

const emptyBank = {
  bank_name: "",
  account_number: "",
  iban: "",
  swift: "",
  currency: "FCFA",
  initial_balance: "",
};

const emptyTransaction = {
  transaction_type: "encaissement_bancaire",
  direction: "entrée",
  bank_id: "",
  amount: "",
  category: "",
  partner_name: "",
  description: "",
};

const emptyVoucher = {
  voucher_type: "encaissement",
  amount: "",
  origin: "",
  beneficiary: "",
  bank_id: "",
  partner_name: "",
  reason: "",
  expense_category: "",
};

const emptyExpense = {
  requested_amount: "",
  reason: "",
  description: "",
  urgency: "normale",
};

export default function ComptabilitePage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState<any>(null);
  const [banks, setBanks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [statements, setStatements] = useState<any>(null);
  const [bankForm, setBankForm] = useState(emptyBank);
  const [transactionForm, setTransactionForm] = useState(emptyTransaction);
  const [voucherForm, setVoucherForm] = useState(emptyVoucher);
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const user = useMemo(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  }, []);

  const role = String(user?.role || "").toLowerCase();
  const isSuperAdmin = user?.is_super_admin === true || role === "super_admin";
  const canManage = isSuperAdmin || role === "admin" || role === "comptable";
  const canApprove =
    isSuperAdmin ||
    role === "admin" ||
    role === "direction" ||
    role === "directeur";

  const loadAll = async () => {
    setLoading(true);
    const [dashboardRes, banksRes, transactionsRes, vouchersRes, expensesRes, statementsRes] =
      await Promise.all([
        authFetch("/accounting/dashboard"),
        authFetch("/accounting/banks"),
        authFetch("/accounting/transactions"),
        authFetch("/accounting/vouchers"),
        authFetch("/accounting/expense-requests"),
        authFetch("/accounting/statements"),
      ]);

    setDashboard(await dashboardRes.json().catch(() => null));
    setBanks(await banksRes.json().catch(() => []));
    setTransactions(await transactionsRes.json().catch(() => []));
    setVouchers(await vouchersRes.json().catch(() => []));
    setExpenses(await expensesRes.json().catch(() => []));
    setStatements(await statementsRes.json().catch(() => null));
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const submitJson = async (path: string, body: any, success: string) => {
    setMessage("");
    const response = await authFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? success : data.error || "Erreur serveur.");
    if (response.ok) await loadAll();
    return response.ok;
  };

  const createBank = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await submitJson("/accounting/banks", bankForm, "Banque enregistrée.");
    if (ok) setBankForm(emptyBank);
  };

  const createTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await submitJson(
      "/accounting/transactions",
      transactionForm,
      "Mouvement comptable enregistré."
    );
    if (ok) setTransactionForm(emptyTransaction);
  };

  const createVoucher = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await submitJson("/accounting/vouchers", voucherForm, "Bon enregistré.");
    if (ok) setVoucherForm(emptyVoucher);
  };

  const createExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await submitJson(
      "/accounting/expense-requests",
      expenseForm,
      "Demande de décaissement envoyée."
    );
    if (ok) setExpenseForm(emptyExpense);
  };

  const patchJson = async (path: string, body: any, success: string) => {
    const response = await authFetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? success : data.error || "Erreur serveur.");
    if (response.ok) await loadAll();
  };

  const totalBanks = Number(dashboard?.bank_balance || 0);
  const treasury = Number(dashboard?.treasury_balance || 0);

  return (
    <main className="min-h-screen bg-gray-100 p-4 pb-24 text-black md:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold text-yellow-600">TRIANGLE WMS PRO</p>
          <h1 className="text-3xl font-black md:text-4xl">Comptabilité & Trésorerie</h1>
          <p className="text-gray-600">
            Banques, encaissements, décaissements, demandes, paie et états financiers.
          </p>
        </div>
        <button
          onClick={loadAll}
          className="rounded-lg bg-black px-5 py-3 font-bold text-white"
        >
          Actualiser
        </button>
      </div>

      {message && <div className="mb-5 rounded-lg bg-yellow-100 p-4 font-bold">{message}</div>}

      <div className="mb-6 flex gap-2 overflow-x-auto">
        {[
          ["dashboard", "Tableau"],
          ["banks", "Banques"],
          ["transactions", "Mouvements"],
          ["vouchers", "Bons"],
          ["expenses", "Demandes"],
          ["statements", "États"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`rounded-lg px-4 py-3 font-bold ${
              activeTab === key ? "bg-yellow-500 text-black" : "bg-white text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-lg bg-white p-8 font-bold shadow">Chargement comptabilité...</div>
      ) : (
        <>
          {activeTab === "dashboard" && (
            <section className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Metric title="Solde banques" value={formatFCFA(totalBanks)} />
                <Metric title="Trésorerie" value={formatFCFA(treasury)} />
                <Metric title="Encaissements du jour" value={formatFCFA(dashboard?.cash_in_today)} />
                <Metric title="Décaissements du jour" value={formatFCFA(dashboard?.cash_out_today)} />
                <Metric title="Dépenses du mois" value={formatFCFA(dashboard?.expenses_month)} />
                <Metric title="Salaires à payer" value={formatFCFA(dashboard?.payroll_pending)} />
                <Metric title="Demandes en attente" value={dashboard?.expense_requests_pending || 0} />
                <Metric title="Demandes validées" value={dashboard?.expense_requests_approved || 0} />
              </div>
              <RecentTable title="Derniers mouvements" rows={transactions.slice(0, 8)} />
            </section>
          )}

          {activeTab === "banks" && (
            <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
              {canManage && (
                <Panel title="Nouvelle banque">
                  <form onSubmit={createBank} className="grid gap-3">
                    <Input placeholder="Nom banque" value={bankForm.bank_name} onChange={(v) => setBankForm({ ...bankForm, bank_name: v })} />
                    <Input placeholder="Numéro compte" value={bankForm.account_number} onChange={(v) => setBankForm({ ...bankForm, account_number: v })} />
                    <Input placeholder="IBAN" value={bankForm.iban} onChange={(v) => setBankForm({ ...bankForm, iban: v })} />
                    <Input placeholder="SWIFT" value={bankForm.swift} onChange={(v) => setBankForm({ ...bankForm, swift: v })} />
                    <Input placeholder="Devise" value={bankForm.currency} onChange={(v) => setBankForm({ ...bankForm, currency: v })} />
                    <Input type="number" placeholder="Solde initial" value={bankForm.initial_balance} onChange={(v) => setBankForm({ ...bankForm, initial_balance: v })} />
                    <Submit>Créer banque</Submit>
                  </form>
                </Panel>
              )}
              <Panel title="Comptes bancaires">
                <DataTable
                  headers={["Banque", "Compte", "Devise", "Solde", "Statut"]}
                  rows={banks.map((bank) => [
                    bank.bank_name,
                    bank.account_number || "-",
                    bank.currency || "FCFA",
                    formatFCFA(bank.current_balance),
                    bank.is_active === false ? "Inactive" : "Active",
                  ])}
                />
              </Panel>
            </section>
          )}

          {activeTab === "transactions" && (
            <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
              {canManage && (
                <Panel title="Nouveau mouvement">
                  <form onSubmit={createTransaction} className="grid gap-3">
                    <select className="rounded-lg border p-3" value={transactionForm.transaction_type} onChange={(e) => setTransactionForm({ ...transactionForm, transaction_type: e.target.value })}>
                      <option value="encaissement_bancaire">Encaissement bancaire</option>
                      <option value="retrait_banque">Retrait banque vers trésorerie</option>
                      <option value="encaissement_especes">Encaissement espèces</option>
                      <option value="depense">Dépense</option>
                      <option value="paiement_fournisseur">Paiement fournisseur</option>
                      <option value="salaire">Salaire</option>
                    </select>
                    <select className="rounded-lg border p-3" value={transactionForm.direction} onChange={(e) => setTransactionForm({ ...transactionForm, direction: e.target.value })}>
                      <option value="entrée">Entrée</option>
                      <option value="sortie">Sortie</option>
                    </select>
                    <BankSelect banks={banks} value={transactionForm.bank_id} onChange={(v) => setTransactionForm({ ...transactionForm, bank_id: v })} />
                    <Input type="number" placeholder="Montant" value={transactionForm.amount} onChange={(v) => setTransactionForm({ ...transactionForm, amount: v })} />
                    <Input placeholder="Catégorie" value={transactionForm.category} onChange={(v) => setTransactionForm({ ...transactionForm, category: v })} />
                    <Input placeholder="Client / fournisseur / bénéficiaire" value={transactionForm.partner_name} onChange={(v) => setTransactionForm({ ...transactionForm, partner_name: v })} />
                    <textarea className="rounded-lg border p-3" placeholder="Description" value={transactionForm.description} onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })} />
                    <Submit>Enregistrer mouvement</Submit>
                  </form>
                </Panel>
              )}
              <Panel title="Historique des mouvements">
                <DataTable
                  headers={["Numéro", "Type", "Sens", "Montant", "Banque", "Date"]}
                  rows={transactions.map((item) => [
                    item.transaction_number,
                    item.transaction_type,
                    item.direction,
                    formatFCFA(item.amount),
                    item.bank_name || "-",
                    new Date(item.created_at).toLocaleDateString("fr-FR"),
                  ])}
                />
              </Panel>
            </section>
          )}

          {activeTab === "vouchers" && (
            <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
              {canManage && (
                <Panel title="Créer un bon">
                  <form onSubmit={createVoucher} className="grid gap-3">
                    <select className="rounded-lg border p-3" value={voucherForm.voucher_type} onChange={(e) => setVoucherForm({ ...voucherForm, voucher_type: e.target.value })}>
                      <option value="encaissement">Bon d’encaissement</option>
                      <option value="decaissement">Bon de décaissement</option>
                    </select>
                    <Input type="number" placeholder="Montant" value={voucherForm.amount} onChange={(v) => setVoucherForm({ ...voucherForm, amount: v })} />
                    <BankSelect banks={banks} value={voucherForm.bank_id} onChange={(v) => setVoucherForm({ ...voucherForm, bank_id: v })} />
                    <Input placeholder="Origine" value={voucherForm.origin} onChange={(v) => setVoucherForm({ ...voucherForm, origin: v })} />
                    <Input placeholder="Bénéficiaire" value={voucherForm.beneficiary} onChange={(v) => setVoucherForm({ ...voucherForm, beneficiary: v })} />
                    <Input placeholder="Partenaire" value={voucherForm.partner_name} onChange={(v) => setVoucherForm({ ...voucherForm, partner_name: v })} />
                    <Input placeholder="Catégorie dépense" value={voucherForm.expense_category} onChange={(v) => setVoucherForm({ ...voucherForm, expense_category: v })} />
                    <textarea className="rounded-lg border p-3" placeholder="Motif" value={voucherForm.reason} onChange={(e) => setVoucherForm({ ...voucherForm, reason: e.target.value })} />
                    <Submit>Créer bon</Submit>
                  </form>
                </Panel>
              )}
              <Panel title="Bons enregistrés">
                <DataTable
                  headers={["Numéro", "Type", "Montant", "Statut", "Action"]}
                  rows={vouchers.map((voucher) => [
                    voucher.voucher_number,
                    voucher.voucher_type,
                    formatFCFA(voucher.amount),
                    voucher.status,
                    canApprove && voucher.status === "brouillon" ? (
                      <button className="rounded bg-yellow-500 px-3 py-2 font-bold" onClick={() => patchJson(`/accounting/vouchers/${voucher.id}/validate`, {}, "Bon validé.")}>
                        Valider
                      </button>
                    ) : "-",
                  ])}
                />
              </Panel>
            </section>
          )}

          {activeTab === "expenses" && (
            <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
              <Panel title="Nouvelle demande de décaissement">
                <form onSubmit={createExpense} className="grid gap-3">
                  <Input type="number" placeholder="Montant demandé" value={expenseForm.requested_amount} onChange={(v) => setExpenseForm({ ...expenseForm, requested_amount: v })} />
                  <Input placeholder="Motif" value={expenseForm.reason} onChange={(v) => setExpenseForm({ ...expenseForm, reason: v })} />
                  <select className="rounded-lg border p-3" value={expenseForm.urgency} onChange={(e) => setExpenseForm({ ...expenseForm, urgency: e.target.value })}>
                    <option value="normale">Urgence normale</option>
                    <option value="haute">Haute urgence</option>
                    <option value="critique">Critique</option>
                  </select>
                  <textarea className="rounded-lg border p-3" placeholder="Description" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                  <Submit>Soumettre demande</Submit>
                </form>
              </Panel>
              <Panel title="Demandes">
                <DataTable
                  headers={["Numéro", "Montant", "Motif", "Statut", "Actions"]}
                  rows={expenses.map((expense) => [
                    expense.request_number,
                    formatFCFA(expense.requested_amount),
                    expense.reason,
                    expense.status,
                    <ExpenseActions
                      key={expense.id}
                      expense={expense}
                      canApprove={canApprove}
                      canManage={canManage}
                      onUpdate={patchJson}
                    />,
                  ])}
                />
              </Panel>
            </section>
          )}

          {activeTab === "statements" && (
            <section className="grid gap-6 lg:grid-cols-2">
              <Panel title="Bilan simplifié">
                <DataTable
                  headers={["Poste", "Montant"]}
                  rows={[
                    ["Banques", formatFCFA(statements?.bilan?.banques)],
                    ["Trésorerie", formatFCFA(statements?.bilan?.tresorerie)],
                    ["Actif total", formatFCFA(statements?.bilan?.actif)],
                  ]}
                />
              </Panel>
              <Panel title="Compte de résultat">
                <DataTable
                  headers={["Poste", "Montant"]}
                  rows={[
                    ["Produits", formatFCFA(statements?.compte_resultat?.produits)],
                    ["Charges", formatFCFA(statements?.compte_resultat?.charges)],
                    [
                      "Résultat",
                      formatFCFA(
                        Number(statements?.compte_resultat?.produits || 0) -
                          Number(statements?.compte_resultat?.charges || 0)
                      ),
                    ],
                  ]}
                />
              </Panel>
              <Panel title="Tableau de trésorerie">
                <DataTable
                  headers={["Flux", "Montant"]}
                  rows={[
                    [
                      "Entrées",
                      formatFCFA(
                        (statements?.tableau_tresorerie || []).find((row: any) => row.direction === "entrée")?.total
                      ),
                    ],
                    [
                      "Sorties",
                      formatFCFA(
                        (statements?.tableau_tresorerie || []).find((row: any) => row.direction === "sortie")?.total
                      ),
                    ],
                    [
                      "Solde net",
                      formatFCFA(
                        Number((statements?.tableau_tresorerie || []).find((row: any) => row.direction === "entrée")?.total || 0) -
                          Number((statements?.tableau_tresorerie || []).find((row: any) => row.direction === "sortie")?.total || 0)
                      ),
                    ],
                  ]}
                />
              </Panel>
              <Panel title="Grand livre récent">
                <DataTable
                  headers={["Date", "Libellé", "Débit", "Crédit"]}
                  rows={(statements?.grand_livre || []).slice(0, 12).map((entry: any) => [
                    new Date(entry.created_at).toLocaleDateString("fr-FR"),
                    entry.label,
                    formatFCFA(entry.debit),
                    formatFCFA(entry.credit),
                  ])}
                />
              </Panel>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function Metric({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <p className="text-sm font-bold text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow">
      <h2 className="mb-4 text-xl font-black">{title}</h2>
      {children}
    </section>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-lg border p-3"
    />
  );
}

function Submit({ children }: { children: ReactNode }) {
  return <button className="rounded-lg bg-yellow-500 p-3 font-black text-black">{children}</button>;
}

function BankSelect({
  banks,
  value,
  onChange,
}: {
  banks: any[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select className="rounded-lg border p-3" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Sans banque</option>
      {banks.map((bank: any) => (
        <option key={bank.id} value={bank.id}>
          {bank.bank_name} - {formatFCFA(bank.current_balance)}
        </option>
      ))}
    </select>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead className="bg-gray-100 text-gray-600">
          <tr>{headers.map((header) => <th key={header} className="p-3">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="p-4 text-gray-500" colSpan={headers.length}>Aucune donnée.</td></tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="border-t">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="p-3">{cell}</td>)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function RecentTable({ title, rows }: { title: string; rows: any[] }) {
  return (
    <Panel title={title}>
      <DataTable
        headers={["Numéro", "Type", "Sens", "Montant", "Date"]}
        rows={rows.map((row) => [
          row.transaction_number,
          row.transaction_type,
          row.direction,
          formatFCFA(row.amount),
          new Date(row.created_at).toLocaleDateString("fr-FR"),
        ])}
      />
    </Panel>
  );
}

function ExpenseActions({ expense, canApprove, canManage, onUpdate }: any) {
  if (expense.status === "soumis" && canApprove) {
    return (
      <div className="flex gap-2">
        <button className="rounded bg-green-600 px-3 py-2 font-bold text-white" onClick={() => onUpdate(`/accounting/expense-requests/${expense.id}/status`, { status: "validé" }, "Demande validée.")}>
          Valider
        </button>
        <button className="rounded bg-red-600 px-3 py-2 font-bold text-white" onClick={() => onUpdate(`/accounting/expense-requests/${expense.id}/status`, { status: "refusé" }, "Demande refusée.")}>
          Refuser
        </button>
      </div>
    );
  }

  if (expense.status === "validé" && canManage) {
    return (
      <button className="rounded bg-yellow-500 px-3 py-2 font-bold" onClick={() => onUpdate(`/accounting/expense-requests/${expense.id}/status`, { status: "payé" }, "Demande payée.")}>
        Marquer payé
      </button>
    );
  }

  if (expense.status === "payé" && canManage) {
    return (
      <button
        className="rounded bg-black px-3 py-2 font-bold text-white"
        onClick={() => {
          const proof = window.prompt("URL du justificatif obligatoire pour clôturer :");
          if (proof) onUpdate(`/accounting/expense-requests/${expense.id}/status`, { status: "clôturé", proof_url: proof }, "Demande clôturée.");
        }}
      >
        Clôturer
      </button>
    );
  }

  return <span>-</span>;
}
