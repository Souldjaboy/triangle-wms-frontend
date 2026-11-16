const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require("typescript");
const root = path.join(__dirname, "../app/stocks/digital-twin");
function compiled(file, types) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const m = new Module(path.join(root, file));
  m.paths = module.paths;
  const original = m.require.bind(m);
  m.require = (name) => (name === "./types" ? types : original(name));
  m._compile(output, path.join(root, file));
  return m.exports;
}
const types = compiled("types.ts");
const { automaticNodes, automaticScene, address } = compiled(
  "automatic.ts",
  types,
);
function location(id, rayon = "A", etagere = "1", level = "3", bin = "BIN1") {
  return {
    id,
    rayon_code: rayon,
    case_code: etagere,
    level_code: level,
    bin_code: bin,
    full_code: `MAG-${rayon}-${etagere}-${level}-${bin}`,
    physical: true,
    unverified: false,
    is_active: true,
  };
}
function snapshot(locations) {
  return {
    warehouse: { id: 10, code: "MAG-A" },
    locations,
    balances: [],
    nodes: [{ id: "published-plan", geometry: { width: 200 } }],
    layout: { id: 9 },
    unallocated: [],
    discrepancies: [],
  };
}
function freeze(x) {
  if (x && typeof x === "object") {
    Object.freeze(x);
    Object.values(x).forEach(freeze);
  }
  return x;
}
test("every official location is represented once, including historical composite codes", () => {
  const d = snapshot([
    location(1, "A", "1", "3", "FULLBIN"),
    location(2, "A", "1", "3", "BIN2-3"),
    location(3, "B", "1", "TOP", "BIN1"),
  ]);
  const original = JSON.stringify(d);
  freeze(d);
  const ns = automaticNodes(d),
    bins = ns.filter((n) => n.kind === "bin");
  assert.equal(bins.length, 3);
  assert.deepEqual(
    new Set(bins.map((n) => n.code)),
    new Set(["FULLBIN", "BIN2-3", "BIN1"]),
  );
  assert.equal(JSON.stringify(d), original);
  assert.equal(ns.filter((n) => n.kind === "rack").length, 2);
  assert.equal(ns.filter((n) => n.kind === "zone").length, 0);
});
test("stable bin identity survives input reordering, a new location and a renamed bin", () => {
  const a = location(7),
    b = location(9);
  const first = automaticNodes(snapshot([b, a])).find(
    (n) => n.location_id === 7,
  );
  const second = automaticNodes(
    snapshot([location(1), { ...a, bin_code: "Renommé" }, b]),
  ).find((n) => n.location_id === 7);
  assert.equal(first.id, second.id);
  assert.equal(second.code, "Renommé");
});
test("missing hierarchy is explicit and never parsed speculatively from the full code", () => {
  const l = { id: 4, full_code: "A-B-C-D" };
  assert.deepEqual(address(l), { rayon: "", etagere: "", niveau: "", bin: "" });
  const ns = automaticNodes(snapshot([l]));
  assert.equal(ns.filter((n) => n.kind === "rack")[0].code, "Non renseigné");
  assert.equal(ns.filter((n) => n.kind === "bin").length, 1);
});
test("legacy hierarchy aliases follow the stock location rules", () => {
  assert.deepEqual(
    address({ zone: "A", rayon: "2", etagere: "TOP", bin_code: "BIN1" }),
    { rayon: "A", etagere: "2", niveau: "TOP", bin: "BIN1" },
  );
});
test("real balances survive unchanged while schematic capacities remain unknown", () => {
  const d = snapshot([location(1), { ...location(2), unverified: true }]);
  d.balances = [
    {
      product_id: 5,
      location_id: 1,
      name: "Produit",
      quantity: "30.25",
      reserved_quantity: "2",
      unit: "EACH",
    },
  ];
  const ns = automaticNodes(d);
  const root = ns.find((n) => n.kind === "warehouse");
  assert.equal(root.metrics.occupied, 1);
  assert.equal(root.metrics.empty, 0);
  assert.equal(root.metrics.unverified, 1);
  for (const n of ns) {
    assert.equal(n.capacity, null);
    assert.equal(n.metrics.percent, null);
    assert.deepEqual(n.metrics.capacities, []);
  }
  assert.equal(
    ns.find((n) => n.location_id === 1).contents[0].quantity,
    "30.25",
  );
});
test("selecting a bin isolates its shelf without losing other levels of that shelf", () => {
  const ns = automaticNodes(
    snapshot([
      location(1),
      location(2, "A", "1", "TOP"),
      location(3, "A", "2", "TOP"),
    ]),
  );
  const scene = automaticScene(
    ns,
    ns.find((n) => n.location_id === 1),
  );
  assert.deepEqual(
    scene.filter((n) => n.kind === "bin").map((n) => n.location_id),
    [1, 2],
  );
  assert.equal(scene.filter((n) => n.kind === "rack").length, 1);
});
test("hundreds of bins remain selectable, with unique IDs and finite drawing geometry", () => {
  const d = snapshot(
    Array.from({ length: 569 }, (_, i) =>
      location(
        i + 1,
        "A" + Math.floor(i / 120),
        String(Math.floor(i / 12) % 10),
        String(Math.floor(i / 3) % 4),
        "BIN" + (i % 3),
      ),
    ),
  );
  const ns = automaticNodes(d);
  assert.equal(ns.filter((n) => n.kind === "bin").length, 569);
  assert.equal(new Set(ns.map((n) => n.id)).size, ns.length);
  for (const n of ns)
    assert.ok(Object.values(n.geometry).every(Number.isFinite));
  const { renderToStaticMarkup } = require("react-dom/server");
  const React = require("react");
  const Flat = compiled("Automatic2D.tsx", types).default;
  const html = renderToStaticMarkup(
    React.createElement(Flat, {
      nodes: automaticScene(ns, ns[0]),
      selected: null,
      onSelect: () => {},
      mode: "contenu",
    }),
  );
  assert.equal((html.match(/aria-label="Bin /g) || []).length, 569);
});
test("empty warehouses produce no fictional shelf or bin", () => {
  const ns = automaticNodes(snapshot([]));
  assert.equal(ns.length, 1);
  assert.equal(automaticScene(ns, ns[0]).length, 0);
});

test("compact warehouse layout, no overlapping rayon bounds and no unbounded historical strip", () => {
  const locs = Array.from({ length: 486 }, (_, i) =>
    location(
      i + 1,
      String.fromCharCode(65 + Math.floor(i / 27)),
      String((Math.floor(i / 9) % 3) + 1),
      String((Math.floor(i / 3) % 3) + 1),
      `B${(i % 3) + 1}`,
    ),
  );
  locs.push(
    ...Array.from({ length: 83 }, (_, i) =>
      location(487 + i, "R&I", "HISTORY", "SOL", `POS${i}`),
    ),
  );
  const ns = automaticNodes(snapshot(locs)),
    root = ns[0].geometry;
  assert.ok(Math.max(root.width / root.depth, root.depth / root.width) < 2.5);
  const rows = ns.filter((n) => n.kind === "aisle");
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i].geometry,
        b = rows[j].geometry;
      assert.ok(
        !(
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.z < b.z + b.depth &&
          a.z + a.depth > b.z
        ),
      );
    }
  const history = ns.find((n) => n.kind === "rack" && n.code === "HISTORY");
  assert.ok(history.geometry.width < 30);
  assert.equal(ns.filter((n) => n.kind === "bin").length, 569);
});
test("level filter shows only that official level; its bin still opens the entire shelf", () => {
  const ns = automaticNodes(
    snapshot([location(1, "A", "1", "1"), location(2, "A", "1", "2")]),
  );
  const level = ns.find((n) => n.kind === "level" && n.code === "1");
  assert.deepEqual(
    automaticScene(ns, level)
      .filter((n) => n.kind === "bin")
      .map((n) => n.location_id),
    [1],
  );
});
const { fitDistance, nonOverlappingLabels } = compiled("scene-math.ts");
test("camera fits a bounding sphere even in portrait view", () => {
  for (const aspect of [0.35, 0.7, 1, 2, 3]) {
    const d = fitDistance(100, aspect),
      angle = Math.min(Math.PI / 8, Math.atan(Math.tan(Math.PI / 8) * aspect));
    assert.ok(d * Math.sin(angle) >= 100);
  }
  assert.ok(fitDistance(100, 0.5) > fitDistance(100, 2));
});
test("screen labels stay inside viewport and selected-first labels win collisions", () => {
  const labels = [
    { id: "selected", x: 20, y: 80, width: 100, height: 25 },
    { id: "overlap", x: 30, y: 85, width: 100, height: 25 },
    { id: "other", x: 200, y: 80, width: 100, height: 25 },
    { id: "outside", x: 390, y: 80, width: 100, height: 25 },
  ];
  assert.deepEqual(
    [...nonOverlappingLabels(labels, 400, 300)],
    ["selected", "other"],
  );
});
