import PrintableCompanyHeader from "./PrintableCompanyHeader";

const n = (value: unknown) => Number(value || 0).toLocaleString("fr-FR");
const fcfa = (value: unknown) =>
  `${Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA`;
const fdate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("fr-FR") : "—";

export default function OfficialDocumentSheet({
  doc,
  company,
  className = "",
}: {
  doc: any;
  company: Record<string, unknown>;
  className?: string;
}) {
  return (
    <div
      className={`doc-sheet mx-auto w-[210mm] min-h-[297mm] bg-white p-[14mm] text-black shadow
                  print:min-h-0 print:w-auto print:p-0 print:shadow-none ${className}`}
    >
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

      {doc.items?.length > 0 && (
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
            {doc.items.map((item: any) => (
              <tr key={item.id}>
                <td className="border border-gray-400 p-1.5">{item.product_reference || "—"}</td>
                <td className="border border-gray-400 p-1.5">{item.product_name || "—"}</td>
                <td className="border border-gray-400 p-1.5 text-right font-bold">{n(item.quantity)}</td>
                <td className="border border-gray-400 p-1.5 text-right">{fcfa(item.unit_price)}</td>
                <td className="border border-gray-400 p-1.5 text-right">{fcfa(item.total_price)}</td>
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

      {doc.observation && doc.observation.trim() && (
        <section className="mt-4 text-[11px]">
          <p className="font-bold">Observations</p>
          <p className="whitespace-pre-wrap">{doc.observation}</p>
        </section>
      )}

      <section className="mt-10 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <p className="font-bold">Établi par</p>
          <p className="mt-1">{doc.auteur_affiche?.nom || "—"}</p>
          {doc.auteur_affiche?.fonction && <p className="text-gray-600">{doc.auteur_affiche.fonction}</p>}
          {doc.auteur_affiche?.badge && <p className="text-gray-600">Badge : {doc.auteur_affiche.badge}</p>}
          {doc.auteur_affiche?.email && <p className="text-gray-600">{doc.auteur_affiche.email}</p>}
          <div className="mt-10 border-t border-black pt-1 text-gray-600">Signature</div>
        </div>
        <div>
          <p className="font-bold">Reçu par</p>
          <div className="mt-[4.5rem] border-t border-black pt-1 text-gray-600">Nom et signature</div>
        </div>
      </section>
    </div>
  );
}
