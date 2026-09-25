/**
 * LES DEUX ÉCRANS NOUVEAUX, DANS UN VRAI NAVIGATEUR, EN 1280 ET 375 px.
 *
 * Ce qu'aucun test d'API ne prouve : qu'une journée chômée s'AFFICHE comme une
 * journée chômée et non comme une absence, que l'écran dit ce que la décision va
 * produire AVANT qu'on l'enregistre, et que le rapport officiel porte la mention
 * de régularisation là où il annonce zéro absence.
 */
const { chromium } = require("playwright-core");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const BASE = process.env.BASE || "http://localhost:3000";
const BACKEND = process.env.BACKEND || "http://127.0.0.1:5050";
const SECRET = process.env.SECRET || "test_chomes";
const SORTIE = process.env.SORTIE;
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MOIS = process.env.MOIS || "2026-09";

const SUPER = { id: 900, fullname: "Super Triangle", email: "sup.tri@t.local",
                role: "super_admin", company_id: 1, is_super_admin: true };
const TOKEN = jwt.sign({ ...SUPER, tenant_id: "triangle" }, SECRET, { expiresIn: "2h" });

let reussis = 0, echoues = 0;
const v = (nom, ok, detail = "") => {
  if (ok) { reussis += 1; console.log(`    ✓ ${nom}`); }
  else { echoues += 1; console.log(`    ✗ ${nom}${detail ? `\n        → ${detail}` : ""}`); }
};
const api = async (m, chemin, corps) => {
  const r = await fetch(BACKEND + chemin, {
    method: m,
    headers: { Authorization: `Bearer ${TOKEN}`, "x-tenant-id": "triangle",
               "x-active-company-id": "1", "Content-Type": "application/json" },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, data: d };
};

const LARGEURS = [
  { nom: "ordinateur", viewport: { width: 1280, height: 950 } },
  { nom: "téléphone", viewport: { width: 375, height: 812 } },
];

async function contexte(navigateur, l) {
  const ctx = await navigateur.newContext({ ...l, locale: "fr-FR", timezoneId: "Africa/Bamako" });
  await ctx.addCookies([
    { name: "triangle_token", value: TOKEN, url: BASE },
    { name: "triangle_business_token", value: TOKEN, url: BASE },
    { name: "triangle_super_admin", value: "true", url: BASE },
  ]);
  await ctx.addInitScript((t) => {
    localStorage.setItem("token", t);
    localStorage.setItem("business_token", t);
    localStorage.setItem("user", JSON.stringify(
      { id: 900, fullname: "Super Triangle", role: "super_admin", is_super_admin: true, company_id: 1 }));
  }, TOKEN);
  return ctx;
}

async function nettoyerBanniere(page) {
  await page.evaluate(() => {
    document.querySelectorAll("*").forEach((n) => {
      const z = Number(getComputedStyle(n).zIndex || 0);
      if (z >= 9000 && n.tagName !== "BODY") n.remove();
    });
  });
}

(async () => {
  console.log("── état de départ : deux journées chômées et l'exception de septembre");
  const emp = await api("GET", `/attendance-v2/payroll?month=${MOIS}`);
  const directeur = (emp.data?.employees || []).find((e) => /Mohamedou Diallo/i.test(e.full_name || ""));
  if (directeur) {
    await api("POST", `/paie/salaries/${directeur.id}/non-remunere`,
      { reason: "Directeur : ne percoit volontairement aucun salaire. Decision direction." });
  }
  await api("POST", "/pointage/calendrier", {
    day_date: "2026-09-08", label: "Fermeture entrepot Sotuba ACI",
    type_key: "FERMETURE_EXCEPTIONNELLE",
    description: "Fermeture exceptionnelle de l'entrepot decidee par la direction.",
    decision_reference: "Note de service 2026-14",
    est_chome: true, est_paye: true, pointage_requis: false, portee: "SITE", cibles: [3] });
  await api("POST", "/pointage/calendrier", {
    day_date: "2026-09-09", label: "Journee chomee non payee",
    type_key: "JOUR_CHOME_EXCEPTIONNEL",
    description: "Journee chomee sans maintien de salaire, decision de l'autorite competente.",
    est_chome: true, est_paye: false, pointage_requis: false, portee: "SITE", cibles: [3] });
  await api("POST", "/pointage/calendrier", {
    day_date: "2026-09-10", label: "Journee chomee toute l'entreprise",
    type_key: "JOUR_CHOME_DIRECTION",
    description: "Journee chomee decidee par la direction pour l'ensemble de l'entreprise.",
    est_chome: true, est_paye: true, pointage_requis: false, portee: "ENTREPRISE",
    traitement_si_travaille: "PRIME_FIXE", compensation_montant: 15000,
    compensation_note: "Prime forfaitaire pour travail un jour chome." });
  await api("POST", `/paie/periodes/${MOIS}/preparer`, {});

  const navigateur = await chromium.launch({ executablePath: CHROME });
  for (const l of LARGEURS) {
    console.log(`\n▸ ${l.nom.toUpperCase()} (${l.viewport.width} px)`);

    // ── LE CALENDRIER ADMINISTRATIF ────────────────────────────────────
    console.log("\n  A — Jours fériés et jours chômés");
    let ctx = await contexte(navigateur, l);
    let page = await ctx.newPage();
    await page.goto(`${BASE}/calendrier-pointage`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await nettoyerBanniere(page);
    let texte = await page.locator("body").innerText();

    v("la page s'ouvre sans erreur", !/Application error|Erreur de chargement/i.test(texte));
    v("elle dit d'emblée qu'une journée déclarée n'est pas une absence",
      /jamais comptée comme une absence injustifiée/i.test(texte));
    v("les trois journées sont listées",
      /Fermeture entrepot Sotuba ACI/.test(texte) && /Journee chomee non payee/.test(texte)
      && /Journee chomee toute l'entreprise/.test(texte), texte.slice(0, 300));
    v("le traitement « chômé et payé » est affiché", /Chômé et payé/.test(texte));
    v("le traitement « chômé, non payé » est distingué", /Chômé, non payé/.test(texte));
    v("la portée d'un site est nommée", /Un ou plusieurs sites/.test(texte));
    v("la référence de la décision est visible", /Note de service 2026-14/.test(texte));
    v("la compensation configurée est chiffrée", /15\s?000\s?FCFA/.test(texte),
      (texte.match(/[\d\s\u202f\u00a0]+FCFA/g) || []).join(" | "));
    v("le bouton d'ajout est proposé",
      await page.locator('button:visible:text("Ajouter une journée spéciale")').count() > 0);

    await page.locator('button:visible:text("Ajouter une journée spéciale")').first().click();
    await page.waitForTimeout(400);
    texte = await page.locator("body").innerText();
    v("la fenêtre annonce ce que la décision va produire",
      /Aucune absence ne sera comptée et le salaire sera maintenu/i.test(texte), texte.slice(0, 400));
    v("elle promet de n'inventer aucun pointage", /Aucun pointage ne sera inventé/i.test(texte));
    /* Décocher « payée » doit changer la phrase, pas seulement la case. */
    await page.locator('input[type="checkbox"]').nth(1).uncheck();
    await page.waitForTimeout(250);
    texte = await page.locator("body").innerText();
    v("décocher « payée » annonce une retenue présentée séparément",
      /retenue d'un jour s'appliquera — présentée séparément des absences/i.test(texte),
      texte.slice(0, 400));
    v("les traitements de compensation sont proposés par le serveur",
      /Prime fixe/.test(texte) && /Repos compensateur/.test(texte));
    if (SORTIE) {
      fs.mkdirSync(SORTIE, { recursive: true });
      await page.screenshot({ path: `${SORTIE}/calendrier-${l.viewport.width}.png`, fullPage: true });
    }
    if (l.viewport.width === 375) {
      const debord = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      v("aucun débordement horizontal", debord <= 0, `${debord} px`);
    }
    await ctx.close();

    // ── LE RAPPORT DE POINTAGE ─────────────────────────────────────────
    console.log("\n  B — Rapport de pointage : les catégories séparées");
    ctx = await contexte(navigateur, l);
    page = await ctx.newPage();
    await page.goto(`${BASE}/rapports/pointage?periode=${MOIS}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    /* La page attend une période choisie à l'écran. */
    const champ = page.locator('input[type="month"], input[placeholder*="AAAA"]').first();
    if (await champ.count()) { await champ.fill(MOIS); await page.waitForTimeout(300); }
    const bouton = page.locator('button:visible:text("Afficher"), button:visible:text("Charger")').first();
    if (await bouton.count()) { await bouton.click(); await page.waitForTimeout(2500); }
    else await page.waitForTimeout(2000);
    await nettoyerBanniere(page);
    texte = await page.locator("body").innerText();

    v("la page s'ouvre sans erreur", !/Application error|Erreur de chargement/i.test(texte));
    v("les jours chômés payés ont leur propre case", /Jours chômés payés/.test(texte), texte.slice(0, 400));
    v("les jours chômés non payés aussi", /Jours chômés non payés/.test(texte));
    v("le travail un jour chômé est compté à part", /Travail un jour chômé/.test(texte));
    v("les absences restent affichées comme catégorie distincte", /Absences/.test(texte));
    if (SORTIE) {
      await page.screenshot({ path: `${SORTIE}/rapport-pointage-${l.viewport.width}.png`, fullPage: true });
    }
    if (l.viewport.width === 375) {
      const debord = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      v("aucun débordement horizontal", debord <= 0, `${debord} px`);
    }
    await ctx.close();

    // ── LE RAPPORT SOUS RÉGULARISATION ─────────────────────────────────
    console.log("\n  C — Rapport officiel sous régularisation : zéro absence + mention");
    await api("POST", `/paie/periodes/${MOIS}/exception-absences`, {
      actif: true, retards_aussi: true,
      reason: "Régularisation exceptionnelle septembre 2026 — incidents du système de pointage — décision direction" });
    ctx = await contexte(navigateur, l);
    page = await ctx.newPage();
    await page.goto(`${BASE}/rapports/pointage?periode=${MOIS}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const champ2 = page.locator('input[type="month"], input[placeholder*="AAAA"]').first();
    if (await champ2.count()) { await champ2.fill(MOIS); await page.waitForTimeout(300); }
    const bouton2 = page.locator('button:visible:text("Afficher"), button:visible:text("Charger")').first();
    if (await bouton2.count()) { await bouton2.click(); await page.waitForTimeout(2500); }
    else await page.waitForTimeout(2000);
    await nettoyerBanniere(page);
    texte = await page.locator("body").innerText();

    v("la mention de régularisation est affichée",
      /Régularisation exceptionnelle du pointage/.test(texte), texte.slice(0, 500));
    v("elle nomme la décision de la Direction", /décision de la Direction/.test(texte));
    v("elle affirme que les pointages sont conservés",
      /pointages d'origine sont conservés intégralement/i.test(texte));
    v("le motif officiel est repris", /incidents du système de pointage/i.test(texte));
    v("le brut reste annoncé à côté de l'officiel", /au pointage brut/.test(texte), texte.slice(0, 600));
    if (SORTIE) {
      await page.screenshot({ path: `${SORTIE}/rapport-regularise-${l.viewport.width}.png`, fullPage: true });
    }
    await ctx.close();
    /* On lève l'exception pour que la largeur suivante reparte du même état. */
    await api("POST", `/paie/periodes/${MOIS}/exception-absences`, { actif: false, retards_aussi: true });
  }

  await navigateur.close();
  console.log(`\n${echoues === 0 ? "✅" : "❌"} ${reussis} réussis, ${echoues} échoués\n`);
  process.exit(echoues === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
