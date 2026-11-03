"use strict";
/**
 * LES PRÉSENTATIONS, PAR L'ÉCRAN.
 *
 * CE QUE CET ESSAI ÉTABLIT, ET QU'AUCUN ESSAI D'API NE PEUT ÉTABLIR.
 *
 * 1. QUE CE QU'ON A VU EST CE QUI A ÉTÉ ENREGISTRÉ. L'écran dessine les
 *    diapositives dans le navigateur et les envoie en images ; le serveur les
 *    assemble en PDF. Si l'une de ces deux moitiés se trompait d'ordre, de
 *    taille ou de contenu, aucun essai d'API ne le verrait : il ne regarde
 *    que ce qu'on lui a envoyé. L'essai met donc à chaque diapositive un fond
 *    d'une COULEUR QU'IL CONNAÎT, enregistre, puis REND le PDF produit et
 *    relit le pixel central de chaque page.
 *
 * 2. QUE L'ALLER-RETOUR POWERPOINT MARCHE DEPUIS L'INTERFACE. L'essai
 *    exporte, télécharge le .pptx déposé, le relit avec le même module que le
 *    serveur, puis le REDÉPOSE par l'écran d'import et vérifie que le compte
 *    rendu s'affiche AVANT tout enregistrement.
 *
 * 3. QUE L'ÉCRAN NE LAISSE PAS PERDRE DE TRAVAIL. Le bandeau « modifications
 *    non enregistrées » apparaît dès la première touche et disparaît après
 *    l'enregistrement.
 */
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { lancer } = require(path.join(__dirname, "navigateur"));
const PPTX = require(path.join(__dirname, "..", "..", "triangle-wms-backend", "services", "pptx"));

const BASE = "http://localhost:3000";
const SECRET = process.env.SECRET || "test_studio";
const SORTIE = process.env.SORTIE || "/tmp/captures-pres";
const FRONT = path.join(__dirname, "..");

const DIR = { id: 900, fullname: "Direction Triangle", email: "dir@t.local",
  role: "direction", company_id: 1, is_super_admin: false };
const MAGA = { id: 902, fullname: "Magasinier Triangle", email: "maga@t.local",
  role: "magasinier", company_id: 1, is_super_admin: false };
const jeton = (u) => jwt.sign({ ...u, tenant_id: "triangle" }, SECRET, { expiresIn: "2h" });

let ok = 0, ko = 0;
const v = (n, c, d = "") => {
  if (c) { ok++; console.log(`  ✔ ${n}`); }
  else { ko++; console.log(`  ✘ ${n}${d ? `\n      → ${d}` : ""}`); }
};
const titre = (t) => console.log(`\n── ${t}`);

async function contexte(nav, utilisateur) {
  const t = jeton(utilisateur);
  const ctx = await nav.newContext({ viewport: { width: 1500, height: 1000 } });
  await ctx.addCookies([
    { name: "triangle_token", value: t, url: BASE },
    { name: "triangle_business_token", value: t, url: BASE },
  ]);
  await ctx.addInitScript(([j, u]) => {
    try {
      localStorage.setItem("token", j); localStorage.setItem("business_token", j);
      localStorage.setItem("user", JSON.stringify(u));
      localStorage.setItem("active_company_id", "1");
    } catch { /* rien */ }
  }, [t, utilisateur]);
  return ctx;
}

/* Les fonds qu'on posera, et qu'on retrouvera dans le PDF. */
const FONDS = ["#1d4ed8", "#15803d", "#b45309"];
const attendu = (hex) => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const proche = (vu, cible, marge = 42) =>
  vu.every((c, i) => Math.abs(c - cible[i]) <= marge);

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const nav = await lancer();

  /* Un onglet à part qui sait rendre un PDF et lire ses pixels. */
  const ctxRendu = await nav.newContext();
  const lecteur = await ctxRendu.newPage();
  await lecteur.route("**/*", (route) => {
    const u = route.request().url();
    const servir = (rel, type) => route.fulfill({
      body: fs.readFileSync(path.join(FRONT, "node_modules/pdfjs-dist", rel)),
      contentType: type });
    if (u.endsWith("/pdf.mjs")) return servir("build/pdf.mjs", "text/javascript");
    if (u.endsWith("/pdf.worker.mjs")) return servir("build/pdf.worker.mjs", "text/javascript");
    return route.fulfill({
      body: "<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>",
      contentType: "text/html" });
  });
  await lecteur.goto("http://lecteur.local/");

  /** Le pixel central de chaque page, et les dimensions en millimètres. */
  const pagesDu = async (octets) => lecteur.evaluate(async (tableau) => {
    const { getDocument, GlobalWorkerOptions } = await import("/pdf.mjs");
    GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
    const doc = await getDocument({ data: new Uint8Array(tableau) }).promise;
    const sortie = [];
    for (let n = 1; n <= doc.numPages; n += 1) {
      const pg = await doc.getPage(n);
      const vue = pg.getViewport({ scale: 1 });
      const c = document.createElement("canvas");
      c.width = Math.ceil(vue.width); c.height = Math.ceil(vue.height);
      const g = c.getContext("2d");
      await pg.render({ canvasContext: g, viewport: vue, canvas: c }).promise;
      const d = g.getImageData(Math.round(c.width * 0.05), Math.round(c.height * 0.9), 1, 1).data;
      sortie.push({
        largeurMm: (vue.width / 72) * 25.4, hauteurMm: (vue.height / 72) * 25.4,
        coin: [d[0], d[1], d[2]],
      });
    }
    return sortie;
  }, Array.from(octets));

  const ctx = await contexte(nav, DIR);
  const page = await ctx.newPage();
  page.setDefaultTimeout(40000);
  page.on("pageerror", (e) => console.log("  pageerror:", e.message.slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") console.log("  console:", m.text().slice(0, 200)); });

  /* ═════════════════ CRÉER DEPUIS L'ÉCRAN ═════════════════ */
  titre("Créer une présentation depuis l'écran");
  await page.goto(`${BASE}/studio/presentations`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Nouvelle présentation", { timeout: 40000 });
  const aide = (await page.textContent("main")).replace(/\s+/g, " ");
  v("l'écran dit d'avance ce qu'un import PowerPoint ne reprend pas",
    /tableaux, les graphiques, les SmartArt/.test(aide) && /masque ne le sont pas/.test(aide),
    aide.slice(0, 300));
  v("et il nomme les formats qui ne s'ouvrent pas ici",
    /\.ppt.*avant 2007/.test(aide) && /\.odp/.test(aide) && /\.key/.test(aide),
    aide.slice(0, 400));

  await page.click("button:has-text('Nouvelle présentation')");
  await page.waitForSelector("input[placeholder='Bilan du trimestre']");
  await page.fill("input[placeholder='Bilan du trimestre']", "Bilan essai");
  const choix = page.locator("main select");
  v("on choisit d'emblée qui peut la voir",
    (await choix.first().locator("option").count()) === 3,
    `${await choix.first().locator("option").count()} option(s)`);
  v("deux formats sont proposés",
    (await choix.nth(1).locator("option").count()) === 2,
    `${await choix.nth(1).locator("option").count()} option(s)`);
  v("et six modèles de première diapositive",
    (await choix.nth(2).locator("option").count()) === 6,
    `${await choix.nth(2).locator("option").count()} option(s)`);
  /* On la rend visible à la société : c'est ce qui permet, plus bas,
     d'éprouver la lecture SEULE par quelqu'un d'autre. Une présentation
     privée serait simplement introuvable pour lui — ce qui est juste, mais
     n'éprouve pas l'écran en lecture. */
  await choix.first().selectOption("SOCIETE");
  await page.click("button:has-text('Créer et ouvrir')");
  await page.waitForURL(/\/studio\/presentations\/\d+$/, { timeout: 60000 });
  const idPres = Number(page.url().match(/(\d+)$/)[1]);
  v("l'éditeur s'ouvre sur la présentation créée", Number.isInteger(idPres), page.url());

  await page.waitForSelector("button[aria-label='Diapositive 1']", { timeout: 40000 });
  await page.waitForTimeout(800);
  let entete = (await page.textContent("header")).replace(/\s+/g, " ");
  v("l'en-tête nomme la présentation", /Bilan essai/.test(entete), entete);
  v("elle compte une diapositive, en version 1",
    /1 diapositive/.test(entete) && /version 1/.test(entete), entete);
  v("et donne les dimensions du 16/9", /339 × 191 mm/.test(entete), entete);
  v("rien n'est encore modifié", !/non enregistrées/.test(entete), entete);

  /* ═════════════ AJOUTER DES DIAPOSITIVES ET DES FONDS ═════════════ */
  titre("Ajouter des diapositives, et leur donner un fond connu");
  const bande = page.locator("aside button[aria-label^='Diapositive']");
  const ajouter = page.locator("select[aria-label='Ajouter une diapositive']");
  await ajouter.selectOption("titre-contenu");
  await page.waitForTimeout(500);
  await ajouter.selectOption("chiffre");
  await page.waitForTimeout(500);
  v("la bande montre trois diapositives", (await bande.count()) === 3,
    `${await bande.count()}`);
  entete = (await page.textContent("header")).replace(/\s+/g, " ");
  v("l'en-tête suit le compte", /3 diapositives/.test(entete), entete);
  v("ET PRÉVIENT QUE RIEN N'EST ENREGISTRÉ", /non enregistrées/.test(entete), entete);

  /* Le fond se règle quand AUCUN élément n'est sélectionné. */
  for (let i = 0; i < 3; i += 1) {
    await bande.nth(i).click();
    await page.waitForTimeout(350);
    /* On clique dans la zone de la toile pour désélectionner, puis on prend
       la couleur dans le panneau du fond. */
    const bouton = page.locator(`aside button[aria-label='Fond ${FONDS[i]}']`);
    if (!(await bouton.count())) {
      /* Un élément est sélectionné : le panneau montre ses réglages. On
         désélectionne en cliquant hors de tout élément. */
      await page.locator("section div.relative.inline-block").click({ position: { x: 4, y: 4 } });
      await page.waitForTimeout(250);
    }
    await page.locator(`aside button[aria-label='Fond ${FONDS[i]}']`).click();
    await page.waitForTimeout(350);
  }
  await page.screenshot({ path: `${SORTIE}/01-trois-diapositives.png`, fullPage: false });

  /* ═════════════ ENREGISTRER, ET REGARDER LE PDF ═════════════ */
  titre("Ce qu'on a vu est ce qui a été enregistré");
  await page.click("header button:has-text('Enregistrer')");
  await page.waitForSelector("[data-bandeau='succes']", { timeout: 90000 });
  const succes = (await page.textContent("[data-bandeau='succes']")).replace(/\s+/g, " ");
  v("l'enregistrement réussit", /version 2/.test(succes), succes);
  v("et rappelle que la précédente reste intacte",
    /précédente reste intacte/.test(succes), succes);
  entete = (await page.textContent("header")).replace(/\s+/g, " ");
  v("le bandeau « non enregistrées » a disparu", !/non enregistrées/.test(entete), entete);
  v("et l'en-tête annonce la version 2", /version 2/.test(entete), entete);

  const telecharger = async (id) => {
    const tableau = await page.evaluate(async (documentId) => {
      const r = await fetch(`/api/studio/documents/${documentId}/fichier`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`,
          "x-active-company-id": "1" } });
      return Array.from(new Uint8Array(await r.arrayBuffer()));
    }, id);
    return Buffer.from(tableau);
  };
  const pdf = await telecharger(idPres);
  v("le PDF enregistré se télécharge",
    pdf.subarray(0, 5).toString("latin1") === "%PDF-", `${pdf.length} octets`);
  const pages = await pagesDu(pdf);
  v("il a une page par diapositive", pages.length === 3, String(pages.length));
  v("chaque page fait la taille du 16/9",
    pages.every((p) => Math.abs(p.largeurMm - 338.667) < 0.5 && Math.abs(p.hauteurMm - 190.5) < 0.5),
    pages.map((p) => `${p.largeurMm.toFixed(1)}×${p.hauteurMm.toFixed(1)}`).join(" "));
  /* LA VÉRIFICATION QUI COMPTE : chaque page porte le fond de SA diapositive,
     dans le bon ordre. Un ordre mélangé entre le navigateur et le serveur ne
     se verrait nulle part ailleurs. */
  pages.forEach((p, i) => {
    v(`la page ${i + 1} porte le fond de la diapositive ${i + 1} (${FONDS[i]})`,
      proche(p.coin, attendu(FONDS[i])),
      `rvb ${p.coin.join(",")} au lieu de ${attendu(FONDS[i]).join(",")}`);
  });

  /* ═════════════ LA DERNIÈRE DIAPOSITIVE NE SE SUPPRIME PAS ═════════════ */
  titre("Une présentation garde au moins une diapositive");
  const supprimer = page.locator("aside button[aria-label='Supprimer cette diapositive']");
  await supprimer.click(); await page.waitForTimeout(300);
  await supprimer.click(); await page.waitForTimeout(300);
  v("il ne reste qu'une diapositive", (await bande.count()) === 1, `${await bande.count()}`);
  await supprimer.click();
  await page.waitForSelector("[data-bandeau='erreur']", { timeout: 20000 });
  const refus = (await page.textContent("[data-bandeau='erreur']")).replace(/\s+/g, " ");
  v("supprimer la dernière est refusé, et expliqué",
    /dernière diapositive/.test(refus) && /au moins une/.test(refus), refus);
  v("et elle est toujours là", (await bande.count()) === 1, `${await bande.count()}`);

  /* On recharge pour repartir de la version enregistrée. */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("button[aria-label='Diapositive 3']", { timeout: 40000 });
  v("recharger sans enregistrer rend les trois diapositives",
    (await page.locator("aside button[aria-label^='Diapositive']").count()) === 3,
    `${await page.locator("aside button[aria-label^='Diapositive']").count()}`);

  /* ═════════════════ EXPORTER VERS POWERPOINT ═════════════════ */
  titre("L'aller-retour PowerPoint, depuis l'écran");
  const avertissement = (await page.textContent("main")).replace(/\s+/g, " ");
  v("l'écran prévient que le PDF est exact et l'export approché",
    /PDF est exact/.test(avertissement) && /bouger d'un millimètre/.test(avertissement),
    avertissement.slice(-400));

  await page.click("header button:has-text('PowerPoint')");
  await page.waitForSelector("[data-bandeau='succes']", { timeout: 60000 });
  const msgExport = (await page.textContent("[data-bandeau='succes']")).replace(/\s+/g, " ");
  v("l'export réussit", /Export PowerPoint déposé/.test(msgExport), msgExport);
  v("et dit que les formes sont modifiables", /modifiables/.test(msgExport), msgExport);
  v("et nomme le fichier déposé", /\.pptx/.test(msgExport), msgExport);

  const idPptx = await page.evaluate(async () => {
    const r = await fetch("/api/studio/documents?recherche=.pptx", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`,
        "x-active-company-id": "1" } });
    const d = await r.json();
    const trouve = (d.documents || []).find((x) => /\.pptx$/i.test(x.name));
    return trouve ? Number(trouve.id) : null;
  });
  v("le .pptx est dans la bibliothèque", Number.isInteger(idPptx), String(idPptx));
  const octetsPptx = await telecharger(idPptx);
  const relu = await PPTX.lire(octetsPptx);
  v("il contient les trois diapositives", relu.diapositives.length === 3,
    String(relu.diapositives.length));
  v("avec les fonds posés à l'écran",
    relu.diapositives.every((d, i) => String(d.fond).toLowerCase() === FONDS[i]),
    JSON.stringify(relu.diapositives.map((d) => d.fond)));

  /* ═════════════════ RÉIMPORTER PAR L'ÉCRAN ═════════════════ */
  titre("Réimporter ce .pptx : lu, montré, et rien d'enregistré");
  await page.goto(`${BASE}/studio/presentations`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Importer un PowerPoint", { timeout: 40000 });
  const avantImport = await page.locator("main ul li a").count();
  await page.setInputFiles("input[type='file'][accept='.pptx']", {
    name: "reimport.pptx", mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: octetsPptx });
  await page.waitForSelector("text=Ce que cela donnera", { timeout: 60000 });
  await page.waitForTimeout(1200);
  const lu = (await page.textContent("main")).replace(/\s+/g, " ");
  v("trois diapositives sont annoncées", /3 diapositives lues/.test(lu), lu.slice(0, 300));
  v("L'ÉCRAN DIT QUE RIEN N'EST ENCORE ENREGISTRÉ",
    /rien n'est encore enregistré/i.test(lu), lu.slice(0, 400));
  v("le compte rendu de l'import est affiché",
    (await page.locator("[data-compte-rendu]").count()) === 1,
    `${await page.locator("[data-compte-rendu]").count()} compte(s) rendu(s)`);
  v("les aperçus sont dessinés", (await page.locator("main figure canvas").count()) === 3,
    `${await page.locator("main figure canvas").count()} aperçu(s)`);
  v("et la liste n'a pas bougé : rien n'est entré dans la bibliothèque",
    (await page.locator("main ul li a").count()) === avantImport,
    `${await page.locator("main ul li a").count()} au lieu de ${avantImport}`);
  await page.screenshot({ path: `${SORTIE}/02-import-compte-rendu.png`, fullPage: true });

  /* Abandonner ne laisse rien. */
  await page.click("button:has-text('Abandonner')");
  await page.waitForTimeout(400);
  v("abandonner ferme l'aperçu sans rien créer",
    (await page.locator("main figure canvas").count()) === 0
    && (await page.locator("main ul li a").count()) === avantImport);

  /* Garder, cette fois. */
  await page.setInputFiles("input[type='file'][accept='.pptx']", {
    name: "reimport.pptx", mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: octetsPptx });
  await page.waitForSelector("text=Ce que cela donnera", { timeout: 60000 });
  await page.locator("section select").first().selectOption("SOCIETE");
  await page.fill("section input[value='reimport']", "Reprise du bilan");
  await page.click("button:has-text('Garder cette présentation')");
  await page.waitForURL(/\/studio\/presentations\/\d+$/, { timeout: 90000 });
  const idReprise = Number(page.url().match(/(\d+)$/)[1]);
  v("la présentation importée est créée et ouverte",
    Number.isInteger(idReprise) && idReprise !== idPres, String(idReprise));
  await page.waitForSelector("button[aria-label='Diapositive 3']", { timeout: 40000 });
  v("avec ses trois diapositives",
    (await page.locator("aside button[aria-label^='Diapositive']").count()) === 3,
    `${await page.locator("aside button[aria-label^='Diapositive']").count()}`);
  const pdfReprise = await telecharger(idReprise);
  const pagesReprise = await pagesDu(pdfReprise);
  v("et son PDF porte les mêmes fonds, dans le même ordre",
    pagesReprise.length === 3
    && pagesReprise.every((p, i) => proche(p.coin, attendu(FONDS[i]))),
    pagesReprise.map((p) => p.coin.join(",")).join(" | "));

  /* La provenance garde le compte rendu. */
  const provenance = await page.evaluate(async (id) => {
    const r = await fetch(`/api/studio/documents/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`,
        "x-active-company-id": "1" } });
    const d = await r.json();
    return d?.document?.source_note || "";
  }, idReprise);
  v("LA PROVENANCE DU DOCUMENT GARDE LA TRACE DE L'IMPORT",
    /Importée d'un fichier PowerPoint/.test(provenance), provenance.slice(0, 220));

  /* ═════════════════ CE QUI N'EST PAS UN .PPTX ═════════════════ */
  titre("Ce qui n'est pas un .pptx est refusé, et dit pourquoi");
  await page.goto(`${BASE}/studio/presentations`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Importer un PowerPoint", { timeout: 40000 });
  await page.setInputFiles("input[type='file'][accept='.pptx']", {
    name: "faux.pptx", mimeType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    buffer: pdf });
  await page.waitForSelector("[data-bandeau='erreur']", { timeout: 40000 });
  const refusImport = (await page.textContent("[data-bandeau='erreur']")).replace(/\s+/g, " ");
  v("un PDF renommé en .pptx est refusé", /n'est pas un \.pptx|archive/i.test(refusImport),
    refusImport);
  v("et aucun aperçu n'est montré", (await page.locator("main figure canvas").count()) === 0);

  /* ═════════════════ LES DROITS ═════════════════ */
  titre("Regarder n'est pas modifier");
  const ctxMaga = await contexte(nav, MAGA);
  const vueMaga = await ctxMaga.newPage();
  vueMaga.setDefaultTimeout(40000);
  await vueMaga.goto(`${BASE}/studio/presentations`, { waitUntil: "domcontentloaded" });
  await vueMaga.waitForSelector("main", { timeout: 40000 });
  await vueMaga.waitForTimeout(800);
  const texteMaga = (await vueMaga.textContent("main")).replace(/\s+/g, " ");
  v("le magasinier voit la liste",
    (await vueMaga.locator("main ul li a").count()) > 0,
    `${await vueMaga.locator("main ul li a").count()} fiche(s)`);
  v("l'écran lui dit qu'il ne peut pas créer",
    /pas en créer/.test(texteMaga), texteMaga.slice(0, 220));
  v("et le bouton de création n'est pas là",
    (await vueMaga.locator("button:has-text('Nouvelle présentation')").count()) === 0);

  await vueMaga.goto(`${BASE}/studio/presentations/${idPres}`, { waitUntil: "domcontentloaded" });
  await vueMaga.waitForSelector("button[aria-label='Diapositive 1']", { timeout: 40000 });
  await vueMaga.waitForTimeout(600);
  const editeurMaga = (await vueMaga.textContent("main")).replace(/\s+/g, " ");
  v("il ouvre l'éditeur en lecture", /pas la modifier/.test(editeurMaga),
    editeurMaga.slice(0, 220));
  v("sans bouton « Enregistrer »",
    (await vueMaga.locator("header button:has-text('Enregistrer')").count()) === 0);
  v("ni bouton « PowerPoint »",
    (await vueMaga.locator("header button:has-text('PowerPoint')").count()) === 0);
  v("et sans outil pour ajouter quoi que ce soit",
    (await vueMaga.locator("button:has-text('Rectangle')").count()) === 0);
  await vueMaga.screenshot({ path: `${SORTIE}/03-sans-droit.png`, fullPage: false });

  await nav.close();
  console.log(`\n  ${ok} réussis, ${ko} échoués`);
  console.log(`  captures dans ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => {
  console.error("\n  ✘ interrompu :", e.message, "\n", e.stack);
  process.exit(2);
});
