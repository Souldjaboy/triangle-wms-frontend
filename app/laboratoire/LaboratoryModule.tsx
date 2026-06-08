"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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
  const emptyAnalysisForm = {
    name: "",
    description: "",
    price: "",
    result_delay: "",
    estimated_duration: "",
    is_available: true,
    home_sampling_available: false,
    on_site_available: true,
    teleconsultation_available: false,
  };
  const [analysisForm, setAnalysisForm] = useState(emptyAnalysisForm);
  const [editingAnalysisId, setEditingAnalysisId] = useState<number | null>(null);
  const [caseForm, setCaseForm] = useState({ patient_id: "", analysis_ids: [] as string[] });
  const [resultDrafts, setResultDrafts] = useState<Record<number, { summary: string; email: string }>>({});
  const [appointmentBusyId, setAppointmentBusyId] = useState<number | null>(null);

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
    const response = await authFetch(editingAnalysisId ? `/laboratory/analyses/${editingAnalysisId}` : "/laboratory/analyses", {
      method: editingAnalysisId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...analysisForm, price: Number(analysisForm.price || 0) }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? (editingAnalysisId ? "Analyse modifiée." : "Analyse ajoutée.") : data.error || "Erreur sauvegarde analyse.");
    setAnalysisForm(emptyAnalysisForm);
    setEditingAnalysisId(null);
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

  const editAnalysis = (analysis: any) => {
    setEditingAnalysisId(analysis.id);
    setAnalysisForm({
      name: analysis.name || "",
      description: analysis.description || "",
      price: String(analysis.price || ""),
      result_delay: analysis.result_delay || "",
      estimated_duration: analysis.estimated_duration || "",
      is_available: analysis.is_available !== false,
      home_sampling_available: Boolean(analysis.home_sampling_available),
      on_site_available: analysis.on_site_available !== false,
      teleconsultation_available: Boolean(analysis.teleconsultation_available),
    });
  };

  const deleteAnalysis = async (analysis: any) => {
    if (!confirm(`Supprimer ou désactiver l'analyse "${analysis.name}" ?`)) return;
    const response = await authFetch(`/laboratory/analyses/${analysis.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Analyse supprimée/désactivée." : data.error || "Erreur suppression analyse.");
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
    const draft = resultDrafts[item.id] || { summary: "", email: "" };
    await authFetch(`/laboratory/cases/${item.id}/result`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: publish ? "publié" : "résultat_prêt",
        result_summary: draft.summary || item.result_summary || "Résultat prêt.",
        result_file_url: item.result_file_url || "",
        result_published: publish,
      }),
    });
    await loadAll();
  };

  const uploadResultFile = async (item: any, file?: File) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("result", file);
    const response = await authFetch(`/laboratory/cases/${item.id}/upload-result`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Fichier résultat ajouté." : data.error || "Erreur upload résultat.");
    await loadAll();
  };

  const emailResult = async (item: any) => {
    const draft = resultDrafts[item.id] || { summary: "", email: "" };
    if (!draft.email) {
      setMessage("Email destinataire obligatoire.");
      return;
    }
    const response = await authFetch(`/laboratory/cases/${item.id}/email-result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_email: draft.email, message: draft.summary }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Résultat envoyé par email." : data.error || "Erreur envoi email résultat.");
  };

  const confirmPayment = async (item: any) => {
    await authFetch(`/laboratory/cases/${item.id}/payments/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "Espèces", amount: item.total_amount }),
    });
    await loadAll();
  };

  const updateAppointmentStatus = async (item: any, status: string) => {
    if (appointmentBusyId) return;
    setAppointmentBusyId(item.id);
    const proposed_time =
      status === "Reporté" || status === "Confirmé"
        ? prompt("Horaire proposé ou confirmé", item.proposed_time || item.requested_time || "") || ""
        : item.proposed_time || "";
    const laboratory_message =
      prompt("Message pour le client", item.lab_response || "") ||
      (status === "Refusé" ? "Rendez-vous refusé par le laboratoire." : "");
    const response = await authFetch(`/laboratory/appointments/${item.id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        proposed_date: item.requested_date || null,
        proposed_time,
        laboratory_message,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? `Rendez-vous ${status.toLowerCase()}.` : data.error || "Erreur rendez-vous.");
    setAppointmentBusyId(null);
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
            <input className="rounded-xl border p-3" placeholder="Durée estimée" value={analysisForm.estimated_duration} onChange={(e) => setAnalysisForm({ ...analysisForm, estimated_duration: e.target.value })} />
            <textarea className="rounded-xl border p-3 md:col-span-2" placeholder="Description" value={analysisForm.description} onChange={(e) => setAnalysisForm({ ...analysisForm, description: e.target.value })} />
            <label className="flex items-center gap-2 rounded-xl border p-3 font-bold"><input type="checkbox" checked={analysisForm.is_available} onChange={(e) => setAnalysisForm({ ...analysisForm, is_available: e.target.checked })} /> Analyse active</label>
            <label className="flex items-center gap-2 rounded-xl border p-3 font-bold"><input type="checkbox" checked={analysisForm.on_site_available} onChange={(e) => setAnalysisForm({ ...analysisForm, on_site_available: e.target.checked })} /> Sur place</label>
            <label className="flex items-center gap-2 rounded-xl border p-3 font-bold"><input type="checkbox" checked={analysisForm.home_sampling_available} onChange={(e) => setAnalysisForm({ ...analysisForm, home_sampling_available: e.target.checked })} /> Domicile</label>
            <label className="flex items-center gap-2 rounded-xl border p-3 font-bold"><input type="checkbox" checked={analysisForm.teleconsultation_available} onChange={(e) => setAnalysisForm({ ...analysisForm, teleconsultation_available: e.target.checked })} /> Téléconsultation</label>
            <button onClick={saveAnalysis} className="rounded-xl bg-yellow-500 font-black text-black">
              {editingAnalysisId ? "Modifier" : "Ajouter"}
            </button>
            {editingAnalysisId && (
              <button
                onClick={() => {
                  setEditingAnalysisId(null);
                  setAnalysisForm(emptyAnalysisForm);
                }}
                className="rounded-xl bg-gray-100 px-4 py-3 font-bold text-black"
              >
                Annuler
              </button>
            )}
          </div>
          <Table rows={analyses} columns={["name", "price", "result_delay", "estimated_duration", "is_available", "home_sampling_available", "on_site_available", "teleconsultation_available"]} action={(row) => (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => editAnalysis(row)} className="rounded-lg bg-yellow-500 px-3 py-2 font-bold text-black">Modifier</button>
              <button onClick={() => updateAnalysis(row, { is_available: !row.is_available })} className="rounded-lg bg-black px-3 py-2 text-white">Activer/Désactiver</button>
              <button onClick={() => deleteAnalysis(row)} className="rounded-lg bg-red-100 px-3 py-2 font-bold text-red-700">Supprimer</button>
            </div>
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

      {mode === "appointments" && (
        <Table rows={appointments} columns={["patient_name", "patient_phone", "analysis_name", "total_amount", "service_type", "requested_date", "requested_time", "proposed_time", "status", "lab_response"]} action={(row) => {
          const normalizedStatus = String(row.status || "").toLowerCase();
          const finalStatus = ["confirmé", "refusé", "terminé"].includes(normalizedStatus);
          return (
            <div className="flex min-w-[300px] flex-wrap gap-2">
              <button disabled={appointmentBusyId === row.id || finalStatus} onClick={() => updateAppointmentStatus(row, "Confirmé")} className="rounded-lg bg-green-700 px-3 py-2 font-bold text-white disabled:opacity-40">
                Confirmer
              </button>
              <button disabled={appointmentBusyId === row.id || finalStatus} onClick={() => updateAppointmentStatus(row, "Refusé")} className="rounded-lg bg-red-100 px-3 py-2 font-bold text-red-700 disabled:opacity-40">
                Refuser
              </button>
              <button disabled={appointmentBusyId === row.id || finalStatus} onClick={() => updateAppointmentStatus(row, "Reporté")} className="rounded-lg bg-yellow-500 px-3 py-2 font-bold text-black disabled:opacity-40">
                Proposer horaire
              </button>
              <button disabled={appointmentBusyId === row.id || normalizedStatus === "terminé"} onClick={() => updateAppointmentStatus(row, "Terminé")} className="rounded-lg bg-black px-3 py-2 font-bold text-white disabled:opacity-40">
                Terminer
              </button>
            </div>
          );
        }} />
      )}

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
            <div className="grid min-w-[360px] gap-2">
              <textarea
                className="rounded-lg border p-2"
                placeholder="Résumé résultat"
                value={resultDrafts[row.id]?.summary ?? row.result_summary ?? ""}
                onChange={(e) => setResultDrafts({ ...resultDrafts, [row.id]: { ...(resultDrafts[row.id] || { email: "" }), summary: e.target.value } })}
              />
              <input type="file" accept="application/pdf,image/*" onChange={(e) => uploadResultFile(row, e.target.files?.[0])} className="rounded-lg border p-2" />
              <input
                className="rounded-lg border p-2"
                placeholder="Email destinataire"
                value={resultDrafts[row.id]?.email || ""}
                onChange={(e) => setResultDrafts({ ...resultDrafts, [row.id]: { ...(resultDrafts[row.id] || { summary: "" }), email: e.target.value } })}
              />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => updateCaseResult(row, false)} className="rounded-lg bg-black px-3 py-2 text-white">Résultat prêt</button>
                <button onClick={() => updateCaseResult(row, true)} className="rounded-lg bg-green-700 px-3 py-2 text-white">Publier</button>
                <button onClick={() => confirmPayment(row)} className="rounded-lg bg-yellow-500 px-3 py-2 font-bold text-black">Paiement</button>
                <button onClick={() => emailResult(row)} className="rounded-lg bg-blue-700 px-3 py-2 text-white">Email</button>
                {row.result_file_url && <a href={row.result_file_url} className="rounded-lg bg-gray-100 px-3 py-2 font-bold text-black">PDF/Image</a>}
                <button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/resultats-laboratoire`)} className="rounded-lg bg-gray-100 px-3 py-2 font-bold text-black">Copier lien</button>
              </div>
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

function Table({ rows, columns, action }: { rows: any[]; columns: string[]; action?: (row: any) => ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead><tr>{columns.map((col) => <th key={col} className="border-b p-3">{col}</th>)}{action && <th className="border-b p-3">Actions</th>}</tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>{columns.map((col) => <td key={col} className="border-b p-3">{col.includes("amount") || col === "price" ? formatFCFA(row[col]) : typeof row[col] === "boolean" ? (row[col] ? "Oui" : "Non") : String(row[col] ?? "-")}</td>)}{action && <td className="border-b p-3">{action(row)}</td>}</tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="p-6 text-center font-bold text-gray-500">Aucune donnée.</div>}
    </div>
  );
}
