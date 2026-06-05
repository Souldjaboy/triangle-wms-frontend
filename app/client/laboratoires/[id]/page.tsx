"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiUrl } from "../../../lib/api";
import { formatFCFA } from "../../../lib/format";

export default function ClientLaboratoireDetailPage() {
  const params = useParams<{ id: string }>();
  const [payload, setPayload] = useState<any>({ laboratory: null, analyses: [] });

  useEffect(() => {
    fetch(apiUrl(`/laboratories/public/${params.id}`))
      .then((response) => response.json())
      .then((data) => setPayload(data || { laboratory: null, analyses: [] }))
      .catch(() => setPayload({ laboratory: null, analyses: [] }));
  }, [params.id]);

  const lab = payload.laboratory;

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <Link href="/client/laboratoires" className="font-bold text-yellow-700">Retour laboratoires</Link>
      <section className="mt-5 rounded-2xl bg-white p-6 shadow">
        <h1 className="text-4xl font-black">{lab?.lab_name || "Laboratoire"}</h1>
        <p className="mt-2 text-gray-500">{lab?.city} - {lab?.address}</p>
        <p className="mt-3">{lab?.public_description || lab?.description}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/client/laboratoire/rendez-vous?lab=${lab?.id}&company=${lab?.company_id}`} className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-black">Prendre rendez-vous</Link>
          {lab?.whatsapp && <a href={`https://wa.me/${String(lab.whatsapp).replace(/\D/g, "")}`} className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white">WhatsApp</a>}
        </div>
      </section>
      <section className="mt-6 rounded-2xl bg-white p-6 shadow">
        <h2 className="text-2xl font-black">Analyses proposées</h2>
        <div className="mt-4 grid gap-3">
          {(payload.analyses || []).map((analysis: any) => (
            <div key={analysis.id} className="rounded-xl border p-4">
              <p className="font-black">{analysis.name}</p>
              <p className="text-sm text-gray-500">{analysis.description}</p>
              <p className="mt-2 font-black text-green-700">{formatFCFA(analysis.price)} - {analysis.result_delay}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
