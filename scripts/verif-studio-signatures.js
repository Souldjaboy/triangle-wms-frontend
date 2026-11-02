/**
 * SIGNER UN PDF DEPUIS L'ÉCRAN.
 *
 * Ce qu'il s'agit de prouver : qu'on trace sa signature, qu'on la pose où
 * l'on veut sur la page qu'on veut, et que **l'encre se retrouve réellement
 * dans le PDF produit, au bon endroit**.
 *
 * Vérifier que la réponse du serveur dit « signé » ne prouve rien : on REND
 * donc le PDF signé comme un lecteur le ferait, et on regarde les pixels —
 * sur la page visée, et sur celle qu'il ne fallait pas toucher.
 *
 * On éprouve aussi la promesse qui rend tout le reste crédible : la
 * signature d'une personne n'apparaît chez personne d'autre.
 */
const { lancer } = require("./navigateur");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE || "http://localhost:3000";
const SECRET = process.env.SECRET || "test_studio";
const SORTIE = process.env.SORTIE;
const RACINE = path.join(__dirname, "..");

let reussis = 0, echoues = 0;
const v = (n, c, d = "") => {
  if (c) { reussis += 1; console.log(`    ✓ ${n}`); }
  else { echoues += 1; console.log(`    ✘ ${n}${d ? `\n        → ${d}` : ""}`); }
};
const titre = (t) => console.log(`\n  ── ${t}`);
const jeton = (u) => jwt.sign({ ...u, tenant_id: "triangle" }, SECRET, { expiresIn: "2h" });

const DIR = { id: 900, fullname: "Direction Triangle", email: "dir@t.local",
              role: "direction", company_id: 1, is_super_admin: false };
const COMPTA = { id: 901, fullname: "Comptable Triangle", email: "compta@t.local",
                 role: "comptable", company_id: 1, is_super_admin: false };

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

/* Un PDF de deux pages blanches, fabriqué dans le navigateur n'étant pas
   possible : on passe par l'API avec un PDF minimal mais valide. */
function pdfDeuxPages() {
  const page = (n) => `${n} 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n`;
  const corps =
    `%PDF-1.4\n` +
    `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
    `2 0 obj<</Type/Pages/Kids[3 0 R 4 0 R]/Count 2>>endobj\n` +
    page(3) + page(4) +
    `trailer<</Root 1 0 R>>\n%%EOF\n`;
  return Buffer.from(corps, "latin1");
}

/* ─────────── LIRE LE PDF PRODUIT, COMME UN LECTEUR LE FERAIT ───────────
   pdf.js est servi depuis le disque dans une page à part : on ne dépend ni
   du réseau ni de l'application pour cette vérification. */
async function lecteurPdf(nav) {
  const ctx = await nav.newContext();
  const page = await ctx.newPage();
  await page.route("**/*", (route) => {
    const u = route.request().url();
    const servir = (rel) => route.fulfill({
      body: fs.readFileSync(path.join(RACINE, "node_modules/pdfjs-dist", rel)),
      contentType: "text/javascript",
    });
    if (u.endsWith("/pdf.mjs")) return servir("build/pdf.mjs");
    if (u.endsWith("/pdf.worker.mjs")) return servir("build/pdf.worker.mjs");
    return route.fulfill({
      body: "<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>",
      contentType: "text/html",
    });
  });
  await page.goto("http://lecteur.local/");
  return {
    /** Rend une page et rend la part de pixels sombres, par quadrant. */
    encre: (octets, numero) => page.evaluate(async ([donnees, n]) => {
      const { getDocument, GlobalWorkerOptions } = await import("/pdf.mjs");
      GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
      const doc = await getDocument({ data: new Uint8Array(donnees) }).promise;
      const pg = await doc.getPage(n);
      const vue = pg.getViewport({ scale: 1.5 });
      const c = document.createElement("canvas");
      c.width = Math.ceil(vue.width); c.height = Math.ceil(vue.height);
      const g = c.getContext("2d");
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: g, viewport: vue, canvas: c }).promise;
      const d = g.getImageData(0, 0, c.width, c.height).data;
      /* Quatre quadrants : on dit où l'encre se trouve, pas seulement
         qu'il y en a. */
      const q = { hautGauche: 0, hautDroite: 0, basGauche: 0, basDroite: 0 };
      let total = 0;
      for (let y = 0; y < c.height; y += 2) {
        for (let x = 0; x < c.width; x += 2) {
          const i = (y * c.width + x) * 4;
          const sombre = d[i] < 170 && d[i + 1] < 170 && d[i + 2] < 170;
          total += 1;
          if (!sombre) continue;
          const haut = y < c.height / 2, gauche = x < c.width / 2;
          q[haut ? (gauche ? "hautGauche" : "hautDroite")
                 : (gauche ? "basGauche" : "basDroite")] += 1;
        }
      }
      const part = (n2) => Number(((n2 / (total / 4)) * 100).toFixed(2));
      return {
        pages: doc.numPages,
        hautGauche: part(q.hautGauche), hautDroite: part(q.hautDroite),
        basGauche: part(q.basGauche), basDroite: part(q.basDroite),
      };
    }, [Array.from(octets), numero]),
    fermer: () => ctx.close(),
  };
}

(async () => {
  const nav = await lancer();
  const ctx = await contexte(nav, DIR);
  const page = await ctx.newPage();
  page.setDefaultTimeout(40000);
  const erreursConsole = [];
  page.on("pageerror", (e) => erreursConsole.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push(m.text()); });

  /* ═════════════════════ TRACER SA SIGNATURE ═══════════════════════ */
  titre("on trace sa signature, et elle n'est qu'à soi");
  await page.goto(`${BASE}/studio/signatures`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Ma signature", { timeout: 25000 });
  await nettoyer(page);
  let corps = await page.textContent("body");
  v("l'écran dit que la signature n'est visible que de soi",
    /visible que de vous/.test(corps));
  v("et pourquoi elle ne sort jamais d'ici",
    /signer à votre place/.test(corps), corps.slice(0, 300));
  v("il distingue le cachet de la maison",
    /Cachets de l.entreprise/.test(corps) && /engage la maison/.test(corps));
  await capture(page, "01-signatures-vide");

  await page.click("button:has-text('Créer ma signature')");
  await page.waitForSelector("text=Nouvelle signature", { timeout: 15000 });
  await nettoyer(page);

  /* On dessine vraiment : une suite de traits au pointeur, comme un doigt. */
  const toile = page.locator("div.fixed canvas").first();
  const boite = await toile.boundingBox();
  v("la zone de tracé est là", !!boite && boite.width > 100, JSON.stringify(boite));
  await page.mouse.move(boite.x + boite.width * 0.2, boite.y + boite.height * 0.65);
  await page.mouse.down();
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    await page.mouse.move(
      boite.x + boite.width * (0.2 + 0.6 * t),
      boite.y + boite.height * (0.65 - 0.33 * Math.sin(t * Math.PI * 1.6)),
      { steps: 2 });
  }
  await page.mouse.up();
  await page.waitForTimeout(300);

  await page.fill("div.fixed input[placeholder*='Paraphe']", "Paraphe de direction");
  await capture(page, "02-trace");
  await page.click("div.fixed button:has-text('Enregistrer')");
  await page.waitForSelector("text=Signature enregistrée", { timeout: 25000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la signature est enregistrée", /Signature enregistrée/.test(corps));
  v("elle porte son nom", /Paraphe de direction/.test(corps));
  v("elle est celle par défaut", /par défaut/.test(corps));
  v("et l'écran dit qu'elle n'a jamais servi", /Jamais utilisée/.test(corps));
  await page.waitForSelector("li img[alt='Paraphe de direction']", { timeout: 20000 });
  const vignette = await page.locator("li img[alt='Paraphe de direction']")
    .evaluate((el) => ({ l: el.naturalWidth, h: el.naturalHeight }));
  /* LE TRACÉ EST RECADRÉ : une signature minuscule au milieu d'un grand vide
     serait impossible à placer précisément. */
  v("le tracé a été recadré sur ce qui a été dessiné",
    vignette.l > 50 && vignette.h > 20 && vignette.l > vignette.h,
    JSON.stringify(vignette));
  await capture(page, "03-signature-enregistree");

  /* ═════════════════════ DÉPOSER UN PDF À SIGNER ═══════════════════ */
  titre("on signe un PDF depuis sa fiche");
  const docId = await page.evaluate(async (octets) => {
    const f = new FormData();
    f.append("fichier", new Blob([new Uint8Array(octets)], { type: "application/pdf" }),
      "Contrat a signer.pdf");
    f.append("nom", "Contrat a signer.pdf");
    f.append("visibilite", "SOCIETE");
    const r = await fetch("/api/studio/documents", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`,
        "x-active-company-id": "1" },
      body: f });
    const d = await r.json();
    return d.document?.id ?? null;
  }, Array.from(pdfDeuxPages()));
  v("le PDF d'essai est déposé", !!docId, String(docId));

  await page.goto(`${BASE}/studio/bibliotheque`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main li button", { timeout: 25000 });
  await nettoyer(page);
  await page.locator("main li button").filter({ hasText: "Contrat a signer" }).first().click();
  /* LE BOUTON EST VISÉ PAR SON RÔLE ET SON NOM EXACT.
     « :has-text() » cherche une sous-chaîne sans distinguer la casse : le
     document s'appelant « Contrat a signer.pdf », le sélecteur attrapait
     aussi les lignes de la liste, et le clic partait au hasard. */
  const boutonSigner = page.getByRole("button", { name: "Signer", exact: true });
  await boutonSigner.waitFor({ state: "visible", timeout: 20000 });
  await nettoyer(page);
  v("la fiche propose de signer", (await boutonSigner.count()) === 1,
    `${await boutonSigner.count()} boutons trouvés`);

  await boutonSigner.click();
  await page.waitForSelector("text=Apposer la signature en page", { timeout: 60000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  /* CE QUI VA ARRIVER AU DOCUMENT, DIT AVANT LE CLIC. */
  v("l'écran prévient que l'original ne sera pas remplacé",
    /ne remplace pas l.original/.test(corps));
  v("il dit que la version non signée restera téléchargeable",
    /restera intacte et téléchargeable/.test(corps));
  v("il annonce la page et leur nombre", /Page 1 sur 2/.test(corps), corps.slice(0, 200));
  await capture(page, "04-signature-page1");

  /* ───────── on passe en page 2 et on place la signature en haut ───── */
  await page.click("button[aria-label='Page suivante']");
  await page.waitForTimeout(1500);
  await nettoyer(page);
  corps = await page.textContent("body");
  v("on peut changer de page", /Page 2 sur 2/.test(corps));

  const cadre = page.locator("div.fixed div.cursor-move").first();
  const avant = await cadre.boundingBox();
  const toilePdf = page.locator("div.fixed canvas").first();
  const bPdf = await toilePdf.boundingBox();
  v("la page est rendue", !!bPdf && bPdf.height > 200, JSON.stringify(bPdf));

  /* On traîne le cadre vers le quart HAUT-GAUCHE de la page. */
  const cibleX = bPdf.x + bPdf.width * 0.22;
  const cibleY = bPdf.y + bPdf.height * 0.18;
  await page.mouse.move(avant.x + avant.width / 2, avant.y + avant.height / 2);
  await page.mouse.down();
  await page.mouse.move(cibleX, cibleY, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const apres = await cadre.boundingBox();
  v("le cadre se déplace", Math.abs(apres.x - avant.x) > 20 || Math.abs(apres.y - avant.y) > 20,
    `${JSON.stringify(avant)} → ${JSON.stringify(apres)}`);
  await capture(page, "05-place");

  await page.fill("div.fixed input[placeholder*='bon pour accord']", "bon pour accord");
  await page.click("button:has-text('Apposer la signature en page 2')");
  await page.waitForSelector("text=version 2", { timeout: 60000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("le document passe en version 2", /version 2/.test(corps));
  v("et le message rappelle que la version 1 reste",
    /version 1, non signée, reste intacte/.test(corps), corps.match(/Signé[^.]*\./)?.[0] || "");
  await capture(page, "06-signe");

  /* ══════════════ L'ENCRE EST-ELLE VRAIMENT DANS LE PDF ? ══════════ */
  titre("l'encre est réellement dans le PDF, à la bonne page");
  const fichiers = await page.evaluate(async (id) => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}`,
      "x-active-company-id": "1" };
    const r = await fetch(`/api/studio/documents/${id}`, { headers: h });
    const d = await r.json();
    const v1 = (d.versions || []).find((x) => x.version === 1);
    const courant = await fetch(`/api/studio/documents/${id}/fichier`, { headers: h });
    const origine = await fetch(`/api/studio/versions/${v1.id}/fichier`, { headers: h });
    return {
      versions: (d.versions || []).map((x) => ({ v: x.version, original: x.is_original, note: x.change_note })),
      signe: Array.from(new Uint8Array(await courant.arrayBuffer())),
      origine: Array.from(new Uint8Array(await origine.arrayBuffer())),
    };
  }, docId);

  v("le document porte deux versions", fichiers.versions.length === 2,
    JSON.stringify(fichiers.versions));
  v("la version 1 reste marquée original",
    fichiers.versions.find((x) => x.v === 1)?.original === true);
  v("la note de la version 2 se relit seule",
    /Signé par .* en page 2/.test(fichiers.versions.find((x) => x.v === 2)?.note || ""),
    fichiers.versions.find((x) => x.v === 2)?.note);

  const lecteur = await lecteurPdf(nav);
  const p2Signe = await lecteur.encre(fichiers.signe, 2);
  const p1Signe = await lecteur.encre(fichiers.signe, 1);
  const p2Origine = await lecteur.encre(fichiers.origine, 2);

  v("le PDF signé a toujours deux pages", p2Signe.pages === 2, String(p2Signe.pages));
  /* L'ENCRE EST LÀ OÙ ON L'A POSÉE : quart haut-gauche de la page 2.

     On COMPARE à la version non signée plutôt que d'exiger un pourcentage.
     Un seuil absolu ne veut rien dire ici : le paraphe d'essai est un trait
     fin, qui couvre une fraction de pour cent du quadrant. Le premier jet
     exigeait 0,3 % et déclarait l'encre absente alors qu'elle était bien là,
     et au bon endroit. Ce qui se vérifie, c'est qu'il y a de l'encre là où
     il n'y en avait aucune. */
  v("de l'encre est apparue en haut à gauche de la page 2",
    p2Signe.hautGauche > p2Origine.hautGauche && p2Signe.hautGauche > 0,
    `signé ${p2Signe.hautGauche} % contre ${p2Origine.hautGauche} % avant`);
  v("c'est bien le quadrant le plus encré",
    p2Signe.hautGauche > p2Signe.hautDroite &&
    p2Signe.hautGauche > p2Signe.basGauche &&
    p2Signe.hautGauche > p2Signe.basDroite, JSON.stringify(p2Signe));
  v("la page 1 est restée vierge",
    p1Signe.hautGauche + p1Signe.hautDroite + p1Signe.basGauche + p1Signe.basDroite < 0.2,
    JSON.stringify(p1Signe));
  /* ET L'ORIGINAL N'A PAS BOUGÉ. */
  v("la version non signée n'a aucune encre",
    p2Origine.hautGauche + p2Origine.hautDroite + p2Origine.basGauche + p2Origine.basDroite < 0.2,
    JSON.stringify(p2Origine));
  await lecteur.fermer();

  /* ══════════════════════ LA TRACE ═══════════════════════════════ */
  titre("la trace garde de quoi répondre si la signature est contestée");
  const trace = await page.evaluate(async (id) => {
    const r = await fetch(`/api/studio/documents/${id}/signatures`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`,
        "x-active-company-id": "1" } });
    return (await r.json()).appositions || [];
  }, docId);
  v("une apposition est tracée", trace.length === 1, JSON.stringify(trace).slice(0, 200));
  v("elle dit la page", trace[0]?.page_number === 2, String(trace[0]?.page_number));
  v("elle nomme le signataire", trace[0]?.acted_by_name === DIR.fullname, trace[0]?.acted_by_name);
  v("elle garde la note", /bon pour accord/.test(trace[0]?.note || ""), trace[0]?.note);
  v("elle garde les deux empreintes",
    !!trace[0]?.sha256_before && !!trace[0]?.sha256_after &&
    trace[0].sha256_before !== trace[0].sha256_after);

  v("aucune erreur de console sur le parcours",
    erreursConsole.length === 0, erreursConsole.slice(0, 4).join("\n        | "));
  await ctx.close();

  /* ════════ LA SIGNATURE D'UNE PERSONNE N'EST QU'À ELLE ═══════════ */
  console.log("\n  LE COMPTABLE — UN AUTRE COMPTE DE LA MÊME SOCIÉTÉ");
  titre("la signature d'un collègue n'apparaît nulle part");
  const ctx2 = await contexte(nav, COMPTA);
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/studio/signatures`, { waitUntil: "domcontentloaded" });
  await page2.waitForSelector("text=Ma signature", { timeout: 25000 });
  await nettoyer(page2);
  corps = await page2.textContent("body");
  v("il ne voit pas le paraphe de la direction",
    !/Paraphe de direction/.test(corps), corps.slice(0, 300));
  v("et son propre espace est vide", /Vous n.avez pas encore de signature/.test(corps));
  /* IL NE PEUT PAS NON PLUS POSER LE CACHET DE LA MAISON. */
  v("on lui dit qu'il ne peut pas créer de cachet",
    /pas en créer/.test(corps), corps.match(/Votre compte[^.]*\./)?.[0] || "absent");
  await capture(page2, "07-comptable");
  await ctx2.close();

  /* ════════════════════════════ 375 px ═══════════════════════════ */
  console.log("\n  TÉLÉPHONE — 375 px");
  titre("rien ne déborde, et l'on peut signer au doigt");
  const ctx3 = await contexte(nav, DIR, { width: 375, height: 760 });
  const page3 = await ctx3.newPage();
  await page3.goto(`${BASE}/studio/signatures`, { waitUntil: "domcontentloaded" });
  await page3.waitForSelector("text=Ma signature", { timeout: 25000 });
  await nettoyer(page3);
  let debord = await page3.evaluate(() => ({
    page: document.documentElement.scrollWidth, vue: window.innerWidth }));
  v("l'écran des signatures ne déborde pas", debord.page <= debord.vue + 1,
    `${debord.page}px pour ${debord.vue}px`);

  await page3.goto(`${BASE}/studio/bibliotheque`, { waitUntil: "domcontentloaded" });
  await page3.waitForSelector("main li button", { timeout: 25000 });
  await nettoyer(page3);
  await page3.locator("main li button").filter({ hasText: "Contrat a signer" }).first().click();
  const signer375 = page3.getByRole("button", { name: "Signer", exact: true });
  await signer375.waitFor({ state: "visible", timeout: 20000 });
  await nettoyer(page3);
  await signer375.click();
  await page3.waitForSelector("text=Apposer la signature en page", { timeout: 60000 });
  await nettoyer(page3);
  debord = await page3.evaluate(() => ({
    page: document.documentElement.scrollWidth, vue: window.innerWidth }));
  v("la fenêtre de signature ne déborde pas", debord.page <= debord.vue + 1,
    `${debord.page}px pour ${debord.vue}px`);
  const poignee = await page3.locator("div.fixed span.cursor-nwse-resize").first().boundingBox();
  v("la poignée d'étirement est assez grande pour le doigt",
    !!poignee && poignee.width >= 16 && poignee.height >= 16, JSON.stringify(poignee));
  await capture(page3, "08-telephone");
  await ctx3.close();

  await nav.close();
  console.log(`\n  ${reussis} réussis, ${echoues} échoués\n`);
  process.exit(echoues ? 1 : 0);
})().catch((e) => { console.error("\n  ✘ interrompu :", e.message, "\n"); process.exit(2); });
