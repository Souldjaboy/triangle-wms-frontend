"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../lib/api";
import PrintableCompanyHeader from "../../components/PrintableCompanyHeader";

/**
 * IMPRESSION GROUPÉE DE DOCUMENTS.
 *
 * Tous les documents sélectionnés sont rendus dans une seule page, séparés par
 * un saut de page : l'utilisateur lance UNE impression pour toute la série.
 *
 * Lecture seule : ouvrir ou imprimer cette page n'écrit rien, ne renumérote
 * aucun document, ne crée aucun mouvement et ne touche aucun stock. Chaque bon
 * est rendu tel qu'il existe — numéro, date, produits, quantités, prix, total
 * et observations.
 *
 * Seul le NOM AFFICHÉ de l'auteur peut être substitué, pour les documents
 * issus du dernier import Excel : le compte technique qui a servi à importer
 * n'est pas l'auteur métier des bons. La colonne created_by reste intacte.
 */

type Item = {
  id: number; product_reference: string | null; product_name: string | null;
  quantity: string | number | null; unit_price: string | number | null;
  total_price: string | number | null;
};
type Doc = {
  id: number; document_number: string; document_type: string; famille: string;
  client_name: string | null; client_phone: string | null; client_address: string | null;
  total_amount: string | null; observation: string | null;
  created_by: string | null; created_at: string | null; status: string | null;
  items: Item[];
  auteur_affiche: { nom: string; fonction: string; role?: string; badge?: string; email: string };
  auteur_substitue: boolean;
  mouvement_type: string | null; mouvement_quantite: number | null;
  mouvement_statut: string | null; stock_before: string | null; stock_after: string | null;
  mouvement_emplacement: string | null; stock_movement_id: number | null;
};

const n = (v: unknown) => Number(v || 0).toLocaleString("fr-FR");
const fcfa = (v: unknown) => `${Number(v || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA`;
const fdate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR") : "—";

/* useSearchParams force le rendu client de l'arbre jusqu'à la limite Suspense
   la plus proche. Sans elle, le prérendu de cette page statique échoue. */
export default function ImpressionGroupeePage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-600">Préparation des documents…</div>}>
      <Impression />
    </Suspense>
  );
}

function Impression() {
  const search = useSearchParams();
  const ids = search?.get("ids") || "";
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [company, setCompany] = useState<Record<string, unknown>>({});
  const [totaux, setTotaux] = useState({ documents: 0, receptions: 0, sorties: 0 });
  const [error, setError] = useState("");
  const [pret, setPret] = useState(false);

  const load = useCallback(async () => {
    if (!ids) { setError("Aucun document sélectionné."); return; }
    const r = await authFetch(`/documents/print/batch?ids=${encodeURIComponent(ids)}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d?.error || "Erreur de chargement."); return; }
    setDocuments(d.documents || []);
    setCompany(d.company || {});
    setTotaux(d.totaux || { documents: 0, receptions: 0, sorties: 0 });
    setPret(true);
  }, [ids]);
  useEffect(() => { load(); }, [load]);

  /* Impression automatique à l'arrivée depuis la liste : un seul travail
     d'impression pour toute la série. */
  useEffect(() => {
    if (!pret || !documents.length || search?.get("print") !== "1") return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [pret, documents, search]);

  if (error) return <div className="p-8 font-semibold text-red-700">{error}</div>;
  if (!pret) return <div className="p-8 text-gray-600">Préparation des documents…</div>;

  const substitues = documents.filter((d) => d.auteur_substitue).length;

  return (
    <div className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      {/* Barre d'actions — jamais imprimée */}
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-4 print:hidden">
        <Link href="/documents" className="font-bold text-blue-700">← Documents</Link>
        <p className="text-sm text-gray-700">
          <span className="font-black">{n(totaux.documents)}</span> document(s) —{" "}
          {n(totaux.receptions)} réception(s), {n(totaux.sorties)} sortie(s)
          {substitues > 0 && (
            <span className="text-gray-500"> · {n(substitues)} avec auteur d&apos;import substitué</span>
          )}
        </p>
        <button onClick={() => window.print()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">
          Imprimer les {n(totaux.documents)} documents
        </button>
      </div>

      {documents.map((doc) => (
        <div key={doc.id}
             className="doc-sheet mx-auto mb-6 w-[210mm] min-h-[297mm] bg-white p-[14mm] text-black shadow
                        print:mb-0 print:min-h-0 print:w-auto print:p-0 print:shadow-none
                        print:break-after-page print:last:break-after-auto">
          <PrintableCompanyHeader
            company={company}
            documentTitle={doc.document_type || "Document"}
            documentNumber={`N° ${doc.document_number}`}
            documentDate={doc.created_at ? `Date : ${fdate(doc.created_at)}` : undefined}
          />

          <section className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            {doc.client_name && <p><span className="font-bold">Client / Fournisseur :</span> {doc.client_name}</p>}
            {doc.client_phone && <p><span className="font-bold">Téléphone :</span> {doc.client_phone}</p>}
            {doc.client_address && <p className="col-span-2"><span className="font-bold">Adresse :</span> {doc.client_address}</p>}
            <p><span className="font-bold">Statut :</span> {doc.status || "—"}</p>
            {doc.mouvement_type && (
              <p><span className="font-bold">Mouvement de stock :</span> {doc.mouvement_type}
                {doc.mouvement_quantite != null ? ` — ${n(doc.mouvement_quantite)}` : ""}
                {doc.mouvement_statut ? ` (${doc.mouvement_statut})` : ""}</p>
            )}
            {doc.mouvement_emplacement && (
              <p><span className="font-bold">Emplacement :</span> {doc.mouvement_emplacement}</p>
            )}
            {doc.stock_before != null && doc.stock_after != null && (
              <p><span className="font-bold">Stock :</span> {n(doc.stock_before)} → {n(doc.stock_after)}</p>
            )}
          </section>

          {doc.items.length > 0 && (
            <table className="mt-5 w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 p-1.5 text-left">Référence</th>
                  <th className="border border-gray-400 p-1.5 text-left">Désignation</th>
                  <th className="border border-gray-400 p-1.5 text-right">Quantité</th>
                  <th className="border border-gray-400 p-1.5 text-right">P.U.</th>
                  <th className="border border-gray-400 p-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((it) => (
                  <tr key={it.id}>
                    <td className="border border-gray-400 p-1.5">{it.product_reference || "—"}</td>
                    <td className="border border-gray-400 p-1.5">{it.product_name || "—"}</td>
                    <td className="border border-gray-400 p-1.5 text-right font-bold">{n(it.quantity)}</td>
                    <td className="border border-gray-400 p-1.5 text-right">{fcfa(it.unit_price)}</td>
                    <td className="border border-gray-400 p-1.5 text-right">{fcfa(it.total_price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-gray-400 p-1.5" colSpan={4}>TOTAL</td>
                  <td className="border border-gray-400 p-1.5 text-right">{fcfa(doc.total_amount)}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {doc.observation && (
            <section className="mt-4 text-[11px]">
              <p className="font-bold">Observations</p>
              <p className="whitespace-pre-wrap">{doc.observation}</p>
            </section>
          )}

          <section className="mt-10 grid grid-cols-2 gap-8 text-[11px]">
            <div>
              <p className="font-bold">Établi par</p>
              <p className="mt-1">{doc.auteur_affiche.nom || "—"}</p>
              {doc.auteur_affiche.fonction && <p className="text-gray-600">{doc.auteur_affiche.fonction}</p>}
              {doc.auteur_affiche.badge && (
                <p className="text-gray-600">Badge : {doc.auteur_affiche.badge}</p>
              )}
              {doc.auteur_affiche.email && <p className="text-gray-600">{doc.auteur_affiche.email}</p>}
              <div className="mt-10 border-t border-black pt-1 text-gray-600">Signature</div>
            </div>
            <div>
              <p className="font-bold">Reçu par</p>
              <div className="mt-[4.5rem] border-t border-black pt-1 text-gray-600">Nom et signature</div>
            </div>
          </section>
        </div>
      ))}
    </div>
  );
}
