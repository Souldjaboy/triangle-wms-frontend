"use client";

/**
 * Statut d'une facture de vente, en français et coloré.
 * Le statut vient TOUJOURS du serveur : il est calculé à partir des paiements
 * réellement enregistrés, jamais choisi par un utilisateur.
 */

const STYLES: Record<string, { label: string; className: string }> = {
  IMPAYEE: { label: "IMPAYÉE", className: "bg-red-100 text-red-800" },
  PARTIELLEMENT_PAYEE: { label: "PARTIELLEMENT PAYÉE", className: "bg-orange-100 text-orange-800" },
  PAYEE: { label: "PAYÉE", className: "bg-green-100 text-green-800" },
};

export default function StatutFactureBadge({ status }: { status?: string | null }) {
  const key = String(status || "").toUpperCase();
  const s = STYLES[key] || { label: key.replace(/_/g, " ") || "—", className: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${s.className}`}>
      {s.label}
    </span>
  );
}
