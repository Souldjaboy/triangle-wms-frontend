"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiUrl } from "../../../lib/api";
import { formatFCFA } from "../../../lib/format";

export default function ClientLaboratoireDetailPage() {
  const params = useParams<{ id: string }>();
  const [payload, setPayload] = useState<any>({ laboratory: null, analyses: [] });
  const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([]);

  useEffect(() => {
    fetch(apiUrl(`/laboratories/public/${params.id}`))
      .then((response) => response.json())
      .then((data) => setPayload(data || { laboratory: null, analyses: [] }))
      .catch(() => setPayload({ laboratory: null, analyses: [] }));
  }, [params.id]);

  const lab = payload.laboratory;
  const total = (payload.analyses || [])
    .filter((analysis: any) => selectedAnalyses.includes(String(analysis.id)))
    .reduce((sum: number, analysis: any) => sum + Number(analysis.price || 0), 0);
  const appointmentHref = `/client/laboratoire/rendez-vous?lab=${lab?.id || ""}&company=${lab?.company_id || ""}&analyses=${encodeURIComponent(selectedAnalyses.join(","))}`;

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <Link href="/client/laboratoires" className="font-bold text-yellow-700">Retour laboratoires</Link>
      <section className="mt-5 rounded-2xl bg-white p-6 shadow">
        <h1 className="text-4xl font-black">{lab?.lab_name || "Laboratoire"}</h1>
        <p className="mt-2 text-gray-500">{lab?.city} - {lab?.address}</p>
        <p className="mt-3">{lab?.public_description || lab?.description}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={appointmentHref} className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-black">Prendre rendez-vous</Link>
          {lab?.whatsapp && <a href={`https://wa.me/${String(lab.whatsapp).replace(/\D/g, "")}`} className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white">WhatsApp</a>}
        </div>
      </section>
      <section className="mt-6 rounded-2xl bg-white p-6 shadow">
        <h2 className="text-2xl font-black">Analyses proposées</h2>
        <div className="mt-4 grid gap-3">
          {(payload.analyses || []).map((analysis: any) => (
            <label key={analysis.id} className="flex cursor-pointer gap-3 rounded-xl border p-4">
              <input
                type="checkbox"
                checked={selectedAnalyses.includes(String(analysis.id))}
                onChange={(event) => {
                  const id = String(analysis.id);
                  setSelectedAnalyses((current) =>
                    event.target.checked ? [...current, id] : current.filter((item) => item !== id)
                  );
                }}
                className="mt-1"
              />
              <span className="flex-1">
                <span className="block font-black">{analysis.name}</span>
                <span className="block text-sm text-gray-500">{analysis.description}</span>
                <span className="mt-2 block font-black text-green-700">{formatFCFA(analysis.price)} - {analysis.result_delay}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-3 rounded-xl bg-yellow-50 p-4 md:flex-row md:items-center md:justify-between">
          <p className="font-black">Total sélectionné : {formatFCFA(total)}</p>
          <Link href={appointmentHref} className="rounded-xl bg-yellow-500 px-5 py-3 text-center font-black text-black">
            Demander rendez-vous ou prélèvement
          </Link>
        </div>
      </section>
    </main>
  );
}
