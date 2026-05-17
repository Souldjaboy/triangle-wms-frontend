"use client";

import { useEffect, useState } from "react";

export default function SuperAdminPage() {
  const [overview, setOverview] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const fetchData = async () => {
    const overviewRes = await fetch("http://localhost:5050/super-admin/overview");
    const overviewData = await overviewRes.json();
    setOverview(overviewData);

    const companiesRes = await fetch("http://localhost:5050/super-admin/companies");
    const companiesData = await companiesRes.json();
    setCompanies(Array.isArray(companiesData) ? companiesData : []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const changeCompanyStatus = async (companyId: number, status: string) => {
    await fetch(`http://localhost:5050/super-admin/companies/${companyId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    setMessage(
      status === "active"
        ? "Entreprise réactivée avec succès."
        : "Entreprise suspendue avec succès."
    );

    fetchData();
  };

  const renewSubscription = async (companyId: number) => {
    await fetch(`http://localhost:5050/super-admin/subscriptions/${companyId}/renew`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        months: 1,
        payment_mode: "manual",
      }),
    });

    setMessage("Abonnement renouvelé pour 1 mois.");
    fetchData();
  };

  const giveFreeAccess = async (companyId: number) => {
    await fetch(`http://localhost:5050/super-admin/subscriptions/${companyId}/free`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    });

    setMessage("Accès gratuit accordé à l’entreprise.");
    fetchData();
  };

  if (!overview) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 text-black">
        Chargement du Super Admin...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Super Admin SaaS
      </h1>

      <p className="text-gray-500 mb-8">
        Contrôle global des entreprises, abonnements, paiements et accès clients.
      </p>

      {message && (
        <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 font-bold">
          {message}
        </div>
      )}

      <div className="grid grid-cols-4 gap-6 mb-8">
        <Card title="Entreprises" value={overview.total_companies} />
        <Card title="Actives" value={overview.active_companies} />
        <Card title="Suspendues" value={overview.suspended_companies} />
        <Card title="Plans" value={overview.total_plans} />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <Card title="Abonnements actifs" value={overview.active_subscriptions} />
        <Card title="Essais gratuits" value={overview.trial_subscriptions} />
        <Card title="Revenus payés" value={`${overview.total_revenue} FCFA`} />
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold text-black mb-5">
          Entreprises clientes
        </h2>

        {companies.length === 0 ? (
          <p className="text-gray-500">Aucune entreprise trouvée.</p>
        ) : (
          <div className="space-y-4">
            {companies.map((company: any) => (
              <div key={company.id} className="border rounded-2xl p-5">
                <div className="flex justify-between items-start gap-6">
                  <div>
                    <p className="text-xl font-bold text-black">
                      {company.name}
                    </p>

                    <p className="text-sm text-gray-500">
                      Responsable : {company.responsible_name || "-"}
                    </p>

                    <p className="text-sm text-gray-500">
                      Email : {company.email || "-"} | Téléphone :{" "}
                      {company.phone || "-"}
                    </p>

                    <p className="text-sm text-gray-500">
                      Plan :{" "}
                      <span className="font-bold text-blue-600">
                        {company.plan_name || "-"}
                      </span>{" "}
                      | Abonnement :{" "}
                      <span className="font-bold">
                        {company.subscription_status || "-"}
                      </span>
                    </p>

                    <p className="text-sm text-gray-500">
                      Expiration :{" "}
                      {company.end_date
                        ? new Date(company.end_date).toLocaleDateString("fr-FR")
                        : "Illimité / Non défini"}
                    </p>

                    <p className="text-sm text-gray-500">
                      Statut entreprise :{" "}
                      <span
                        className={
                          company.status === "active"
                            ? "text-green-600 font-bold"
                            : "text-red-600 font-bold"
                        }
                      >
                        {company.status}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 min-w-[220px]">
                    {company.status === "active" ? (
                      <button
                        onClick={() => changeCompanyStatus(company.id, "suspended")}
                        className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold"
                      >
                        Suspendre
                      </button>
                    ) : (
                      <button
                        onClick={() => changeCompanyStatus(company.id, "active")}
                        className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold"
                      >
                        Réactiver
                      </button>
                    )}

                    <button
                      onClick={() => renewSubscription(company.id)}
                      className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold"
                    >
                      Renouveler 1 mois
                    </button>

                    <button
                      onClick={() => giveFreeAccess(company.id)}
                      className="bg-black text-white px-4 py-2 rounded-xl font-bold"
                    >
                      Accès gratuit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <a
        href="/assistant"
        className="fixed bottom-6 right-6 bg-black text-white px-5 py-4 rounded-full shadow-2xl font-bold hover:scale-105 transition z-50"
      >
        🤖 Triangle IA
      </a>
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow">
      <p className="text-gray-500">{title}</p>
      <h2 className="text-3xl font-bold text-black">{value ?? 0}</h2>
    </div>
  );
}