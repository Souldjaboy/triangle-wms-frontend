// Synthetic fixtures are intercepted only in a local browser; no production writes.
const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const base = process.env.TWIN_TEST_URL || "http://127.0.0.1:3101";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw Error("Localhost only");
const locations = [];
for (let r = 0; r < 18; r++)
  for (let s = 1; s <= 3; s++)
    for (let l = 1; l <= 3; l++)
      for (let b = 1; b <= 3; b++) {
        const id = locations.length + 1,
          row = String.fromCharCode(65 + r);
        locations.push({
          id,
          rayon_code: row,
          case_code: String(s),
          level_code: String(l),
          bin_code: `BIN${b}`,
          full_code: `TEST-${row}-${s}-${l}-BIN${b}`,
          physical: true,
          is_active: true,
          unverified: id % 9 === 0,
        });
      }
for (let i = 0; i < 83; i++)
  locations.push({
    id: locations.length + 1,
    rayon_code: "R&I",
    case_code: "HISTORIQUE",
    level_code: "SOL",
    bin_code: `POSITION${i + 1}`,
    full_code: `TEST-HIST-${i + 1}`,
    is_active: true,
    unverified: true,
  });
const balances = locations
  .filter((l) => l.id % 3 !== 0)
  .map((l) => ({
    location_id: l.id,
    product_id: l.id,
    name: `Produit test ${l.id}`,
    reference: `REF-${l.id}`,
    unit: "carton",
    quantity: "20.5",
    reserved_quantity: "2",
    available: "18.5",
    unverified: l.unverified,
  }));
const warehouse = {
  id: 1,
  code: "TEST-MAG",
  name: "Entrepôt de test local",
  location: "Hors production",
  locations: locations.length,
  unmapped: locations.length,
  preview: [],
  configured: false,
  unallocated: 0,
};
const snapshot = {
  warehouse,
  locations,
  balances,
  nodes: [],
  layout: null,
  unmapped: [],
  unallocated: [],
  discrepancies: [],
  capabilities: { configure: true, publish: true },
  as_of: new Date().toISOString(),
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.TWIN_BROWSER_PATH || "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-gl=angle",
      "--use-angle=swiftshader",
    ],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1050 },
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
      const p = new URL(route.request().url()).pathname;
      let body = {};
      if (p.endsWith("/digital-twin/access")) body = {canView:true,canManage:true};
      else if (p.endsWith("/digital-twin/warehouses"))
        body = { warehouses: [warehouse], as_of: snapshot.as_of };
      else if (p.endsWith("/warehouses/1")) body = snapshot;
      else if (/\/locations\/\d+$/.test(p)) {
        const id = Number(p.split("/").pop());
        body = {
          location: locations.find((l) => l.id === id),
          balances: balances.filter((b) => b.location_id === id),
          movements: [],
          next_cursor: null,
        };
      } else if (p.endsWith("/search"))
        body = { results: [], next_cursor: null };
      await route.fulfill({ json: body });
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "/stocks/digital-twin");
    await page
      .getByRole("button", { name: "Explorer en 3D", exact: true })
      .click();
    await page.locator("canvas").waitFor();
    await page.waitForTimeout(3500);
    assert.equal(
      await page.locator(".dt-location-table tbody tr").count(),
      569,
    );
    await page
      .locator(".dt-scene-card")
      .screenshot({ path: "/tmp/twin-new-overview.png" });
    const visible = await page.locator(".dt-3d-label").evaluateAll((els) =>
      els
        .filter((e) => getComputedStyle(e).visibility === "visible")
        .map((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        }),
    );
    assert.ok(visible.length > 0, "Overview labels visible");
    for (let i = 0; i < visible.length; i++)
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i],
          b = visible[j];
        assert.ok(
          !(
            a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y
          ),
          "Labels overlap",
        );
      }
    await page
      .getByRole("combobox", { name: "Rayon", exact: true })
      .selectOption({ label: "A · 27 emplacements" });
    await page
      .getByRole("combobox", { name: "Étagère", exact: true })
      .selectOption({ label: "1" });
    await page.waitForTimeout(1000);
    await page
      .locator(".dt-scene-card")
      .screenshot({ path: "/tmp/twin-new-rack.png" });
    await page.getByRole("button", { name: "Zoom avant", exact: true }).click();
    await page.getByRole("button", { name: "Recentrer", exact: true }).click();
    await page
      .getByRole("button", { name: "Vue du dessus", exact: true })
      .click();
    await page.getByRole("button", { name: "Plan 2D", exact: true }).click();
    assert.equal(await page.locator(".dt-auto-bin").count(), 9);
    await page
      .getByRole("combobox", { name: "Niveau", exact: true })
      .selectOption({ label: "1" });
    assert.equal(await page.locator(".dt-auto-bin").count(), 3);
    await page.locator(".dt-auto-bin").first().click();
    await page.getByText("Produit test 1", { exact: true }).first().waitFor();
    const details = await page.locator(".dt-details").innerText();
    assert.match(details, /20,5/);
    await page.getByRole("button", { name: "Vue 3D", exact: true }).click();
    assert.match(
      await page.locator(".dt-details").innerText(),
      /TEST-A-1-1-BIN1/,
    );
    await page
      .getByRole("button", { name: "Agrandir la vue", exact: true })
      .click();
    assert.equal(await page.locator(".dt-expanded").count(), 1);
    await page.waitForTimeout(1000);
    await page
      .locator(".dt-scene-card")
      .screenshot({ path: "/tmp/twin-new-expanded.png" });
    await page
      .getByRole("button", { name: "Réduire la vue", exact: true })
      .click();
    // A committed new location appears on refresh without creating a plan.
    locations.push({
      ...locations[0],
      id: 570,
      bin_code: "NEW",
      full_code: "TEST-NEW",
    });
    await page.evaluate(() =>
      window.dispatchEvent(new Event("triangle:stock-committed")),
    );
    await page
      .getByRole("button", { name: "Vue d’ensemble", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".dt-location-table tbody tr").length === 570,
    );
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.waitForTimeout(700);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({ path: "/tmp/twin-new-tablet.png", fullPage: true });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: WebGL; 569 bins; non-overlapping labels; rayon/shelf/level; real detail; 2D/3D; camera; fullscreen; 570th location refresh; tablet.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
