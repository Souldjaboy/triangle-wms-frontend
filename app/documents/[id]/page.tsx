"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { authFetch } from "../../lib/api";
import { formatFCFA } from "../../lib/format";

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const [documentData, setDocumentData] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailForm, setEmailForm] = useState({
    recipient_email: "",
    subject: "",
    message: "",
  });

  const doc = documentData?.document;
  const items = documentData?.items || [];
  const isReceipt = useMemo(
    () => String(doc?.document_type || "").toLowerCase().includes("reçu"),
    [doc?.document_type]
  );

  const loadDocument = async () => {
    setLoading(true);
    try {
      const [documentRes, companyRes] = await Promise.all([
        authFetch(`/documents/${params.id}`),
        authFetch("/company-settings/current"),
      ]);
      const data = await documentRes.json().catch(() => null);
      const companyData = await companyRes.json().catch(() => null);
      setDocumentData(data);
      setCompany(companyData || {});
      if (!documentRes.ok) setMessage(data?.error || "Document introuvable.");
    } catch (error) {
      console.error(error);
      setMessage("Erreur chargement document.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocument();
  }, [params.id]);

  const sendEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    const response = await authFetch(`/documents/${params.id}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...emailForm,
        subject:
          emailForm.subject ||
          `${doc?.document_type || "Document"} ${doc?.document_number || ""}`,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? data.message || "Email envoyé." : data.error || "Erreur envoi email.");
    if (response.ok) setEmailOpen(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-100 p-8 font-bold">Chargement document...</div>;
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <p className="rounded-xl bg-red-100 p-4 font-bold text-red-700">{message || "Document introuvable."}</p>
        <Link href="/documents" className="mt-4 inline-block rounded-xl bg-black px-5 py-3 font-bold text-white">
          Retour documents
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mb-6 flex flex-col gap-3 print:hidden md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/documents" className="font-bold text-gray-600">
            Retour documents
          </Link>
          <h1 className="mt-2 text-3xl font-black text-black">{doc.document_type}</h1>
          <p className="font-bold text-blue-700">{doc.document_number}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => window.print()} className="rounded-xl bg-black px-5 py-3 font-bold text-white">
            Imprimer
          </button>
          <button onClick={() => window.print()} className="rounded-xl bg-gray-800 px-5 py-3 font-bold text-white">
            Télécharger PDF
          </button>
          <button onClick={() => setEmailOpen(true)} className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black">
            Envoyer par email
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-5 rounded-xl bg-yellow-100 p-4 font-bold text-yellow-800 print:hidden">
          {message}
        </div>
      )}

      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
          <form onSubmit={sendEmail} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-2xl font-black">Envoyer le document</h2>
            <input
              type="email"
              required
              placeholder="Email destinataire"
              value={emailForm.recipient_email}
              onChange={(e) => setEmailForm({ ...emailForm, recipient_email: e.target.value })}
              className="mb-3 w-full rounded-xl border p-3"
            />
            <input
              placeholder="Objet"
              value={emailForm.subject}
              onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
              className="mb-3 w-full rounded-xl border p-3"
            />
            <textarea
              placeholder="Message"
              value={emailForm.message}
              onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
              className="mb-4 min-h-28 w-full rounded-xl border p-3"
            />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setEmailOpen(false)} className="rounded-xl border px-5 py-3 font-bold">
                Annuler
              </button>
              <button className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black">
                Envoyer
              </button>
            </div>
          </form>
        </div>
      )}

      <main
        className={`mx-auto bg-white p-6 shadow print:shadow-none ${
          isReceipt ? "max-w-[80mm] rounded-lg text-sm" : "max-w-5xl rounded-2xl"
        }`}
      >
        <header className="flex justify-between gap-6 border-b-2 border-black pb-5">
          <div>
            {company?.logo_url && (
              <img src={company.logo_url} alt="Logo entreprise" className="mb-3 max-h-20 max-w-40 object-contain" />
            )}
            <h2 className="text-xl font-black">{company?.name || company?.company_name || "Triangle WMS Pro"}</h2>
            <p className="text-gray-600">{company?.address || ""}</p>
            <p className="text-gray-600">
              {company?.phone || ""} {company?.email ? `| ${company.email}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black">{doc.document_type}</p>
            <p className="font-bold text-blue-700">{doc.document_number}</p>
            <p className="text-gray-500">
              {doc.created_at ? new Date(doc.created_at).toLocaleString("fr-FR") : "-"}
            </p>
          </div>
        </header>

        <section className="my-5 grid grid-cols-1 gap-2 md:grid-cols-2">
          <p><strong>Client / Fournisseur :</strong> {doc.client_name || "-"}</p>
          <p><strong>Téléphone :</strong> {doc.client_phone || "-"}</p>
          <p><strong>Adresse :</strong> {doc.client_address || "-"}</p>
          <p><strong>Créé par :</strong> {doc.created_by || "-"}</p>
        </section>

        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2">Référence</th>
              <th className="p-2">Produit</th>
              <th className="p-2 text-right">Quantité</th>
              <th className="p-2 text-right">Prix</th>
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-gray-500">Aucune ligne détaillée.</td></tr>
            ) : (
              items.map((item: any) => (
                <tr key={item.id} className="border-b">
                  <td className="p-2">{item.product_reference || "-"}</td>
                  <td className="p-2">{item.product_name || "-"}</td>
                  <td className="p-2 text-right">{Number(item.quantity || 0).toLocaleString("fr-FR")}</td>
                  <td className="p-2 text-right">{formatFCFA(item.unit_price)}</td>
                  <td className="p-2 text-right">{formatFCFA(item.total_price)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-6 text-right text-2xl font-black">
          Total : {formatFCFA(doc.total_amount)}
        </div>

        {doc.observation && (
          <p className="mt-6 rounded-xl bg-gray-50 p-4 text-gray-700">
            <strong>Observation :</strong> {doc.observation}
          </p>
        )}

        {!isReceipt && (
          <footer className="mt-20 flex justify-between gap-10">
            <div className="w-5/12 border-t border-black pt-2 text-center">Signature</div>
            <div className="w-5/12 border-t border-black pt-2 text-center">Cachet</div>
          </footer>
        )}
      </main>
    </div>
  );
}
