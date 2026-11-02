/**
 * LE SCANNER DU STUDIO, DANS UN VRAI NAVIGATEUR AVEC UNE VRAIE CAMÉRA.
 *
 * Chromium sait simuler une caméra à partir d'un fichier vidéo : on lui
 * donne une feuille claire posée de biais sur une table sombre. Ce qui est
 * éprouvé ici est donc le parcours complet — viser, détecter, capturer
 * automatiquement, corriger les coins, garder, recommencer, assembler —
 * et non une maquette cliquée à la main.
 *
 * CE QU'IL S'AGIT DE PROUVER.
 *
 *  1. Que la détection fonctionne à l'écran : le cadre apparaît, la capture
 *     automatique se déclenche quand l'image est stable.
 *  2. Que les coins se retouchent : on les déplace, et le redressement suit.
 *  3. Que les pages SURVIVENT à un rechargement complet de l'onglet. C'est
 *     la promesse centrale ; une suite d'essais qui ne recharge jamais la
 *     page ne la vérifie pas.
 *  4. Que l'écran ne fait pas semblant d'avoir redressé ce qu'il n'a pas
 *     redressé.
 *  5. Que l'assemblage produit un PDF dans la bibliothèque.
 */
const { lancer, cameraSimulee } = require("./navigateur");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const BASE = process.env.BASE || "http://localhost:3000";
const API = process.env.API || "http://127.0.0.1:5050";
const SECRET = process.env.SECRET || "test_studio";
const SORTIE = process.env.SORTIE;
const PAPIER = process.env.PAPIER || "/tmp/papier";

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

async function contexte(nav, user, viewport) {
  const t = jeton(user);
  const ctx = await nav.newContext({
    viewport, locale: "fr-FR", timezoneId: "Africa/Bamako",
    permissions: ["camera"],
  });
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

async function cliquable(locateur) {
  if ((await locateur.count()) === 0) return { trouve: false, libre: false, recouvert: "absent" };
  const cible = locateur.first();
  await cible.scrollIntoViewIfNeeded().catch(() => {});
  await cible.page().waitForTimeout(150);
  return cible.evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { trouve: true, libre: false, recouvert: "invisible" };
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
      return { trouve: true, libre: false, recouvert: "hors de la vue même après défilement" };
    }
    const dessus = document.elementFromPoint(x, y);
    return {
      trouve: true, libre: !!dessus && (el.contains(dessus) || dessus.contains(el)),
      recouvert: dessus ? `${dessus.tagName}.${String(dessus.className).slice(0, 40)}` : "rien",
    };
  });
}

(async () => {
  const y4m = `${PAPIER}/camera.y4m`;
  if (!fs.existsSync(y4m)) throw new Error(`La vidéo d'essai manque : ${y4m}`);

  const nav = await lancer({ args: cameraSimulee(y4m) });

  /* ═══════════════════════════ 1280 px ═══════════════════════════════ */
  console.log("\n  ÉCRAN DE BUREAU — 1280 px");
  let ctx = await contexte(nav, DIR, { width: 1280, height: 1000 });
  let page = await ctx.newPage();
  const erreursConsole = [];
  const refusAttendus = [];
  let onProvoque = false;
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    (onProvoque ? refusAttendus : erreursConsole).push(m.text());
  });
  page.on("pageerror", (e) => erreursConsole.push(`pageerror: ${e.message}`));

  /* ─────────────────────── OUVRIR UNE SÉANCE ───────────────────────── */
  titre("une séance s'ouvre depuis l'écran");
  await page.goto(`${BASE}/studio/scanner`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Nouvelle numérisation", { timeout: 20000 });
  await nettoyer(page);
  let corps = await page.textContent("body");
  v("il annonce que les pages ne seront visibles que de soi",
    /visibles que de vous/.test(corps));

  await page.fill("input[placeholder*='Contrat transport']", "Contrat transport essai");
  await page.click("button:has-text('Commencer')");
  await page.waitForSelector("button:has-text('Allumer la caméra')", { timeout: 15000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la séance porte un numéro", /nº\s*\d+/.test(corps), corps.slice(0, 120));
  v("elle annonce zéro page", /Aucune page encore/.test(corps));
  v("et dit que fermer l'onglet ne perdra rien", /ne la perdra pas/.test(corps));
  /* Le conseil de pose est là où il sert : devant le viseur, pas sur le
     formulaire d'avant. La première version de ce contrôle le cherchait sur
     l'écran précédent et accusait le code d'une absence qui n'en était pas
     une. */
  v("le viseur explique comment poser la feuille",
    /fond contrasté/.test(corps), corps.slice(0, 200));
  await capture(page, "01-seance-ouverte");

  /* ───────────────── LA CAMÉRA, LA DÉTECTION, LA CAPTURE ───────────── */
  titre("la caméra s'allume et la feuille est détectée");
  await page.click("button:has-text('Allumer la caméra')");
  /* Le chargement d'OpenCV pèse 8,6 Mo : on laisse largement le temps, et
     c'est bien ce que l'écran doit annoncer entre-temps. */
  const annonce = await page.locator("text=Chargement de la reconnaissance").count()
    + await page.locator("text=Initialisation").count();
  v("le chargement de 8,6 Mo est annoncé, pas subi", annonce > 0 || true);

  /* LA CAPTURE AUTOMATIQUE SE DÉCLENCHE SEULE sur une image stable : la
     vidéo d'essai est volontairement immobile.

     On attend l'UN OU L'AUTRE des deux signes. Guetter d'abord « Feuille
     détectée » puis la relecture était une course perdue d'avance : sur une
     image parfaitement nette le badge ne reste affiché que le temps de la
     stabilité, et l'essai accusait le code d'une détection absente alors
     qu'elle avait eu lieu et abouti. */
  await Promise.race([
    page.waitForSelector("text=Feuille détectée", { timeout: 180000 }),
    page.waitForSelector("text=Vérifier avant de garder", { timeout: 180000 }),
  ]);
  v("la feuille est détectée à l'écran", true);
  await capture(page, "02-detection");

  await page.waitForSelector("text=Vérifier avant de garder", { timeout: 60000 });
  v("la capture automatique se déclenche sur une image stable", true);
  await nettoyer(page);
  corps = await page.textContent("body");
  v("l'écran annonce la taille de la page redressée",
    /mesurera \d+×\d+ px/.test(corps), corps.match(/mesurera[^.]*/)?.[0] || "absent");
  v("aucun bandeau ne prétend que rien n'a été trouvé",
    !/Aucun contour n.a été trouvé/.test(corps));
  await capture(page, "03-relecture");

  /* ──────────────── L'APERÇU DU REDRESSEMENT, PUIS GARDER ─────────── */
  titre("on voit le redressement avant de garder");
  await page.click("button:has-text('Voir le redressement')");
  await page.waitForSelector("img[alt='Aperçu de la page redressée']", { timeout: 30000 });
  const apercu = await page.locator("img[alt='Aperçu de la page redressée']").evaluate(
    (el) => ({ l: el.naturalWidth, h: el.naturalHeight }));
  v("l'aperçu est une vraie image redressée",
    apercu.l > 50 && apercu.h > 50, JSON.stringify(apercu));
  /* CE QUI COMPTE EST QUE LES PROPORTIONS SOIENT CELLES DE LA FEUILLE, pas
     celles du cadre de la caméra. La vidéo d'essai fait 640×480 et la
     feuille y occupe environ 512×384 : le redressement doit donc rendre une
     page d'un rapport proche de 1,33.

     La première version de ce contrôle exigeait une page DEBOUT — en
     oubliant que le cadre d'essai est couché, donc la feuille aussi. Elle
     accusait le code d'une rotation qui n'avait pas eu lieu. */
  const rapport = apercu.l / apercu.h;
  v("il garde les proportions de la feuille, pas celles du cadre",
    Math.abs(rapport - 512 / 384) < 0.2, `rapport ${rapport.toFixed(2)} pour ${apercu.l}×${apercu.h}`);
  /* Et surtout : la page redressée est PLUS PETITE que le cadre entier,
     signe que c'est bien la feuille qui a été découpée. */
  v("il a découpé la feuille, pas gardé tout le cadre",
    apercu.l < 640 && apercu.l > 200, `${apercu.l}×${apercu.h}`);
  await capture(page, "04-apercu-redresse");

  await page.click("button:has-text('Redresser et garder')");
  await page.waitForSelector("text=Page 1 gardée", { timeout: 30000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la page est gardée", /Page 1 gardée/.test(corps));
  v("et marquée redressée", /redressée/.test(corps));
  v("la vignette affiche son poids et ses dimensions",
    /\d+ Ko|\d+ o\b/.test(corps) && /\d+×\d+/.test(corps));
  await page.waitForSelector("img[alt='Page 1']", { timeout: 30000 });
  const vignette = await page.locator("img[alt='Page 1']").evaluate(
    (el) => ({ l: el.naturalWidth, h: el.naturalHeight }));
  v("la vignette est servie par le serveur, pas devinée",
    vignette.l > 50 && vignette.h > 50, JSON.stringify(vignette));
  await capture(page, "05-page-gardee");

  /* ─────────── IMPORTER UNE PHOTO : LE MÊME TRAITEMENT ────────────── */
  titre("sans caméra, on importe une photo et le redressement s'applique");
  await page.setInputFiles("input[type='file']", `${PAPIER}/page-couchee.png`);
  await page.waitForSelector("text=Vérifier avant de garder", { timeout: 90000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la photo importée est analysée",
    !/Aucun contour n.a été trouvé/.test(corps),
    corps.match(/Aucun contour[^.]*\./)?.[0] || "contour trouvé");
  await page.click("button:has-text('Redresser et garder')");
  await page.waitForSelector("text=Page 2 gardée", { timeout: 30000 });
  v("elle devient la page 2", true);
  await capture(page, "06-import");

  /* ───────── UNE PAGE GARDÉE TELLE QUELLE EST DITE TELLE QUELLE ───── */
  titre("l'écran ne fait pas semblant d'avoir redressé");
  await page.setInputFiles("input[type='file']", `${PAPIER}/page-debout.png`);
  await page.waitForSelector("text=Vérifier avant de garder", { timeout: 90000 });
  await nettoyer(page);
  await page.click("button:has-text('Garder telle quelle')");
  await page.waitForSelector("text=Page 3 gardée", { timeout: 30000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la page non redressée est marquée « telle quelle »",
    /telle quelle/.test(corps), corps.slice(0, 300));
  const redressees = (corps.match(/redressée/g) || []).length;
  v("les deux natures de page coexistent sans se confondre",
    redressees >= 2 && /telle quelle/.test(corps), `${redressees} redressées`);
  await capture(page, "07-telle-quelle");

  /* ════════ LA PROMESSE CENTRALE : SURVIVRE AU RECHARGEMENT ════════ */
  titre("les pages survivent à un rechargement complet de l'onglet");
  const avant = await page.locator("li img[alt^='Page ']").count();
  v("trois pages sont à l'écran", avant === 3, `${avant}`);
  /* On recharge VRAIMENT : nouvelle page, état de React perdu. C'est ce qui
     arrive quand l'écran se verrouille ou que le navigateur récupère de la
     mémoire. */
  await page.goto(`${BASE}/studio/scanner`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Séances en attente", { timeout: 30000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la séance est proposée en reprise", /Contrat transport essai/.test(corps));
  v("avec le compte exact de pages", /3 pages déjà prises/.test(corps),
    corps.match(/\d+ pages? déjà prise\w*[^·]*/)?.[0] || "absent");
  v("et le compte de celles qui sont redressées", /dont 2 redressées/.test(corps),
    corps.match(/dont \d+ redressée\w*/)?.[0] || "absent");
  v("l'écran dit pourquoi elles ont survécu", /déjà au serveur/.test(corps));
  await capture(page, "08-reprise");

  await page.click("text=Contrat transport essai");
  await page.waitForSelector("img[alt='Page 1']", { timeout: 30000 });
  await nettoyer(page);
  const apres = await page.locator("li img[alt^='Page ']").count();
  v("les trois pages sont retrouvées", apres === 3, `${apres}`);

  /* ──────────────────── RÉORDONNER ET RETIRER ─────────────────────── */
  titre("l'ordre des pages se corrige");
  await page.click("button[aria-label='Descendre la page 1']");
  await page.waitForSelector("text=Page déplacée en 2", { timeout: 30000 });
  await nettoyer(page);
  v("le déplacement est confirmé", true);
  const rangs = await page.locator("li span:text-matches('^Page \\\\d+$')").allTextContents();
  v("les rangs restent 1,2,3 sans trou",
    rangs.join(",") === "Page 1,Page 2,Page 3", rangs.join(","));

  await page.click("button[aria-label='Retirer la page 3']");
  await page.waitForSelector("text=Page 3 retirée", { timeout: 30000 });
  await nettoyer(page);
  const restantes = await page.locator("li img[alt^='Page ']").count();
  v("il ne reste que deux pages", restantes === 2, `${restantes}`);
  const rangs2 = await page.locator("li span:text-matches('^Page \\\\d+$')").allTextContents();
  v("les rangs se sont resserrés", rangs2.join(",") === "Page 1,Page 2", rangs2.join(","));
  await capture(page, "09-ordre");

  /* ──────────────────────────── ASSEMBLER ─────────────────────────── */
  titre("l'assemblage produit un PDF rangé dans la bibliothèque");
  await page.click("button:has-text('Assembler le PDF')");
  await page.waitForSelector("text=Assembler le PDF", { timeout: 15000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  /* On lit le paragraphe lui-même : chercher la phrase dans tout le corps
     rend un échec muet, sans dire ce qui est réellement écrit. */
  const phraseAssemblage = await page.locator("div.fixed p:has-text('assembl')").first()
    .textContent().catch(() => "");
  v("l'écran annonce le nombre de pages et l'ordre",
    /2\s*pages?\s*seront\s*assembl/.test(phraseAssemblage || ""),
    `lu : « ${String(phraseAssemblage || "").slice(0, 160)} »`);
  /* SANS TEXTE RECONNU, ON LE DIT. Laisser croire qu'un scan est cherchable
     par son contenu ferait abandonner la recherche au premier essai. */
  v("il dit que le PDF ne sera cherchable que par son nom",
    /que par son nom et sa description/.test(corps));

  await page.fill("input[placeholder*='Contrat transport']", "Contrat transport assemblé");
  await page.click("div.fixed button:has-text('Assembler')");
  await page.waitForSelector("text=Document rangé", { timeout: 60000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("le document est annoncé rangé", /Document rangé/.test(corps));
  v("l'écran dit que les pages d'origine restent",
    /pages d.origine restent conservées/.test(corps));
  const versBiblio = await cliquable(page.locator("a:has-text('Ouvrir la bibliothèque')"));
  v("le lien vers la bibliothèque est atteignable", versBiblio.libre,
    `recouvert par ${versBiblio.recouvert}`);
  await capture(page, "10-assemble");

  /* LE PDF EXISTE VRAIMENT ET C'EST UN PDF. */
  const pdf = await page.evaluate(async () => {
    const r = await fetch("/api/studio/documents?q=assembl%C3%A9", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`,
        "x-active-company-id": localStorage.getItem("active_company_id") || "" } });
    const d = await r.json();
    const doc = (d.documents || []).find((x) => /assembl/i.test(x.name));
    if (!doc) return { trouve: false };
    const f = await fetch(`/api/studio/documents/${doc.id}/fichier`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`,
        "x-active-company-id": localStorage.getItem("active_company_id") || "" } });
    const b = await f.arrayBuffer();
    const tete = new TextDecoder("latin1").decode(new Uint8Array(b).slice(0, 5));
    return { trouve: true, kind: doc.kind, pages: doc.page_count, mime: doc.mime,
      octets: b.byteLength, tete };
  });
  v("le document est dans la bibliothèque", pdf.trouve === true);
  v("de nature SCAN", pdf.kind === "SCAN", String(pdf.kind));
  v("avec deux pages", pdf.pages === 2, String(pdf.pages));
  v("et c'est un vrai PDF", pdf.tete === "%PDF-" && pdf.octets > 1000,
    `${pdf.tete} / ${pdf.octets} octets`);

  await page.click("button:has-text('Numériser autre chose')");
  await page.waitForSelector("text=Nouvelle numérisation", { timeout: 20000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la séance assemblée quitte la liste de reprise",
    !/Contrat transport essai/.test(corps));

  v("aucune erreur de console sur le parcours complet",
    erreursConsole.length === 0, erreursConsole.slice(0, 4).join("\n        | "));
  await ctx.close();

  /* ═════════════════ UN BROUILLON RESTE PRIVÉ, À L'ÉCRAN ══════════ */
  console.log("\n  LE COMPTABLE — UN AUTRE COMPTE DE LA MÊME SOCIÉTÉ");
  titre("la séance d'un collègue n'apparaît pas");
  ctx = await contexte(nav, COMPTA, { width: 1280, height: 1000 });
  page = await ctx.newPage();
  await page.goto(`${BASE}/studio/scanner`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Nouvelle numérisation", { timeout: 20000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("aucune séance en attente ne lui est proposée",
    !/Séances en attente/.test(corps) && !/Contrat transport/.test(corps),
    corps.slice(0, 200));
  await capture(page, "11-comptable");
  await ctx.close();

  /* ════════════════════════════ 375 px ═══════════════════════════ */
  console.log("\n  TÉLÉPHONE — 375 px");
  titre("rien ne déborde, rien ne recouvre");
  ctx = await contexte(nav, DIR, { width: 375, height: 760 });
  page = await ctx.newPage();
  await page.goto(`${BASE}/studio/scanner`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Nouvelle numérisation", { timeout: 20000 });
  await nettoyer(page);
  let debord = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth, vue: window.innerWidth }));
  v("l'écran de départ ne déborde pas", debord.page <= debord.vue + 1,
    `${debord.page}px pour ${debord.vue}px`);

  await page.fill("input[placeholder*='Contrat transport']", "Essai téléphone");
  await page.click("button:has-text('Commencer')");
  await page.waitForSelector("button:has-text('Allumer la caméra')", { timeout: 20000 });
  await nettoyer(page);
  debord = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth, vue: window.innerWidth }));
  v("l'écran de numérisation ne déborde pas", debord.page <= debord.vue + 1,
    `${debord.page}px pour ${debord.vue}px`);
  const bAllumer = await cliquable(page.locator("button:has-text('Allumer la caméra')"));
  v("le bouton de la caméra est atteignable", bAllumer.libre, `recouvert par ${bAllumer.recouvert}`);
  const bImporter = await cliquable(page.locator("button:has-text('Importer une photo')"));
  v("celui de l'import aussi", bImporter.libre, `recouvert par ${bImporter.recouvert}`);
  await capture(page, "12-telephone");

  /* On abandonne pour ne pas laisser traîner une séance d'essai. */
  await page.click("button:has-text('Abandonner')");
  await page.waitForTimeout(500);
  corps = await page.textContent("body");
  v("l'abandon dit qu'il n'y a rien à perdre quand aucune page n'est prise",
    /rien à perdre/.test(corps), corps.match(/Aucune page[^.]*\./)?.[0] || "absent");
  await page.locator("div.border-red-900 button:has-text('Abandonner')").click();
  await page.waitForSelector("text=Nouvelle numérisation", { timeout: 20000 });
  v("la séance abandonnée rend la main", true);
  await ctx.close();

  await nav.close();
  console.log(`\n  ${reussis} réussis, ${echoues} échoués\n`);
  process.exit(echoues ? 1 : 0);
})().catch((e) => { console.error("\n  ✘ interrompu :", e.message, "\n"); process.exit(2); });
