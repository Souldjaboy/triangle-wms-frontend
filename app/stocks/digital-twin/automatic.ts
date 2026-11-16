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
  // Compact drawing layout. Wrapping preserves official levels and bin IDs.
  const rows = children.get(root.id) || [];
  for (const row of rows) {
    const racks = children.get(row.id) || [];
    const cols = Math.max(1, Math.ceil(Math.sqrt(racks.length)));
    const sizes = racks.map((r) => {
      const levels = children.get(r.id) || [];
      const count = Math.max(
        1,
        ...levels.map((l) => (children.get(l.id) || []).length),
      );
      const columns = count <= 8 ? count : Math.ceil(Math.sqrt(count * 2));
      return {
        columns,
        width: columns * 1.6 + 0.6,
        depth: Math.ceil(count / columns) * 2 + 0.4,
        height: Math.max(1, levels.length) * 1.8 + 0.2,
      };
    });
    const cw = Math.max(1, ...sizes.map((s) => s.width)) + 3.5;
    const cd = Math.max(1, ...sizes.map((s) => s.depth)) + 4;
    racks.forEach((rack, i) => {
      const s = sizes[i],
        x = (i % cols) * cw,
        z = Math.floor(i / cols) * cd;
      rack.geometry = {
        x,
        y: 0,
        z,
        width: s.width,
        depth: s.depth,
        height: s.height,
        yaw: 0,
      };
      (children.get(rack.id) || []).forEach((level, j) => {
        level.geometry = { ...rack.geometry!, y: 0.4 + j * 1.8, height: 1.5 };
        (children.get(level.id) || []).forEach((bin, k) => {
          bin.geometry = {
            x: x + 0.3 + (k % s.columns) * 1.6,
            y: 0.4 + j * 1.8,
            z: z + 0.3 + Math.floor(k / s.columns) * 2,
            width: 1.3,
            depth: 1.5,
            height: 1.15,
            yaw: 0,
          };
        });
      });
    });
    row.geometry = {
      x: 0,
      y: 0,
      z: 0,
      width: cols * cw - 3.5,
      depth: Math.ceil(racks.length / cols) * cd - 4,
      height: Math.max(1, ...sizes.map((s) => s.height)),
      yaw: 0,
    };
  }
  const target = Math.max(
    1,
    ...rows.map((r) => r.geometry!.width),
    Math.sqrt(
      rows.reduce(
        (sum, r) => sum + (r.geometry!.width + 6) * (r.geometry!.depth + 6),
        0,
      ),
    ) * 1.15,
  );
  let x = 0,
    z = 0,
    bandDepth = 0,
    maxX = 1,
    maxZ = 1;
  for (const row of rows) {
    const g = row.geometry!;
    if (x > 0 && x + g.width > target) {
      x = 0;
      z += bandDepth + 6;
      bandDepth = 0;
    }
    function translate(n: PlanNode) {
      if (n.geometry) {
        n.geometry.x += x;
        n.geometry.z += z;
      }
      for (const child of children.get(n.id) || []) translate(child);
    }
    translate(row);
    maxX = Math.max(maxX, x + g.width);
    maxZ = Math.max(maxZ, z + g.depth);
    x += g.width + 6;
    bandDepth = Math.max(bandDepth, g.depth);
  }
  root.geometry = {
    x: 0,
    y: 0,
    z: 0,
    width: maxX,
    depth: maxZ,
    height: Math.max(1, ...rows.map((r) => r.geometry!.height)),
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
  if (focus?.kind === "bin") {
    focus = byId.get(focus.parent_id!);
    if (focus?.kind === "level") focus = byId.get(focus.parent_id!);
  }
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
  const rows = new Set(
    nodes
      .filter((n) => parents.has(n.id) && n.kind === "rack")
      .map((n) => n.parent_id),
  );
  return nodes.filter(
    (n) => parents.has(n.id) || bins.includes(n) || rows.has(n.id),
  );
}
