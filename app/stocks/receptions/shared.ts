/**
 * Types et formats partagés par les écrans de réception.
 *
 * Règle affichée partout : RÉCEPTION ≠ STOCK. Une quantité reçue reste « en
 * attente de rangement » tant qu'elle n'est pas mise en stock, et n'est jamais
 * additionnée au stock disponible.
 */

export type ReceptionRow = {
  id: number;
  reception_number: string;
  container_number: string | null;
  reception_date: string | null;
  status: string;
  status_label: string;
  warehouses: string | null;
  line_count: number;
  quantity_received: string;
  quantity_putaway: string;
  quantity_pending: string;
  to_review: number;
  source: string | null;
  source_file: string | null;
  notes: string | null;
  created_by_name: string | null;
};

export type ReceptionLine = {
  id: number;
  line_no: number;
  received_label: string;
  product_id: number | null;
  product_name: string | null;
  product_stock: number | null;
  match_status: string;
  unit: string;
  warehouse_code: string | null;
  quantity_received: string;
  quantity_putaway: string;
  quantity_remaining: string;
  excel_sheet: string | null;
  excel_row: number | null;
};

export type ReceptionDetail = {
  reception: ReceptionRow;
  lines: ReceptionLine[];
  totals: { lines: number; received: string; putaway: string; pending: string; to_review: number };
};

export type Suggestion = {
  id: number; name: string; reference: string | null;
  stock: number | null; unit: string | null; category: string | null;
  warehouse: string | null; score: number;
};

export type Putaway = {
  id: number; quantity: string; stock_before: string | null; stock_after: string | null;
  warehouse_code: string | null; location_code: string | null;
  product_name: string | null; product_reference: string | null;
  received_label: string | null; unit: string | null; line_no: number | null;
  reception_number: string | null; container_number: string | null; reception_date: string | null;
  created_by_name: string | null; created_at: string;
};

export const n = (v: unknown) => Number(v || 0).toLocaleString("fr-FR");

/* Une date « AAAA-MM-JJ » est affichée telle quelle : la repasser par
   new Date() la ferait basculer en UTC et afficher la veille. */
export const fdate = (d: string | null | undefined) => {
  if (!d) return "—";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
};

export const fdatetime = (d: string | null | undefined) => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? String(d)
    : `${dt.toLocaleDateString("fr-FR")} ${dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};

export const STATUS_TONE: Record<string, string> = {
  RECEIVED_PENDING_PUTAWAY: "bg-amber-100 text-amber-900",
  PARTIALLY_PUTAWAY: "bg-blue-100 text-blue-800",
  PUTAWAY_COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-200 text-gray-700",
};

export const MATCH_TONE: Record<string, string> = {
  MATCH_EXISTING: "bg-green-100 text-green-800",
  CREATE_NEW_PRODUCT: "bg-indigo-100 text-indigo-800",
  TO_REVIEW: "bg-amber-100 text-amber-900",
};

export const MATCH_LABEL: Record<string, string> = {
  MATCH_EXISTING: "Associé",
  CREATE_NEW_PRODUCT: "Nouveau produit",
  TO_REVIEW: "À vérifier",
};

/** Emplacement normalisé ROW / LOCATION / LEVEL / BIN, comme le reste du WMS. */
export function buildLocationCode(
  warehouse: string,
  parts: { row?: string; location?: string; level?: string; bin?: string }
) {
  const seg = [parts.row, parts.location, parts.level, parts.bin]
    .map((s) => String(s || "").trim().toUpperCase())
    .filter(Boolean);
  if (!seg.length) return "";
  return [String(warehouse || "").trim().toUpperCase(), ...seg].filter(Boolean).join("-");
}
