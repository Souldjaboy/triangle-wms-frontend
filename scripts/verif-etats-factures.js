/**
 * L'ÉCRAN DES ÉTATS DE FACTURES, DANS UN VRAI NAVIGATEUR.
 *
 * Ce qu'il s'agit de prouver : qu'on peut RÉELLEMENT faire le travail depuis
 * l'écran — cocher des factures, créer un brouillon, le valider avec une
 * confirmation qui dit ce qu'elle engage, l'annuler avec un motif obligatoire,
 * le corriger, l'imprimer — et que l'écran dit ce qu'il ne sait pas.
 *
 * Une API seule ne vaut pas un module terminé.
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

/* Les bandeaux systèmes (notifications, bannières) flottent au-dessus de tout
   et masqueraient les clics. On les retire comme le fait la vérification des
   autres écrans. */
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

/* Rien ne doit en recouvrir un autre : on demande au navigateur QUI se trouve
   au point du bouton. C'est le seul contrôle qui attrape un bandeau posé
   par-dessus une action.
   On prend un LOCATEUR, pas une chaîne : « :has-text() » est une extension de
   Playwright que document.querySelector ne connaît pas, et le passer à
   evaluate lève une SyntaxError au lieu de mesurer quoi que ce soit. */
async function cliquable(locateur) {
  if ((await locateur.count()) === 0) return { trouve: false, libre: false, recouvert: "absent" };
  return locateur.first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { trouve: true, visible: false, libre: false, recouvert: "invisible" };
    const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      trouve: true, visible: true,
      libre: !!dessus && (el.contains(dessus) || dessus.contains(el)),
      recouvert: dessus ? `${dessus.tagName}.${String(dessus.className).slice(0, 40)}` : "rien",
    };
  });
}

(async () => {
  const nav = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });

  /* ═══════════════════════════════════════════════════════════ 1280 px ══ */
  console.log("\n  ÉCRAN DE BUREAU — 1280 px");
  let ctx = await contexte(nav, DIR, { width: 1280, height: 1000 });
  let page = await ctx.newPage();
  const erreursConsole = [];
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push(m.text()); });

  titre("La page s'ouvre");
  await page.goto(`${BASE}/etats-factures`, { waitUntil: "networkidle" });
  await nettoyer(page);
  await page.waitForTimeout(600);
  v("le titre est là", (await page.locator("h1").first().innerText()).includes("États de factures"));
  v("les deux produits sont proposés",
    (await page.getByRole("button", { name: "Sable", exact: true }).count()) === 1
    && (await page.getByRole("button", { name: "Ciment", exact: true }).count()) === 1);

  titre("L'écran dit ce qu'il ne sait pas");
  const bandeau = page.locator("text=Reprise des états antérieurs incomplète");
  v("le bandeau d'avertissement est visible", await bandeau.isVisible());
  v("il explique le risque",
    (await page.locator("body").innerText()).includes("peut déjà figurer sur un état papier"));
  await capture(page, "etats-1280-avertissement");

  titre("La sélection");
  const lignes = page.locator("table tbody tr");
  const n = await lignes.count();
  v("des factures sont proposées", n >= 3, `${n} ligne(s)`);
  v("chaque ligne a sa case", (await page.locator('table tbody input[type="checkbox"]').count()) === n);

  titre("Cocher fait apparaître le récapitulatif");
  await page.locator('table tbody input[type="checkbox"]').first().check();
  await page.locator('table tbody input[type="checkbox"]').nth(1).check();
  await page.waitForTimeout(300);
  const corps = await page.locator("body").innerText();
  v("le nombre retenu s'affiche", /Factures retenues\s*:\s*2/.test(corps), corps.slice(0, 200));
  /* `toLocaleString("fr-FR")` sépare les milliers par une espace FINE
     INSÉCABLE (U+202F) : un motif qui n'attend qu'une espace ordinaire ne
     trouve rien. On accepte tout caractère d'espacement Unicode. */
  v("le total aussi", /Total\s*:\s*[\d\s\u00a0\u202f]+FCFA/u.test(corps),
    (corps.match(/Total[^\n]*/) || [""])[0]);
  v("et le restant dû", /Restant dû\s*:/.test(corps));
  const bouton = page.getByRole("button", { name: /Créer le brouillon/ });
  v("le bouton de création apparaît", await bouton.isVisible());
  const etatBouton = await cliquable(bouton);
  v("rien ne le recouvre", etatBouton.libre === true, etatBouton.recouvert);
  v("l'écran prévient qu'un brouillon ne bloque rien",
    corps.includes("Un brouillon ne bloque rien"));
  await capture(page, "etats-1280-selection");

  titre("Créer le brouillon");
  await page.locator('input[placeholder="Factures de septembre 2026"]').fill("Essai navigateur");
  await bouton.click();
  await page.waitForTimeout(1200);
  const apres = await page.locator("body").innerText();
  v("le message de succès s'affiche", /Brouillon créé avec 2 facture/.test(apres), apres.slice(0, 300));
  v("l'écran bascule sur la liste des états", /Les états \(\d+\)/.test(apres));
  v("le brouillon apparaît", apres.includes("Brouillon"));
  v("avec un numéro de la série ETS", /ETS-\d{6}-\d{3}/.test(apres));
  await capture(page, "etats-1280-brouillon");

  titre("Valider : la confirmation dit ce qu'elle engage");
  await page.getByRole("button", { name: "Valider", exact: true }).first().click();
  await page.waitForTimeout(400);
  const dial = page.locator('[role="dialog"]');
  v("une confirmation s'ouvre", await dial.isVisible());
  const texteDial = await dial.innerText();
  v("elle nomme l'état", /ETS-\d{6}-\d{3}/.test(texteDial));
  v("elle dit ce qui devient impossible",
    texteDial.includes("cesseront d'être disponibles"), texteDial.slice(0, 200));
  v("elle rassure sur ce qui n'est pas effacé", texteDial.includes("Rien ne sera effacé"));
  const etatConfirme = await cliquable(dial.getByRole("button", { name: "Valider" }));
  v("le bouton de confirmation est atteignable", etatConfirme.libre === true, etatConfirme.recouvert);
  await capture(page, "etats-1280-confirmation");

  await dial.getByRole("button", { name: "Valider" }).click();
  await page.waitForTimeout(1500);
  const valide = await page.locator("body").innerText();
  v("l'état est validé", /validé/i.test(valide), valide.slice(0, 200));
  v("la pastille passe à « Validé »", valide.includes("Validé"));

  titre("Les factures prises restent visibles, barrées");
  await page.getByRole("button", { name: /Préparer un état/ }).click();
  await page.waitForTimeout(900);
  const prep = await page.locator("body").innerText();
  v("un repli annonce les factures déjà prises",
    /facture\(s\) figurent déjà sur un état validé/.test(prep), prep.slice(0, 400));
  await page.locator("summary").first().click();
  await page.waitForTimeout(300);
  v("elles nomment l'état qui les détient",
    (await page.locator("details").innerText()).includes("sur l'état"));
  const barre = await page.locator("details .line-through").count();
  v("et sont barrées", barre >= 1, `${barre}`);
  await capture(page, "etats-1280-deja-prises");

  titre("Annuler : motif obligatoire, avec compteur");
  await page.getByRole("button", { name: /Les états/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Annuler", exact: true }).first().click();
  await page.waitForTimeout(400);
  const dial2 = page.locator('[role="dialog"]');
  v("la confirmation d'annulation s'ouvre", await dial2.isVisible());
  const confirmer = dial2.getByRole("button", { name: "Annuler l'état" });
  v("le bouton est désactivé sans motif", await confirmer.isDisabled());
  await dial2.locator("textarea").fill("court");
  await page.waitForTimeout(200);
  v("et le reste avec un motif trop court", await confirmer.isDisabled());
  v("le compteur affiche la longueur", (await dial2.innerText()).includes("5 / 10"));
  await dial2.locator("textarea").fill("la période retenue était fausse");
  await page.waitForTimeout(200);
  v("il s'active avec un motif suffisant", await confirmer.isEnabled());
  v("la confirmation dit que l'état reste consultable",
    (await dial2.innerText()).includes("restera consultable"));
  v("et que les factures redeviennent disponibles",
    (await dial2.innerText()).includes("redeviendront disponibles"));
  await capture(page, "etats-1280-annulation");
  await confirmer.click();
  await page.waitForTimeout(1500);
  const annule = await page.locator("body").innerText();
  v("l'état est annulé", /annulé/i.test(annule));
  v("le motif est affiché", annule.includes("la période retenue était fausse"));

  titre("Les factures sont revenues");
  await page.getByRole("button", { name: /Préparer un état/ }).click();
  await page.waitForTimeout(900);
  v("plus aucune facture n'est marquée prise",
    !(await page.locator("body").innerText()).includes("figurent déjà sur un état validé"));

  titre("Le détail d'un état");
  await page.getByRole("button", { name: /Les états/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Voir", exact: true }).first().click();
  await page.waitForTimeout(900);
  const detail = page.locator('[role="dialog"]');
  v("le détail s'ouvre", await detail.isVisible());
  const td = await detail.innerText();
  v("les lignes sont listées", /FS-\d{4}/.test(td), td.slice(0, 200));
  v("l'historique est là", td.includes("Historique"));
  v("il nomme qui a fait quoi", td.includes("Direction Triangle") || td.includes("par "));
  await capture(page, "etats-1280-detail");
  await detail.getByRole("button", { name: "Fermer" }).click();
  await page.waitForTimeout(300);

  titre("Le ciment, par le même écran");
  await page.getByRole("button", { name: "Ciment", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Préparer un état/ }).click();
  await page.waitForTimeout(600);
  const ciment = await page.locator("body").innerText();
  v("la sélection ciment se charge", /FC-\d{4}/.test(ciment), ciment.slice(0, 300));
  await capture(page, "etats-1280-ciment");

  titre("Aucune erreur de console, aucune erreur d'hydratation");
  const hydratation = erreursConsole.filter((e) => /hydrat|did not match|Minified React error #4\d\d/i.test(e));
  v("pas d'erreur d'hydratation", hydratation.length === 0, hydratation.slice(0, 2).join(" | "));
  const graves = erreursConsole.filter((e) =>
    !/favicon|manifest|404|Failed to load resource|net::ERR/i.test(e));
  v("pas d'erreur JavaScript", graves.length === 0, graves.slice(0, 3).join(" | "));

  await ctx.close();

  /* ═══════════════════════════════════════════════════════════ 375 px ══ */
  console.log("\n  TÉLÉPHONE — 375 px");
  ctx = await contexte(nav, DIR, { width: 375, height: 760 });
  page = await ctx.newPage();
  await page.goto(`${BASE}/etats-factures`, { waitUntil: "networkidle" });
  await nettoyer(page);
  await page.waitForTimeout(800);

  titre("La page tient dans la largeur");
  const deborde = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  v("aucun débordement horizontal de la page", deborde <= 1, `${deborde} px`);
  v("le titre reste lisible", await page.locator("h1").first().isVisible());
  v("le bandeau d'avertissement est là aussi",
    await page.locator("text=Reprise des états antérieurs incomplète").isVisible());
  await capture(page, "etats-375");

  titre("Les actions restent atteignables");
  await page.getByRole("button", { name: /Les états/ }).click();
  await page.waitForTimeout(800);
  const voir = await cliquable(page.getByRole("button", { name: "Voir", exact: true }));
  v("le bouton « Voir » n'est recouvert par rien", voir.libre === true, voir.recouvert);
  await page.getByRole("button", { name: "Voir", exact: true }).first().click();
  await page.waitForTimeout(800);
  const fermer = await cliquable(page.locator('[role="dialog"] button[aria-label="Fermer"]'));
  v("la fenêtre de détail se ferme", fermer.libre === true, fermer.recouvert);
  const debordeDial = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  v("la fenêtre ne déborde pas non plus", debordeDial <= 1, `${debordeDial} px`);
  await capture(page, "etats-375-detail");
  await ctx.close();

  /* ═══════════════════════════════════════════ UN RÔLE SANS LE DROIT ══ */
  console.log("\n  UN RÔLE QUI N'A PAS LE DROIT");
  ctx = await contexte(nav, MAGA, { width: 1280, height: 900 });
  page = await ctx.newPage();
  await page.goto(`${BASE}/etats-factures`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const refus = await page.locator("body").innerText();
  v("l'écran refuse poliment", refus.includes("Vous n'avez pas accès"), refus.slice(0, 200));
  v("et ne montre aucune facture", !/FS-\d{4}/.test(refus));
  v("ni aucun bouton de création",
    (await page.getByRole("button", { name: /Créer le brouillon/ }).count()) === 0);
  await capture(page, "etats-magasinier");
  await ctx.close();

  await nav.close();
  console.log(`\n  ${"─".repeat(50)}\n  ${reussis} réussis, ${echoues} échoués\n  ${"─".repeat(50)}`);
  process.exit(echoues ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
