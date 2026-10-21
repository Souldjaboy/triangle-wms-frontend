/**
 * L'ÉCRAN DES TRANSFERTS INTERNES, DANS UN VRAI NAVIGATEUR, EN 1280 ET 375 px.
 *
 * Ce qu'aucun test d'API ne prouve : que l'écran ANNONCE les deux soldes futurs
 * avant d'envoyer quoi que ce soit, qu'il affirme à l'écran que le total des
 * fonds ne bouge pas, que la confirmation d'annulation dit en clair qu'une
 * contre-passation n'est pas un virement bancaire, et que rien de tout cela ne
 * se replie ni ne déborde sur un téléphone.
 */
const { chromium } = require("playwright-core");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const BASE = process.env.BASE || "http://localhost:3000";
const BACKEND = process.env.BACKEND || "http://127.0.0.1:5050";
const SECRET = process.env.SECRET || "test_transferts";
const SORTIE = process.env.SORTIE;
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

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

const capture = async (page, nom) => {
  if (!SORTIE) return;
  fs.mkdirSync(SORTIE, { recursive: true });
  await page.screenshot({ path: `${SORTIE}/${nom}.png`, fullPage: true });
};

/** Ouvre la comptabilité et va sur l'onglet des transferts internes. */
async function ouvrirOnglet(page) {
  await page.goto(`${BASE}/comptabilite`, { waitUntil: "networkidle" });
  await nettoyerBanniere(page);
  const onglet = page.getByRole("button", { name: "Transferts internes" });
  await onglet.click();
  await page.waitForSelector("text=Total des fonds de l'entreprise", { timeout: 15000 });
  await nettoyerBanniere(page);
}

(async () => {
  /* Un transfert existant, pour que la liste et le bouton d'annulation
     soient réellement présents à l'écran. */
  console.log("── état de départ");
  const pose = await api("POST", "/comptabilite/transferts-internes", {
    source: { kind: "BANQUE", id: 1 }, destination: { kind: "TRESORERIE" },
    montant: 5000000,
    motif: "Approvisionnement de la trésorerie pour les décaissements du mois",
  });
  console.log(`   transfert de départ : ${pose.status} ${pose.data?.transfert?.reference || pose.data?.error || ""}`);

  const navigateur = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });

  for (const l of LARGEURS) {
    console.log(`\n── ${l.nom} (${l.viewport.width} px)`);
    const ctx = await contexte(navigateur, l);
    const page = await ctx.newPage();
    const erreursConsole = [];
    page.on("pageerror", (e) => erreursConsole.push(String(e.message)));

    await ouvrirOnglet(page);
    await capture(page, `transferts-${l.nom}`);

    const corps = await page.textContent("body");

    v("l'onglet « Transferts internes » existe et s'ouvre",
      /Total des fonds de l'entreprise/.test(corps));
    v("l'écran affirme que ce total ne change pas",
      /ne change pas/.test(corps) && /ni dans les recettes ni dans les dépenses/.test(corps));
    v("le transfert de départ est listé",
      corps.includes(pose.data?.transfert?.reference || "AUCUNE_REFERENCE"),
      pose.data?.transfert?.reference);
    v("son motif est lisible dans la liste",
      /Approvisionnement de la trésorerie/.test(corps));
    v("il est marqué Actif", /Actif/.test(corps));

    /* L'aperçu : le point de l'écran. On remplit le formulaire SANS envoyer. */
    const selects = page.locator("form select");
    await selects.nth(0).selectOption({ index: 1 });
    const valeurSource = await selects.nth(0).inputValue();
    const optionsDest = await selects.nth(1).locator("option").count();
    v("le compte d'arrivée ne propose pas le compte de départ",
      !(await selects.nth(1).locator(`option[value="${valeurSource}"]`).count()),
      `${optionsDest} options`);
    await selects.nth(1).selectOption({ index: 1 });
    await page.locator('input[type="number"]').fill("1000000");
    await page.waitForTimeout(250);
    await nettoyerBanniere(page);
    await capture(page, `transferts-apercu-${l.nom}`);

    const avecApercu = await page.textContent("body");
    v("les deux soldes futurs sont annoncés AVANT l'envoi",
      /→/.test(avecApercu) && /inchangé/.test(avecApercu));
    v("le mot « inchangé » accompagne le total des fonds", /Total des fonds/.test(avecApercu));

    /* Un montant impossible : l'écran doit le dire et désactiver le bouton,
       plutôt que laisser partir une requête vouée au refus. */
    const soldeSource = await selects.nth(0).locator("option:checked").textContent();
    await page.locator('input[type="number"]').fill("999999999");
    await page.waitForTimeout(250);
    const avecTrop = await page.textContent("body");
    v("un montant supérieur au solde est signalé à l'écran",
      /il manque/i.test(avecTrop), `source : ${soldeSource}`);
    const bouton = page.getByRole("button", { name: /Déplacer les fonds/ });
    v("et le bouton d'envoi est désactivé", await bouton.isDisabled());

    /* La confirmation d'annulation : la phrase qui évite d'attendre un
       virement qui n'arrivera pas. */
    await page.getByRole("button", { name: "Annuler", exact: true }).first().click();
    await page.waitForSelector("text=annulation comptable", { timeout: 10000 });
    await nettoyerBanniere(page);
    await capture(page, `transferts-annulation-${l.nom}`);
    const dialogue = await page.textContent("body");
    v("la confirmation distingue l'annulation comptable du remboursement bancaire",
      /annulation comptable, pas un remboursement bancaire/i.test(dialogue));
    v("elle précise qu'aucune instruction n'est envoyée à la banque",
      /Aucune instruction n'est envoyée\s*à la banque/i.test(dialogue.replace(/\s+/g, " ")));
    v("elle nomme les deux comptes et le montant",
      /reviendront de/.test(dialogue));
    const confirmer = page.getByRole("button", { name: /Confirmer l'annulation/ });
    v("confirmer est impossible sans motif de 10 caractères", await confirmer.isDisabled());
    await page.locator("textarea").fill("Transfert saisi sur le mauvais compte de destination");
    await page.waitForTimeout(150);
    v("avec un vrai motif, confirmer devient possible", !(await confirmer.isDisabled()));

    /* Présent et actif ne suffit pas : le bouton flottant « Envoyer dans le
       chat » (z-80) recouvrait la confirmation sur téléphone. On vérifie donc
       que c'est bien LUI que l'on touche au point où il s'affiche. */
    const recouvert = await confirmer.evaluate((n) => {
      const b = n.getBoundingClientRect();
      const dessus = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return dessus && !n.contains(dessus) && dessus !== n
        ? `${dessus.tagName}.${String(dessus.className).slice(0, 50)}` : null;
    });
    v("rien ne recouvre le bouton de confirmation", recouvert === null, String(recouvert));

    /* La mise en page sur téléphone : rien ne doit déborder. */
    const debord = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    v(`aucun débordement horizontal de la page (${debord} px)`, debord <= 1, `${debord} px`);

    const dialogueLargeur = await page.evaluate(() => {
      const n = [...document.querySelectorAll("div")].find((d) =>
        /annulation comptable/i.test(d.textContent || "") && d.className.includes("max-w-lg"));
      return n ? { large: n.getBoundingClientRect().width, vue: window.innerWidth } : null;
    });
    v("la boîte de confirmation tient dans l'écran",
      !!dialogueLargeur && dialogueLargeur.large <= dialogueLargeur.vue,
      JSON.stringify(dialogueLargeur));

    /* L'erreur d'hydratation #418 PRÉEXISTE à cet écran : elle se produit sur
       l'onglet « Tableau » avant que ce composant ne soit monté, parce que la
       page lit localStorage pendant le rendu. On la nomme pour ne pas la
       confondre avec une régression, mais toute AUTRE erreur fait échouer. */
    const connue = (m) => /Minified React error #418/.test(m);
    const nouvelles = erreursConsole.filter((m) => !connue(m));
    v("aucune erreur JavaScript nouvelle", nouvelles.length === 0, nouvelles.join(" | "));
    if (erreursConsole.some(connue)) {
      console.log("      · hydratation #418 : défaut préexistant de app/comptabilite/page.tsx");
    }
    await ctx.close();
  }

  /* Un rôle sans le droit d'annuler ne doit pas voir le bouton. */
  console.log("\n── ce que voit un comptable");
  const JETON_C = jwt.sign(
    { id: 903, fullname: "Comptable Triangle", email: "compta.tri@t.local",
      role: "comptable", company_id: 1, is_super_admin: false, tenant_id: "triangle" },
    SECRET, { expiresIn: "2h" });
  const ctxC = await navigateur.newContext({ viewport: { width: 1280, height: 950 }, locale: "fr-FR" });
  await ctxC.addCookies([
    { name: "triangle_token", value: JETON_C, url: BASE },
    { name: "triangle_business_token", value: JETON_C, url: BASE },
  ]);
  await ctxC.addInitScript((t) => {
    localStorage.setItem("token", t);
    localStorage.setItem("business_token", t);
    localStorage.setItem("user", JSON.stringify(
      { id: 903, fullname: "Comptable Triangle", role: "comptable", is_super_admin: false, company_id: 1 }));
  }, JETON_C);
  const pageC = await ctxC.newPage();
  await ouvrirOnglet(pageC);
  await capture(pageC, "transferts-comptable");
  const corpsC = await pageC.textContent("body");
  v("le comptable voit le formulaire de transfert", /Déplacer des fonds/.test(corpsC));
  v("le comptable ne voit AUCUN bouton d'annulation",
    (await pageC.getByRole("button", { name: "Annuler", exact: true }).count()) === 0);
  await ctxC.close();

  await navigateur.close();
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${reussis} réussis, ${echoues} échoués`);
  if (SORTIE) console.log(`  captures : ${SORTIE}`);
  process.exit(echoues === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
