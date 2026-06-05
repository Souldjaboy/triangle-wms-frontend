"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "../../lib/api";

export default function ClientLaboratoiresPage() {
  const [labs, setLabs] = useState<any[]>([]);
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");

  const loadLabs = async () => {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (query) params.set("q", query);
    const response = await fetch(apiUrl(`/laboratories/public?${params.toString()}`));
    const data = await response.json().catch(() => []);
    setLabs(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadLabs();
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-black">Laboratoires</h1>
          <p className="text-gray-500">Analyses, prix, horaires et rendez-vous.</p>
        </div>
        <Link href="/marketplace" className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black">Marketplace</Link>
      </div>
      <div className="mb-6 grid gap-3 rounded-2xl bg-white p-4 shadow md:grid-cols-3">
        <input className="rounded-xl border p-3" placeholder="Recherche laboratoire" value={query} onChange={(e) => setQuery(e.target.value)} />
        <input className="rounded-xl border p-3" placeholder="Ville" value={city} onChange={(e) => setCity(e.target.value)} />
        <button onClick={loadLabs} className="rounded-xl bg-black font-bold text-white">Rechercher</button>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {labs.map((lab) => (
          <article key={lab.id} className="rounded-2xl bg-white p-5 shadow">
            {lab.public_image_url || lab.logo_url ? <img src={lab.public_image_url || lab.logo_url} alt={lab.lab_name} className="mb-4 h-36 w-full rounded-xl object-cover" /> : null}
            <h2 className="text-2xl font-black">{lab.lab_name || lab.company_name}</h2>
            <p className="mt-2 text-gray-500">{lab.city} - {lab.address}</p>
            <p className="mt-2 text-sm text-gray-600">{lab.public_description || lab.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/client/laboratoires/${lab.id}`} className="rounded-xl bg-black px-4 py-3 font-bold text-white">Voir laboratoire</Link>
              {lab.whatsapp && <a href={`https://wa.me/${String(lab.whatsapp).replace(/\D/g, "")}`} className="rounded-xl bg-green-600 px-4 py-3 font-bold text-white">WhatsApp</a>}
            </div>
          </article>
        ))}
      </div>
      {labs.length === 0 && <div className="rounded-2xl bg-white p-8 text-center font-bold text-gray-500">Aucun laboratoire publié.</div>}
    </main>
  );
}
