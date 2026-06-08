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
    analysis_ids: [] as string[],
    analysis_name: "",
    requested_date: "",
    requested_time: "",
    service_type: "sur_place",
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
              analysis_ids: selected.map((analysis: any) => String(analysis.id)),
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
    if (form.analysis_ids.length === 0) {
      setMessage("Veuillez choisir au moins une analyse.");
      return;
    }
    const response = await authFetch("/laboratory/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        analysis_ids: form.analysis_ids.map(Number),
        analysis_id: form.analysis_id ? Number(form.analysis_id) : null,
        total_amount: selectedTotal,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Rendez-vous demandé." : data.error || "Erreur demande rendez-vous.");
    if (response.ok) await loadAppointments();
  };

  const selectedTotal = analyses
    .filter((analysis) => form.analysis_ids.includes(String(analysis.id)))
    .reduce((sum, analysis) => sum + Number(analysis.price || 0), 0);

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <h1 className="text-4xl font-black">Demander un rendez-vous laboratoire</h1>
      {message && <div className="mt-4 rounded-xl bg-yellow-50 p-4 font-bold text-yellow-800">{message}</div>}
      <form onSubmit={submit} className="mt-6 grid max-w-3xl gap-4 rounded-2xl bg-white p-6 shadow">
        <input className="rounded-xl border p-4" placeholder="Nom complet patient" value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} required />
        <input className="rounded-xl border p-4" placeholder="Téléphone patient" value={form.patient_phone} onChange={(e) => setForm({ ...form, patient_phone: e.target.value })} required />
        <input className="rounded-xl border p-4" placeholder="Email patient" value={form.patient_email} onChange={(e) => setForm({ ...form, patient_email: e.target.value })} />
        <div className="rounded-xl border p-4">
          <p className="mb-3 font-black">Analyses à demander</p>
          <div className="grid gap-3">
            {analyses.map((analysis) => {
              const id = String(analysis.id);
              const checked = form.analysis_ids.includes(id);
              return (
                <label key={analysis.id} className="flex cursor-pointer gap-3 rounded-xl bg-gray-50 p-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={(event) => {
                      const nextIds = event.target.checked
                        ? [...form.analysis_ids, id]
                        : form.analysis_ids.filter((item) => item !== id);
                      const selected = analyses.filter((item) => nextIds.includes(String(item.id)));
                      setForm({
                        ...form,
                        analysis_ids: nextIds,
                        analysis_id: nextIds[0] || "",
                        analysis_name: selected.map((item) => item.name).join(", "),
                      });
                    }}
                  />
                  <span className="flex-1">
                    <span className="block font-black">{analysis.name}</span>
                    <span className="block text-sm text-gray-500">{analysis.description || "Analyse laboratoire"}</span>
                    <span className="mt-1 block font-bold text-green-700">{formatFCFA(analysis.price)} {analysis.result_delay ? `- ${analysis.result_delay}` : ""}</span>
                    <span className="mt-1 block text-xs font-bold text-gray-500">
                      {analysis.on_site_available !== false ? "Sur place" : ""}
                      {analysis.home_sampling_available ? " · Domicile" : ""}
                      {analysis.teleconsultation_available ? " · Téléconsultation" : ""}
                    </span>
                  </span>
                </label>
              );
            })}
            {analyses.length === 0 && <p className="font-bold text-gray-500">Aucune analyse active pour ce laboratoire.</p>}
          </div>
        </div>
        <select className="rounded-xl border p-4" value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value, home_sampling: e.target.value === "domicile" })}>
          <option value="sur_place">Sur place</option>
          <option value="domicile">Prélèvement à domicile</option>
          <option value="teleconsultation">Téléconsultation</option>
        </select>
        <div className="grid gap-3 md:grid-cols-2">
          <input type="date" className="rounded-xl border p-4" value={form.requested_date} onChange={(e) => setForm({ ...form, requested_date: e.target.value })} />
          <input type="time" className="rounded-xl border p-4" value={form.requested_time} onChange={(e) => setForm({ ...form, requested_time: e.target.value })} />
        </div>
        {form.service_type === "domicile" && <input className="rounded-xl border p-4" placeholder="Adresse de prélèvement" value={form.home_address} onChange={(e) => setForm({ ...form, home_address: e.target.value })} />}
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
                  <p className="text-sm font-bold text-green-700">Total : {formatFCFA(appointment.total_amount || 0)} · Service : {appointment.service_type || "sur_place"}</p>
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
