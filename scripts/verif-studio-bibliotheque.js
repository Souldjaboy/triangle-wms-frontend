/**
 * LA BIBLIOTHÈQUE DU STUDIO, DANS UN VRAI NAVIGATEUR.
 *
 * Ce qu'il s'agit de prouver : qu'on peut RÉELLEMENT travailler depuis
 * l'écran — déposer un fichier, le retrouver par le texte d'un scan, le
 * verser en nouvelle version, le jeter, le ravoir, le partager par lien, le
 * supprimer avec motif — et que l'écran DIT ce qu'il ne faut pas ignorer :
 *
 *   • qu'un document a été modifié, au lieu de le faire passer pour l'original ;
 *   • qu'un lien de partage ne sera plus jamais réaffiché ;
 *   • que la corbeille n'est pas la suppression ;
 *   • qu'une liste ne montre pas le fonds complet de la société.
 *
 * Et qu'une direction de FAT & MAT ne voit RIEN de Triangle. C'est le seul
 * contrôle qui vaut : les deux sociétés partagent la même base.
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
const COMPTA = { id: 901, fullname: "Comptable Triangle", email: "compta@t.local",
                 role: "comptable", company_id: 1, is_super_admin: false };
const FAT = { id: 903, fullname: "Direction Fatemat", email: "fat@t.local",
              role: "direction", company_id: 2, is_super_admin: false };

/* ────────────────────── UN PDF MINUSCULE MAIS VRAI ──────────────────────
   Le serveur contrôle les octets de tête : un faux PDF serait refusé, et le
   test mesurerait alors le refus au lieu de l'écran. */
function pdf(texte) {
  const corps = `BT /F1 12 Tf 40 700 Td (${texte.replace(/[()\\]/g, "")}) Tj ET`;
  return Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
    `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R` +
    `/Resources<</Font<</F1 5 0 R>>>>>>endobj\n` +
    `4 0 obj<</Length ${corps.length}>>stream\n${corps}\nendstream endobj\n` +
    `5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n` +
    `trailer<</Root 1 0 R>>\n%%EOF\n`, "latin1");
}
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489" +
  "0000000a49444154789c6300010000050001" + "0d0a2db4" + "0000000049454e44ae426082", "hex");

async function deposer(user, { nom, buffer, mime, ocr, visibilite, description, tags }) {
  const f = new FormData();
  f.append("fichier", new Blob([buffer], { type: mime }), nom);
  f.append("nom", nom);
  if (ocr) f.append("ocr_texte", ocr);
  if (description) f.append("description", description);
  if (tags) f.append("tags", tags);
  f.append("visibilite", visibilite || "SOCIETE");
  const r = await fetch(`${API}/studio/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jeton(user)}`, "x-active-company-id": String(user.company_id) },
    body: f,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`dépôt « ${nom} » refusé : ${r.status} ${j.error || ""}`);
  return j.document;
}

async function versionner(user, id, { buffer, mime, nom, note }) {
  const f = new FormData();
  f.append("fichier", new Blob([buffer], { type: mime }), nom);
  f.append("note", note);
  const r = await fetch(`${API}/studio/documents/${id}/versions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jeton(user)}`, "x-active-company-id": String(user.company_id) },
    body: f,
  });
  if (!r.ok) throw new Error(`version refusée : ${r.status}`);
  return (await r.json()).document;
}

async function contexte(nav, user, viewport) {
  const t = jeton(user);
  const ctx = await nav.newContext({ viewport, locale: "fr-FR", timezoneId: "Africa/Bamako" });
  await ctx.addCookies([
    { name: "triangle_token", value: t, url: BASE },
    { name: "triangle_business_token", value: t, url: BASE },
  ]);
  /* Le script d'amorçage tourne sur CHAQUE document, « about:blank »
     compris — et là, localStorage est nul. Sans cette garde, le harnais
     lui-même injectait deux « pageerror » dans le relevé et se faisait
     passer pour un défaut de l'écran. */
  await ctx.addInitScript(([jet, u]) => {
    try {
      if (typeof localStorage === "undefined" || !localStorage) return;
      localStorage.setItem("token", jet);
      localStorage.setItem("business_token", jet);
      localStorage.setItem("user", JSON.stringify(u));
      localStorage.setItem("active_company_id", String(u.company_id));
    } catch { /* fenêtre sans stockage : rien à amorcer */ }
  }, [t, user]);
  return ctx;
}

/* Les bandeaux systèmes flottent au-dessus de tout et masqueraient les clics. */
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

/* QUI se trouve au point du bouton ? Le seul contrôle qui attrape un bandeau
   posé par-dessus une action. */
async function cliquable(locateur) {
  if ((await locateur.count()) === 0) return { trouve: false, libre: false, recouvert: "absent" };
  const cible = locateur.first();
  /* ON AMÈNE L'ÉLÉMENT DANS LA VUE AVANT DE MESURER. Sans cela, un bouton
     parfaitement atteignable mais situé plus bas que la fenêtre était
     compté comme « recouvert par rien » : elementFromPoint ne répond que
     pour un point visible. Trois contrôles de cette suite ont ainsi accusé
     le code d'un défaut qui n'était que dans la sonde. La question posée
     est « l'utilisateur peut-il l'atteindre », pas « est-il visible sans
     défiler ». */
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

/* OUVRIR UN DOCUMENT PAR SA LIGNE DE LISTE, pas par « text= ». Le sélecteur
   textuel attrape aussi l'attribut alt de l'image d'aperçu : il visait alors
   le document DÉJÀ ouvert, à l'intérieur du panneau, et le clic restait
   bloqué derrière le voile de la fiche. On cible la liste. */
async function ouvrirDocument(page, nom) {
  const ligne = page.locator("main li button").filter({ hasText: nom });
  await ligne.first().waitFor({ state: "visible", timeout: 15000 });
  await ligne.first().click();
}

(async () => {
  /* ═════════════════════════ LE FONDS D'ESSAI ═════════════════════════ */
  titre("jeu d'essai déposé par l'API");
  const contrat = await deposer(DIR, {
    nom: "Contrat transport Bamako.pdf", buffer: pdf("Contrat de transport"),
    mime: "application/pdf", visibilite: "SOCIETE",
    description: "Contrat annuel avec le transporteur", tags: "contrat,2026",
  });
  const recu = await deposer(DIR, {
    nom: "Recu carburant mars.pdf", buffer: pdf("Recu carburant"),
    mime: "application/pdf", visibilite: "SOCIETE",
    /* Le texte reconnu n'est PAS dans le nom : c'est tout l'intérêt du test
       de recherche — on cherche un mot qui n'existe que dans le scan. */
    ocr: "Station Elton Sebenikoro quarante mille francs gasoil",
  });
  const prive = await deposer(COMPTA, {
    nom: "Note privee comptable.pdf", buffer: pdf("Note privee"),
    mime: "application/pdf", visibilite: "PRIVE",
  });
  const image = await deposer(DIR, {
    nom: "Photo entrepot.png", buffer: PNG, mime: "image/png", visibilite: "SOCIETE",
  });
  await deposer(FAT, {
    nom: "Facture Fatemat exclusive.pdf", buffer: pdf("Fatemat"),
    mime: "application/pdf", visibilite: "SOCIETE",
  });
  await versionner(DIR, contrat.id, {
    buffer: pdf("Contrat de transport corrige"), mime: "application/pdf",
    nom: "contrat-v2.pdf", note: "montant corrige apres verification du bon de livraison",
  });
  v("le fonds d'essai est en place", !!(contrat && recu && prive && image));

  const nav = await lancer();

  /* ═══════════════════════════════ 1280 px ═══════════════════════════════ */
  console.log("\n  ÉCRAN DE BUREAU — 1280 px");
  let ctx = await contexte(nav, DIR, { width: 1280, height: 1000 });
  let page = await ctx.newPage();
  const erreursConsole = [];
  const reponsesFachees = [];
  const refusAttendus = [];
  let onProvoque = false;
  /* On note aussi D'OÙ vient l'erreur : « 415 Unsupported Media Type » sans
     URL ne dit pas si le défaut est dans l'écran mesuré ou dans un
     composant global de l'application. */
  /* LES REFUS QU'ON PROVOQUE EXPRÈS NE SONT PAS DES DÉFAUTS. Déposer du HTML
     renommé en PDF DOIT échouer, et « 415 Unsupported Media Type » est le
     code exact pour cela. Sans cet aiguillage, le contrôle comptait ce
     succès comme une anomalie. */
  /* Le navigateur consigne aussi « Failed to load resource » pour le refus
     qu'on provoque : même aiguillage, sinon le succès du contrôle précédent
     ferait échouer celui-ci. */
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    (onProvoque ? refusAttendus : erreursConsole).push(m.text());
  });
  page.on("pageerror", (e) => erreursConsole.push(`pageerror: ${e.message}\n          ${String(e.stack || "").split("\n").slice(1, 4).join("\n          ")}`));
  page.on("response", (r) => {
    if (r.status() < 400) return;
    const ligne = `${r.status()} ${r.request().method()} ${r.url()}`;
    (onProvoque ? refusAttendus : reponsesFachees).push(ligne);
  });

  /* ───────────────────────────── L'ACCUEIL ──────────────────────────── */
  titre("l'accueil du Studio ne propose que ce qui marche");
  await page.goto(`${BASE}/studio`, { waitUntil: "networkidle" });
  await nettoyer(page);
  const corpsAccueil = await page.textContent("body");
  v("la tuile « Bibliothèque » est là", corpsAccueil.includes("Bibliothèque"));
  v("les modules à construire sont annoncés comme tels",
    corpsAccueil.includes("Pas encore construit"));
  /* CE QUI N'EST PAS CONSTRUIT EST NOMMÉ SANS ÊTRE CLIQUABLE. C'est la
     promesse de cet accueil : on peut lire ce qui viendra, mais rien ne
     s'ouvre sur du vide. */
  const aVenir = await page.$$eval(
    "section:has(> h2) li",
    (lis) => lis.filter((li) => /Pas encore construit/.test(
      li.closest("section")?.textContent || "")).map((li) => ({
        texte: (li.textContent || "").slice(0, 60),
        cliquable: !!li.querySelector("a,button"),
      })));
  v("ce qui reste à construire est annoncé", corpsAccueil.includes("Pas encore construit"));
  v("et rien de ce qui reste à construire n'est cliquable",
    aVenir.every((x) => !x.cliquable),
    JSON.stringify(aVenir.filter((x) => x.cliquable)));

  /* AUCUN LIEN MORT. Une tuile qui ouvre une page vide coûte plus cher
     qu'une tuile absente.

     LE PREMIER JET COMPARAIT LES LIENS À UNE LISTE ÉCRITE EN DUR — « /studio »
     et « /studio/bibliotheque ». Elle était juste au moment où elle a été
     écrite, et fausse dès le module suivant : chaque écran construit ajoutait
     légitimement une tuile, et l'essai criait au lien mort. Une liste figée
     ne décrit pas une promesse, elle décrit un instant.

     Ce qui se vérifie maintenant est la promesse elle-même : on SUIT chaque
     lien et on regarde où il atterrit. */
  const liens = [...new Set(await page.$$eval("main a[href^='/studio']",
    (as) => as.map((a) => a.getAttribute("href"))))];
  v("l'accueil propose au moins un module", liens.length > 0, JSON.stringify(liens));
  const morts = [];
  for (const href of liens) {
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main, h1", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(400);
    const ou = page.url();
    const texte = (await page.textContent("body").catch(() => "")).replace(/\s+/g, " ");
    /* Un module indisponible redirige vers la connexion ; une page vide
       affiche « introuvable » ou « non accessible ». Les deux sont des
       liens morts du point de vue de qui a cliqué. */
    if (/\/login/.test(ou) || /introuvable|non accessible|module=indisponible/i.test(texte)) {
      morts.push(`${href} → ${ou}`);
    }
  }
  v("AUCUNE TUILE NE MÈNE À UNE PAGE VIDE : chaque lien a été suivi",
    morts.length === 0, morts.join(" | "));
  await page.goto(`${BASE}/studio`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main", { timeout: 20000 });
  await nettoyer(page);

  /* La dépendance extérieure est dite, pas cachée. */
  v("WhatsApp est annoncé comme exigeant une API dédiée",
    /WhatsApp Business API/.test(corpsAccueil));
  v("le courriel est annoncé comme exigeant un SMTP",
    /SMTP/.test(corpsAccueil));
  await capture(page, "01-accueil-studio");

  /* ──────────────────────────── LA LISTE ───────────────────────────── */
  titre("la liste montre le fonds accessible, et rien de plus");
  await page.click("a[href='/studio/bibliotheque']");
  await page.waitForURL("**/studio/bibliotheque");
  await page.waitForSelector("text=Contrat transport Bamako", { timeout: 15000 });
  await nettoyer(page);
  let corps = await page.textContent("body");
  v("le contrat apparaît", corps.includes("Contrat transport Bamako"));
  v("le reçu apparaît", corps.includes("Recu carburant mars"));
  v("l'image apparaît", corps.includes("Photo entrepot"));

  /* LE DOCUMENT PRIVÉ D'UN COLLÈGUE N'EST PAS LÀ. La direction a tous les
     droits sur le module ; cela ne lui donne pas le privé d'autrui. */
  v("la note privée du comptable n'est PAS visible par la direction",
    !corps.includes("Note privee comptable"));
  v("la facture de FAT & MAT n'est PAS visible chez Triangle",
    !corps.includes("Facture Fatemat exclusive"));

  /* L'ÉCRAN NE PRÉTEND PAS MONTRER TOUT LE FONDS. */
  v("la version modifiée est signalée dans la liste", /v2\s*—\s*modifié/.test(corps));
  await capture(page, "02-liste");

  /* ────────────────────────── LA RECHERCHE ─────────────────────────── */
  titre("on retrouve un scan par un mot qui n'est QUE dans son texte reconnu");
  await page.fill("input[placeholder*='texte reconnu']", "Sebenikoro");
  await page.click("button:has-text('Chercher')");
  await page.waitForTimeout(1200);
  corps = await page.textContent("body");
  v("« Sebenikoro » ramène le reçu", corps.includes("Recu carburant mars"));
  v("et laisse le contrat de côté", !corps.includes("Contrat transport Bamako"));
  await page.click("button:has-text('Effacer')");
  await page.waitForTimeout(800);

  /* ───────────────── LE BANDEAU QUI REFUSE DE MENTIR ──────────────── */
  titre("un document modifié ne passe pas pour un original");
  await ouvrirDocument(page, "Contrat transport Bamako");
  await page.waitForSelector("text=Versions", { timeout: 10000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la fiche avertit que le document a été modifié",
    /a été modifié/.test(corps) && /version 2/.test(corps));
  v("elle dit où retrouver l'original", /original est conservé intact/.test(corps));
  await capture(page, "03-fiche-modifie");

  await page.click("button:has-text('Versions')");
  await page.waitForTimeout(600);
  corps = await page.textContent("body");
  v("la version 1 porte la marque « original »", /original, jamais modifié/.test(corps));
  v("la note de modification est lisible",
    corps.includes("montant corrige apres verification du bon de livraison"));
  v("les deux versions sont là", /Version 1/.test(corps) && /Version 2/.test(corps));
  await capture(page, "04-versions");

  /* ──────────────────── LE JOURNAL EST CONSULTABLE ─────────────────── */
  titre("le journal se relit");
  await page.click("button:has-text('Journal')");
  await page.waitForTimeout(600);
  corps = await page.textContent("body");
  v("le journal nomme qui a fait quoi", /Direction Triangle/.test(corps));
  v("les actions sont écrites en français lisible",
    /déposé|consulté|nouvelle version/.test(corps));
  v("le journal annonce qu'il survit au document", /survit au document/.test(corps));

  /* ───────────────── LE LIEN NE S'AFFICHE QU'UNE FOIS ──────────────── */
  titre("le lien de partage prévient qu'il ne sera plus jamais réaffiché");
  await page.click("button:has-text('Partages')");
  await page.waitForTimeout(600);
  const boutonLien = page.locator("button:has-text('Créer le lien')");
  const etatLien = await cliquable(boutonLien);
  v("le bouton « Créer le lien » n'est recouvert par rien",
    etatLien.libre, `recouvert par ${etatLien.recouvert}`);
  await boutonLien.click();
  await page.waitForSelector("text=Copiez ce lien maintenant", { timeout: 10000 });
  corps = await page.textContent("body");
  v("l'avertissement est affiché AVANT que l'on ferme", /qu.une seule fois/.test(corps));
  const adresse = await page.inputValue("input[readonly]");
  v("un lien complet est proposé", /\/studio\/liens\/[A-Za-z0-9_-]{10,}/.test(adresse), adresse);
  await capture(page, "05-lien");

  /* LE LIEN MARCHE SANS SESSION. C'est le seul contrôle qui le prouve. */
  const jetonLien = adresse.split("/studio/liens/")[1];
  const sansSession = await fetch(`${API}/studio/liens/${jetonLien}`);
  v("le lien s'ouvre sans compte", sansSession.status === 200, `reçu ${sansSession.status}`);
  v("et rend bien un PDF",
    (sansSession.headers.get("content-type") || "").includes("pdf"),
    sansSession.headers.get("content-type") || "aucun");
  const bidon = await fetch(`${API}/studio/liens/${"z".repeat(43)}`);
  v("un jeton inventé ne donne rien", bidon.status === 404, `reçu ${bidon.status}`);

  await page.click("text=J'ai copié le lien");
  await page.waitForTimeout(1000);

  /* ───────────── DÉPOSER DEPUIS L'ÉCRAN, PAS PAR L'API ────────────── */
  titre("on dépose réellement un fichier depuis l'écran");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const tmp = "/tmp/studio-depot-ecran.pdf";
  fs.writeFileSync(tmp, pdf("Bon de livraison depose a l ecran"));
  await page.click("button:has-text('Déposer')");
  await page.waitForSelector("text=Déposer un document", { timeout: 8000 });
  await nettoyer(page);
  await page.setInputFiles("input[type='file']", tmp);
  await page.waitForTimeout(400);
  await page.fill("input[placeholder*='contrat, 2026']", "livraison");
  await page.selectOption("select >> nth=1", "SOCIETE");
  const envoyer = page.locator("form button:has-text('Déposer')");
  await envoyer.click();
  await page.waitForSelector("text=Document déposé", { timeout: 15000 });
  corps = await page.textContent("body");
  v("l'écran confirme le dépôt", /Document déposé/.test(corps));

  /* LA FICHE DU DOCUMENT FRAÎCHEMENT DÉPOSÉ S'OUVRE. C'est l'instant où une
     erreur de visibilité se voit et se corrige : on vérifie donc que les
     trois réponses y sont, et pas seulement un « c'est fait ». */
  await page.waitForSelector("text=Empreinte SHA-256", { timeout: 10000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la fiche du document déposé s'ouvre", corps.includes("studio-depot-ecran"));
  v("elle montre son empreinte", /Empreinte SHA-256/.test(corps));
  v("elle montre qui peut le voir", /Qui peut le voir/.test(corps));
  v("elle n'annonce PAS de modification sur un dépôt neuf",
    !/a été modifié/.test(corps));
  await capture(page, "06-depot");

  /* Échap referme : sans quoi la fiche recouvre le bouton « Déposer ». */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  v("la fiche se referme et rend la main",
    (await page.locator("text=Empreinte SHA-256").count()) === 0);

  /* ─────────── LE FICHIER DÉGUISÉ EST REFUSÉ, AVEC LA RAISON ───────── */
  titre("un fichier déguisé est refusé et l'écran dit pourquoi");
  const faux = "/tmp/studio-faux.pdf";
  fs.writeFileSync(faux, "<html><script>alert(1)</script></html>");
  onProvoque = true;
  await page.click("button:has-text('Déposer')");
  await page.waitForSelector("text=Déposer un document", { timeout: 8000 });
  await nettoyer(page);
  await page.setInputFiles("input[type='file']", faux);
  await page.waitForTimeout(400);
  await page.locator("form button:has-text('Déposer')").click();
  await page.waitForTimeout(2500);
  const texteModale = await page.textContent("form");
  v("le dépôt est refusé", /refus|ne correspond|incohéren|invalide|signature/i.test(texteModale),
    texteModale.slice(0, 200));
  /* 415 « Unsupported Media Type » : le code exact. Un 400 passe-partout ou
     un 500 diraient autre chose. */
  v("le serveur répond bien 415, pas une erreur vague",
    refusAttendus.some((x) => x.startsWith("415")), refusAttendus.join(" | ") || "aucun refus");
  /* La raison doit être lisible, sinon on réessaie indéfiniment le même
     fichier : on la consigne telle qu'elle s'affiche. */
  const raison = (texteModale.match(/[^.]*(?:incohéren|correspond|refus|signature)[^.]*\./i) || [])[0];
  console.log(`        raison affichée : « ${(raison || "").trim().slice(0, 160) || "—"} »`);
  onProvoque = false;
  await capture(page, "07-faux-refuse");
  await page.click("button:has-text('Annuler')");
  await page.waitForTimeout(500);
  v("le formulaire refusé se referme sans rien déposer",
    (await page.locator("text=Déposer un document").count()) === 0);

  /* ──────────── CORBEILLE PUIS RETOUR : RIEN N'EST PERDU ──────────── */
  titre("la corbeille n'est pas la suppression, et ce n'est pas un cul-de-sac");
  await ouvrirDocument(page, "Photo entrepot");
  await page.waitForSelector("button:has-text('Mettre à la corbeille')", { timeout: 10000 });
  await nettoyer(page);
  await page.click("button:has-text('Mettre à la corbeille')");
  await page.waitForSelector("text=Vous pouvez le restaurer", { timeout: 10000 });
  v("l'écran annonce que c'est réversible", true);

  /* LA FICHE RESTE OUVERTE ET DEVIENT CELLE D'UN DOCUMENT JETÉ. C'est ce qui
     manquait : tant que la fiche répondait « introuvable » pour un document
     à la corbeille, les deux seuls boutons qui le sauvent ou l'achèvent
     étaient hors d'atteinte. */
  await page.waitForSelector("text=À la corbeille depuis", { timeout: 10000 });
  await nettoyer(page);
  corps = await page.textContent("body");
  v("la fiche dit depuis quand et par qui", /À la corbeille depuis/.test(corps));
  v("elle répète que rien n'est effacé", /Rien n.est effacé/.test(corps));
  const peutRestaurer = await cliquable(page.locator("button:has-text('Restaurer')"));
  v("« Restaurer » est là et atteignable", peutRestaurer.libre, `recouvert par ${peutRestaurer.recouvert}`);
  await capture(page, "08-corbeille-fiche");

  /* LA SUPPRESSION DÉFINITIVE ÉNONCE CE QU'ELLE DÉTRUIT. */
  await page.click("button:has-text('Supprimer définitivement')");
  await page.waitForTimeout(700);
  corps = await page.textContent("body");
  v("la confirmation énonce ce qui disparaît", /effacés du disque/.test(corps));
  v("elle dit qu'aucune restauration n'est possible", /Aucune restauration/.test(corps));
  v("elle dit que les liens cessent d'ouvrir", /cessent d.ouvrir/.test(corps));
  v("elle dit que le journal subsiste", /journal subsiste/.test(corps));
  const boutonSup = page.locator("button:has-text('Supprimer définitivement')").last();
  v("le bouton reste inerte sans motif", await boutonSup.isDisabled());
  /* « erreur.. » fait huit caractères : SOUS le minimum de dix. Trois suites
     d'essais précédentes se sont fait prendre à écrire un motif « trop
     court » qui faisait pile dix caractères et passait donc le contrôle. */
  await page.fill("input[placeholder*='mauvaise société']", "erreur..");
  await page.waitForTimeout(300);
  v("un motif de huit caractères ne suffit pas", await boutonSup.isDisabled());
  await page.fill("input[placeholder*='mauvaise société']", "photo deposee en double");
  await page.waitForTimeout(300);
  v("un motif qui se relit ouvre la suppression", !(await boutonSup.isDisabled()));
  await capture(page, "09-suppression");

  /* On RESTAURE au lieu de détruire : la confirmation a dit ce qu'il fallait,
     et la suite du parcours a encore besoin du document. */
  await page.click("button:has-text('Garder le document')");
  await page.waitForTimeout(500);
  await page.click("button:has-text('Restaurer')");
  await page.waitForSelector("text=Document restauré", { timeout: 10000 });
  v("le document se restaure depuis sa fiche", true);

  /* ÉCHAP FERME, ET LA FICHE NE REVIENT PAS. Le rechargement qui suit une
     action rouvrait le panneau une seconde après qu'on l'ait fermé. */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(2500);
  v("Échap referme, et le rechargement ne rouvre pas la fiche",
    (await page.locator("button:has-text('Versions')").count()) === 0);
  corps = await page.textContent("body");
  v("le document restauré est revenu dans la liste", corps.includes("Photo entrepot"));

  /* ─────────────── LA CORBEILLE SE PARCOURT AUSSI ──────────────── */
  titre("la corbeille se parcourt depuis le volet des dossiers");
  await ouvrirDocument(page, "Contrat transport Bamako");
  await page.waitForSelector("button:has-text('Mettre à la corbeille')", { timeout: 10000 });
  await nettoyer(page);
  await page.click("button:has-text('Mettre à la corbeille')");
  await page.waitForSelector("text=À la corbeille depuis", { timeout: 10000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(2200);
  await page.click("button:has-text('Corbeille')");
  await page.waitForTimeout(1500);
  await nettoyer(page);
  corps = await page.textContent("body");
  v("le contrat jeté est listé dans la corbeille", corps.includes("Contrat transport Bamako"));
  v("le volet annonce que rien n'est effacé", /Rien n.est effacé/.test(corps));
  await ouvrirDocument(page, "Contrat transport Bamako");
  await page.waitForSelector("button:has-text('Restaurer')", { timeout: 10000 });
  await nettoyer(page);
  v("sa fiche s'ouvre depuis la corbeille", true);
  /* On peut encore le relire avant de décider : c'est le propre d'une
     corbeille, et c'est ce qui manquait. */
  const relire = await cliquable(page.locator("button:has-text('Télécharger')"));
  v("on peut le relire avant de décider", relire.libre, `recouvert par ${relire.recouvert}`);
  await page.click("button:has-text('Restaurer')");
  await page.waitForSelector("text=Document restauré", { timeout: 10000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  await capture(page, "10-corbeille-volet");

  /* LES RÉPONSES EN ERREUR, TRIÉES PAR ORIGINE. Celles du Studio sont des
     défauts à corriger ; celles d'un composant global de l'application sont
     préexistantes et doivent être nommées, pas noyées dans le verdict de
     cet écran. */
  const duStudio = reponsesFachees.filter((x) => /\/studio\//.test(x));
  const ailleurs = reponsesFachees.filter((x) => !/\/studio\//.test(x));
  v("aucune requête du Studio ne part en erreur",
    duStudio.length === 0, duStudio.slice(0, 5).join("\n          "));
  if (ailleurs.length) {
    console.log(`    · ${ailleurs.length} réponse(s) en erreur venant d'ailleurs que du Studio :`);
    for (const x of [...new Set(ailleurs)].slice(0, 6)) console.log(`        ${x}`);
  }
  v("aucune erreur de console sur le parcours complet",
    erreursConsole.length === 0, erreursConsole.slice(0, 4).join("\n        | "));
  await ctx.close();

  /* ══════════════════ LE CLOISONNEMENT DES SOCIÉTÉS ══════════════════ */
  console.log("\n  FAT & MAT — LE MÊME ÉCRAN, UN AUTRE FONDS");
  titre("une direction de FAT & MAT ne voit rien de Triangle");
  ctx = await contexte(nav, FAT, { width: 1280, height: 1000 });
  page = await ctx.newPage();
  await page.goto(`${BASE}/studio/bibliotheque`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await nettoyer(page);
  corps = await page.textContent("body");
  v("elle voit sa propre facture", corps.includes("Facture Fatemat exclusive"));
  v("le contrat de Triangle est absent", !corps.includes("Contrat transport Bamako"));
  v("le reçu de Triangle est absent", !corps.includes("Recu carburant mars"));
  v("la note privée du comptable de Triangle est absente",
    !corps.includes("Note privee comptable"));

  /* ET PAR L'URL DIRECTE ? Deviner un identifiant ne doit rien donner. */
  const direct = await fetch(`${API}/studio/documents/${contrat.id}`, {
    headers: { Authorization: `Bearer ${jeton(FAT)}`, "x-active-company-id": "2" },
  });
  v("l'identifiant d'un document de Triangle répond 404 chez FAT & MAT",
    direct.status === 404, `reçu ${direct.status}`);
  const fichier = await fetch(`${API}/studio/documents/${contrat.id}/fichier`, {
    headers: { Authorization: `Bearer ${jeton(FAT)}`, "x-active-company-id": "2" },
  });
  v("son fichier aussi", fichier.status === 404, `reçu ${fichier.status}`);
  await capture(page, "11-fatemat");
  await ctx.close();

  /* ═════════════════════ LA LECTURE SEULE SE VOIT ════════════════════ */
  console.log("\n  LE COMPTABLE — DROITS MOINDRES");
  titre("ce qu'un compte sans droit de suppression voit");
  ctx = await contexte(nav, COMPTA, { width: 1280, height: 1000 });
  page = await ctx.newPage();
  await page.goto(`${BASE}/studio/bibliotheque`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await nettoyer(page);
  corps = await page.textContent("body");
  v("le comptable voit sa propre note privée", corps.includes("Note privee comptable"));
  v("et les documents ouverts à la société", corps.includes("Contrat transport Bamako"));

  await ouvrirDocument(page, "Contrat transport Bamako");
  await page.waitForSelector("text=Télécharger", { timeout: 10000 });
  await nettoyer(page);
  const supPresent = await page.locator("button:has-text('Supprimer définitivement')").count();
  v("le bouton de suppression définitive ne lui est pas proposé", supPresent === 0);
  const telecharge = await cliquable(page.locator("button:has-text('Télécharger')"));
  v("il peut tout de même télécharger", telecharge.libre, `recouvert par ${telecharge.recouvert}`);
  await capture(page, "12-comptable");
  await ctx.close();

  /* ════════════════════════════ 375 px ═══════════════════════════════ */
  console.log("\n  TÉLÉPHONE — 375 px");
  titre("rien ne déborde, rien ne recouvre");
  ctx = await contexte(nav, DIR, { width: 375, height: 760 });
  page = await ctx.newPage();
  await page.goto(`${BASE}/studio/bibliotheque`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await nettoyer(page);

  /* `min-w-0 w-full` : sans cela, le <body> en flex-col laisse un enfant
     imposer sa largeur et toute la page défile de côté. */
  let debord = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth, vue: window.innerWidth,
  }));
  v("la liste ne déborde pas en largeur", debord.page <= debord.vue + 1,
    `${debord.page}px pour ${debord.vue}px`);
  await capture(page, "13-telephone-liste");

  await ouvrirDocument(page, "Contrat transport Bamako");
  await page.waitForSelector("text=Versions", { timeout: 10000 });
  await nettoyer(page);
  debord = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth, vue: window.innerWidth,
  }));
  v("la fiche ne déborde pas non plus", debord.page <= debord.vue + 1,
    `${debord.page}px pour ${debord.vue}px`);
  const fermer = await cliquable(page.locator("button[aria-label='Fermer']"));
  v("la croix de fermeture est atteignable", fermer.libre, `recouvert par ${fermer.recouvert}`);
  const tel375 = await cliquable(page.locator("button:has-text('Télécharger')"));
  v("le bouton de téléchargement est atteignable", tel375.libre, `recouvert par ${tel375.recouvert}`);
  await capture(page, "14-telephone-fiche");

  /* Échap ferme : une fiche qui ne se ferme qu'au clic sur une croix de
     16 pixels est une impasse sur téléphone. */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const encoreOuverte = await page.locator("button:has-text('Versions')").count();
  v("Échap referme la fiche", encoreOuverte === 0);
  await ctx.close();

  await nav.close();
  console.log(`\n  ${reussis} réussis, ${echoues} échoués\n`);
  process.exit(echoues ? 1 : 0);
})().catch((e) => { console.error("\n  ✘ interrompu :", e.message, "\n"); process.exit(2); });
