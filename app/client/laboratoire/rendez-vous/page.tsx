"use client";

import { useEffect, useState } from "react";
import { apiUrl, authFetch, getAuthToken } from "../../../lib/api";
import { formatFCFA } from "../../../lib/format";

export default function ClientLaboratoireRendezVousPage() {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [form, setForm] = useState({
    laboratory_id: "",
    company_id: "",
    patient_name: "",
    patient_phone: "",
    patient_email: "",
    analysis_id: "",
    analysis_name: "",
    requested_date: "",
    requested_time: "",
    home_sampling: false,
    home_address: "",
    message: "",
  });
  const [message, setMessage] = useState("");
  const [appointments, setAppointments] = useState<any[]>([]);

  const loadAppointments = async () => {
    if (!getAuthToken()) return;
    const response = await authFetch("/client/laboratory/appointments");
    const data = await response.json().catch(() => []);
    setAppointments(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const lab = search.get("lab") || "";
    const selectedIds = (search.get("analyses") || "").split(",").filter(Boolean);
    setForm((current) => ({ ...current, laboratory_id: lab, company_id: search.get("company") || "" }));

    if (lab) {
      fetch(apiUrl(`/laboratories/public/${lab}`))
        .then((response) => response.json())
        .then((data) => {
          const list = Array.isArray(data?.analyses) ? data.analyses : [];
          setAnalyses(list);
          const selected = list.filter((analysis: any) => selectedIds.includes(String(analysis.id)));
          if (selected.length > 0) {
            setForm((current) => ({
              ...current,
              analysis_id: String(selected[0].id),
              analysis_name: selected.map((analysis: any) => analysis.name).join(", "),
            }));
          }
        })
        .catch(() => setAnalyses([]));
    }
    loadAppointments().catch(() => setAppointments([]));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (!getAuthToken()) {
      window.location.href = `/client/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    if (!form.company_id) {
      setMessage("Laboratoire introuvable. Revenez à la fiche laboratoire puis réessayez.");
      return;
    }
    const response = await authFetch("/laboratory/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        analysis_id: form.analysis_id ? Number(form.analysis_id) : null,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Rendez-vous demandé." : data.error || "Erreur demande rendez-vous.");
    if (response.ok) await loadAppointments();
  };

  const selectedTotal = analyses
    .filter((analysis) => form.analysis_name.split(", ").includes(analysis.name))
    .reduce((sum, analysis) => sum + Number(analysis.price || 0), 0);

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <h1 className="text-4xl font-black">Demander un rendez-vous laboratoire</h1>
      {message && <div className="mt-4 rounded-xl bg-yellow-50 p-4 font-bold text-yellow-800">{message}</div>}
      <form onSubmit={submit} className="mt-6 grid max-w-3xl gap-4 rounded-2xl bg-white p-6 shadow">
        <input className="rounded-xl border p-4" placeholder="Nom complet patient" value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} required />
        <input className="rounded-xl border p-4" placeholder="Téléphone patient" value={form.patient_phone} onChange={(e) => setForm({ ...form, patient_phone: e.target.value })} required />
        <input className="rounded-xl border p-4" placeholder="Email patient" value={form.patient_email} onChange={(e) => setForm({ ...form, patient_email: e.target.value })} />
        <select
          className="rounded-xl border p-4"
          value={form.analysis_id}
          onChange={(e) => {
            const analysis = analyses.find((item) => String(item.id) === e.target.value);
            setForm({ ...form, analysis_id: e.target.value, analysis_name: analysis?.name || form.analysis_name });
          }}
        >
          <option value="">Choisir une analyse principale</option>
          {analyses.map((analysis) => (
            <option key={analysis.id} value={analysis.id}>{analysis.name} - {formatFCFA(analysis.price)}</option>
          ))}
        </select>
        <textarea className="rounded-xl border p-4" placeholder="Analyses demandées" value={form.analysis_name} onChange={(e) => setForm({ ...form, analysis_name: e.target.value })} />
        <div className="grid gap-3 md:grid-cols-2">
          <input type="date" className="rounded-xl border p-4" value={form.requested_date} onChange={(e) => setForm({ ...form, requested_date: e.target.value })} />
          <input type="time" className="rounded-xl border p-4" value={form.requested_time} onChange={(e) => setForm({ ...form, requested_time: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={form.home_sampling} onChange={(e) => setForm({ ...form, home_sampling: e.target.checked })} /> Prélèvement à domicile</label>
        {form.home_sampling && <input className="rounded-xl border p-4" placeholder="Adresse de prélèvement" value={form.home_address} onChange={(e) => setForm({ ...form, home_address: e.target.value })} />}
        <textarea className="rounded-xl border p-4" placeholder="Message ou précision médicale" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        {selectedTotal > 0 && <p className="rounded-xl bg-green-50 p-4 font-black text-green-800">Prix indicatif : {formatFCFA(selectedTotal)}</p>}
        <button className="rounded-xl bg-yellow-500 py-4 font-black text-black">Envoyer la demande</button>
      </form>

      <section className="mt-8 rounded-2xl bg-white p-6 shadow">
        <h2 className="text-2xl font-black">Mes rendez-vous laboratoire</h2>
        <div className="mt-4 grid gap-3">
          {appointments.map((appointment) => (
            <article key={appointment.id} className="rounded-xl border p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-black">{appointment.lab_name || "Laboratoire"}</p>
                  <p className="text-sm text-gray-500">{appointment.analysis_name || "Analyse"} - {appointment.requested_date || "-"} {appointment.requested_time || ""}</p>
                  {appointment.proposed_time && <p className="text-sm font-bold text-blue-700">Horaire proposé : {appointment.proposed_time}</p>}
                  {appointment.lab_response && <p className="text-sm text-gray-600">Message : {appointment.lab_response}</p>}
                </div>
                <span className="rounded-full bg-yellow-100 px-4 py-2 text-sm font-black text-yellow-800">
                  {appointment.status || "En attente"}
                </span>
              </div>
            </article>
          ))}
          {appointments.length === 0 && <p className="font-bold text-gray-500">Aucun rendez-vous enregistré.</p>}
        </div>
      </section>
    </main>
  );
}
