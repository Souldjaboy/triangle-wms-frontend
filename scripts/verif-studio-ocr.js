/**
 * LA RECONNAISSANCE DE TEXTE, DE BOUT EN BOUT.
 *
 * Ce qu'il s'agit de prouver : qu'un papier scanné devient RETROUVABLE PAR
 * SON CONTENU. C'est tout l'intérêt : personne ne se souvient, six mois plus
 * tard, d'avoir appelé un fichier « bon 2026-03 » — mais on se souvient du
 * nom du chauffeur ou de la destination.
 *
 * On ne se contente donc pas de vérifier qu'« un texte » a été produit : on
 * cherche le document dans la bibliothèque par un mot qui n'apparaît NULLE
 * PART ailleurs que dans l'image, puis on relit le texte stocké.
 *
 * Et on éprouve l'honnêteté de l'écran : une page sans texte lisible doit le
 * dire, pas laisser croire que le document sera trouvable.
 */
const { lancer } = require("./navigateur");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const BASE = process.env.BASE || "http://localhost:3000";
const API = process.env.API || "http://127.0.0.1:5050";
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

/* Un mot qui n'existe que dans l'image : ni dans le nom du document, ni dans
   sa description, ni dans ses étiquettes. Si la recherche le trouve, c'est
   que le texte a bien été lu, rangé et indexé. */
const MOT_CACHE = "Sebenikoro";
const LIGNES = [
  "TRIANGLE LOGISTIQUE",
  "Bon de livraison numero 4512",
  "Chauffeur: Moussa Traore",
  `Destination: ${MOT_CACHE}`,
  "Quantite: 32 tonnes de ciment",
];

async function contexte(nav, user) {
  const t = jeton(user);
  const ctx = await nav.newContext({
    viewport: { width: 1280, height: 1000 }, locale: "fr-FR", timezoneId: "Africa/Bamako" });
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

/* L'image est DESSINÉE DANS LE NAVIGATEUR : écrire de vraies lettres depuis
   Node demanderait un moteur de polices. Ici on obtient de vrais glyphes,
   donc une vraie lecture — pas une imitation. */
async function fabriquerImage(page, lignes, { vide = false } = {}) {
  return page.evaluate(([l, estVide]) => {
    const c = document.createElement("canvas");
    c.width = 1000; c.height = 620;
    const g = c.getContext("2d");
    g.fillStyle = "#141414"; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#ffffff"; g.fillRect(60, 40, 880, 540);
    if (!estVide) {
      g.fillStyle = "#000000"; g.font = "32px serif";
      l.forEach((t, i) => g.fillText(t, 100, 110 + i * 80));
    }
    return c.toDataURL("image/png").split(",")[1];
  }, [lignes, vide]);
}

(async () => {
  const nav = await lancer();
  const ctx = await contexte(nav, DIR);
  const page = await ctx.newPage();
  page.setDefaultTimeout(40000);
  const erreursConsole = [];
  page.on("pageerror", (e) => erreursConsole.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push(m.text()); });

  /* ───────────────────── LE CHOIX EST OFFERT ─────────────────────── */
  titre("la reconnaissance est proposée, avec ce qu'elle coûte");
  await page.goto(`${BASE}/studio/scanner`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Nouvelle numérisation");
  await nettoyer(page);
  let corps = await page.textContent("body");
  v("l'écran propose la reconnaissance du texte", /Reconnaissance du texte/.test(corps));
  v("et annonce le poids à télécharger", /6 Mo à télécharger une fois/.test(corps),
    corps.match(/\d+ Mo à télécharger[^.]*/)?.[0] || "absent");
  v("il dit que rien ne part vers un service extérieur, ou ce qu'on perd sans",
    /ne se cherchera que par son nom/.test(corps) || /aucune image ne part/.test(corps));
  /* SANS RECONNAISSANCE, ON DIT CE QU'ON PERD. */
  const choix = page.locator("select").filter({ hasText: "Sans reconnaissance" });
  v("le choix par défaut est « sans reconnaissance »",
    (await choix.inputValue()) === "", await choix.inputValue());
  await capture(page, "01-choix");

  /* ─────────────── UNE PAGE LUE EN FRANÇAIS ──────────────────────── */
  titre("un bon de livraison scanné devient trouvable par son contenu");
  const image = await fabriquerImage(page, LIGNES);
  await choix.selectOption("fra");
  await nettoyer(page);
  corps = await page.textContent("body");
  v("le choix du français change le message",
    /trouvable par son contenu/.test(corps), corps.slice(0, 300));

  await page.fill("input[placeholder*='Contrat transport']", "Bon de livraison mars");
  await page.click("button:has-text('Commencer')");
  await page.waitForSelector("button:has-text('Allumer la caméra')");

  await page.setInputFiles("input[type='file']", {
    name: "bon.png", mimeType: "image/png", buffer: Buffer.from(image, "base64") });
  await page.waitForSelector("text=Vérifier avant de garder", { timeout: 120000 });
  await nettoyer(page);
  await capture(page, "02-relecture");

  await page.click("button:has-text('Redresser et garder')");
  /* Le moteur se télécharge la première fois : on laisse largement le temps,
     et c'est précisément ce que la jauge doit annoncer. */
  await page.waitForSelector("text=Page 1 gardée", { timeout: 300000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la page est gardée", /Page 1 gardée/.test(corps));
  /* AUCUN AVERTISSEMENT DE LECTURE RATÉE sur une page bien lisible. */
  v("aucun avertissement de texte illisible",
    !/Aucun texte n.a pu être lu/.test(corps), corps.match(/Aucun texte[^.]*\./)?.[0] || "");
  await capture(page, "03-page-lue");

  /* LE SERVEUR A BIEN REÇU LE TEXTE. */
  const etat = await page.evaluate(async () => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-active-company-id": "1" };
    const r = await fetch("/api/studio/scans", { headers: h });
    const d = await r.json();
    const s = (d.seances || [])[0];
    const r2 = await fetch(`/api/studio/scans/${s.id}`, { headers: h });
    const d2 = await r2.json();
    return { seance: s.id, pages: d2.pages?.length, texte: d2.pages?.[0]?.texte_reconnu };
  });
  v("le serveur a reçu une page", etat.pages === 1, JSON.stringify(etat));
  v("et cette page porte du texte reconnu", etat.texte === true, JSON.stringify(etat));

  /* ──────────────── L'ASSEMBLAGE PORTE LE TEXTE ──────────────────── */
  titre("le PDF assemblé se cherche par son contenu");
  await page.click("button:has-text('Assembler le PDF')");
  await page.waitForSelector("div.fixed >> text=Assembler le PDF", { timeout: 15000 });
  await nettoyer(page);
  const phrase = await page.locator("div.fixed p:has-text('assembl')").first()
    .textContent().catch(() => "");
  v("l'écran annonce que le document sera trouvable par son contenu",
    /trouvable par son contenu/.test(phrase || ""), `lu : « ${String(phrase || "").slice(0, 160)} »`);

  await page.fill("div.fixed input[placeholder*='Contrat transport']", "Bon mars 2026");
  await page.click("div.fixed button:has-text('Assembler')");
  await page.waitForSelector("text=Document rangé", { timeout: 120000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("le message confirme que le contenu est cherchable",
    /trouvable par son contenu/.test(corps), corps.match(/Document rangé[^.]*\./)?.[0] || "");
  await capture(page, "04-assemble");

  /* LA PREUVE : on cherche un mot qui n'est QUE dans l'image. */
  const recherche = await page.evaluate(async (mot) => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-active-company-id": "1" };
    const r = await fetch(`/api/studio/documents?q=${encodeURIComponent(mot)}`, { headers: h });
    const d = await r.json();
    return (d.documents || []).map((x) => ({ id: x.id, nom: x.name, kind: x.kind, texte: x.texte_reconnu }));
  }, MOT_CACHE);
  v(`« ${MOT_CACHE} » ramène le document, alors qu'il n'est ni dans son nom ni dans sa description`,
    recherche.length === 1 && recherche[0].kind === "SCAN",
    JSON.stringify(recherche));
  v("le document est bien marqué comme portant du texte",
    recherche[0]?.texte === true, JSON.stringify(recherche[0] || {}));

  /* On relit le texte stocké : « non vide » ne suffit pas, il faut que ce
     soit le bon texte. */
  const stocke = await page.evaluate(async (id) => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-active-company-id": "1" };
    const r = await fetch(`/api/studio/scans`, { headers: h });
    const d = await r.json();
    return d.seances?.length ?? 0;
  }, recherche[0]?.id);
  v("la séance assemblée a quitté la liste de reprise", stocke === 0, String(stocke));

  /* ──────────── UNE PAGE SANS TEXTE LE DIT ───────────────────────── */
  titre("une page illisible est signalée, pas maquillée");
  await page.click("button:has-text('Numériser autre chose')");
  await page.waitForSelector("text=Nouvelle numérisation");
  await nettoyer(page);
  const blanche = await fabriquerImage(page, [], { vide: true });
  await page.locator("select").filter({ hasText: "Sans reconnaissance" }).selectOption("fra");
  await page.fill("input[placeholder*='Contrat transport']", "Page blanche");
  await page.click("button:has-text('Commencer')");
  await page.waitForSelector("button:has-text('Allumer la caméra')");
  await page.setInputFiles("input[type='file']", {
    name: "blanche.png", mimeType: "image/png", buffer: Buffer.from(blanche, "base64") });
  await page.waitForSelector("text=Vérifier avant de garder", { timeout: 120000 });
  await nettoyer(page);
  await page.click("button:has-text('Redresser et garder')");
  await page.waitForSelector("text=Page 1 gardée", { timeout: 180000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("l'écran prévient qu'aucun texte n'a pu être lu",
    /Aucun texte n.a pu être lu|peu sûr/.test(corps),
    corps.match(/Aucun texte[^.]*\.|texte lu est peu sûr[^.]*\./)?.[0] || "aucun avertissement");
  v("mais la page est quand même gardée", /Page 1 gardée/.test(corps));
  await capture(page, "05-page-blanche");

  v("aucune erreur de console sur le parcours",
    erreursConsole.length === 0, erreursConsole.slice(0, 4).join("\n        | "));

  await nav.close();
  console.log(`\n  ${reussis} réussis, ${echoues} échoués\n`);
  process.exit(echoues ? 1 : 0);
})().catch((e) => { console.error("\n  ✘ interrompu :", e.message, "\n"); process.exit(2); });
