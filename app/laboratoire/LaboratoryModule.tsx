"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";
import { formatFCFA } from "../lib/format";

const tabs = [
  { href: "/laboratoire", label: "Tableau laboratoire", mode: "dashboard" },
  { href: "/laboratoire/parametres", label: "Paramètres", mode: "settings" },
  { href: "/laboratoire/analyses", label: "Analyses", mode: "analyses" },
  { href: "/laboratoire/patients", label: "Patients", mode: "patients" },
  { href: "/laboratoire/rendez-vous", label: "Rendez-vous", mode: "appointments" },
  { href: "/laboratoire/resultats", label: "Résultats", mode: "results" },
  { href: "/laboratoire/paiements", label: "Paiements", mode: "payments" },
  { href: "/laboratoire/documents", label: "Documents", mode: "documents" },
];

export default function LaboratoryModule({ mode = "dashboard" }: { mode?: string }) {
  const [settings, setSettings] = useState<any>({});
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [patientForm, setPatientForm] = useState({ full_name: "", phone: "", email: "", gender: "", age: "", address: "" });
  const [analysisForm, setAnalysisForm] = useState({ name: "", description: "", price: "", result_delay: "" });
  const [caseForm, setCaseForm] = useState({ patient_id: "", analysis_ids: [] as string[] });

  const loadAll = async () => {
    const [settingsRes, analysesRes, patientsRes, appointmentsRes, casesRes, paymentsRes, documentsRes] = await Promise.all([
      authFetch("/laboratory/settings"),
      authFetch("/laboratory/analyses"),
      authFetch("/laboratory/patients"),
      authFetch("/laboratory/appointments"),
      authFetch("/laboratory/cases"),
      authFetch("/laboratory/payments"),
      authFetch("/laboratory/documents"),
    ]);
    setSettings(await settingsRes.json().catch(() => ({})));
    setAnalyses(await analysesRes.json().catch(() => []));
    setPatients(await patientsRes.json().catch(() => []));
    setAppointments(await appointmentsRes.json().catch(() => []));
    setCases(await casesRes.json().catch(() => []));
    setPayments(await paymentsRes.json().catch(() => []));
    setDocuments(await documentsRes.json().catch(() => []));
  };

  useEffect(() => {
    loadAll().catch(() => setMessage("Erreur chargement laboratoire."));
  }, []);

  const availableAnalyses = useMemo(() => analyses.filter((item) => item.company_id), [analyses]);

  const saveSettings = async () => {
    const response = await authFetch("/laboratory/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setMessage(response.ok ? "Paramètres laboratoire enregistrés." : "Erreur sauvegarde paramètres.");
    await loadAll();
  };

  const saveAnalysis = async () => {
    const response = await authFetch("/laboratory/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...analysisForm, price: Number(analysisForm.price || 0) }),
    });
    setMessage(response.ok ? "Analyse ajoutée." : "Erreur ajout analyse.");
    setAnalysisForm({ name: "", description: "", price: "", result_delay: "" });
    await loadAll();
  };

  const updateAnalysis = async (analysis: any, patch: any) => {
    await authFetch(`/laboratory/analyses/${analysis.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...analysis, ...patch }),
    });
    await loadAll();
  };

  const savePatient = async () => {
    const response = await authFetch("/laboratory/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patientForm, age: patientForm.age ? Number(patientForm.age) : null }),
    });
    setMessage(response.ok ? "Patient créé." : "Erreur création patient.");
    setPatientForm({ full_name: "", phone: "", email: "", gender: "", age: "", address: "" });
    await loadAll();
  };

  const createCase = async () => {
    const response = await authFetch("/laboratory/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient_id: Number(caseForm.patient_id), analysis_ids: caseForm.analysis_ids.map(Number) }),
    });
    setMessage(response.ok ? "Dossier analyse créé avec code résultat." : "Erreur création dossier.");
    setCaseForm({ patient_id: "", analysis_ids: [] });
    await loadAll();
  };

  const updateCaseResult = async (item: any, publish = false) => {
    await authFetch(`/laboratory/cases/${item.id}/result`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: publish ? "publié" : "résultat_prêt",
        result_summary: item.result_summary || "Résultat prêt.",
        result_file_url: item.result_file_url || "",
        result_published: publish,
      }),
    });
    await loadAll();
  };

  const confirmPayment = async (item: any) => {
    await authFetch(`/laboratory/cases/${item.id}/payments/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "Espèces", amount: item.total_amount }),
    });
    await loadAll();
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-black">Laboratoire</h1>
          <p className="text-gray-500">Analyses, patients, rendez-vous, résultats et paiements.</p>
        </div>
        <Link href="/client/laboratoires" className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black">Vue client</Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={`rounded-xl px-4 py-3 font-bold ${mode === tab.mode ? "bg-black text-white" : "bg-white text-black"}`}>
            {tab.label}
          </Link>
        ))}
      </div>

      {message && <div className="mb-5 rounded-xl bg-yellow-50 p-4 font-bold text-yellow-800">{message}</div>}

      {mode === "dashboard" && (
        <div className="grid gap-4 md:grid-cols-4">
          <Stat title="Analyses proposées" value={availableAnalyses.length} />
          <Stat title="Patients" value={patients.length} />
          <Stat title="Rendez-vous" value={appointments.length} />
          <Stat title="Résultats prêts" value={cases.filter((item) => String(item.status).includes("résultat") || item.result_published).length} />
        </div>
      )}

      {mode === "settings" && (
        <section className="grid gap-4 rounded-2xl bg-white p-6 shadow">
          {["lab_name", "phone", "whatsapp", "email", "city", "address", "opening_hours", "logo_url", "public_image_url"].map((field) => (
            <input key={field} className="rounded-xl border p-3" placeholder={field} value={settings[field] || ""} onChange={(e) => setSettings({ ...settings, [field]: e.target.value })} />
          ))}
          <textarea className="rounded-xl border p-3" placeholder="Description publique" value={settings.public_description || settings.description || ""} onChange={(e) => setSettings({ ...settings, public_description: e.target.value, description: e.target.value })} />
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={Boolean(settings.home_sampling_enabled)} onChange={(e) => setSettings({ ...settings, home_sampling_enabled: e.target.checked })} /> Prélèvement à domicile</label>
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={Boolean(settings.appointments_enabled)} onChange={(e) => setSettings({ ...settings, appointments_enabled: e.target.checked })} /> Rendez-vous activés</label>
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={Boolean(settings.online_payment_enabled)} onChange={(e) => setSettings({ ...settings, online_payment_enabled: e.target.checked })} /> Paiement en ligne</label>
          <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={Boolean(settings.is_published)} onChange={(e) => setSettings({ ...settings, is_published: e.target.checked })} /> Publier dans Marketplace Santé / Laboratoire</label>
          <button onClick={saveSettings} className="rounded-xl bg-yellow-500 p-4 font-black text-black">Enregistrer</button>
        </section>
      )}

      {mode === "analyses" && (
        <section className="space-y-4">
          <div className="grid gap-3 rounded-2xl bg-white p-5 shadow md:grid-cols-4">
            <input className="rounded-xl border p-3" placeholder="Nom analyse" value={analysisForm.name} onChange={(e) => setAnalysisForm({ ...analysisForm, name: e.target.value })} />
            <input className="rounded-xl border p-3" placeholder="Prix" value={analysisForm.price} onChange={(e) => setAnalysisForm({ ...analysisForm, price: e.target.value })} />
            <input className="rounded-xl border p-3" placeholder="Délai résultat" value={analysisForm.result_delay} onChange={(e) => setAnalysisForm({ ...analysisForm, result_delay: e.target.value })} />
            <button onClick={saveAnalysis} className="rounded-xl bg-yellow-500 font-black text-black">Ajouter</button>
          </div>
          <Table rows={analyses} columns={["name", "price", "result_delay", "is_available"]} action={(row) => (
            <button onClick={() => updateAnalysis(row, { is_available: !row.is_available })} className="rounded-lg bg-black px-3 py-2 text-white">Activer/Désactiver</button>
          )} />
        </section>
      )}

      {mode === "patients" && (
        <section className="space-y-4">
          <div className="grid gap-3 rounded-2xl bg-white p-5 shadow md:grid-cols-3">
            {Object.keys(patientForm).map((field) => (
              <input key={field} className="rounded-xl border p-3" placeholder={field} value={(patientForm as any)[field]} onChange={(e) => setPatientForm({ ...patientForm, [field]: e.target.value })} />
            ))}
            <button onClick={savePatient} className="rounded-xl bg-yellow-500 font-black text-black">Créer patient</button>
          </div>
          <Table rows={patients} columns={["full_name", "phone", "email", "age", "address"]} />
        </section>
      )}

      {mode === "appointments" && <Table rows={appointments} columns={["patient_name", "patient_phone", "analysis_name", "requested_date", "requested_time", "status"]} />}

      {mode === "results" && (
        <section className="space-y-4">
          <div className="grid gap-3 rounded-2xl bg-white p-5 shadow md:grid-cols-3">
            <select className="rounded-xl border p-3" value={caseForm.patient_id} onChange={(e) => setCaseForm({ ...caseForm, patient_id: e.target.value })}>
              <option value="">Patient</option>
              {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name}</option>)}
            </select>
            <select multiple className="rounded-xl border p-3" value={caseForm.analysis_ids} onChange={(e) => setCaseForm({ ...caseForm, analysis_ids: Array.from(e.target.selectedOptions).map((option) => option.value) })}>
              {analyses.map((analysis) => <option key={analysis.id} value={analysis.id}>{analysis.name} - {formatFCFA(analysis.price)}</option>)}
            </select>
            <button onClick={createCase} className="rounded-xl bg-yellow-500 font-black text-black">Créer dossier</button>
          </div>
          <Table rows={cases} columns={["case_number", "result_code", "patient_name", "total_amount", "payment_status", "status"]} action={(row) => (
            <div className="flex gap-2">
              <button onClick={() => updateCaseResult(row, false)} className="rounded-lg bg-black px-3 py-2 text-white">Résultat prêt</button>
              <button onClick={() => updateCaseResult(row, true)} className="rounded-lg bg-green-700 px-3 py-2 text-white">Publier</button>
              <button onClick={() => confirmPayment(row)} className="rounded-lg bg-yellow-500 px-3 py-2 font-bold text-black">Paiement</button>
            </div>
          )} />
        </section>
      )}

      {mode === "payments" && <Table rows={payments} columns={["case_number", "patient_name", "amount", "method", "status", "paid_at"]} />}
      {mode === "documents" && <Table rows={documents} columns={["document_type", "document_number", "client_name", "total_amount", "status", "created_at"]} />}
    </main>
  );
}

function Stat({ title, value }: { title: string; value: any }) {
  return <div className="rounded-2xl bg-white p-6 shadow"><p className="text-gray-500">{title}</p><p className="mt-2 text-3xl font-black">{value}</p></div>;
}

function Table({ rows, columns, action }: { rows: any[]; columns: string[]; action?: (row: any) => React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead><tr>{columns.map((col) => <th key={col} className="border-b p-3">{col}</th>)}{action && <th className="border-b p-3">Actions</th>}</tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>{columns.map((col) => <td key={col} className="border-b p-3">{col.includes("amount") || col === "price" ? formatFCFA(row[col]) : String(row[col] ?? "-")}</td>)}{action && <td className="border-b p-3">{action(row)}</td>}</tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="p-6 text-center font-bold text-gray-500">Aucune donnée.</div>}
    </div>
  );
}
