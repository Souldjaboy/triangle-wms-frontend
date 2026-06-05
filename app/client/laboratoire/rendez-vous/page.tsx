"use client";

import { useEffect, useState } from "react";
import { authFetch } from "../../../lib/api";

export default function ClientLaboratoireRendezVousPage() {
  const [form, setForm] = useState({
    company_id: "",
    patient_name: "",
    patient_phone: "",
    patient_email: "",
    analysis_name: "",
    requested_date: "",
    requested_time: "",
    home_sampling: false,
    home_address: "",
    message: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setForm((current) => ({ ...current, company_id: search.get("company") || "" }));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await authFetch("/laboratory/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setMessage(response.ok ? "Rendez-vous demandé." : "Erreur demande rendez-vous.");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <h1 className="text-4xl font-black">Demander un rendez-vous laboratoire</h1>
      {message && <div className="mt-4 rounded-xl bg-yellow-50 p-4 font-bold text-yellow-800">{message}</div>}
      <form onSubmit={submit} className="mt-6 grid max-w-3xl gap-4 rounded-2xl bg-white p-6 shadow">
        {Object.entries(form).filter(([key]) => key !== "home_sampling").map(([key, value]) => (
          <input key={key} className="rounded-xl border p-4" placeholder={key} value={String(value)} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
        ))}
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={form.home_sampling} onChange={(e) => setForm({ ...form, home_sampling: e.target.checked })} /> Prélèvement à domicile</label>
        <button className="rounded-xl bg-yellow-500 py-4 font-black text-black">Envoyer la demande</button>
      </form>
    </main>
  );
}
