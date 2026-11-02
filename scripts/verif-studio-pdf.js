/**
 * L'ÉDITEUR DE PAGES, À L'ÉCRAN.
 *
 * Ce qu'il s'agit de prouver : que les vignettes montrent vraiment les pages
 * du document, que les déplacer les déplace POUR DE BON dans le fichier, et
 * qu'aucune page ne disparaît sans que l'écran le dise.
 *
 * Les pages du document d'essai portent chacune un carré de couleur à une
 * position différente : on peut donc LIRE l'ordre des vignettes en
 * échantillonnant leurs pixels, et dire que la page 3 est bien passée en
 * tête — pas seulement qu'il y a toujours cinq vignettes.
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

/* Lire la position du carré coloré de chaque vignette : c'est la signature
   de la page, et elle suit la page quand on la déplace. */
async function ordreVu(page) {
  return page.evaluate(async () => {
    const imgs = [...document.querySelectorAll("li img[alt^='Page ']")];
    const out = [];
    for (const img of imgs) {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      /* ON BALAIE UNE BANDE, pas une seule ligne. Le carré occupe environ
         un dixième à un sixième de la hauteur depuis le haut ; viser une
         ligne unique à 9 % tombait juste AU-DESSUS, et toutes les pages se
         ressemblaient — l'essai concluait alors qu'elles n'étaient pas
         reconnaissables, alors que c'est la sonde qui regardait à côté. */
      let premier = -1;
      for (let part = 0.05; part <= 0.30 && premier < 0; part += 0.01) {
        const y = Math.min(c.height - 1, Math.round(c.height * part));
        const d = g.getImageData(0, y, c.width, 1).data;
        for (let x = 0; x < c.width; x++) {
          const i = x * 4;
          /* Le carré est coloré ; le papier est blanc. */
          if (d[i] + d[i + 1] + d[i + 2] < 700) { premier = x; break; }
        }
      }
      out.push(premier < 0 ? "vide" : Math.round((premier / c.width) * 20));
    }
    return out;
  });
}

(async () => {
  const nav = await lancer();
  const ctx = await contexte(nav, DIR);
  const page = await ctx.newPage();
  page.setDefaultTimeout(40000);
  const erreursConsole = [];
  page.on("pageerror", (e) => erreursConsole.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push(m.text()); });

  /* ═════════════════ DÉPOSER UN PDF RECONNAISSABLE ════════════════ */
  titre("l'éditeur montre les pages du document");
  await page.goto(`${BASE}/studio/bibliotheque`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main", { timeout: 25000 });

  const docId = await page.evaluate(async () => {
    /* Cinq pages, chacune avec son carré à une place différente. On les
       fabrique ici avec pdf-lib ? Non : on compose un PDF minimal à la
       main, avec un rectangle dessiné à une abscisse qui change. */
    const page = (n, obj) => {
      const contenu = `${20 + (n - 1) * 60} 500 40 40 re f`;
      return { obj, contenu };
    };
    const parties = [];
    let corps = "%PDF-1.4\n";
    const offsets = [];
    const ajouter = (txt) => { offsets.push(corps.length); corps += txt; };
    ajouter("1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n");
    const kids = [3, 5, 7, 9, 11].map((n) => `${n} 0 R`).join(" ");
    ajouter(`2 0 obj<</Type/Pages/Kids[${kids}]/Count 5>>endobj\n`);
    for (let i = 0; i < 5; i++) {
      const pObj = 3 + i * 2, cObj = 4 + i * 2;
      const flux = `0.1 0.2 0.8 rg ${20 + i * 60} 500 40 40 re f`;
      ajouter(`${pObj} 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 600]/Contents ${cObj} 0 R>>endobj\n`);
      ajouter(`${cObj} 0 obj<</Length ${flux.length}>>stream\n${flux}\nendstream endobj\n`);
    }
    corps += "trailer<</Root 1 0 R/Size 13>>\n%%EOF\n";
    const octets = new TextEncoder().encode(corps);

    const f = new FormData();
    f.append("fichier", new Blob([octets], { type: "application/pdf" }), "Lot de cinq.pdf");
    f.append("nom", "Lot de cinq.pdf");
    f.append("visibilite", "SOCIETE");
    const r = await fetch("/api/studio/documents", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-active-company-id": "1" },
      body: f });
    const d = await r.json();
    return d.document?.id ?? null;
  });
  v("le PDF de cinq pages est déposé", !!docId, String(docId));

  /* ═══════════════ OUVRIR L'ÉDITEUR DEPUIS LA FICHE ══════════════ */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("main li button", { timeout: 25000 });
  await page.locator("main li button").filter({ hasText: "Lot de cinq" }).first().click();
  const lien = page.getByRole("link", { name: /Organiser les pages/ });
  await lien.waitFor({ state: "visible", timeout: 20000 });
  await nettoyer(page);
  v("la fiche propose d'organiser les pages", (await lien.count()) === 1);
  await lien.click();
  await page.waitForURL(`**/studio/pdf/${docId}`, { timeout: 20000 });
  await page.waitForSelector("li img[alt='Page 5']", { timeout: 60000 });
  await nettoyer(page);

  let corps = await page.textContent("body");
  v("les cinq pages sont vignettées",
    (await page.locator("li img[alt^='Page ']").count()) === 5,
    String(await page.locator("li img[alt^='Page ']").count()));
  v("l'écran sépare ce qui modifie de ce qui fabrique",
    /une version de plus/.test(corps) && /n.est pas modifié/.test(corps), corps.slice(0, 400));
  await capture(page, "01-editeur");

  const ordreInitial = await ordreVu(page);
  v("chaque page est reconnaissable",
    new Set(ordreInitial).size === 5, JSON.stringify(ordreInitial));

  /* ═════════════════════ RÉORDONNER ══════════════════════════════ */
  titre("déplacer une page la déplace pour de bon");
  /* On remonte la page 5 jusqu'en tête, quatre fois. */
  for (let i = 0; i < 4; i++) {
    await page.click("button[aria-label='Avancer la page 5']");
    await page.waitForTimeout(120);
  }
  await nettoyer(page);
  corps = await page.textContent("body");
  v("l'écran montre le nouveau rang", /→ 1/.test(corps), corps.match(/Page 5[^·]{0,20}/)?.[0] || "");

  await page.click("button:has-text(\"Enregistrer l'ordre\")");
  await page.waitForSelector("text=Pages réordonnées", { timeout: 60000 });
  await page.waitForSelector("li img[alt='Page 5']", { timeout: 60000 });
  await page.waitForTimeout(800);
  await nettoyer(page);
  const ordreApres = await ordreVu(page);
  v("l'ordre a réellement changé dans le fichier",
    ordreApres[0] === ordreInitial[4],
    `${JSON.stringify(ordreInitial)} → ${JSON.stringify(ordreApres)}`);
  v("et toutes les pages sont toujours là",
    ordreApres.length === 5 && new Set(ordreApres).size === 5, JSON.stringify(ordreApres));
  corps = await page.textContent("body");
  v("le document est passé en version 2", /version 2/.test(corps), corps.match(/version \d/)?.[0] || "");
  await capture(page, "02-reordonne");

  /* ═════════════════════════ TOURNER ═════════════════════════════ */
  titre("tourner une page");
  await page.locator("li img[alt='Page 1']").first().click();
  await page.waitForTimeout(200);
  const avantRotation = await page.locator("li img[alt='Page 1']").first()
    .evaluate((el) => ({ l: el.naturalWidth, h: el.naturalHeight }));
  await page.click("button:has-text('Tourner à droite')");
  await page.waitForSelector("text=tournée", { timeout: 60000 });
  await page.waitForSelector("li img[alt='Page 1']", { timeout: 60000 });
  await page.waitForTimeout(800);
  await nettoyer(page);
  const apresRotation = await page.locator("li img[alt='Page 1']").first()
    .evaluate((el) => ({ l: el.naturalWidth, h: el.naturalHeight }));
  /* UNE PAGE TOURNÉE D'UN QUART DE TOUR est plus large que haute. */
  v("la vignette a basculé",
    (avantRotation.h > avantRotation.l) !== (apresRotation.h > apresRotation.l),
    `${JSON.stringify(avantRotation)} → ${JSON.stringify(apresRotation)}`);
  await capture(page, "03-tournee");

  /* ═════════════════════════ RETIRER ═════════════════════════════ */
  titre("retirer des pages demande une raison, et dit ce qu'on garde");
  /* Le rechargement qui suit la rotation vide déjà la sélection : le bouton
     « Tout désélectionner » n'est alors plus affiché, et le chercher faisait
     échouer l'essai sur un bouton absent à bon droit. */
  await page.locator("li img[alt='Page 2']").first().click();
  await page.waitForTimeout(200);
  await page.click("button:has-text('Retirer')");
  await page.waitForSelector("text=Retirer 1 page sur 5", { timeout: 15000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la confirmation dit combien il restera",
    /passera de 5 à 4 pages/.test(corps), corps.match(/passera de[^.]*\./)?.[0] || "");
  v("elle rassure sur la version complète",
    /restera téléchargeable dans l.historique/.test(corps));
  const boutonRetirer = page.locator("div.border-red-800 button:has-text('Retirer')");
  v("le bouton reste inerte sans motif", await boutonRetirer.isDisabled());
  await page.fill("input[placeholder*='pages blanches']", "page blanche du scanner");
  await page.waitForTimeout(200);
  v("un motif qui se relit l'ouvre", !(await boutonRetirer.isDisabled()));
  await capture(page, "04-retrait");
  await boutonRetirer.click();
  await page.waitForSelector("text=5 pages avant, 4 après", { timeout: 60000 });
  await page.waitForTimeout(1200);
  await nettoyer(page);
  v("quatre vignettes restent",
    (await page.locator("li img[alt^='Page ']").count()) === 4,
    String(await page.locator("li img[alt^='Page ']").count()));

  /* ═════════════════════════ DÉCOUPER ════════════════════════════ */
  titre("découper ne peut pas oublier de page");
  await page.click("button:has-text('Découper')");
  await page.waitForSelector("text=Cliquez sur les ciseaux", { timeout: 15000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("l'écran explique pourquoi aucune page ne peut être perdue",
    /aucune page ne peut être oubliée/.test(corps));
  await page.click("button[aria-label='Couper après la page 2']");
  await page.waitForTimeout(300);
  await nettoyer(page);
  corps = await page.textContent("body");
  v("il annonce les parties et leurs tailles",
    /2 parties : 2 p\. \+ 2 p\./.test(corps), corps.match(/\d+ parties[^.]*\./)?.[0] || "");
  await capture(page, "05-decoupe");
  await page.click("button:has-text('Créer 2 documents')");
  await page.waitForSelector("text=2 documents créés", { timeout: 60000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("les deux documents sont créés", /2 documents créés/.test(corps));
  v("et il est dit que la source n'a pas bougé",
    /qui n.a pas été modifié/.test(corps), corps.match(/2 documents[^.]*\./)?.[0] || "");
  v("aucune page oubliée n'est signalée", !/dans aucune partie/.test(corps));

  /* ════════════════════════ FUSIONNER ════════════════════════════ */
  titre("assembler avec un autre PDF");
  await page.click("button:has-text(\"Assembler avec d'autres PDF\")");
  await page.waitForSelector("text=Un nouveau document sera créé", { timeout: 15000 });
  await nettoyer(page);
  const candidats = await page.locator("section button:has-text('.pdf')").count();
  v("les autres PDF accessibles sont proposés", candidats >= 2, String(candidats));
  await page.locator("section button:has-text('partie 1')").first().click();
  await page.waitForTimeout(200);
  await page.click("button:has-text('Assembler 2 documents')");
  await page.waitForSelector("text=pages assemblées", { timeout: 60000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la fusion annonce le total", /\d+ pages assemblées/.test(corps),
    corps.match(/\d+ pages assemblées[^.]*\./)?.[0] || "");
  v("et dit que les sources n'ont pas été modifiées",
    /n.ont pas été modifiés/.test(corps));
  await capture(page, "06-fusion");

  v("aucune erreur de console sur le parcours",
    erreursConsole.length === 0, erreursConsole.slice(0, 4).join("\n        | "));
  await ctx.close();

  /* ════════════════════════════ 375 px ═══════════════════════════ */
  console.log("\n  TÉLÉPHONE — 375 px");
  titre("rien ne déborde");
  const ctx2 = await contexte(nav, DIR, { width: 375, height: 760 });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/studio/pdf/${docId}`, { waitUntil: "domcontentloaded" });
  await page2.waitForSelector("li img[alt^='Page ']", { timeout: 60000 });
  await nettoyer(page2);
  const debord = await page2.evaluate(() => ({
    page: document.documentElement.scrollWidth, vue: window.innerWidth }));
  v("l'éditeur ne déborde pas", debord.page <= debord.vue + 1,
    `${debord.page}px pour ${debord.vue}px`);
  await capture(page2, "07-telephone");
  await ctx2.close();

  await nav.close();
  console.log(`\n  ${reussis} réussis, ${echoues} échoués\n`);
  process.exit(echoues ? 1 : 0);
})().catch((e) => { console.error("\n  ✘ interrompu :", e.message, "\n"); process.exit(2); });
