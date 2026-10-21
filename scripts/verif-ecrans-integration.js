/**
 * LES DEUX ÉCRANS DE L'INTÉGRATION, DANS UN VRAI NAVIGATEUR.
 *
 * Correction d'une demande validée, et registres du personnel. En 1280 et
 * 375 px, avec un rôle qui a tous les droits et un rôle qui ne doit pas voir
 * les salaires.
 */
const { chromium } = require("playwright-core");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const BASE = process.env.BASE || "http://localhost:3000";
const BACKEND = process.env.BACKEND || "http://127.0.0.1:5050";
const SECRET = process.env.SECRET || "test_integration";
const SORTIE = process.env.SORTIE;
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let reussis = 0, echoues = 0;
const v = (n, c, d = "") => {
  if (c) { reussis += 1; console.log(`    ✓ ${n}`); }
  else { echoues += 1; console.log(`    ✗ ${n}${d ? `\n        → ${d}` : ""}`); }
};
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

const LARGEURS = [
  { nom: "ordinateur", viewport: { width: 1280, height: 950 } },
  { nom: "téléphone", viewport: { width: 375, height: 812 } },
];

(async () => {
  const nav = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });

  for (const l of LARGEURS) {
    console.log(`\n── CORRECTION D'UNE DEMANDE — ${l.nom} (${l.viewport.width} px)`);
    const ctx = await contexte(nav, SUPER, l.viewport);
    const page = await ctx.newPage();
    const erreurs = [];
    page.on("pageerror", (e) => erreurs.push(String(e.message)));

    await page.goto(`${BASE}/demandes-stock`, { waitUntil: "networkidle" });
    await nettoyer(page);
    await page.waitForTimeout(600);
    await capture(page, `demandes-${l.nom}`);

    const corriger = page.getByRole("button", { name: "Corriger" });
    v("le bouton « Corriger » apparaît sur une demande reçue",
      (await corriger.count()) > 0, `${await corriger.count()} bouton(s)`);

    if (await corriger.count()) {
      await corriger.first().click();
      await page.waitForSelector("text=Historique des corrections", { timeout: 10000 });
      await nettoyer(page);
      await capture(page, `correction-${l.nom}`);
      const corps = await page.textContent("body");

      v("l'écran propose la contre-passation", /Contre-passer la réception/.test(corps));
      v("il propose aussi de contre-passer puis annuler", /Contre-passer et annuler/.test(corps));
      v("il explique que les mouvements d'origine sont conservés",
        /conservés, marqués annulés/.test(corps));

      await page.getByText("Contre-passer la réception").first().click();
      await page.waitForSelector("text=Rien ne sera effacé", { timeout: 5000 });
      const avecMotif = await page.textContent("body");
      v("la confirmation affirme que rien ne sera effacé", /Rien ne sera effacé/.test(avecMotif));
      v("elle explique que le stock n'est jamais réécrit directement",
        /jamais réécrit directement/.test(avecMotif));

      const bouton = page.getByRole("button", { name: /^Contre-passer$/ });
      v("le bouton est désactivé sans motif", await bouton.isDisabled());
      await page.locator("textarea").fill("court");
      v("il reste désactivé avec un motif trop court", await bouton.isDisabled());
      await page.locator("textarea").fill("Conteneur livré au mauvais entrepôt, saisi à tort");
      await page.waitForTimeout(150);
      v("il s'active avec un vrai motif", !(await bouton.isDisabled()));

      /* Présent et actif ne suffit pas : rien ne doit le recouvrir. */
      const recouvert = await bouton.evaluate((n) => {
        const b = n.getBoundingClientRect();
        const dessus = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return dessus && !n.contains(dessus) && dessus !== n
          ? `${dessus.tagName}.${String(dessus.className).slice(0, 40)}` : null;
      });
      v("rien ne recouvre le bouton de confirmation", recouvert === null, String(recouvert));
      await capture(page, `correction-motif-${l.nom}`);
    }

    const debord = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    v(`aucun débordement horizontal (${debord} px)`, debord <= 1, `${debord} px`);
    v("aucune erreur JavaScript", erreurs.length === 0, erreurs.join(" | "));
    await ctx.close();
  }

  /* ── LES REGISTRES RH ─────────────────────────────────────────────── */
  for (const l of LARGEURS) {
    console.log(`\n── REGISTRES RH — ${l.nom} (${l.viewport.width} px)`);
    const ctx = await contexte(nav, SUPER, l.viewport);
    const page = await ctx.newPage();
    const erreurs = [];
    page.on("pageerror", (e) => erreurs.push(String(e.message)));

    await page.goto(`${BASE}/rh`, { waitUntil: "networkidle" });
    await nettoyer(page);
    await page.waitForTimeout(600);
    await capture(page, `rh-${l.nom}`);
    const corps = await page.textContent("body");

    v("la page s'ouvre", /Documents du personnel/.test(corps));
    v("les trois onglets sont là",
      /Contrats \(/.test(corps) && /Pièces remises \(/.test(corps) && /Clauses \(/.test(corps));
    v("le bandeau sur les clauses non validées est affiché",
      /n'ont pas été relues par un juriste/.test(corps));
    v("un super-administrateur voit les rémunérations",
      /FCFA/.test(corps) && !/Les rémunérations vous sont masquées/.test(corps));

    await page.getByRole("button", { name: /Pièces remises/ }).click();
    await page.waitForTimeout(400);
    const docs = await page.textContent("body");
    v("le registre annonce l'empreinte du PDF", /empreinte du PDF remis/.test(docs));
    await capture(page, `rh-documents-${l.nom}`);

    await page.getByRole("button", { name: /Clauses/ }).click();
    await page.waitForTimeout(400);
    const cl = await page.textContent("body");
    v("les clauses sont présentées comme des données",
      /sont des .{0,3}données.{0,3}, pas du code/.test(cl), cl.slice(0, 0));
    v("celles à valider portent une marque", /à faire valider/.test(cl));
    await capture(page, `rh-clauses-${l.nom}`);

    const debord = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    v(`aucun débordement horizontal (${debord} px)`, debord <= 1, `${debord} px`);
    v("aucune erreur JavaScript", erreurs.length === 0, erreurs.join(" | "));
    await ctx.close();
  }

  /* ── CE QUE VOIT UN RÔLE SANS LE DROIT DE VOIR LES SALAIRES ───────── */
  console.log("\n── REGISTRES RH — assistante RH (sans droit sur les rémunérations)");
  const ctxRH = await contexte(nav, RH, { width: 1280, height: 950 });
  const pageRH = await ctxRH.newPage();
  await pageRH.goto(`${BASE}/rh`, { waitUntil: "networkidle" });
  await nettoyer(pageRH);
  await pageRH.waitForTimeout(600);
  await capture(pageRH, "rh-assistante");
  const corpsRH = await pageRH.textContent("body");

  v("elle accède bien au module", /Documents du personnel/.test(corpsRH));
  v("l'écran dit que les rémunérations lui sont masquées",
    /Les rémunérations vous sont masquées/.test(corpsRH));
  v("il précise que ce n'est pas zéro mais non transmis",
    /ne vous sont pas transmis/.test(corpsRH));
  v("aucun montant en FCFA n'apparaît dans le tableau des contrats",
    !/\d[\d  ]*FCFA/.test(corpsRH), (corpsRH.match(/\d[\d  ]*FCFA/) || ["—"])[0]);
  v("la colonne affiche « masqué »", /masqué/.test(corpsRH));
  await ctxRH.close();

  await nav.close();
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${reussis} réussis, ${echoues} échoués`);
  if (SORTIE) console.log(`  captures : ${SORTIE}`);
  process.exit(echoues === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
