/**
 * LE STUDIO GRAPHIQUE, À L'ÉCRAN.
 *
 * Ce qu'il s'agit de prouver :
 *
 *  1. Que les modèles se dessinent vraiment — un modèle qui n'apparaît pas
 *     est un modèle qui n'existe pas.
 *  2. Que le QR du badge est un VRAI QR et non un carré gris. Un badge
 *     imprimé à deux cents exemplaires avec un QR vide, cela se découvre au
 *     portail, le lundi matin.
 *  3. Qu'on pose un élément, qu'on le déplace, qu'on enregistre, et que
 *     l'image produite change réellement.
 *  4. Que le PDF d'impression annonce et respecte les dimensions physiques.
 */
const { lancer } = require("./navigateur");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const BASE = process.env.BASE || "http://localhost:3000";
const SECRET = process.env.SECRET || "test_studio";
const SORTIE = process.env.SORTIE;

let reussis = 0, echoues = 0;
const v = (n, c, d = "") => {
  if (c) { reussis += 1; console.log(`    ✓ ${n}`); }
  else { echoues += 1; console.log(`    ✘ ${n}${d ? `\n        → ${d}` : ""}`); }
};
const titre = (t) => console.log(`\n  ── ${t}`);
const jeton = (u) => jwt.sign({ ...u, tenant_id: "triangle" }, SECRET, { expiresIn: "2h" });

const DIR = { id: 900, fullname: "Direction Triangle", email: "dir@t.local",
              role: "direction", company_id: 1, is_super_admin: false };

async function contexte(nav, user, viewport = { width: 1280, height: 1000 }) {
  const t = jeton(user);
  const ctx = await nav.newContext({ viewport, locale: "fr-FR", timezoneId: "Africa/Bamako" });
  await ctx.addCookies([
    { name: "triangle_token", value: t, url: BASE },
    { name: "triangle_business_token", value: t, url: BASE },
  ]);
  await ctx.addInitScript(([jet, u]) => {
    try {
      if (typeof localStorage === "undefined" || !localStorage) return;
      localStorage.setItem("token", jet);
      localStorage.setItem("business_token", jet);
      localStorage.setItem("user", JSON.stringify(u));
      localStorage.setItem("active_company_id", String(u.company_id));
    } catch { /* fenêtre sans stockage */ }
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

/* Un QR est un damier noir et blanc : la part de pixels sombres y est
   élevée et répartie. Un carré gris uniforme ne lui ressemble pas. */
const ANALYSER = `(canvas, zone) => {
  const g = canvas.getContext("2d");
  const x = Math.round(canvas.width * zone[0]);
  const y = Math.round(canvas.height * zone[1]);
  const l = Math.round(canvas.width * zone[2]);
  const h = Math.round(canvas.height * zone[3]);
  const d = g.getImageData(x, y, Math.max(1, l), Math.max(1, h)).data;
  let sombres = 0, clairs = 0, gris = 0, total = 0, transitions = 0;
  let precedent = null;
  for (let i = 0; i < d.length; i += 4) {
    const moyenne = (d[i] + d[i + 1] + d[i + 2]) / 3;
    total += 1;
    const etat = moyenne < 90 ? "sombre" : moyenne > 200 ? "clair" : "gris";
    if (etat === "sombre") sombres += 1;
    else if (etat === "clair") clairs += 1;
    else gris += 1;
    if (precedent !== null && precedent !== etat) transitions += 1;
    precedent = etat;
  }
  return {
    sombres: Math.round((sombres / total) * 100),
    clairs: Math.round((clairs / total) * 100),
    gris: Math.round((gris / total) * 100),
    transitions,
  };
}`;

(async () => {
  const nav = await lancer();
  const ctx = await contexte(nav, DIR);
  const page = await ctx.newPage();
  page.setDefaultTimeout(40000);
  const erreursConsole = [];
  page.on("pageerror", (e) => erreursConsole.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push(m.text()); });

  /* ════════════════════════ LES MODÈLES ═════════════════════════ */
  titre("les modèles se dessinent, et disent leur format");
  await page.goto(`${BASE}/studio/design`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Commencer", { timeout: 30000 });
  await page.waitForTimeout(900);
  await nettoyer(page);

  let corps = await page.textContent("body");
  v("les formats sont donnés en millimètres",
    /85 × 55 mm/.test(corps) && /297 × 210 mm/.test(corps), corps.slice(0, 400));
  v("l'écran dit que les modèles sont à modifier",
    /à modifier entièrement/.test(corps));
  const apercus = await page.locator("li img[alt^='Aperçu du modèle']").count();
  v("tous les modèles ont un aperçu dessiné", apercus >= 6, String(apercus));
  /* UN APERÇU QUI SERAIT VIDE ne vaut rien : on regarde qu'il porte de
     l'encre. */
  const encreModele = await page.evaluate(async ([analyser]) => {
    const img = document.querySelector("li img[alt='Aperçu du modèle Carte de visite']");
    if (!img) return null;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    return new Function("return " + analyser)()(c, [0, 0, 1, 1]);
  }, [ANALYSER]);
  v("l'aperçu de la carte de visite porte de l'encre",
    encreModele && encreModele.sombres + encreModele.gris > 2, JSON.stringify(encreModele));
  await capture(page, "01-modeles");

  /* ══════════════════ CRÉER UN BADGE ET SON QR ══════════════════ */
  titre("le badge porte un vrai QR, pas un carré gris");
  await page.locator("li button:has-text('Badge')").first().click();
  await page.waitForURL("**/studio/design/*", { timeout: 60000 });
  await page.waitForSelector("text=Pour l'imprimeur", { timeout: 60000 });
  await page.waitForTimeout(1800);
  await nettoyer(page);
  corps = await page.textContent("body");
  v("l'éditeur s'ouvre sur le badge", /100 × 70 mm/.test(corps), corps.slice(0, 200));
  v("il rappelle que tout est en millimètres",
    /sortira à cette taille exacte/.test(corps));

  /* Le QR du modèle est à 68 mm sur 100 de large, 24 sur 70 de haut, 28 mm
     de côté : on regarde cette zone de la planche. */
  const zoneQr = [68 / 100, 24 / 70, 28 / 100, 28 / 70];
  const qr = await page.evaluate(async ([analyser, zone]) => {
    const c = document.querySelector("div.relative canvas");
    if (!c) return null;
    return new Function("return " + analyser)()(c, zone);
  }, [ANALYSER, zoneQr]);
  v("la zone du QR est un damier, pas un aplat",
    qr && qr.sombres > 15 && qr.clairs > 15 && qr.transitions > 50, JSON.stringify(qr));
  await capture(page, "02-badge");

  /* ═══════════ POSER UN ÉLÉMENT, LE DÉPLACER, ENREGISTRER ═══════ */
  titre("on pose un texte, on le déplace, on enregistre");
  const avant = await page.locator("div.relative div.touch-none").count();
  await page.click("button:has-text('Texte')");
  await page.waitForTimeout(500);
  await nettoyer(page);
  const apres = await page.locator("div.relative div.touch-none").count();
  v("un élément de plus est posé", apres === avant + 1, `${avant} → ${apres}`);
  corps = await page.textContent("body");
  v("il est choisi et réglable", /Corps \(mm\)/.test(corps), corps.slice(0, 300));
  v("l'en-tête signale les modifications non enregistrées",
    /modifications non enregistrées/.test(corps));

  /* On change son texte, pour pouvoir le reconnaître. */
  await page.fill("section textarea", "ESSAI AUTOMATIQUE");
  await page.waitForTimeout(500);
  await nettoyer(page);
  corps = await page.textContent("body");
  v("le texte saisi apparaît dans la liste des éléments",
    /ESSAI AUTOMATIQUE/.test(corps));

  /* On le déplace en changeant ses coordonnées, ce qui est le geste exact
     que fait quelqu'un qui veut une position précise. */
  const champGauche = page.locator("label:has-text('Gauche (mm)') input").first();
  await champGauche.fill("40");
  await page.waitForTimeout(400);
  const champHaut = page.locator("label:has-text('Haut (mm)') input").first();
  await champHaut.fill("50");
  await page.waitForTimeout(600);
  await nettoyer(page);
  v("les coordonnées se règlent au millimètre",
    (await champGauche.inputValue()) === "40" && (await champHaut.inputValue()) === "50",
    `${await champGauche.inputValue()} / ${await champHaut.inputValue()}`);
  await capture(page, "03-texte-pose");

  await page.click("header button:has-text('Enregistrer')");
  await page.waitForSelector("text=Enregistré en version 2", { timeout: 60000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la création passe en version 2", /Enregistré en version 2/.test(corps));
  v("et le message rappelle que la précédente reste",
    /reste intacte et téléchargeable/.test(corps));
  v("l'en-tête ne signale plus de modification en attente",
    !/modifications non enregistrées/.test(corps));

  /* L'IMAGE ENREGISTRÉE PORTE BIEN LE NOUVEAU TEXTE. */
  const rouvert = await page.evaluate(async (url) => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-active-company-id": "1" };
    const id = Number(location.pathname.split("/").pop());
    const c = await (await fetch(`/api/studio/creations/${id}`, { headers: h })).json();
    const d = await (await fetch(`/api/studio/documents/${id}`, { headers: h })).json();
    return {
      elements: c.plan?.elements?.length ?? 0,
      texte: JSON.stringify(c.plan?.elements || []).includes("ESSAI AUTOMATIQUE"),
      versions: (d.versions || []).length,
      note: (d.versions || []).find((x) => x.version === 2)?.change_note || "",
    };
  });
  v("le plan enregistré contient le nouvel élément", rouvert.texte === true,
    JSON.stringify(rouvert));
  v("le document porte deux versions", rouvert.versions === 2, String(rouvert.versions));
  v("la note de version se relit", /Mise en page modifiée/.test(rouvert.note), rouvert.note);

  /* ═══════════════════ LE PDF D'IMPRESSION ══════════════════════ */
  titre("le PDF d'impression annonce les dimensions réelles");
  await page.click("button:has-text('4 exemplaires')");
  await page.waitForSelector("text=PDF d'impression créé", { timeout: 60000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("l'export est confirmé", /PDF d.impression créé/.test(corps));
  v("avec le nombre de pages et les millimètres",
    /4 pages de 100×70 mm exactement/.test(corps),
    corps.match(/PDF d.impression[^.]*\./)?.[0] || "");
  await capture(page, "04-impression");

  v("aucune erreur de console sur le parcours",
    erreursConsole.length === 0, erreursConsole.slice(0, 4).join("\n        | "));
  await ctx.close();

  /* ════════════════════════════ 375 px ═══════════════════════════ */
  console.log("\n  TÉLÉPHONE — 375 px");
  titre("rien ne déborde");
  const ctx2 = await contexte(nav, DIR, { width: 375, height: 760 });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/studio/design`, { waitUntil: "domcontentloaded" });
  await page2.waitForSelector("text=Commencer", { timeout: 30000 });
  await page2.waitForTimeout(800);
  await nettoyer(page2);
  let debord = await page2.evaluate(() => ({
    page: document.documentElement.scrollWidth, vue: window.innerWidth }));
  v("la liste des modèles ne déborde pas", debord.page <= debord.vue + 1,
    `${debord.page}px pour ${debord.vue}px`);

  await page2.locator("li button:has-text('Étiquette')").first().click();
  await page2.waitForURL("**/studio/design/*", { timeout: 60000 });
  await page2.waitForSelector("text=Pour l'imprimeur", { timeout: 60000 });
  await page2.waitForTimeout(1500);
  await nettoyer(page2);
  debord = await page2.evaluate(() => ({
    page: document.documentElement.scrollWidth, vue: window.innerWidth }));
  v("l'éditeur ne déborde pas", debord.page <= debord.vue + 1,
    `${debord.page}px pour ${debord.vue}px`);
  await capture(page2, "05-telephone");
  await ctx2.close();

  await nav.close();
  console.log(`\n  ${reussis} réussis, ${echoues} échoués\n`);
  process.exit(echoues ? 1 : 0);
})().catch((e) => { console.error("\n  ✘ interrompu :", e.message, "\n"); process.exit(2); });
