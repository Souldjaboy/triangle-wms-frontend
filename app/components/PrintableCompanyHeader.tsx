"use client";

export default function PrintableCompanyHeader({
  company,
  documentTitle,
  documentNumber,
  documentDate,
}: {
  company: any;
  documentTitle: string;
  documentNumber?: string;
  documentDate?: string;
}) {
  return (
    <header className="flex items-start justify-between gap-8 border-b-2 border-black pb-5">
      <div className="flex items-start gap-4">
        {company?.logo_url && (
          <img
            src={company.logo_url}
            alt="Logo entreprise"
            className="max-h-24 max-w-40 object-contain"
          />
        )}

        <div>
          <h1 className="text-xl font-black">
            {company?.company_name || company?.name || "Entreprise"}
          </h1>

          {company?.slogan && (
            <p className="font-semibold text-gray-700">{company.slogan}</p>
          )}

          {company?.address && (
            <p className="mt-1 text-sm text-gray-600">{company.address}</p>
          )}

          {(company?.phone || company?.email) && (
            <p className="text-sm text-gray-600">
              {company?.phone ? `Tél : ${company.phone}` : ""}
              {company?.phone && company?.email ? " | " : ""}
              {company?.email || ""}
            </p>
          )}

          {company?.website && (
            <p className="text-sm text-gray-600">{company.website}</p>
          )}
        </div>
      </div>

      <div className="text-right">
        <h2 className="text-2xl font-black uppercase">{documentTitle}</h2>

        {documentNumber && (
          <p className="mt-2 font-bold">{documentNumber}</p>
        )}

        {documentDate && (
          <p className="text-sm text-gray-500">{documentDate}</p>
        )}
      </div>
    </header>
  );
}
