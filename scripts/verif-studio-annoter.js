"use strict";
/**
 * ANNOTER UNE PAGE, PAR L'ÉCRAN.
 *
 * CE QUE CET ESSAI ÉTABLIT, ET QU'AUCUN ESSAI D'API NE PEUT ÉTABLIR.
 *
 * Trois conversions se suivent, écrites par trois morceaux de code
 * différents, et il suffit qu'une seule se trompe pour que l'annotation
 * atterrisse ailleurs :
 *
 *   1. l'écran convertit le cadre tracé à la souris en points du repère de
 *      l'affichage (app/lib/pdf.ts) ;
 *   2. le serveur convertit ce repère en coordonnées du contenu du PDF
 *      (services/pdf-reperes.js) ;
 *   3. le lecteur ramène le contenu à l'écran, en appliquant /Rotate.
 *
 * L'essai les parcourt toutes les trois : il trace à la souris, lit la
 * position que L'ÉCRAN AFFICHE, pose, puis REND le PDF produit et regarde si
 * l'encre est là où l'écran l'avait annoncée. Un essai d'API ne vérifierait
 * que la deuxième.
 *
 * LA PAGE 2 EST TOURNÉE D'UN QUART DE TOUR. C'est la seule où une erreur de
 * repère se voit : sur une page droite, tous les repères coïncident et
 * n'importe quel code faux passe.
 */
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { lancer } = require(path.join(__dirname, "navigateur"));

const BASE = "http://localhost:3000";
const SECRET = process.env.SECRET || "test_studio";
const SORTIE = process.env.SORTIE || "/tmp/captures-annot";
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
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 1000 } });
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

/* Un PDF de trois pages, la deuxième tournée d'un quart de tour. Écrit à la
   main : c'est trois objets, et cela évite de dépendre d'un générateur. */
function pdfTrois() {
  const corps =
    "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R 4 0 R 5 0 R]/Count 3>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n" +
    "4 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Rotate 90>>endobj\n" +
    "5 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 420 595]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n";
  return Buffer.from(corps, "latin1");
}

/* Lire « Position : 120 ; 540 — 300×60 points » dans le panneau. */
function lirePosition(texte) {
  const m = /Position\s*:\s*(-?\d+)\s*;\s*(-?\d+)\s*[—-]\s*(\d+)×(\d+)/.exec(
    String(texte).replace(/\s+/g, " "));
  if (!m) return null;
  return { x: +m[1], y: +m[2], largeur: +m[3], hauteur: +m[4] };
}

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const nav = await lancer();

  /* ─── Une page à part, qui sait rendre un PDF et compter les pixels ─── */
  const ctxRendu = await nav.newContext();
  const lecteur = await ctxRendu.newPage();
  await lecteur.route("**/*", (route) => {
    const u = route.request().url();
    const servir = (rel, type) => route.fulfill({
      body: fs.readFileSync(path.join(FRONT, "node_modules/pdfjs-dist", rel)),
      contentType: type,
    });
    if (u.endsWith("/pdf.mjs")) return servir("build/pdf.mjs", "text/javascript");
    if (u.endsWith("/pdf.worker.mjs")) return servir("build/pdf.worker.mjs", "text/javascript");
    return route.fulfill({
      body: "<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>",
      contentType: "text/html" });
  });
  await lecteur.goto("http://lecteur.local/");

  /**
   * Rend une page du PDF produit et répond, pour le rectangle donné EN
   * POINTS DU REPÈRE DE L'AFFICHAGE : la couleur au centre, la quantité
   * d'encre, et la couleur d'un coin resté libre.
   */
  const inspecter = async (octets, numero, rect) => lecteur.evaluate(
    async ([tableau, page, r]) => {
      const { getDocument, GlobalWorkerOptions } = await import("/pdf.mjs");
      GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
      const doc = await getDocument({ data: new Uint8Array(tableau) }).promise;
      const pg = await doc.getPage(page);
      const echelle = 2;
      const vue = pg.getViewport({ scale: echelle });
      const c = document.createElement("canvas");
      c.width = Math.ceil(vue.width); c.height = Math.ceil(vue.height);
      const g = c.getContext("2d");
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
      await pg.render({ canvasContext: g, viewport: vue, canvas: c }).promise;

      /* Du repère de l'affichage aux pixels : la vue a déjà absorbé /Rotate,
         il ne reste qu'à multiplier et à retourner l'ordonnée. */
      const gauche = r.x * echelle, droite = (r.x + r.largeur) * echelle;
      const haut = (vue.height / echelle - (r.y + r.hauteur)) * echelle;
      const bas = (vue.height / echelle - r.y) * echelle;

      const d = g.getImageData(0, 0, c.width, c.height).data;
      const lire = (x, y) => {
        const i = (Math.round(Math.min(c.height - 1, Math.max(0, y))) * c.width
                 + Math.round(Math.min(c.width - 1, Math.max(0, x)))) * 4;
        return [d[i], d[i + 1], d[i + 2]];
      };
      let encre = 0, total = 0;
      for (let y = Math.round(haut); y <= Math.round(bas); y += 1) {
        for (let x = Math.round(gauche); x <= Math.round(droite); x += 1) {
          const [a, b2, c2] = lire(x, y);
          total += 1;
          if (a + b2 + c2 < 690) encre += 1;
        }
      }
      return {
        vue: { l: Math.round(vue.width / echelle), h: Math.round(vue.height / echelle) },
        centre: lire((gauche + droite) / 2, (haut + bas) / 2),
        encre, total,
        /* Un coin loin du rectangle : rien n'a dû y être peint. */
        ailleurs: lire(c.width * 0.93, c.height * 0.95),
        boite: { gauche, droite, haut, bas },
      };
    }, [Array.from(octets), numero, rect]);

  /* ════════════════ LE DOCUMENT D'ESSAI ════════════════ */
  const ctx = await contexte(nav, DIR);
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  page.on("pageerror", (e) => console.log("  pageerror:", e.message.slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") console.log("  console:", m.text().slice(0, 200)); });

  await page.goto(`${BASE}/studio/bibliotheque`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main", { timeout: 30000 });
  const docId = await page.evaluate(async (b64) => {
    const octets = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const f = new FormData();
    f.append("fichier", new Blob([octets], { type: "application/pdf" }), "Bon a annoter.pdf");
    f.append("nom", "Bon a annoter.pdf");
    f.append("visibilite", "SOCIETE");
    const r = await fetch("/api/studio/documents", {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-active-company-id": "1" },
      body: f });
    return (await r.json())?.document?.id ?? null;
  }, pdfTrois().toString("base64"));

  titre("L'écran s'ouvre et dit la page telle qu'on la voit");
  v("le document d'essai est déposé", !!docId, String(docId));

  await page.goto(`${BASE}/studio/pdf/${docId}/annoter`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=En attente sur cette page", { timeout: 40000 });
  await page.waitForSelector("canvas", { timeout: 40000 });
  await page.waitForTimeout(600);

  let entete = (await page.textContent("header")).replace(/\s+/g, " ");
  v("l'en-tête nomme le document", /Annoter — Bon a annoter\.pdf/.test(entete), entete);
  v("et donne les dimensions de la page 1 en points",
    /595×842 points/.test(entete), entete);
  v("et ne prétend pas qu'elle est tournée", !/tournée/.test(entete), entete);

  const outils = (await page.locator("section button").allTextContents()).join("|");
  v("les quatre outils sont proposés",
    /Mention/.test(outils) && /Tableau/.test(outils) && /Surlignage/.test(outils) && /Cadre/.test(outils),
    outils.slice(0, 160));

  /* ════════════════ UNE MENTION SUR LA PAGE DROITE ════════════════ */
  titre("Tracer une mention, la remplir, la poser");
  const toile = page.locator("div.relative.w-fit").first();
  const tracer = async (gx, gy, dx, dy) => {
    const b = await toile.boundingBox();
    await page.mouse.move(b.x + b.width * gx, b.y + b.height * gy);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * dx, b.y + b.height * dy, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(250);
  };

  await page.click("section button:has-text('Mention')");
  await tracer(0.10, 0.12, 0.70, 0.20);
  v("le cadre tracé apparaît dans la liste d'attente",
    (await page.locator("aside li button").count()) === 1,
    `${await page.locator("aside li button").count()} entrée(s)`);
  v("un cadre ajouté est tout de suite sélectionné",
    await page.locator("aside textarea").isVisible().catch(() => false));

  const positionMention = lirePosition(await page.textContent("aside"));
  v("l'écran affiche la position du cadre en points", !!positionMention,
    (await page.textContent("aside")).replace(/\s+/g, " ").slice(0, 200));
  v("et cette position tient dans la page vue",
    !!positionMention && positionMention.x >= 0 && positionMention.y >= 0
      && positionMention.x + positionMention.largeur <= 596
      && positionMention.y + positionMention.hauteur <= 843,
    JSON.stringify(positionMention));

  await page.fill("aside textarea", "RECU CONFORME");
  await page.selectOption("aside select", "sans-gras");
  await page.fill("aside input[type='number']", "24");
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SORTIE}/01-mention-tracee.png`, fullPage: false });

  await page.click("header button:has-text('Poser')");
  await page.waitForSelector("text=version 2", { timeout: 40000 });
  let msg = (await page.textContent("body")).replace(/\s+/g, " ");
  v("la pose réussit et annonce la version 2", /version 2/.test(msg), msg.slice(0, 200));
  v("et rappelle que la précédente reste intacte",
    /précédente reste intacte/.test(msg), msg.slice(0, 260));
  v("la liste d'attente est vidée",
    (await page.locator("aside li button").count()) === 0);

  /* ─── La preuve : l'encre est là où l'écran l'avait annoncée ─── */
  const telecharger = async () => {
    const tableau = await page.evaluate(async (id) => {
      const r = await fetch(`/api/studio/documents/${id}/fichier`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-active-company-id": "1" } });
      return Array.from(new Uint8Array(await r.arrayBuffer()));
    }, docId);
    return Buffer.from(tableau);
  };
  let produit = await telecharger();
  v("le PDF produit se télécharge",
    produit.subarray(0, 5).toString("latin1") === "%PDF-", `${produit.length} octets`);

  let vu = await inspecter(produit, 1, positionMention);
  v("la page 1 se rend à ses dimensions",
    vu.vue.l === 595 && vu.vue.h === 842, `${vu.vue.l}×${vu.vue.h}`);
  v("l'encre de la mention est dans le cadre annoncé par l'écran",
    vu.encre > 150, `${vu.encre} pixels d'encre sur ${vu.total}`);
  v("et rien n'a été peint ailleurs sur la page",
    vu.ailleurs[0] > 240 && vu.ailleurs[1] > 240 && vu.ailleurs[2] > 240,
    `rvb ${vu.ailleurs.join(",")}`);

  /* ════════════════ LA PAGE TOURNÉE ════════════════ */
  titre("Un surlignage sur la page tournée d'un quart de tour");
  await page.click("button[aria-label='Page suivante']");
  await page.waitForTimeout(1200);
  entete = (await page.textContent("header")).replace(/\s+/g, " ");
  v("l'en-tête dit que la page 2 est tournée", /tournée de 90°/.test(entete), entete);
  v("et donne ses dimensions COUCHÉES", /842×595 points/.test(entete), entete);

  await page.click("section button:has-text('Surlignage')");
  const avertissementAvant = (await page.textContent("aside")).replace(/\s+/g, " ");
  await tracer(0.12, 0.30, 0.45, 0.38);
  const posSurlignage = lirePosition(await page.textContent("aside"));
  v("le cadre du surlignage est placé dans la page couchée",
    !!posSurlignage && posSurlignage.x + posSurlignage.largeur <= 843
      && posSurlignage.y + posSurlignage.hauteur <= 596,
    JSON.stringify(posSurlignage));
  v("un cadre plus large que 595 points est donc possible : la page est bien couchée",
    !!posSurlignage && posSurlignage.largeur > 150, JSON.stringify(posSurlignage));

  const avertissement = (await page.textContent("aside")).replace(/\s+/g, " ");
  v("l'écran prévient que le surlignage est de l'encre, pas une annotation de lecteur",
    /ENCRE dans la page/.test(avertissement) && /Acrobat/.test(avertissement),
    avertissement.slice(0, 240));
  /* On met l'opacité à fond : l'essai doit pouvoir reconnaître la couleur. */
  const curseur = page.locator("aside input[type='range']");
  await curseur.fill("100");
  await page.locator("aside button[aria-label='Couleur #15803d']").click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SORTIE}/02-surlignage-page-tournee.png`, fullPage: false });

  await page.click("header button:has-text('Poser')");
  await page.waitForSelector("text=version 3", { timeout: 40000 });
  v("la pose sur la page tournée réussit",
    /version 3/.test((await page.textContent("body")).replace(/\s+/g, " ")));

  produit = await telecharger();
  vu = await inspecter(produit, 2, posSurlignage);
  v("la page 2 se rend couchée", vu.vue.l === 842 && vu.vue.h === 595, `${vu.vue.l}×${vu.vue.h}`);
  const [r2, g2, b2] = vu.centre;
  v("LE SURLIGNAGE EST À L'ENDROIT ANNONCÉ PAR L'ÉCRAN, sur la page tournée",
    g2 > 90 && r2 < 110 && b2 < 110, `rvb ${r2},${g2},${b2}`);
  v("et rien n'a été peint ailleurs sur cette page",
    vu.ailleurs[0] > 240 && vu.ailleurs[1] > 240 && vu.ailleurs[2] > 240,
    `rvb ${vu.ailleurs.join(",")}`);

  /* ════════════════ UN TABLEAU ════════════════ */
  titre("Un tableau, posé sur la troisième page");
  await page.click("button[aria-label='Page suivante']");
  await page.waitForTimeout(1200);
  await page.click("section button:has-text('Tableau')");
  await tracer(0.10, 0.25, 0.85, 0.55);
  v("le tableau arrive avec une grille à remplir",
    (await page.locator("aside input[type='text'], aside input:not([type])").count()) >= 6,
    `${await page.locator("aside input:not([type])").count()} cellules`);
  const cellules = page.locator("aside input:not([type])");
  const n = await cellules.count();
  for (let i = 0; i < Math.min(n, 6); i += 1) {
    await cellules.nth(i).fill(["Produit", "Quantite", "Unite", "Ciment", "320", "sacs"][i] || "x");
  }
  await page.click("aside button:has-text('+ une ligne')");
  await page.waitForTimeout(200);
  const apresAjout = await page.locator("aside input:not([type])").count();
  v("on peut ajouter une ligne", apresAjout === n + 3, `${apresAjout} cellules au lieu de ${n + 3}`);
  await page.click("header button:has-text('Poser')");
  await page.waitForSelector("text=version 4", { timeout: 40000 });
  v("le tableau se pose", /version 4/.test((await page.textContent("body")).replace(/\s+/g, " ")));
  /* POSER NE DOIT PAS FAIRE PERDRE SA PLACE. Le premier jet de l'écran
     revenait en page 1 après chaque pose : qui annote le feuillet 7 d'un
     dossier de vingt devait y retourner à chaque mention. */
  v("après la pose, on est resté sur la page 3",
    /page 3 sur 3/.test((await page.textContent("header")).replace(/\s+/g, " ")),
    (await page.textContent("header")).replace(/\s+/g, " "));
  await page.screenshot({ path: `${SORTIE}/03-tableau-pose.png`, fullPage: false });

  /* ════════════════ CE QUI EST REFUSÉ, ET COMMENT C'EST DIT ════════════ */
  titre("Un refus du serveur est répété mot pour mot");
  await page.click("button[aria-label='Page précédente']");
  await page.click("button[aria-label='Page précédente']");
  await page.waitForTimeout(1200);
  /* DEUX CADRES EN ATTENTE, ET C'EST LE SECOND QUI DÉBORDE. C'est la seule
     façon d'éprouver vraiment la désignation du cadre fautif : avec un seul
     cadre, « il est sélectionné » serait vrai sans que personne n'ait rien
     fait. On sélectionne même l'autre avant de poser, pour que la sélection
     DOIVE bouger. */
  await page.click("section button:has-text('Cadre')");
  await tracer(0.10, 0.45, 0.40, 0.52);
  await page.click("section button:has-text('Mention')");
  await tracer(0.10, 0.60, 0.22, 0.625);
  await page.fill("aside textarea",
    "Un commentaire beaucoup trop long pour tenir dans un cadre de cette taille, et qui doit donc être refusé plutôt que rogné.");
  await page.locator("aside li button").first().click();
  await page.waitForTimeout(200);
  v("avant la pose, c'est l'autre cadre qui est sélectionné",
    (await page.locator("aside textarea").count()) === 0,
    `${await page.locator("aside textarea").count()} zone(s) de texte`);

  await page.click("header button:has-text('Poser')");
  /* ON ATTEND LE BANDEAU D'ERREUR LUI-MÊME, par son ancrage.

     DEUX PREMIERS JETS ONT ÉCHOUÉ POUR LA MÊME RAISON. Ils attendaient un
     MOT : « lignes » d'abord — qui se trouve aussi dans le bouton
     « + une ligne » —, puis « rogné » — qui se trouve dans l'aide de l'outil
     Mention, affichée en permanence sous la barre. Les deux attentes étaient
     satisfaites AVANT l'arrivée du refus, et l'essai lisait un écran qui
     n'affichait encore rien : il accusait l'écran de taire ce qu'il n'avait
     pas eu le temps de dire. Un mot ne désigne pas un endroit. */
  await page.waitForSelector("[data-bandeau='erreur']", { timeout: 40000 });
  await page.waitForTimeout(200);
  const refus = (await page.textContent("[data-bandeau='erreur']")).replace(/\s+/g, " ");
  v("le refus dit combien de lignes le texte demande",
    /demande \d+ lignes?/.test(refus), refus.slice(0, 300));
  v("et combien le cadre en tient", /n'en tient que \d+/.test(refus), refus.slice(0, 300));
  v("et promet que rien n'est rogné", /rien n'est rogné sans le dire/.test(refus), refus.slice(0, 300));
  v("les deux annotations restent en attente : rien n'a été posé",
    (await page.locator("aside li button").count()) === 2,
    `${await page.locator("aside li button").count()} entrée(s)`);
  v("et l'écran dit que rien n'a été posé",
    /Rien n'a été posé/.test(refus), refus.slice(0, 400));
  v("et désigne le cadre en cause dans la liste",
    /cadre en cause est sélectionné/.test(refus), refus.slice(0, 400));
  v("LA SÉLECTION A BOUGÉ VERS LE CADRE FAUTIF, le second",
    (await page.locator("aside textarea").count()) === 1
      && (await page.locator("aside textarea").inputValue()).startsWith("Un commentaire beaucoup trop long"),
    `${await page.locator("aside textarea").count()} zone(s) : ` +
    (await page.locator("aside textarea").inputValue().catch(() => "—")).slice(0, 50));
  v("et le refus dit lequel : le deuxième", /le 2. de la liste/.test(refus), refus.slice(0, 300));
  await page.screenshot({ path: `${SORTIE}/04-refus-debordement.png`, fullPage: false });

  /* LA MÊME MENTION, DANS UN CADRE ASSEZ GRAND.

     Le premier jet de cet essai traçait simplement un second cadre et
     reposait : la petite mention étant RESTÉE en attente — c'est voulu —, la
     liste la contenait encore et le serveur refusait de nouveau, à bon
     droit. L'essai accusait l'écran d'un défaut qui était le sien. On retire
     donc d'abord le cadre trop petit, ce que l'utilisateur ferait. */
  await page.click("aside button:has-text('Retirer')");
  await page.waitForTimeout(200);
  v("retirer le cadre fautif laisse l'autre",
    (await page.locator("aside li button").count()) === 1,
    `${await page.locator("aside li button").count()} entrée(s)`);
  await tracer(0.05, 0.60, 0.92, 0.78);
  await page.fill("aside textarea",
    "Un commentaire beaucoup trop long pour tenir dans un cadre de cette taille, et qui doit donc être refusé plutôt que rogné.");
  await page.click("header button:has-text('Poser')");
  await page.waitForSelector("text=version 5", { timeout: 40000 });
  v("dans un cadre assez grand, la même mention passe",
    /version 5/.test((await page.textContent("body")).replace(/\s+/g, " ")));

  /* ════════════════ UN CLIC N'EST PAS UN TRACÉ ════════════════ */
  titre("Un clic ne crée pas d'annotation invisible");
  const avant = await page.locator("aside li button").count();
  const b = await toile.boundingBox();
  await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.5);
  await page.waitForTimeout(300);
  v("un simple clic ne pose rien",
    (await page.locator("aside li button").count()) === avant,
    `${await page.locator("aside li button").count()} au lieu de ${avant}`);

  /* ════════════════ LE DROIT DE MODIFIER ════════════════ */
  titre("Regarder n'est pas annoter");
  const ctxMaga = await contexte(nav, MAGA);
  const vueMaga = await ctxMaga.newPage();
  vueMaga.setDefaultTimeout(30000);
  await vueMaga.goto(`${BASE}/studio/pdf/${docId}/annoter`, { waitUntil: "domcontentloaded" });
  await vueMaga.waitForSelector("canvas", { timeout: 40000 });
  await vueMaga.waitForTimeout(600);
  const texteMaga = (await vueMaga.textContent("body")).replace(/\s+/g, " ");
  v("le magasinier voit la page", (await vueMaga.locator("canvas").count()) > 0);
  v("l'écran lui dit qu'il ne peut pas annoter, et pourquoi",
    /pas l'annoter/.test(texteMaga) && /droit de modification/.test(texteMaga),
    texteMaga.slice(0, 260));
  v("le bouton « Poser » lui est inerte",
    await vueMaga.locator("header button:has-text('Poser')").isDisabled());
  const bMaga = await vueMaga.locator("div.relative.w-fit").first().boundingBox();
  await vueMaga.mouse.move(bMaga.x + bMaga.width * 0.2, bMaga.y + bMaga.height * 0.2);
  await vueMaga.mouse.down();
  await vueMaga.mouse.move(bMaga.x + bMaga.width * 0.6, bMaga.y + bMaga.height * 0.3, { steps: 8 });
  await vueMaga.mouse.up();
  await vueMaga.waitForTimeout(400);
  v("et tracer ne crée rien chez lui",
    (await vueMaga.locator("aside li button").count()) === 0,
    `${await vueMaga.locator("aside li button").count()} entrée(s)`);
  await vueMaga.screenshot({ path: `${SORTIE}/05-sans-droit.png`, fullPage: false });

  /* ════════════════ L'ORIGINAL ════════════════ */
  titre("L'original n'a pas bougé");
  const versions = await page.evaluate(async (id) => {
    const r = await fetch(`/api/studio/documents/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "x-active-company-id": "1" } });
    const d = await r.json();
    return (d.versions || []).map((x) => ({ v: x.version, original: x.is_original, note: x.change_note }));
  }, docId);
  v("cinq versions existent", versions.length === 5, JSON.stringify(versions.map((x) => x.v)));
  v("la version 1 est toujours marquée comme l'original",
    versions.find((x) => x.v === 1)?.original === true, JSON.stringify(versions[0]));
  v("chaque version annotée dit ce qui a été posé",
    versions.filter((x) => x.v > 1).every((x) => /Annotations posées/.test(x.note || "")),
    JSON.stringify(versions.map((x) => x.note)));

  await nav.close();
  console.log(`\n  ${ok} réussis, ${ko} échoués`);
  console.log(`  captures dans ${SORTIE}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => {
  console.error("\n  ✘ interrompu :", e.message, "\n", e.stack);
  process.exit(2);
});
