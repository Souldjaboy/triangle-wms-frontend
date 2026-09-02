"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { authFetch } from "../../lib/api";
import { formatFCFA } from "../../lib/format";
import { afficherDate } from "../../lib/dates";
import DateDocumentEditor from "../../components/DateDocumentEditor";
import { usePermissions } from "../../lib/permissions";

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const [documentData, setDocumentData] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  /* La date métier du document, servie par /documents/:id/dates. Tant
     qu'elle n'est pas chargée, on retombe sur ce que porte le document. */
  const [datesDoc, setDatesDoc] = useState<any>(null);
  const { can } = usePermissions();
  const [emailForm, setEmailForm] = useState({
    recipient_email: "",
    subject: "",
    message: "",
  });

  /* Correction du contenu IMPRIMÉ : le numéro du bon et les quantités qui
     figurent dessus. Rien ici ne touche au stock — le mouvement, le stock du
     produit et les balances d'emplacement restent tels quels. C'est le
     serveur qui le garantit ; l'écran le dit pour que personne ne s'en
     serve en croyant corriger un stock. */
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correction, setCorrection] = useState<{
    document_number: string;
    reason: string;
    quantites: Record<string, string>;
  }>({ document_number: "", reason: "", quantites: {} });
  const [correctionEnCours, setCorrectionEnCours] = useState(false);

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

  /** Les quatre dates du document, servies par l'API dédiée. */
  const chargerDates = async () => {
    const r = await authFetch(`/documents/${params.id}/dates`, { cache: "no-store" });
    if (r.ok) setDatesDoc(await r.json().catch(() => null));
  };

  useEffect(() => {
    loadDocument();
    chargerDates();
  }, [params.id]);

  /**
   * Imprimer, et le dire au serveur.
   *
   * `printed_at` n'est pas la date du document : c'est celle de sa sortie.
   * Sans cet enregistrement, on ne saurait pas qu'un bon circule déjà, et
   * corriger sa date resterait un geste anodin alors qu'il ne l'est plus.
   */
  const imprimer = () => {
    window.print();
    authFetch(`/documents/${params.id}/printed`, { method: "POST" })
      .then(() => chargerDates())
      .catch(() => {});
  };

  /** Ouvre le formulaire pré-rempli avec ce que porte le document aujourd'hui. */
  const ouvrirCorrection = () => {
    const quantites: Record<string, string> = {};
    for (const item of items) quantites[String(item.id)] = String(Number(item.quantity));
    setCorrection({
      document_number: doc?.document_number || "",
      reason: "",
      quantites,
    });
    setCorrectionOpen(true);
  };

  const enregistrerCorrection = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setCorrectionEnCours(true);
    try {
      const response = await authFetch(`/documents/${params.id}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_number: correction.document_number,
          reason: correction.reason,
          items: items.map((item: any) => ({
            id: item.id,
            quantity: Number(correction.quantites[String(item.id)]),
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setCorrectionOpen(false);
        setMessage(
          `Document corrigé (révision ${data.revision}). `
          + "Le mouvement de stock et les quantités en stock n'ont pas changé."
        );
        await loadDocument();
      } else {
        setMessage(data?.error || "Erreur de correction du document.");
      }
    } catch (error) {
      console.error(error);
      setMessage("Erreur de correction du document.");
    } finally {
      setCorrectionEnCours(false);
    }
  };

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
    <>
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mb-6 flex flex-col gap-3 print:hidden md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/documents" className="font-bold text-gray-600">
            Retour documents
          </Link>
          <h1 className="mt-2 text-3xl font-black text-black">{doc.document_type}</h1>
          <p className="font-bold text-blue-700">{doc.document_number}</p>
        </div>
        <div className="flex flex-wrap gap-3 print:hidden">
          {can("document", "update") && (
            <button onClick={() => setDateOpen(true)}
                    className="rounded-xl border-2 border-black px-5 py-3 font-bold text-black">
              Modifier la date et l&apos;heure
            </button>
          )}
          {can("document", "update") && !doc.cancelled_at && (
            <button onClick={ouvrirCorrection}
                    className="min-h-[44px] rounded-xl border-2 border-black px-5 py-3 font-bold text-black">
              Corriger numéro / quantités
            </button>
          )}
          <button onClick={imprimer} className="rounded-xl bg-black px-5 py-3 font-bold text-white">
            Imprimer
          </button>
          <button onClick={imprimer} className="rounded-xl bg-gray-800 px-5 py-3 font-bold text-white">
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

      {correctionOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 print:hidden">
          <form onSubmit={enregistrerCorrection}
                className="my-8 w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl md:p-6">
            <h2 className="text-2xl font-black">Corriger numéro / quantités</h2>

            {/* Dit à l'écran ce que le serveur impose : sans cette phrase,
                quelqu'un corrigerait un bon en croyant rectifier un stock. */}
            <p className="mt-2 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-900">
              Cette correction ne porte que sur le papier : le mouvement de
              stock, le stock du produit et les emplacements ne bougent pas.
              Pour corriger une quantité réellement entrée ou sortie, passez
              par le mouvement lui-même.
            </p>

            {Number(doc.print_count || 0) > 0 && (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
                Ce document a déjà été imprimé{" "}
                {Number(doc.print_count)} fois : le corriger demande le droit de
                réimpression.
              </p>
            )}

            <label className="mt-4 block text-sm font-bold text-gray-700">
              Numéro du document
              <input
                required
                value={correction.document_number}
                onChange={(e) =>
                  setCorrection({ ...correction, document_number: e.target.value })
                }
                className="mt-1 w-full rounded-xl border p-3 font-mono font-bold text-black"
              />
            </label>

            <div className="mt-4 space-y-2">
              <p className="text-sm font-bold text-gray-700">Quantités imprimées</p>
              {items.map((item: any) => (
                <div key={item.id}
                     className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 p-3">
                  <span className="min-w-0 flex-1">
                    <b className="block text-black">{item.product_name}</b>
                    <span className="text-xs text-gray-500">
                      {item.product_reference || "—"} · actuellement{" "}
                      {Number(item.quantity)}
                    </span>
                  </span>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    required
                    value={correction.quantites[String(item.id)] ?? ""}
                    onChange={(e) =>
                      setCorrection({
                        ...correction,
                        quantites: {
                          ...correction.quantites,
                          [String(item.id)]: e.target.value,
                        },
                      })
                    }
                    className="w-28 rounded-xl border p-3 text-right font-bold"
                  />
                </div>
              ))}
            </div>

            <label className="mt-4 block text-sm font-bold text-gray-700">
              Motif de la correction (obligatoire)
              <textarea
                required
                value={correction.reason}
                onChange={(e) => setCorrection({ ...correction, reason: e.target.value })}
                placeholder="Ex. : quantité saisie deux fois lors de l'import du 2 septembre."
                className="mt-1 min-h-24 w-full rounded-xl border p-3 text-black"
              />
            </label>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setCorrectionOpen(false)}
                      className="min-h-[44px] rounded-xl border px-5 py-3 font-bold">
                Annuler
              </button>
              <button disabled={correctionEnCours}
                      className="min-h-[44px] rounded-xl bg-black px-5 py-3 font-bold text-white disabled:bg-gray-300">
                {correctionEnCours ? "Enregistrement…" : "Enregistrer la correction"}
              </button>
            </div>
          </form>
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
            {/* Date MÉTIER, à l'heure de Bamako. Auparavant on imprimait
                created_at dans le fuseau du navigateur : le même bon affichait
                une heure différente selon le téléphone qui l'ouvrait. */}
            <p className="text-gray-500">
              {afficherDate(
                datesDoc?.dates?.document_affiche?.iso
                  || doc.document_datetime || doc.operation_effective_at || doc.created_at,
                "-"
              )}
            </p>
            {Number(datesDoc?.revision || doc.document_revision || 1) > 1 && (
              <p className="text-xs text-gray-400">
                Révision {datesDoc?.revision || doc.document_revision}
              </p>
            )}
          </div>
        </header>

        <section className="my-5 grid grid-cols-1 gap-2 md:grid-cols-2">
          <p><strong>Client / Fournisseur :</strong> {doc.client_name || "-"}</p>
          <p><strong>Téléphone :</strong> {doc.client_phone || "-"}</p>
          <p><strong>Adresse :</strong> {doc.client_address || "-"}</p>
          <p><strong>Créé par :</strong> {doc.created_by || "-"}</p>
        </section>

        {/* Cinq colonnes ne tiennent pas dans 375 px : sans ce conteneur, c'est
            la page entière qui glisse latéralement et les boutons sortent de
            l'écran. Le tableau défile ici, seul. L'impression n'a pas cette
            contrainte de largeur : elle reprend le débordement visible. */}
        <div className="-mx-2 overflow-x-auto px-2 print:mx-0 print:overflow-visible print:px-0">
        <table className="w-full min-w-[34rem] border-collapse text-left print:min-w-0">
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
        </div>

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
            <div className="w-5/12 border-t border-black pt-2 text-center font-semibold">Reçu par</div>
            <div className="w-5/12 border-t border-black pt-2 text-center font-semibold">Livré par</div>
          </footer>
        )}
      </main>
    </div>

      <DateDocumentEditor
        documentId={Number(params.id)}
        ouvert={dateOpen}
        onFermer={() => setDateOpen(false)}
        onEnregistre={(v) => { setDatesDoc(v); loadDocument(); }}
      />
    </>
  );
}