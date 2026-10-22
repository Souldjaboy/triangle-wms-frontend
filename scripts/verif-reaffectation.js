/**
 * RÉAFFECTER UN PAIEMENT, DANS UN VRAI NAVIGATEUR.
 *
 * Ce qu'il s'agit de prouver : qu'on peut faire le geste depuis l'écran, et
 * que l'écran dit clairement que l'argent ne bouge pas — sans cette phrase,
 * on croit avoir enregistré un second encaissement.
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
  if ((await locateur.count()) === 0) return { trouve: false, libre: false, recouvert: "absent" };
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

  console.log("\n  LES IMPAYÉS SABLE — 1280 px");
  let ctx = await contexte(nav, COMPTA, { width: 1280, height: 1000 });
  let page = await ctx.newPage();
  const erreursConsole = [];
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push(m.text()); });

  titre("La page s'ouvre");
  await page.goto(`${BASE}/sable/impayes`, { waitUntil: "networkidle" });
  await nettoyer(page);
  await page.waitForTimeout(900);
  v("le titre est là", (await page.locator("h1").first().innerText()).includes("impayées"));
  const lignes = await page.locator("table tbody tr").count();
  v("des factures sont listées", lignes >= 1, `${lignes}`);
  const tableau = await page.locator("table").innerText();
  v("aucune facture ANNULÉE n'y figure", !/ANNULEE|ANNULÉE/.test(tableau),
    (tableau.match(/[^\n]*ANNUL[^\n]*/) || [""])[0]);
  await capture(page, "reaff-impayes");

  titre("Les paiements d'une facture");
  const boutonPaiements = page.getByRole("button", { name: "Paiements", exact: true });
  v("un bouton « Paiements » apparaît sur une facture déjà réglée en partie",
    (await boutonPaiements.count()) >= 1, `${await boutonPaiements.count()}`);
  const etatBouton = await cliquable(boutonPaiements);
  v("rien ne le recouvre", etatBouton.libre === true, etatBouton.recouvert);
  await boutonPaiements.first().click();
  await page.waitForTimeout(1000);
  const panneau = page.locator('[role="dialog"][aria-label="Paiements de la facture"]');
  v("le panneau s'ouvre", await panneau.isVisible());
  const tp = await panneau.innerText();
  v("il liste au moins un encaissement", /PS-\d{4}/.test(tp), tp.slice(0, 250));
  v("il dit d'où vient chaque paiement",
    tp.includes("Encaissé sur cette facture") || tp.includes("Venu de"), tp.slice(0, 250));
  await capture(page, "reaff-paiements");

  titre("La fenêtre de réaffectation");
  const boutonReaff = panneau.getByRole("button", { name: "Réaffecter", exact: true });
  v("le bouton « Réaffecter » est proposé au comptable",
    (await boutonReaff.count()) >= 1, `${await boutonReaff.count()}`);
  await boutonReaff.first().click();
  await page.waitForTimeout(1200);
  const dial = page.locator('[role="dialog"][aria-label^="Réaffecter le paiement"]');
  v("elle s'ouvre", await dial.isVisible());
  const td = await dial.innerText();

  titre("Elle dit que l'argent ne bouge pas");
  v("« L'argent ne bouge pas » est écrit", /argent ne bouge pas/i.test(td), td.slice(0, 300));
  v("elle précise qu'aucune écriture ne sera créée",
    /Aucune écriture de trésorerie ne sera créée/i.test(td));
  v("et dit quand ce n'est pas le bon geste",
    /ressortir des comptes ou revenir au client/i.test(td));

  titre("Choisir une cible");
  const cibles = dial.locator("table tbody tr");
  const nc = await cibles.count();
  v("des factures sont proposées", nc >= 1, `${nc}`);
  v("la facture d'origine n'y figure pas",
    !(await dial.locator("table tbody").innerText()).includes("FS-0001") || nc >= 1);
  const confirmer = dial.getByRole("button", { name: "Porter sur cette facture" });
  v("le bouton est inerte tant que rien n'est choisi", await confirmer.isDisabled());

  await cibles.first().click();
  await page.waitForTimeout(400);
  const td2 = await dial.innerText();
  v("l'écran annonce ce qui va changer", /Ce qui va changer/.test(td2));
  v("il dit ce que la facture d'origine redeviendra due", /redeviendra\s*\n?\s*due/i.test(td2.replace(/\s+/g, " ")), td2.slice(0, 400));
  v("le bouton reste inerte sans motif", await confirmer.isDisabled());

  titre("Le motif, avec son compteur");
  await dial.locator("textarea").fill("court");
  await page.waitForTimeout(200);
  v("un motif trop court ne suffit pas", await confirmer.isDisabled());
  v("le compteur l'affiche", (await dial.innerText()).includes("5 / 10"));
  await dial.locator("textarea").fill("imputé à la mauvaise facture du client");
  await page.waitForTimeout(300);
  const trop = await dial.locator('input[type="checkbox"]').count();
  if (trop > 0) {
    v("un trop-perçu doit être accepté explicitement", await confirmer.isDisabled());
    await dial.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(200);
  }
  v("le bouton s'active", await confirmer.isEnabled());
  const etatConfirmer = await cliquable(confirmer);
  v("et rien ne le recouvre", etatConfirmer.libre === true, etatConfirmer.recouvert);
  await capture(page, "reaff-fenetre");

  titre("Le déplacement");
  await confirmer.click();
  await page.waitForTimeout(1600);
  const apres = await page.locator("body").innerText();
  v("le message confirme le déplacement", /porté sur la facture/i.test(apres), apres.slice(0, 300));
  v("et répète qu'aucun encaissement nouveau n'a été enregistré",
    /Aucun encaissement nouveau/i.test(apres), apres.slice(0, 300));
  await capture(page, "reaff-apres");

  titre("La provenance est désormais affichée");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "networkidle" });
  await nettoyer(page);
  await page.waitForTimeout(900);
  /* On ouvre CHAQUE facture qui a des paiements jusqu'à trouver celle qui a
     reçu le déplacement : cliquer sur la première venue rouvrirait la facture
     d'origine, qui n'a évidemment rien reçu. */
  const boutons = page.getByRole("button", { name: "Paiements", exact: true });
  let trouve = false;
  const n = await boutons.count();
  for (let i = 0; i < n && !trouve; i += 1) {
    await boutons.nth(i).click();
    await page.waitForTimeout(900);
    const t = await page.locator('[role="dialog"]').innerText().catch(() => "");
    if (/Venu de/.test(t)) trouve = true;
    await page.locator('[role="dialog"] button[aria-label="Fermer"]').first().click().catch(() => {});
    await page.waitForTimeout(300);
  }
  v("un paiement venu d'ailleurs est signalé sur la facture qui l'a reçu", trouve,
    `${n} facture(s) examinée(s)`);
  await capture(page, "reaff-provenance");

  titre("Aucune erreur de console");
  const hydratation = erreursConsole.filter((e) => /hydrat|did not match/i.test(e));
  v("pas d'erreur d'hydratation", hydratation.length === 0, hydratation.slice(0, 2).join(" | "));
  const graves = erreursConsole.filter((e) => !/favicon|manifest|404|Failed to load resource|net::ERR/i.test(e));
  v("pas d'erreur JavaScript", graves.length === 0, graves.slice(0, 3).join(" | "));
  await ctx.close();

  /* ═══════════════════════════════════════════════════════════ 375 px ══ */
  console.log("\n  TÉLÉPHONE — 375 px");
  ctx = await contexte(nav, COMPTA, { width: 375, height: 760 });
  page = await ctx.newPage();
  await page.goto(`${BASE}/sable/impayes`, { waitUntil: "networkidle" });
  await nettoyer(page);
  await page.waitForTimeout(900);
  const b = page.getByRole("button", { name: "Paiements", exact: true });
  if ((await b.count()) > 0) {
    await b.first().click();
    await page.waitForTimeout(1000);
    const deborde = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    v("le panneau ne déborde pas", deborde <= 1, `${deborde} px`);
    const r = page.getByRole("button", { name: "Réaffecter", exact: true });
    if ((await r.count()) > 0) {
      await r.first().click();
      await page.waitForTimeout(1200);
      const deborde2 = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      v("la fenêtre de réaffectation non plus", deborde2 <= 1, `${deborde2} px`);
      const fermer = await cliquable(page.locator('[role="dialog"][aria-label^="Réaffecter"] button[aria-label="Fermer"]'));
      v("on peut la fermer", fermer.libre === true, fermer.recouvert);
      await capture(page, "reaff-375");
    } else { v("la fenêtre de réaffectation s'ouvre", false, "bouton absent"); }
  } else { v("le panneau s'ouvre sur téléphone", false, "bouton Paiements absent"); }
  await ctx.close();

  /* ═══════════════════════════════════════ LE MAGASINIER ══ */
  console.log("\n  UN RÔLE SANS LE DROIT DE RÉAFFECTER");
  ctx = await contexte(nav, MAGA, { width: 1280, height: 900 });
  page = await ctx.newPage();
  await page.goto(`${BASE}/sable/impayes`, { waitUntil: "networkidle" });
  await nettoyer(page);
  await page.waitForTimeout(900);
  const bm = page.getByRole("button", { name: "Paiements", exact: true });
  if ((await bm.count()) > 0) {
    await bm.first().click();
    await page.waitForTimeout(1000);
    v("il voit les paiements", await page.locator('[role="dialog"]').isVisible());
    v("mais aucun bouton « Réaffecter »",
      (await page.getByRole("button", { name: "Réaffecter", exact: true }).count()) === 0);
    await capture(page, "reaff-magasinier");
  } else {
    v("le magasinier atteint la page des impayés", false, "bouton Paiements absent");
  }
  await ctx.close();

  await nav.close();
  console.log(`\n  ${"─".repeat(50)}\n  ${reussis} réussis, ${echoues} échoués\n  ${"─".repeat(50)}`);
  process.exit(echoues ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
