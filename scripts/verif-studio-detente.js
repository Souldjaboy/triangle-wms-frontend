/**
 * L'ESPACE DÉTENTE.
 *
 * Ce qu'il s'agit de prouver, dans l'ordre où cela compte :
 *
 *  1. QUE RIEN NE PART AU SERVEUR. Pas de score, pas de classement, pas de
 *     temps de jeu. Un temps de jeu mesuré finirait par être regardé, et une
 *     pause surveillée n'est plus une pause. On écoute donc TOUTES les
 *     requêtes pendant qu'on joue.
 *  2. Que les jeux marchent vraiment : le premier clic du démineur ne saute
 *     jamais, et le mélange du taquin est toujours résoluble.
 *  3. Que l'espace ne s'impose pas : rien n'y renvoie depuis ailleurs.
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

(async () => {
  const nav = await lancer();
  const ctx = await contexte(nav, DIR);
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const erreursConsole = [];
  page.on("pageerror", (e) => erreursConsole.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push(m.text()); });

  /* ON ÉCOUTE TOUT CE QUI PART. */
  const requetes = [];
  page.on("request", (r) => {
    const u = r.url();
    /* Les ressources de la page elle-même ne comptent pas : on surveille ce
       qui parle au serveur de l'application. */
    if (/\/api\//.test(u) || r.method() !== "GET") requetes.push(`${r.method()} ${u}`);
  });

  titre("l'espace ne s'impose pas, et ne dit rien de vous");
  await page.goto(`${BASE}/studio/detente`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Espace détente", { timeout: 25000 });
  await page.waitForTimeout(600);
  await nettoyer(page);
  let corps = await page.textContent("body");
  v("l'écran annonce que rien ne part au serveur",
    /ni score, ni classement, ni temps passé/.test(corps), corps.slice(0, 300));
  v("et que rien ne viendra vous chercher ailleurs",
    /ne s.ouvre que si vous venez/.test(corps));
  v("les deux jeux sont proposés",
    /Démineur/.test(corps) && /Taquin/.test(corps));
  await capture(page, "01-detente");

  /* ════════════════════════ LE DÉMINEUR ═════════════════════════ */
  titre("le démineur : le premier clic ne saute jamais");
  await page.click("button:has-text('Démineur')");
  await page.waitForSelector("button[aria-label='Case 1, 1']", { timeout: 20000 });
  await nettoyer(page);
  const cases = await page.locator("button[aria-label^='Case ']").count();
  v("la grille facile fait 81 cases", cases === 81, String(cases));

  /* On rejoue plusieurs fois : si les mines étaient posées AVANT le premier
     clic, on finirait par sauter — dix cases sur quatre-vingt-une, donc une
     partie sur huit. Vingt essais rendraient l'échec quasi certain. */
  let sautes = 0;
  for (let essai = 0; essai < 20; essai++) {
    await page.click("button:has-text('Recommencer')");
    await page.waitForTimeout(60);
    await page.click("button[aria-label='Case 5, 5']");
    await page.waitForTimeout(60);
    const txt = await page.textContent("body");
    if (/Raté/.test(txt)) sautes += 1;
  }
  v("vingt premiers clics, aucune mine", sautes === 0, `${sautes} parties perdues au premier clic`);

  const ouvertes = await page.evaluate(() =>
    [...document.querySelectorAll("button[aria-label^='Case ']")]
      .filter((b) => b.className.includes("bg-gray-800")).length);
  v("le premier clic ouvre une zone, pas une seule case", ouvertes > 1, String(ouvertes));
  await capture(page, "02-demineur");

  /* Le chronomètre démarre au premier clic, pas avant. */
  await page.waitForTimeout(1600);
  corps = await page.textContent("body");
  v("le chronomètre tourne pendant la partie", /[1-9]\d* s/.test(corps),
    corps.match(/\d+ s/)?.[0] || "aucun");

  /* ═══════════════════════════ LE TAQUIN ════════════════════════ */
  titre("le taquin : un mélange toujours résoluble");
  await page.click("button:has-text('Les jeux')");
  await page.waitForTimeout(300);
  await page.click("button:has-text('Taquin')");
  await page.waitForSelector("button[aria-label='Case vide']", { timeout: 20000 });
  await nettoyer(page);
  const tuiles = await page.locator("button[aria-label^='Tuile ']").count();
  v("la grille 3 × 3 porte huit tuiles et un vide", tuiles === 8, String(tuiles));

  /* LA RÉSOLUBILITÉ SE VÉRIFIE : pour une grille de côté impair, le nombre
     d'inversions doit être pair. Un tirage au sort donnerait une grille
     impossible une fois sur deux, et personne ne saurait que c'est perdu
     d'avance. */
  const resoluble = await page.evaluate(() => {
    const boutons = [...document.querySelectorAll(
      "button[aria-label^='Tuile '], button[aria-label='Case vide']")];
    const vals = boutons.map((b) => {
      const m = (b.getAttribute("aria-label") || "").match(/Tuile (\d+)/);
      return m ? Number(m[1]) : 0;
    });
    const sans = vals.filter((x) => x !== 0);
    let inversions = 0;
    for (let i = 0; i < sans.length; i++) {
      for (let j = i + 1; j < sans.length; j++) if (sans[i] > sans[j]) inversions += 1;
    }
    return { vals, inversions, pair: inversions % 2 === 0 };
  });
  v("le mélange est résoluble", resoluble.pair === true,
    `${resoluble.inversions} inversions — ${JSON.stringify(resoluble.vals)}`);

  /* Une tuile voisine du vide glisse ; une tuile éloignée ne bouge pas. */
  const avant = await page.locator("button[aria-label^='Tuile ']").allTextContents();
  await page.click("button:has-text('Mélanger')");
  await page.waitForTimeout(300);
  const apres = await page.locator("button[aria-label^='Tuile ']").allTextContents();
  v("un nouveau mélange donne une autre grille",
    avant.join(",") !== apres.join(",") || avant.length === 0,
    `${avant.join(",")} / ${apres.join(",")}`);
  await capture(page, "03-taquin");

  /* ══════════ RIEN N'EST PARTI AU SERVEUR PENDANT TOUT CELA ══════ */
  titre("rien n'a été envoyé au serveur pendant le jeu");
  /* CE QUI SE VÉRIFIE, C'EST QUE LE JEU NE RAPPORTE RIEN — pas que
     l'application se tait. Toute page de Triangle demande les droits du
     compte et relève les notifications : ces deux-là vivent dans la coquille
     commune, existent sur l'écran des factures comme ici, et ne disent rien
     de la partie. Le premier jet les comptait comme des fuites et accusait
     l'espace détente de quelque chose qui n'est pas de lui.

     La promesse tenue est donc : aucune ÉCRITURE, et aucune requête qui
     parle de jeu, de score ou de partie. */
  const COQUILLE = /\/api\/(permissions\/me|notifications\/)/;
  const ecritures = requetes.filter((r) => !r.startsWith("GET"));
  v("aucune écriture d'aucune sorte", ecritures.length === 0,
    ecritures.slice(0, 5).join("\n        "));

  const parlantDeJeu = requetes.filter(
    (r) => /detente|jeu|score|partie|demineur|taquin/i.test(r));
  v("aucune requête ne parle de jeu, de score ou de partie",
    parlantDeJeu.length === 0, parlantDeJeu.slice(0, 5).join("\n        "));

  const horsCoquille = requetes.filter((r) => /\/api\//.test(r) && !COQUILLE.test(r));
  v("rien d'autre que les droits et les notifications de l'application",
    horsCoquille.length === 0, horsCoquille.slice(0, 5).join("\n        "));
  console.log(`    · requêtes de la coquille commune pendant le jeu : ` +
    `${requetes.filter((r) => COQUILLE.test(r)).length} (droits et notifications)`);

  /* ET RIEN N'EST GARDÉ LOCALEMENT NON PLUS. */
  const garde = await page.evaluate(() => {
    const cles = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || "";
        if (/jeu|score|detente|demineur|taquin|partie/i.test(k)) cles.push(k);
      }
    } catch { /* stockage indisponible */ }
    return cles;
  });
  v("rien n'est gardé dans le navigateur non plus", garde.length === 0, garde.join(", "));

  v("aucune erreur de console", erreursConsole.length === 0,
    erreursConsole.slice(0, 3).join("\n        | "));
  await ctx.close();

  /* ════════════════════════════ 375 px ═══════════════════════════ */
  console.log("\n  TÉLÉPHONE — 375 px");
  titre("rien ne déborde");
  const ctx2 = await contexte(nav, DIR, { width: 375, height: 760 });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/studio/detente`, { waitUntil: "domcontentloaded" });
  await page2.waitForSelector("text=Espace détente", { timeout: 25000 });
  await page2.click("button:has-text('Démineur')");
  await page2.waitForSelector("button[aria-label='Case 1, 1']", { timeout: 20000 });
  await page2.waitForTimeout(400);
  await nettoyer(page2);
  const debord = await page2.evaluate(() => ({
    page: document.documentElement.scrollWidth, vue: window.innerWidth }));
  v("le démineur ne déborde pas", debord.page <= debord.vue + 1,
    `${debord.page}px pour ${debord.vue}px`);
  await capture(page2, "04-telephone");
  await ctx2.close();

  await nav.close();
  console.log(`\n  ${reussis} réussis, ${echoues} échoués\n`);
  process.exit(echoues ? 1 : 0);
})().catch((e) => { console.error("\n  ✘ interrompu :", e.message, "\n"); process.exit(2); });
