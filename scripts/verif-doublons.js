/**
 * L'ÉCRAN DES FACTURES EN DOUBLE, DANS UN VRAI NAVIGATEUR.
 *
 * Ce qu'il s'agit de prouver avant tout : que l'écran ne pousse PAS à
 * nettoyer. Qu'il présente les signaux, dit que la suggestion n'est qu'un
 * classement, et n'offre nulle part un bouton « tout traiter ».
 */
const { chromium } = require("playwright-core");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const BASE = process.env.BASE || "http://localhost:3000";
const SECRET = process.env.SECRET || "test_integration";
const SORTIE = process.env.SORTIE;
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let reussis = 0, echoues = 0;
const v = (n, c, d = "") => {
  if (c) { reussis += 1; console.log(`    ✓ ${n}`); }
  else { echoues += 1; console.log(`    ✗ ${n}${d ? `\n        → ${d}` : ""}`); }
};
const titre = (t) => console.log(`\n  ── ${t}`);
const jeton = (u) => jwt.sign({ ...u, tenant_id: "triangle" }, SECRET, { expiresIn: "2h" });

const DIR = { id: 904, fullname: "Direction Triangle", email: "dir.tri@t.local",
              role: "direction", company_id: 1, is_super_admin: false };
const COMPTA = { id: 903, fullname: "Comptable Triangle", email: "compta.tri@t.local",
                 role: "comptable", company_id: 1, is_super_admin: false };
const MAGA = { id: 905, fullname: "Magasinier Triangle", email: "mag.tri@t.local",
               role: "magasinier", company_id: 1, is_super_admin: false };

async function contexte(nav, user, viewport) {
  const t = jeton(user);
  const ctx = await nav.newContext({ viewport, locale: "fr-FR", timezoneId: "Africa/Bamako" });
  await ctx.addCookies([
    { name: "triangle_token", value: t, url: BASE },
    { name: "triangle_business_token", value: t, url: BASE },
  ]);
  await ctx.addInitScript(([jet, u]) => {
    localStorage.setItem("token", jet);
    localStorage.setItem("business_token", jet);
    localStorage.setItem("user", JSON.stringify(u));
  }, [t, user]);
  return ctx;
}
const nettoyer = (page) => page.evaluate(() => {
  document.querySelectorAll("*").forEach((n) => {
    const z = Number(getComputedStyle(n).zIndex || 0);
    if (z >= 9000 && n.tagName !== "BODY") n.remove();
  });
});
const capture = async (page, nom) => {
  if (!SORTIE) return;
  fs.mkdirSync(SORTIE, { recursive: true });
  await page.screenshot({ path: `${SORTIE}/${nom}.png`, fullPage: true });
};
async function cliquable(locateur) {
  if ((await locateur.count()) === 0) return { libre: false, recouvert: "absent" };
  return locateur.first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { libre: false, recouvert: "invisible" };
    const d = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { libre: !!d && (el.contains(d) || d.contains(el)),
             recouvert: d ? `${d.tagName}.${String(d.className).slice(0, 40)}` : "rien" };
  });
}

(async () => {
  const nav = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });

  console.log("\n  LE COMPTABLE — 1280 px");
  let ctx = await contexte(nav, COMPTA, { width: 1280, height: 1200 });
  let page = await ctx.newPage();
  const erreursConsole = [];
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push(m.text()); });

  await page.goto(`${BASE}/factures-doublons`, { waitUntil: "networkidle" });
  await nettoyer(page);
  await page.waitForTimeout(1000);

  titre("La page s'ouvre");
  v("le titre est là", (await page.locator("h1").first().innerText()).includes("se ressemblent"));
  const corps = await page.locator("body").innerText();
  v("l'avertissement est en tête",
    /ne sont pas un doublon/.test(corps), corps.slice(0, 300));
  v("il nomme les cas légitimes", /abonnement, une location/.test(corps));
  await capture(page, "doublons-liste");

  titre("CE QUI NE DOIT PAS EXISTER");
  for (const mot of ["Tout nettoyer", "Supprimer tout", "Nettoyer les doublons", "Tout traiter"]) {
    v(`aucun bouton « ${mot} »`,
      (await page.getByRole("button", { name: mot }).count()) === 0);
  }
  v("aucune case « tout cocher »",
    (await page.locator('input[type="checkbox"][aria-label*="out"]').count()) === 0);

  titre("Les paires et leurs signaux");
  const cartes = page.locator("div.rounded.border.bg-white");
  const n = await cartes.count();
  v("des paires sont affichées", n >= 4, `${n}`);
  v("chaque suggestion est présentée comme telle",
    /la décision vous revient/.test(corps), corps.slice(0, 500));
  v("un renouvellement est reconnu à l'écran", /Renouvellement/.test(corps));
  v("un doublon aussi", /Doublon/.test(corps));
  v("et des factures distinctes", /Factures distinctes/.test(corps));
  v("les signaux sont écrits en clair",
    /série régulière|même vente|Émises le même jour/i.test(corps), corps.slice(0, 700));

  titre("Trancher");
  const trancher = page.getByRole("button", { name: "Trancher", exact: true });
  v("le comptable peut trancher", (await trancher.count()) >= 1, `${await trancher.count()}`);
  const et = await cliquable(trancher);
  v("rien ne recouvre le bouton", et.libre === true, et.recouvert);
  await trancher.first().click();
  await page.waitForTimeout(600);
  const dial = page.locator('[role="dialog"][aria-label="Trancher sur la paire"]');
  v("la fenêtre s'ouvre", await dial.isVisible());
  const td = await dial.innerText();
  v("elle dit que rien ne sera modifié", /Rien ne sera modifié/.test(td), td.slice(0, 300));
  v("les trois réponses sont proposées",
    /Doublon/.test(td) && /Renouvellement/.test(td) && /Factures distinctes/.test(td));
  v("chacune est expliquée", /Les deux sont dues/.test(td));
  const valider = dial.getByRole("button", { name: "Enregistrer le verdict" });
  v("le bouton est inerte sans motif", await valider.isDisabled());
  await dial.locator("textarea").fill("court");
  await page.waitForTimeout(200);
  v("et le reste avec un motif trop court", await valider.isDisabled());
  v("le compteur l'affiche", (await dial.innerText()).includes("5 / 10"));
  await dial.locator("textarea").fill("deux factures pour la même vente");
  await page.waitForTimeout(200);
  v("il s'active une fois le motif suffisant", await valider.isEnabled());
  await capture(page, "doublons-trancher");
  await valider.click();
  await page.waitForTimeout(1500);
  const apres = await page.locator("body").innerText();
  v("le message dit qu'aucune facture n'a été modifiée",
    /Aucune facture n'a été modifiée/.test(apres), apres.slice(0, 300));

  titre("Le comptable ne neutralise pas");
  await page.getByRole("button", { name: /Décisions/ }).click();
  await page.waitForTimeout(900);
  v("il voit la décision", /Doublon/.test(await page.locator("body").innerText()));
  v("mais aucun bouton « Neutraliser »",
    (await page.getByRole("button", { name: /Neutraliser/ }).count()) === 0);
  await capture(page, "doublons-decisions-comptable");
  await ctx.close();

  /* ══════════════════════════════════════════ LA DIRECTION ══ */
  console.log("\n  LA DIRECTION");
  ctx = await contexte(nav, DIR, { width: 1280, height: 1200 });
  page = await ctx.newPage();
  await page.goto(`${BASE}/factures-doublons`, { waitUntil: "networkidle" });
  await nettoyer(page);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /Décisions/ }).click();
  await page.waitForTimeout(900);
  const corpsDir = await page.locator("body").innerText();
  v("elle voit que des doublons attendent",
    /attendent d'être\s*neutralisés/.test(corpsDir.replace(/\s+/g, " ")), corpsDir.slice(0, 400));
  const neutraliser = page.getByRole("button", { name: /Neutraliser le doublon/ });
  v("elle peut neutraliser", (await neutraliser.count()) >= 1, `${await neutraliser.count()}`);
  await neutraliser.first().click();
  await page.waitForTimeout(700);
  const dial2 = page.locator('[role="dialog"][aria-label="Neutraliser le doublon"]');
  v("la fenêtre s'ouvre", await dial2.isVisible());
  const td2 = await dial2.innerText();
  v("elle demande laquelle fait foi", /Laquelle fait foi/.test(td2));
  v("elle dit qu'aucune écriture ne sera créée",
    /Aucune écriture de trésorerie ne sera créée/.test(td2), td2.slice(0, 400));
  v("elle avertit du double paiement",
    /le client a payé deux fois/.test(td2), td2.slice(0, 600));
  const confirmer = dial2.getByRole("button", { name: "Neutraliser le doublon" });
  v("le bouton est inerte sans choix ni motif", await confirmer.isDisabled());
  await dial2.locator('input[type="radio"]').first().check();
  await dial2.locator("textarea").fill("saisie en double de la même vente");
  await page.waitForTimeout(300);
  v("il s'active une fois les deux donnés", await confirmer.isEnabled());
  await capture(page, "doublons-neutraliser");
  await confirmer.click();
  await page.waitForTimeout(1800);
  const final = await page.locator("body").innerText();
  v("le message confirme la neutralisation",
    /neutralisée au profit de/.test(final), final.slice(0, 400));
  v("et répète qu'aucune écriture n'a été créée",
    /Aucune écriture de trésorerie/.test(final) || /Aucun encaissement à déplacer/.test(final),
    final.slice(0, 400));
  await capture(page, "doublons-apres");

  titre("Aucune erreur de console");
  const hydratation = erreursConsole.filter((e) => /hydrat|did not match/i.test(e));
  v("pas d'erreur d'hydratation", hydratation.length === 0, hydratation.slice(0, 2).join(" | "));
  await ctx.close();

  /* ══════════════════════════════════════════ 375 px ══ */
  console.log("\n  TÉLÉPHONE — 375 px");
  ctx = await contexte(nav, DIR, { width: 375, height: 760 });
  page = await ctx.newPage();
  await page.goto(`${BASE}/factures-doublons`, { waitUntil: "networkidle" });
  await nettoyer(page);
  await page.waitForTimeout(1000);
  const deborde = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  v("la page ne déborde pas", deborde <= 1, `${deborde} px`);
  v("les deux factures d'une paire s'empilent",
    await page.locator("h1").first().isVisible());
  await capture(page, "doublons-375");
  await ctx.close();

  /* ══════════════════════════════════════════ LE MAGASINIER ══ */
  console.log("\n  LE MAGASINIER");
  ctx = await contexte(nav, MAGA, { width: 1280, height: 900 });
  page = await ctx.newPage();
  await page.goto(`${BASE}/factures-doublons`, { waitUntil: "networkidle" });
  await nettoyer(page);
  await page.waitForTimeout(1000);
  v("aucun bouton « Trancher »",
    (await page.getByRole("button", { name: "Trancher", exact: true }).count()) === 0);
  v("aucun bouton « Neutraliser »",
    (await page.getByRole("button", { name: /Neutraliser/ }).count()) === 0);
  await capture(page, "doublons-magasinier");
  await ctx.close();

  await nav.close();
  console.log(`\n  ${"─".repeat(50)}\n  ${reussis} réussis, ${echoues} échoués\n  ${"─".repeat(50)}`);
  process.exit(echoues ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
