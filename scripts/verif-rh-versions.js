/**
 * LE REGISTRE DU PERSONNEL : VERSIONS, ARCHIVE, ANNULATION — AU NAVIGATEUR.
 *
 * Ce qu'il s'agit de prouver : que l'écran montre l'état réel de chaque
 * pièce, qu'on peut lire la chaîne des versions, et qu'annuler exige un
 * motif et prévient que le salarié détient peut-être déjà le document.
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

const SUPER = { id: 900, fullname: "Super Triangle", email: "sup.tri@t.local",
                role: "super_admin", company_id: 1, is_super_admin: true };
const RH = { id: 908, fullname: "Assistante RH", email: "rh@t.local",
             role: "assistant_rh", company_id: 1, is_super_admin: false };

async function contexte(nav, user, viewport) {
  const t = jeton(user);
  const ctx = await nav.newContext({ viewport, locale: "fr-FR", timezoneId: "Africa/Bamako" });
  await ctx.addCookies([
    { name: "triangle_token", value: t, url: BASE },
    { name: "triangle_business_token", value: t, url: BASE },
    ...(user.is_super_admin ? [{ name: "triangle_super_admin", value: "true", url: BASE }] : []),
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

  console.log("\n  LE REGISTRE DU PERSONNEL — 1280 px");
  let ctx = await contexte(nav, SUPER, { width: 1280, height: 1100 });
  let page = await ctx.newPage();
  const erreursConsole = [];
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push(m.text()); });

  await page.goto(`${BASE}/rh`, { waitUntil: "networkidle" });
  await nettoyer(page);
  await page.waitForTimeout(900);

  titre("L'onglet des pièces");
  await page.getByRole("button", { name: /Pièces remises/ }).click();
  await page.waitForTimeout(900);
  const corps = await page.locator("body").innerText();
  v("des pièces sont listées", /BP-|AT-|DOC-/.test(corps), corps.slice(0, 300));
  v("l'écran explique que le fichier est conservé",
    /sert l'archive telle qu'elle a été remise/.test(corps), corps.slice(0, 400));
  await capture(page, "rh-pieces");

  titre("L'état de chaque pièce se lit");
  v("une pièce en vigueur est marquée", /En vigueur/.test(corps));
  v("une version remplacée aussi", /Remplacée/.test(corps), corps.slice(0, 500));
  const v2 = await page.locator("text=v2").count();
  v("le numéro de version apparaît", v2 >= 1, `${v2}`);

  titre("Les versions d'une pièce");
  const boutonVersions = page.getByRole("button", { name: "Versions", exact: true });
  v("un bouton « Versions » est proposé", (await boutonVersions.count()) >= 1);
  const etat = await cliquable(boutonVersions);
  v("rien ne le recouvre", etat.libre === true, etat.recouvert);
  /* On cherche la pièce qui a DEUX versions : la première venue peut n'en
     avoir qu'une, et le test ne prouverait alors rien de la chaîne. */
  let chaine = false;
  const n = await boutonVersions.count();
  for (let i = 0; i < n && !chaine; i += 1) {
    await boutonVersions.nth(i).click();
    await page.waitForTimeout(700);
    const t = await page.locator('[role="dialog"]').innerText().catch(() => "");
    if (/v2/.test(t) && /v1/.test(t)) chaine = true;
    else { await page.locator('[role="dialog"] button[aria-label="Fermer"]').first().click().catch(() => {}); await page.waitForTimeout(250); }
  }
  v("une pièce montre ses deux versions", chaine, `${n} pièce(s) examinée(s)`);
  const dial = page.locator('[role="dialog"]');
  const td = await dial.innerText();
  v("le motif de la nouvelle version est affiché", /Motif :/.test(td), td.slice(0, 400));
  v("l'historique est là", /Historique/.test(td));
  v("on y lit le remplacement", /Remplacée|Nouvelle version/.test(td));
  await capture(page, "rh-versions");
  await dial.locator('button[aria-label="Fermer"]').first().click();
  await page.waitForTimeout(400);

  titre("Annuler : motif obligatoire, et l'avertissement qui compte");
  const boutonAnnuler = page.getByRole("button", { name: "Annuler", exact: true });
  v("un bouton « Annuler » est proposé au super-administrateur",
    (await boutonAnnuler.count()) >= 1, `${await boutonAnnuler.count()}`);
  await boutonAnnuler.first().click();
  await page.waitForTimeout(500);
  const dial2 = page.locator('[role="dialog"][aria-label="Annuler la pièce"]');
  v("la confirmation s'ouvre", await dial2.isVisible());
  const td2 = await dial2.innerText();
  v("elle dit que la pièce reste au registre", /reste au registre/.test(td2), td2.slice(0, 300));
  v("et qu'il faut prévenir le salarié", /prévenez-le/.test(td2));
  const confirmer = dial2.getByRole("button", { name: "Annuler la pièce" });
  v("le bouton est inerte sans motif", await confirmer.isDisabled());
  await dial2.locator("textarea").fill("erreur");
  await page.waitForTimeout(200);
  v("et le reste avec un motif trop court", await confirmer.isDisabled());
  v("le compteur l'affiche", (await dial2.innerText()).includes("6 / 10"));
  await dial2.locator("textarea").fill("éditée pour le mauvais salarié");
  await page.waitForTimeout(200);
  v("il s'active", await confirmer.isEnabled());
  await capture(page, "rh-annulation");
  await confirmer.click();
  await page.waitForTimeout(1600);
  const apres = await page.locator("body").innerText();
  v("l'avertissement du serveur est relayé",
    /ne fait plus foi/.test(apres), apres.slice(0, 400));
  v("la pièce apparaît annulée", /Annulée/.test(apres));
  v("avec son motif", /éditée pour le mauvais salarié/.test(apres));
  await capture(page, "rh-apres-annulation");

  titre("Aucune erreur de console");
  const hydratation = erreursConsole.filter((e) => /hydrat|did not match/i.test(e));
  v("pas d'erreur d'hydratation", hydratation.length === 0, hydratation.slice(0, 2).join(" | "));
  const graves = erreursConsole.filter((e) => !/favicon|manifest|404|Failed to load resource|net::ERR/i.test(e));
  v("pas d'erreur JavaScript", graves.length === 0, graves.slice(0, 3).join(" | "));
  await ctx.close();

  /* ═══════════════════════════════════════════════════════════ 375 px ══ */
  console.log("\n  TÉLÉPHONE — 375 px");
  ctx = await contexte(nav, SUPER, { width: 375, height: 760 });
  page = await ctx.newPage();
  await page.goto(`${BASE}/rh`, { waitUntil: "networkidle" });
  await nettoyer(page);
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /Pièces remises/ }).click();
  await page.waitForTimeout(800);
  const deborde = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  v("la page ne déborde pas", deborde <= 1, `${deborde} px`);
  const bv = page.getByRole("button", { name: "Versions", exact: true });
  if ((await bv.count()) > 0) {
    await bv.first().click();
    await page.waitForTimeout(800);
    const d2 = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    v("la fenêtre des versions non plus", d2 <= 1, `${d2} px`);
    const f = await cliquable(page.locator('[role="dialog"] button[aria-label="Fermer"]'));
    v("on peut la fermer", f.libre === true, f.recouvert);
  } else v("le bouton Versions existe sur téléphone", false, "absent");
  await capture(page, "rh-375");
  await ctx.close();

  /* ═══════════════════════════════════ L'ASSISTANTE RH ══ */
  console.log("\n  L'ASSISTANTE RH");
  ctx = await contexte(nav, RH, { width: 1280, height: 1000 });
  page = await ctx.newPage();
  await page.goto(`${BASE}/rh`, { waitUntil: "networkidle" });
  await nettoyer(page);
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /Pièces remises/ }).click();
  await page.waitForTimeout(800);
  v("elle voit le registre",
    /Pièces remises/.test(await page.locator("body").innerText()));
  v("mais aucun bouton « Annuler »",
    (await page.getByRole("button", { name: "Annuler", exact: true }).count()) === 0);
  v("ni de « Réimprimer »",
    (await page.getByRole("button", { name: "Réimprimer", exact: true }).count()) === 0);
  await capture(page, "rh-assistante");
  await ctx.close();

  await nav.close();
  console.log(`\n  ${"─".repeat(50)}\n  ${reussis} réussis, ${echoues} échoués\n  ${"─".repeat(50)}`);
  process.exit(echoues ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
