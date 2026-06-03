"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { authFetch } from "../../lib/api";
import { formatFCFA } from "../../lib/format";

export default function PartnerDetailsPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPartner = async () => {
      try {
        const response = await authFetch(`/partners/${params.id}/details`);
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(payload.error || "Erreur chargement fiche partenaire.");
          return;
        }

        setData(payload);
      } catch (loadError) {
        console.error(loadError);
        setError("Backend inaccessible pour la fiche partenaire.");
      }
    };

    if (params.id) loadPartner();
  }, [params.id]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 text-black">
        <div className="rounded-xl bg-red-100 p-4 font-bold text-red-700">{error}</div>
      </div>
    );
  }

  if (!data) {
    return <div className="min-h-screen bg-gray-100 p-8 text-black">Chargement partenaire...</div>;
  }

  const partner = data.partner || {};
  const balance = data.balance || {};

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold">{partner.name}</h1>
          <p className="text-gray-500">Fiche complète partenaire</p>
        </div>
        <a href="/partenaires" className="rounded-xl bg-black px-5 py-3 font-bold text-white">
          Retour partenaires
        </a>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-bold">Informations générales</h2>
          <Info label="Type" value={partner.type} />
          <Info label="Téléphone" value={partner.phone} />
          <Info label="Email" value={partner.email} />
          <Info label="Adresse" value={partner.address} />
          <Info label="Ville" value={partner.city} />
          <Info label="Pays" value={partner.country} />
          <Info label="Contact" value={partner.contact_person} />
          <Info label="NIF" value={partner.nif} />
          <Info label="RCCM" value={partner.rccm} />
          <Info label="Statut" value={partner.status} />
        </section>

        <section className="rounded-2xl bg-black p-6 text-white shadow">
          <h2 className="mb-4 text-2xl font-bold">Solde</h2>
          <p className="text-gray-300">Crédit client</p>
          <p className="mb-5 text-3xl font-bold text-yellow-400">
            {formatFCFA(balance.client_credit || 0)}
          </p>
          <p className="text-gray-300">Dette fournisseur</p>
          <p className="text-3xl font-bold text-orange-300">
            {formatFCFA(balance.supplier_debt || 0)}
          </p>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-bold">Résumé</h2>
          <Info label="Ventes liées" value={(data.sales || []).length} />
          <Info label="Achats liés" value={(data.purchases || []).length} />
          <Info label="Paiements liés" value={(data.payments || []).length} />
          <Info label="Reçus liés" value={(data.receipts || []).length} />
          <Info label="Documents liés" value={(data.documents || []).length} />
        </section>
      </div>

      <HistorySection title="Historique ventes" rows={data.sales || []} columns={[
        ["sale_number", "Vente"],
        ["total_amount", "Montant", "money"],
        ["amount_paid", "Payé", "money"],
        ["payment_status", "Paiement"],
        ["status", "Statut"],
        ["created_at", "Date", "date"]
      ]} />

      <HistorySection title="Historique achats" rows={data.purchases || []} columns={[
        ["purchase_number", "Achat"],
        ["total_amount", "Montant", "money"],
        ["status", "Statut"],
        ["created_at", "Date", "date"]
      ]} />

      <HistorySection title="Historique paiements" rows={data.payments || []} columns={[
        ["payment_method", "Méthode"],
        ["amount", "Montant", "money"],
        ["status", "Statut"],
        ["paid_at", "Payé le", "date"],
        ["created_at", "Créé le", "date"]
      ]} />

      <HistorySection title="Reçus" rows={data.receipts || []} columns={[
        ["receipt_number", "Reçu"],
        ["total_amount", "Montant", "money"],
        ["payment_status", "Paiement"],
        ["status", "Statut"],
        ["created_at", "Date", "date"]
      ]} />

      <HistorySection title="Documents" rows={data.documents || []} columns={[
        ["document_type", "Type"],
        ["document_number", "Numéro"],
        ["total_amount", "Montant", "money"],
        ["status", "Statut"],
        ["created_at", "Date", "date"]
      ]} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="border-b py-2">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-semibold">{value || "-"}</p>
    </div>
  );
}

function HistorySection({ title, rows, columns }: { title: string; rows: any[]; columns: any[] }) {
  return (
    <section className="mt-6 overflow-x-auto rounded-2xl bg-white p-5 shadow">
      <h2 className="mb-4 text-2xl font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-gray-500">Aucun enregistrement.</p>
      ) : (
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b text-gray-500">
              {columns.map(([key, label]) => (
                <th key={key} className="py-3">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                {columns.map(([key, , type]) => (
                  <td key={key} className="py-3">
                    {formatValue(row[key], type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function formatValue(value: any, type?: string) {
  if (type === "money") return formatFCFA(value || 0);
  if (type === "date") return value ? new Date(value).toLocaleString("fr-FR") : "-";
  return value || "-";
}
