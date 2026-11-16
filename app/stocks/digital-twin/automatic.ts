import type { Location, PlanNode, Snapshot, Metrics } from "./types";
// Projection de lecture uniquement : aucun emplacement, plan ou stock n'est écrit.
// Les unités de dessin ne sont ni des mètres, ni des capacités physiques.
export function address(l: Location) {
  return {
    rayon: String(l.rayon_code || l.zone || "").trim(),
    etagere: String(l.case_code || l.rayon || "").trim(),
    niveau: String(l.level_code || l.etagere || "").trim(),
    bin: String(l.bin_code || "").trim(),
  };
}
export function automaticNodes(data: Snapshot): PlanNode[] {
  const nodes: PlanNode[] = [],
    byId = new Map<string, PlanNode>();
  const children = new Map<string, PlanNode[]>();
  function add(
    id: string,
    parent_id: string | null,
    kind: PlanNode["kind"],
    code: string,
    display_label: string,
  ) {
    if (byId.has(id)) return byId.get(id)!;
    const n: PlanNode = {
      id,
      parent_id,
      kind,
      code: code || "Non renseigné",
      display_label,
      name: "",
      zone_type: null,
      location_id: null,
      geometry: null,
      capacity: null,
      capacity_unit: null,
      operational_state: "active",
      schematic: true,
    };
    nodes.push(n);
    byId.set(id, n);
    if (parent_id) {
      const a = children.get(parent_id) || [];
      a.push(n);
      children.set(parent_id, a);
    }
    return n;
  }
  const rootId = "auto:" + JSON.stringify([data.warehouse.id]);
  const root = add(rootId, null, "warehouse", data.warehouse.code, "Entrepôt");
  const stock = new Map<number, Snapshot["balances"]>();
  for (const b of data.balances) {
    const a = stock.get(Number(b.location_id)) || [];
    a.push(b);
    stock.set(Number(b.location_id), a);
  }
  const sort = (a: Location, b: Location) =>
    JSON.stringify(Object.values(address(a))).localeCompare(
      JSON.stringify(Object.values(address(b))),
      "fr",
      { numeric: true },
    ) || a.id - b.id;
  for (const l of [...data.locations].sort(sort)) {
    const a = address(l),
      group = [data.warehouse.id, a.rayon];
    const row = add(
      "auto:" + JSON.stringify(group),
      rootId,
      "aisle",
      a.rayon,
      "Rayon",
    );
    group.push(a.etagere);
    const rack = add(
      "auto:" + JSON.stringify(group),
      row.id,
      "rack",
      a.etagere,
      "Étagère",
    );
    rack.name = "Rayon " + (a.rayon || "non renseigné");
    group.push(a.niveau);
    const level = add(
      "auto:" + JSON.stringify(group),
      rack.id,
      "level",
      a.niveau,
      "Niveau",
    );
    const bin = add(
      "location:" + data.warehouse.id + ":" + l.id,
      level.id,
      "bin",
      a.bin || l.full_code || l.emplacement_code,
      "Bin",
    );
    bin.location_id = l.id;
    bin.contents = stock.get(Number(l.id)) || [];
    bin.unverified =
      !!l.unverified ||
      !!l.configuration_issue ||
      bin.contents.some((b) => b.unverified);
    bin.operational_state =
      l.is_active === false || l.occupancy_status === "INACTIVE"
        ? "inactive"
        : /bloqu|quarant|maintenance/i.test(l.status || "")
          ? "blocked"
          : "active";
  }
  let z = 0,
    maxX = 1;
  for (const row of children.get(root.id) || []) {
    const racks = children.get(row.id) || [],
      cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(racks.length))));
    const widths = racks.map(
      (r) =>
        Math.max(
          1,
          ...(children.get(r.id) || []).map(
            (l) => (children.get(l.id) || []).length,
          ),
        ) *
          1.6 +
        0.6,
    );
    const columnWidth = Math.max(...widths, 2.2) + 3;
    let rowHeight = 1;
    racks.forEach((rack, index) => {
      const x = (index % cols) * columnWidth,
        rz = z + Math.floor(index / cols) * 6;
      const levels = children.get(rack.id) || [];
      levels.forEach((level, i) => {
        level.geometry = {
          x,
          y: 0.4 + i * 1.8,
          z: rz,
          width: widths[index],
          depth: 2.1,
          height: 1.5,
          yaw: 0,
        };
        (children.get(level.id) || []).forEach((bin, j) => {
          bin.geometry = {
            x: x + 0.3 + j * 1.6,
            y: 0.4 + i * 1.8,
            z: rz + 0.3,
            width: 1.3,
            depth: 1.5,
            height: 1.15,
            yaw: 0,
          };
        });
      });
      rack.geometry = {
        x,
        y: 0,
        z: rz,
        width: widths[index],
        depth: 2.1,
        height: Math.max(1, levels.length) * 1.8 + 0.2,
        yaw: 0,
      };
      rowHeight = Math.max(rowHeight, rack.geometry.height);
      maxX = Math.max(maxX, x + widths[index]);
    });
    const depth = Math.max(1, Math.ceil(racks.length / cols)) * 6;
    row.geometry = {
      x: 0,
      y: 0,
      z,
      width: cols * columnWidth - 3,
      depth: depth - 3,
      height: rowHeight,
      yaw: 0,
    };
    z += depth + 3;
  }
  root.geometry = {
    x: 0,
    y: 0,
    z: 0,
    width: maxX,
    depth: Math.max(1, z),
    height: Math.max(1, ...nodes.map((n) => n.geometry?.height || 0)),
    yaw: 0,
  };
  function summarize(n: PlanNode): Metrics {
    const ms = (children.get(n.id) || []).map(summarize),
      bs = n.contents || [];
    const m: Metrics = {
      bins: 0,
      empty: 0,
      occupied: 0,
      blocked: 0,
      reserved: 0,
      full: 0,
      overloaded: 0,
      unknown: 0,
      unverified: 0,
      percent: null,
      high_threshold: 80,
      capacities: [],
    };
    if (n.kind === "bin")
      Object.assign(m, {
        bins: 1,
        empty: !n.unverified && !bs.some((b) => Number(b.quantity) > 0) ? 1 : 0,
        occupied: bs.some((b) => Number(b.quantity) > 0) ? 1 : 0,
        blocked: n.operational_state !== "active" ? 1 : 0,
        reserved: bs.some((b) => Number(b.reserved_quantity) > 0) ? 1 : 0,
        unknown: 1,
        unverified: n.unverified ? 1 : 0,
      });
    else
      for (const child of ms)
        for (const key of [
          "bins",
          "empty",
          "occupied",
          "blocked",
          "reserved",
          "unknown",
          "unverified",
        ] as const)
          m[key] += child[key];
    n.metrics = m;
    return m;
  }
  summarize(root);
  return nodes;
}
export function automaticScene(
  nodes: PlanNode[],
  selected: PlanNode | undefined | null,
): PlanNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let focus = selected;
  if (focus?.kind === "bin") focus = byId.get(focus.parent_id!);
  if (focus?.kind === "level") focus = byId.get(focus.parent_id!);
  const bins = nodes.filter((n) => {
    if (n.kind !== "bin") return false;
    if (!focus || focus.kind === "warehouse") return true;
    let p: PlanNode | undefined = n;
    while (p) {
      if (p.id === focus.id) return true;
      p = byId.get(p.parent_id!);
    }
    return false;
  });
  const parents = new Set<string>();
  for (const b of bins) {
    const level = byId.get(b.parent_id!);
    if (level) {
      parents.add(level.id);
      if (level.parent_id) parents.add(level.parent_id);
    }
  }
  return nodes.filter((n) => parents.has(n.id) || bins.includes(n));
}
