// Fixtures exclusivement locales : jamais envoyées au backend ni à PostgreSQL.
const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const base = process.env.TWIN_TEST_URL || "http://127.0.0.1:3101";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw Error("Ce test est réservé à localhost.");
const metrics = {
  bins: 1,
  occupied: 1,
  empty: 0,
  blocked: 0,
  reserved: 1,
  full: 0,
  overloaded: 0,
  unknown: 0,
  unverified: 0,
  percent: 20,
  high_threshold: 80,
  capacities: [
    {
      unit: "carton",
      capacity: 100,
      used: 20,
      available: 80,
      percent: 20,
      bins: 1,
    },
  ],
};
let parent = null;
const nodes = ["warehouse", "zone", "aisle", "rack", "level", "bin"].map(
  (kind, i) => {
    const id = `00000000-0000-4000-8000-00000000000${i + 1}`;
    const n = {
      id,
      parent_id: parent,
      kind,
      code: [
        "TEST-MAG",
        "TEST-Z01",
        "TEST-A01",
        "TEST-R01",
        "TEST-N01",
        "TEST-B01",
      ][i],
      name: "",
      zone_type: null,
      location_id: kind === "bin" ? 1 : null,
      geometry: { x: 0, y: 0, z: 0, width: 10, height: 5, depth: 6, yaw: 0 },
      capacity: kind === "bin" ? 100 : null,
      capacity_unit: kind === "bin" ? "carton" : null,
      operational_state: "active",
      effective_state: "active",
      metrics,
    };
    parent = id;
    return n;
  },
);
const warehouse = {
  id: 1,
  code: "TEST-MAG",
  name: "Entrepôt de test — hors production",
  location: "Site de test",
  status: "Actif",
  metrics,
  zones: 1,
  aisles: 1,
  racks: 1,
  configured: true,
  unmapped: 0,
  unallocated: 0,
  locations: 1,
  preview: [],
};
const balances = [
  {
    location_id: 1,
    product_id: 1,
    name: "Produit de test",
    reference: "TEST-REF",
    unit: "carton",
    quantity: "20",
    reserved_quantity: "5",
    available: "15",
    barcode: "123",
    category: "",
  },
];
const location = {
  id: 1,
  full_code: "TEST-MAG/TEST-Z01/TEST-A01/TEST-R01/TEST-N01/TEST-B01",
  emplacement_code: "TEST-B01",
  bin_code: "TEST-B01",
  physical: true,
  unverified: false,
  is_active: true,
  occupancy_status: "OCCUPIED",
  configuration_issue: null,
};
const snapshot = {
  warehouse,
  layout: { id: "1", base_id: null, high_threshold: 80 },
  nodes,
  balances,
  locations: [location],
  unmapped: [],
  unallocated: [],
  capabilities: { configure: true, publish: true },
  as_of: new Date().toISOString(),
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.TWIN_BROWSER_PATH || undefined,
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const token =
      "test." +
      Buffer.from(JSON.stringify({ role: "admin", company_id: 1 })).toString(
        "base64url",
      ) +
      ".fixture";
    await context.addCookies([
      { name: "triangle_business_token", value: token, url: base },
    ]);
    await context.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let body = {};
      if (path.endsWith("/digital-twin/warehouses"))
        body = { warehouses: [warehouse], as_of: snapshot.as_of };
      else if (path.endsWith("/layouts")) body = [];
      else if (path.includes("/locations/1"))
        body = {
          location,
          balances,
          movements: [
            {
              id: 1,
              type: "Entrée",
              quantity: 20,
              status: "Validé",
              product_name: "Produit de test",
              created_at: snapshot.as_of,
            },
          ],
          next_cursor: null,
          lots_serials: "Traçabilité à vérifier",
        };
      else if (path.endsWith("/warehouses/1")) body = snapshot;
      else if (path.endsWith("/search"))
        body = {
          results: [
            {
              location_id: 1,
              warehouse_id: 1,
              full_code: location.full_code,
              products: balances,
            },
          ],
          next_cursor: null,
        };
      await route.fulfill({ json: body });
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/stocks/digital-twin");
    await page
      .getByRole("heading", { name: "Vos entrepôts, en un regard" })
      .waitFor();
    await page.getByText(warehouse.name, { exact: true }).waitFor();
    await page.screenshot({ path: "/tmp/twin-overview.png", fullPage: true });
    await page.getByRole("button", { name: "Plan 2D", exact: true }).click();
    await page
      .getByRole("heading", { name: warehouse.name, exact: true })
      .waitFor();
    for (const code of [
      "TEST-Z01",
      "TEST-A01",
      "TEST-R01",
      "TEST-N01",
      "TEST-B01",
    ])
      await page
        .locator(".dt-zone")
        .filter({ has: page.getByText(code, { exact: true }) })
        .click();
    await page.getByText("Produit de test", { exact: true }).first().waitFor();
    assert.match(
      await page.locator(".dt-details").innerText(),
      /15 disponibles/,
    );
    await page.getByRole("button", { name: "Vue 3D", exact: true }).click();
    await page.waitForTimeout(2000);
    assert.match(await page.locator(".dt-details").innerText(), /TEST-B01/);
    await page.screenshot({ path: "/tmp/twin-bin-3d.png", fullPage: true });
    await page.getByRole("button", { name: "Plan 2D", exact: true }).click();
    assert.match(await page.locator(".dt-details").innerText(), /TEST-B01/);
    await page
      .getByRole("textbox", { name: "Rechercher un produit ou un emplacement" })
      .fill("TEST-REF");
    await page
      .locator(".dt-search-results button")
      .filter({ hasText: "TEST-MAG/" })
      .click();
    await page
      .getByRole("button", { name: "Configurer le plan", exact: true })
      .click();
    await page.getByRole("heading", { name: /Configurer/ }).waitFor();
    await page
      .getByRole("button", { name: "7. Validation", exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: "Publier le plan validé" })
        .isDisabled(),
      true,
    );
    await page
      .getByRole("button", { name: "Fermer", exact: true })
      .last()
      .click();
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.screenshot({ path: "/tmp/twin-tablet.png", fullPage: true });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: navigation entrepôt → zone → allée → rack → niveau → bin; détail; 2D/3D; recherche; validation; tablette.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
