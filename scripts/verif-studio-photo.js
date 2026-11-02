/**
 * L'ÉDITEUR PHOTO.
 *
 * La question qui compte : L'IMAGE ENREGISTRÉE EST-ELLE CELLE QU'ON A VUE ?
 * Un aperçu qui mentirait ferait enregistrer autre chose que ce qui a été
 * validé — et comme on ne rouvre presque jamais une photo retouchée, on ne
 * s'en apercevrait pas.
 *
 * L'image d'essai est un damier de quatre couleurs, une par coin. On peut
 * donc dire, après rotation ou miroir, quelle couleur se trouve où — et pas
 * seulement « quelque chose a changé ».
 *
 * On vérifie aussi la promesse qui permet d'oser retoucher : dans les deux
 * façons d'enregistrer, l'original reste.
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

/* Les quatre coins d'une image, lus dans le navigateur. On s'écarte des
   bords : une rotation fine laisse des coins blancs, et lire exactement le
   pixel du coin donnerait du blanc au lieu de la couleur. */
const LIRE_COINS = `(src) => new Promise((ok, non) => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const p = (fx, fy) => {
      const d = g.getImageData(Math.round(c.width * fx), Math.round(c.height * fy), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    ok({
      taille: [c.width, c.height],
      hg: p(0.25, 0.25), hd: p(0.75, 0.25),
      bg: p(0.25, 0.75), bd: p(0.75, 0.75),
    });
  };
  img.onerror = () => non(new Error("image illisible"));
  img.src = src;
})`;

/* Nommer une couleur : « rouge » se compare, « 237,28,36 » ne se compare pas. */
function couleur(rvb) {
  const [r, g, b] = rvb;
  if (r > 150 && g < 110 && b < 110) return "rouge";
  if (g > 150 && r < 110 && b < 110) return "vert";
  if (b > 150 && r < 110 && g < 110) return "bleu";
  if (r > 180 && g > 180 && b < 110) return "jaune";
  if (r > 220 && g > 220 && b > 220) return "blanc";
  return `autre(${rvb.join(",")})`;
}

(async () => {
  const nav = await lancer();
  const ctx = await contexte(nav, DIR);
  const page = await ctx.newPage();
  page.setDefaultTimeout(40000);
  const erreursConsole = [];
  page.on("pageerror", (e) => erreursConsole.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push(m.text()); });

  /* ═══════════════ DÉPOSER UNE IMAGE RECONNAISSABLE ═══════════════ */
  titre("l'éditeur s'ouvre sur une image de la bibliothèque");
  await page.goto(`${BASE}/studio/bibliotheque`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main", { timeout: 25000 });

  const docId = await page.evaluate(async () => {
    /* Un damier : rouge en haut à gauche, vert en haut à droite, bleu en
       bas à gauche, jaune en bas à droite. */
    const c = document.createElement("canvas");
    c.width = 400; c.height = 300;
    const g = c.getContext("2d");
    g.fillStyle = "#e01b1b"; g.fillRect(0, 0, 200, 150);
    g.fillStyle = "#19b219"; g.fillRect(200, 0, 200, 150);
    g.fillStyle = "#1b3fe0"; g.fillRect(0, 150, 200, 150);
    g.fillStyle = "#e8d41b"; g.fillRect(200, 150, 200, 150);
    const blob = await new Promise((ok) => c.toBlob((b) => ok(b), "image/png"));
    const f = new FormData();
    f.append("fichier", blob, "Recu photographie.png");
    f.append("nom", "Recu photographie.png");
    f.append("visibilite", "SOCIETE");
    const r = await fetch("/api/studio/documents", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-active-company-id": "1" },
      body: f });
    return (await r.json()).document?.id ?? null;
  });
  v("l'image d'essai est déposée", !!docId, String(docId));

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("main li button", { timeout: 25000 });
  await page.locator("main li button").filter({ hasText: "Recu photographie" }).first().click();
  const lien = page.getByRole("link", { name: /Retoucher/ });
  await lien.waitFor({ state: "visible", timeout: 20000 });
  await nettoyer(page);
  v("la fiche propose de retoucher une image", (await lien.count()) === 1);
  await lien.click();
  await page.waitForURL(`**/studio/photo/${docId}`, { timeout: 20000 });
  await page.waitForSelector("text=Cadrage et orientation", { timeout: 40000 });
  await page.waitForTimeout(800);
  await nettoyer(page);

  let corps = await page.textContent("body");
  v("l'écran annonce que l'aperçu est fidèle",
    /applique exactement le traitement qui sera enregistré/.test(corps));
  v("et que rien n'est écrasé", /rien n.est écrasé/.test(corps));
  v("aucune retouche n'est annoncée au départ", /Aucune retouche/.test(corps));
  await capture(page, "01-editeur-photo");

  /* ══════════════════ TOURNER, ET VÉRIFIER ═══════════════════════ */
  titre("tourner déplace réellement les couleurs");
  await page.click("button:has-text('Droite')");
  await page.waitForTimeout(600);
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la retouche est annoncée", /tournée de 90°/.test(corps),
    corps.match(/Ce qui sera enregistré[^.]*\./)?.[0] || "");

  /* L'APERÇU EST UN CANVAS : on le lit directement. */
  const apercu = await page.evaluate(async ([lire]) => {
    const c = document.querySelector("div.relative canvas");
    if (!c) return null;
    const f = new Function("return " + lire)();
    return f(c.toDataURL("image/png"));
  }, [LIRE_COINS]);
  v("l'aperçu a bien tourné d'un quart de tour",
    couleur(apercu.hg) === "bleu" && couleur(apercu.hd) === "rouge",
    `hg ${couleur(apercu.hg)}, hd ${couleur(apercu.hd)}, bg ${couleur(apercu.bg)}, bd ${couleur(apercu.bd)}`);
  /* L'image d'origine fait 400×300, donc en largeur. Un quart de tour la met
     EN HAUTEUR : l'affirmation inverse, qui était écrite ici, accusait le
     code d'une rotation qui avait pourtant bien eu lieu. On vérifie que les
     deux dimensions ont échangé, ce qui est la propriété réelle. */
  v("les deux dimensions ont échangé",
    apercu.taille[0] < apercu.taille[1], JSON.stringify(apercu.taille));

  /* ════════ ENREGISTRER EN VERSION, ET COMPARER À L'APERÇU ═══════ */
  titre("l'image enregistrée est exactement celle qu'on a vue");
  await page.click("button:has-text('Enregistrer en nouvelle version')");
  await page.waitForSelector("text=Enregistré en version 2", { timeout: 60000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("le document passe en version 2", /Enregistré en version 2/.test(corps));
  v("et le message rappelle que la précédente reste",
    /reste intacte et téléchargeable/.test(corps));
  await capture(page, "02-enregistre");

  const compare = await page.evaluate(async ([id, lire]) => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-active-company-id": "1" };
    const f = new Function("return " + lire)();
    const detail = await (await fetch(`/api/studio/documents/${id}`, { headers: h })).json();
    const v1 = (detail.versions || []).find((x) => x.version === 1);
    const lireBlob = async (chemin) => {
      const r = await fetch(chemin, { headers: h });
      const b = await r.blob();
      const url = URL.createObjectURL(b);
      try { return await f(url); } finally { URL.revokeObjectURL(url); }
    };
    return {
      versions: (detail.versions || []).map((x) => ({ v: x.version, original: x.is_original, note: x.change_note })),
      courante: await lireBlob(`/api/studio/documents/${id}/fichier`),
      origine: await lireBlob(`/api/studio/versions/${v1.id}/fichier`),
    };
  }, [docId, LIRE_COINS]);

  v("deux versions existent", compare.versions.length === 2, JSON.stringify(compare.versions));
  v("la version 1 reste marquée original",
    compare.versions.find((x) => x.v === 1)?.original === true);
  v("la note de version énumère ce qui a été fait",
    /tournée de 90°/.test(compare.versions.find((x) => x.v === 2)?.note || ""),
    compare.versions.find((x) => x.v === 2)?.note);

  /* LA PREUVE : les coins de l'image enregistrée sont ceux de l'aperçu. */
  v("l'image enregistrée a les mêmes coins que l'aperçu",
    couleur(compare.courante.hg) === couleur(apercu.hg) &&
    couleur(compare.courante.hd) === couleur(apercu.hd) &&
    couleur(compare.courante.bg) === couleur(apercu.bg) &&
    couleur(compare.courante.bd) === couleur(apercu.bd),
    `enregistré : ${[compare.courante.hg, compare.courante.hd, compare.courante.bg, compare.courante.bd].map(couleur).join(", ")} ` +
    `| aperçu : ${[apercu.hg, apercu.hd, apercu.bg, apercu.bd].map(couleur).join(", ")}`);
  v("et elle garde la pleine résolution, pas celle de l'aperçu",
    compare.courante.taille[0] === 300 && compare.courante.taille[1] === 400,
    JSON.stringify(compare.courante.taille));
  /* L'ORIGINAL N'A PAS BOUGÉ. */
  v("l'original est toujours dans son sens d'origine",
    couleur(compare.origine.hg) === "rouge" && couleur(compare.origine.hd) === "vert",
    `${[compare.origine.hg, compare.origine.hd].map(couleur).join(", ")}`);
  v("et dans sa taille d'origine",
    compare.origine.taille[0] === 400 && compare.origine.taille[1] === 300,
    JSON.stringify(compare.origine.taille));

  /* ═════════════ RECADRER, PUIS DOCUMENT À PART ══════════════════ */
  titre("recadrer, et enregistrer à part sans toucher à l'original");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Cadrage et orientation", { timeout: 40000 });
  await page.waitForTimeout(900);
  await nettoyer(page);
  await page.click("button:has-text('Recadrer')");
  await page.waitForTimeout(400);
  await nettoyer(page);

  /* On réduit le cadre au quart haut-gauche en traînant la poignée. */
  const cadre = page.locator("div.relative div.touch-none").first();
  const bc = await cadre.boundingBox();
  const toileBox = await page.locator("div.relative canvas").first().boundingBox();
  v("le cadre de recadrage apparaît", !!bc && bc.width > 30, JSON.stringify(bc));
  const poignee = page.locator("span.cursor-nwse-resize").first();
  const bp = await poignee.boundingBox();
  await page.mouse.move(bp.x + bp.width / 2, bp.y + bp.height / 2);
  await page.mouse.down();
  await page.mouse.move(toileBox.x + toileBox.width * 0.45, toileBox.y + toileBox.height * 0.45,
    { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  await nettoyer(page);
  corps = await page.textContent("body");
  v("le recadrage est annoncé", /recadrée/.test(corps),
    corps.match(/Ce qui sera enregistré[^.]*\./)?.[0] || "");
  await capture(page, "03-recadrage");

  await page.click("button:has-text('Créer un document à part')");
  await page.waitForSelector("text=Nouveau document", { timeout: 60000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("un document à part est créé", /Nouveau document/.test(corps));
  v("et l'écran dit que l'original n'a pas bougé",
    /L.original n.a pas été modifié/.test(corps), corps.match(/Nouveau document[^.]*\./)?.[0] || "");

  const apres = await page.evaluate(async (id) => {
    const h = { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-active-company-id": "1" };
    const d = await (await fetch(`/api/studio/documents/${id}`, { headers: h })).json();
    const liste = await (await fetch("/api/studio/documents?q=retouch", { headers: h })).json();
    return {
      versionsSource: (d.versions || []).length,
      retouches: (liste.documents || []).map((x) => ({
        nom: x.name, source: x.source_document_id })),
    };
  }, docId);
  v("la source garde ses deux versions, sans en gagner une",
    apres.versionsSource === 2, String(apres.versionsSource));
  v("le document créé garde le lien vers sa source",
    apres.retouches.some((x) => Number(x.source) === Number(docId)),
    JSON.stringify(apres.retouches));

  v("aucune erreur de console sur le parcours",
    erreursConsole.length === 0, erreursConsole.slice(0, 4).join("\n        | "));
  await ctx.close();

  /* ════════════════════════════ 375 px ═══════════════════════════ */
  console.log("\n  TÉLÉPHONE — 375 px");
  titre("rien ne déborde");
  const ctx2 = await contexte(nav, DIR, { width: 375, height: 760 });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/studio/photo/${docId}`, { waitUntil: "domcontentloaded" });
  await page2.waitForSelector("text=Cadrage et orientation", { timeout: 40000 });
  await page2.waitForTimeout(800);
  await nettoyer(page2);
  const debord = await page2.evaluate(() => ({
    page: document.documentElement.scrollWidth, vue: window.innerWidth }));
  v("l'éditeur photo ne déborde pas", debord.page <= debord.vue + 1,
    `${debord.page}px pour ${debord.vue}px`);
  await capture(page2, "04-telephone");
  await ctx2.close();

  await nav.close();
  console.log(`\n  ${reussis} réussis, ${echoues} échoués\n`);
  process.exit(echoues ? 1 : 0);
})().catch((e) => { console.error("\n  ✘ interrompu :", e.message, "\n"); process.exit(2); });
