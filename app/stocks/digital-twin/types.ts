export type Kind = "warehouse" | "zone" | "aisle" | "rack" | "level" | "bin";
export type Geometry = {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  yaw: number;
};
export type Capacity = {
  unit: string;
  capacity: number;
  used: number | null;
  available: number | null;
  percent: number | null;
  bins: number;
};
export type Metrics = {
  bins: number;
  empty: number;
  occupied: number;
  blocked: number;
  reserved: number;
  full: number;
  overloaded: number;
  unknown: number;
  unverified: number;
  percent: number | null;
  high_threshold: number;
  capacities: Capacity[];
};
export type PlanNode = {
  schematic?: boolean;
  display_label?: string;
  contents?: Balance[];
  id: string;
  parent_id: string | null;
  kind: Kind;
  code: string;
  name: string;
  zone_type: string | null;
  location_id: number | null;
  geometry: Geometry | null;
  capacity: number | null;
  capacity_unit: string | null;
  operational_state: string;
  effective_state?: string;
  unverified?: boolean;
  metrics?: Metrics;
};
export type Warehouse = {
  id: number;
  code: string;
  name: string;
  location: string;
  status: string;
  metrics: Metrics | null;
  zones: number;
  racks: number;
  aisles: number;
  configured: boolean;
  unmapped: number;
  unallocated: number;
  discrepancies: number;
  locations: number;
  preview: {
    id: string;
    code: string;
    geometry: Geometry | null;
    metrics: Metrics;
  }[];
};
export type Balance = {
  unverified?: boolean;
  location_id: number;
  product_id: number;
  name: string;
  reference: string;
  unit: string;
  quantity: string;
  reserved_quantity: string;
  available: string;
  barcode: string;
  category: string;
};
export type Location = {
  rayon_code?: string;
  case_code?: string;
  level_code?: string;
  zone?: string;
  rayon?: string;
  etagere?: string;
  status?: string;
  id: number;
  full_code: string;
  emplacement_code: string;
  bin_code: string;
  physical: boolean;
  unverified: boolean;
  is_active: boolean;
  occupancy_status: string;
  configuration_issue: string | null;
};
export type Snapshot = {
  warehouse: Warehouse;
  layout: { id: string; base_id: string | null; high_threshold: number } | null;
  nodes: PlanNode[];
  balances: Balance[];
  locations: Location[];
  unmapped: number[];
  unallocated: { id: number; name: string; stock: string }[];
  discrepancies: {
    id: number;
    name: string;
    reference: string;
    location_id: number | null;
  }[];
  capabilities: { configure: boolean; publish: boolean };
  as_of: string;
};
export type ColorMode =
  "contenu" | "occupation" | "disponibilite" | "etat" | "alertes";
export const labels: Record<Kind, string> = {
  warehouse: "Entrepôt",
  zone: "Zone",
  aisle: "Allée",
  rack: "Rack",
  level: "Niveau",
  bin: "Bin",
};
export const stateLabels: Record<string, string> = {
  active: "Actif",
  blocked: "Bloqué",
  quarantine: "Quarantaine",
  maintenance: "Maintenance",
  inactive: "Inactif",
};
export const format = (v: unknown) =>
  typeof v === "number" || typeof v === "string"
    ? Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 1 })
    : "—";
export const quantityText = (v: string | number) => String(v).replace(".", ",");
export function color(n: PlanNode, mode: ColorMode) {
  const m = n.metrics,
    state = n.effective_state || n.operational_state;
  if (mode === "contenu") {
    if (state !== "active" || m?.blocked) return "#8b5cc7";
    if (m?.unverified) return "#d5a52a";
    if (m?.reserved) return "#3988dc";
    return m?.occupied ? "#16a37d" : "#bbc4cf";
  }
  if (mode === "etat") return state === "active" ? "#16a37d" : "#8b5cc7";
  if (mode === "alertes")
    return m?.overloaded
      ? "#df4c59"
      : m?.unknown || m?.unverified
        ? "#eab849"
        : "#16a37d";
  if (mode === "disponibilite") {
    if (state !== "active" || m?.blocked) return "#8b5cc7";
    if (m?.reserved) return "#3988dc";
    if (m?.percent != null && m.percent >= 100) return "#df4c59";
    return m?.unknown ? "#8997aa" : "#16a37d";
  }
  if (!m || m.unverified || m.percent === null) return "#8997aa";
  if (m.percent === 0) return "#bbc4cf";
  if (m.percent >= 100) return "#df4c59";
  if (m.percent >= m.high_threshold) return "#eab849";
  return "#16a37d";
}
export function descendants(nodes: PlanNode[], id: string): PlanNode[] {
  const out: PlanNode[] = [];
  const children = nodes.filter((n) => n.parent_id === id);
  for (const n of children) {
    out.push(n, ...descendants(nodes, n.id));
  }
  return out;
}
