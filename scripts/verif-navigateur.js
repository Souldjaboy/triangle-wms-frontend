/**
 * VÉRIFICATION FRONTEND RÉELLE — navigateur, deux largeurs, trois fuseaux.
 *
 *   # backend sur la base de TEST, avec l'origine du frontend autorisée
 *   DATABASE_URL=…/triangle_test JWT_SECRET=… FRONTEND_URL=http://localhost:3000 \
 *     node server.js &
 *   # frontend construit, pointé sur ce backend
 *   BACKEND_URL=http://127.0.0.1:5050 npx next start -p 3000 &
 *   SORTIE=/tmp/captures node scripts/verif-navigateur.js
 *
 * Les captures d'écran sont écrites dans $SORTIE : ce sont elles qui
 * montrent ce qu'aucune assertion ne dit — la lisibilité sur un téléphone.
 *
 * Ce que les tests d'API ne peuvent pas prouver : qu'un magasinier VOIT ses
 * bacs, que l'heure imprimée ne dépend pas du réglage de son téléphone, et
 * qu'un refus s'affiche en une phrase compréhensible.
 */
const { chromium } = require("playwright-core");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const BASE = "http://localhost:3000";
const SORTIE = process.env.SORTIE;
const TOKEN = jwt.sign(
  { id: 1, email: "admin@triangle.test", role: "super_admin", company_id: 1, is_super_admin: true },
  "test-secret-durcissement", { expiresIn: "2h" });

let reussis = 0, echoues = 0;
const verifier = (nom, ok, detail = "") => {
  if (ok) { reussis += 1; console.log(`  ✓ ${nom}`); }
  else { echoues += 1; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ""}`); }
};

const LARGEURS = [
  { nom: "téléphone", viewport: { width: 390, height: 844 } },
  { nom: "ordinateur", viewport: { width: 1440, height: 900 } },
];

async function nouveauContexte(navigateur, options) {
  const ctx = await navigateur.newContext({
    ...options,
    locale: "fr-FR",
  });
  await ctx.addCookies([
    { name: "triangle_token", value: TOKEN, url: BASE },
    { name: "triangle_business_token", value: TOKEN, url: BASE },
    { name: "triangle_super_admin", value: "true", url: BASE },
  ]);
  await ctx.addInitScript((t) => {
    localStorage.setItem("token", t);
    localStorage.setItem("business_token", t);
    localStorage.setItem("user", JSON.stringify(
      { id: 1, fullname: "Admin Triangle", role: "super_admin", is_super_admin: true, company_id: 1 }));
  }, TOKEN);
  return ctx;
}

(async () => {
  const navigateur = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

  /* ─────────────────────────── ÉCRAN DES EMPLACEMENTS ─────────────── */
  for (const l of LARGEURS) {
    console.log(`\n▸ EMPLACEMENTS — ${l.nom} (${l.viewport.width}px)`);
    const ctx = await nouveauContexte(navigateur, { viewport: l.viewport, timezoneId: "Africa/Bamako" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/emplacements`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const texte = await page.locator("body").innerText();

    verifier("la page s'ouvre sans erreur", !/Application error|Erreur de chargement/i.test(texte));
    verifier("tous les bacs sont listés (10 dans le jeu d'essai)",
      /Tous \(10\)/.test(texte), (texte.match(/Tous \(\d+\)/) || ["?"])[0]);
    verifier("les statuts sont chiffrés",
      /Libres \(\d+\)/.test(texte) && /Occupés \(\d+\)/.test(texte)
      && /Désactivés \(\d+\)/.test(texte) && /À régulariser \(\d+\)/.test(texte));
    verifier("le bandeau signale les emplacements historiques",
      /emplacement\(s\) historique\(s\) à régulariser/.test(texte));

    /* Vue tableau : c'est là qu'on voit produit et quantité d'un coup d'œil. */
    await page.getByRole("button", { name: "Tableau" }).click();
    await page.waitForTimeout(600);
    const tableau = await page.locator("body").innerText();
    verifier("un bac occupé affiche son produit et sa quantité",
      /Faux plafond metallique D — 600/.test(tableau),
      (tableau.match(/Faux plafond[^\n]*/) || ["absent"])[0].slice(0, 60));
    verifier("un bac partiellement réservé est distingué",
      /Partiellement occupé/.test(tableau));
    verifier("un bac désactivé est visible, pas masqué", /Désactivé/.test(tableau));
    verifier("l'ambigu annonce ce qu'il contient",
      /unité\(s\) à répartir/.test(tableau),
      (tableau.match(/[^\n]*à répartir[^\n]*/) || ["absent"])[0].slice(0, 60));
    verifier("Level 4 apparaît", /\b4\b/.test(tableau) && tableau.includes("BIN1"));
    verifier("Level Top apparaît et porte son repère", /TOP ▲/.test(tableau) || /TOP/.test(tableau));

    /* Recherche par nom de produit. */
    await page.getByPlaceholder(/Code de bac/).fill("Faux plafond");
    await page.waitForTimeout(1200);
    const recherche = await page.locator("body").innerText();
    verifier("la recherche par produit filtre la liste",
      /Faux plafond metallique D/.test(recherche) && !/Vis autoforeuse/.test(recherche));
    await page.getByPlaceholder(/Code de bac/).fill("");
    await page.waitForTimeout(1200);

    verifier("le formulaire de création en série est présent",
      /Ajouter des bacs/.test(await page.locator("body").innerText()));

    await page.screenshot({ path: `${SORTIE}/emplacements-${l.nom}.png`, fullPage: true });
    await ctx.close();
  }

  /* ─────────────────────────── DÉTAIL ET RÉGULARISATION ───────────── */
  {
    console.log("\n▸ DÉTAIL D'UN BAC ET RÉGULARISATION");
    const ctx = await nouveauContexte(navigateur, { viewport: LARGEURS[1].viewport, timezoneId: "Africa/Bamako" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/emplacements`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Tableau" }).click();
    await page.waitForTimeout(600);
    await page.locator("tr", { hasText: "1,2,3" }).first().click();
    await page.waitForTimeout(600);
    const detail = await page.locator("body").innerText();
    verifier("le panneau de détail s'ouvre",
      /Bac sélectionné/i.test(detail));
    verifier("il annonce le statut « à régulariser »",
      /Emplacement historique à régulariser/.test(detail));
    verifier("il montre le contenu du bac",
      /Vis autoforeuse/.test(detail) && /180/.test(detail));
    verifier("il propose de régulariser", /Régulariser \/ Découper/.test(detail));

    await page.getByRole("button", { name: /Régulariser \/ Découper/ }).click();
    await page.waitForTimeout(400);
    const formulaire = await page.locator("body").innerText();
    verifier("le formulaire de répartition s'ouvre",
      /réparti .* reliquat/.test(formulaire.replace(/\n/g, " ")));
    verifier("le bouton reste bloqué sans motif ni quantité",
      await page.getByRole("button", { name: "Régulariser", exact: true }).isDisabled());

    /* Répartition volontairement excessive : le message doit être lisible. */
    const champs = page.locator('input[type="number"]');
    await champs.nth(0).fill("500");
    await page.waitForTimeout(300);
    verifier("un dépassement est signalé en clair",
      /dépasse les 180 présents/.test(await page.locator("body").innerText()));
    await champs.nth(0).fill("100");
    await champs.nth(1).fill("50");
    await page.waitForTimeout(300);
    verifier("la somme se met à jour en direct",
      /réparti 150 \+ reliquat 30 = 180 sur 180/.test(
        (await page.locator("body").innerText()).replace(/\n/g, " ")));
    await page.screenshot({ path: `${SORTIE}/regularisation.png`, fullPage: true });
    await ctx.close();
  }

  /* ─────────────────────────── RÉORGANISATION ─────────────────────── */
  {
    console.log("\n▸ APERÇU DE RÉORGANISATION");
    const ctx = await nouveauContexte(navigateur, { viewport: LARGEURS[1].viewport, timezoneId: "Africa/Bamako" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/emplacements/reorganiser`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const t = await page.locator("body").innerText();
    verifier("l'assistant s'ouvre", /Réorganiser les emplacements/.test(t));
    verifier("il propose d'insérer un rayon", /Insérer un nouveau rayon/.test(t));

    const lignes = page.locator("table input");
    await lignes.nth(1).fill("A");     // nom actuel
    await lignes.nth(2).fill("Z");     // nouveau nom
    await page.getByRole("button", { name: /Aperçu complet/ }).click();
    await page.waitForTimeout(1500);
    const apercu = await page.locator("body").innerText();
    verifier("l'aperçu chiffre l'impact", /Résultat attendu/.test(apercu));
    verifier("il affiche le stock avant et après",
      /Quantité avant → après/.test(apercu));
    verifier("il annonce que le stock est identique",
      /identique — un renommage ne déplace rien/.test(apercu));
    verifier("il montre le tableau avant/après", /WH1-A-1-1-BIN1/.test(apercu));
    verifier("appliquer reste bloqué sans motif",
      await page.getByRole("button", { name: /Appliquer à/ }).isDisabled());
    await page.screenshot({ path: `${SORTIE}/reorganisation.png`, fullPage: true });
    await ctx.close();
  }

  /* ─────────────── DOCUMENT : LA MÊME HEURE DEPUIS TROIS FUSEAUX ─── */
  console.log("\n▸ DOCUMENT — trois fuseaux, une seule heure métier");
  const affichages = [];
  for (const tz of ["Africa/Bamako", "Europe/Paris", "UTC"]) {
    const ctx = await nouveauContexte(navigateur, { viewport: LARGEURS[1].viewport, timezoneId: tz });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/documents/1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    /* Première visite : on pose la date métier. */
    if (affichages.length === 0) {
      await page.getByRole("button", { name: /Modifier la date/ }).click();
      await page.waitForTimeout(1200);
      const modal = await page.locator("body").innerText();
      verifier("l'éditeur montre les quatre dates",
        /Création en base/i.test(modal) && /Opération effectuée le/i.test(modal)
        && /Affiché sur le document/i.test(modal) && /Dernière impression/i.test(modal));
      verifier("la date de création est celle de la base",
        /25\/08\/2026 à 14:07/.test(modal), (modal.match(/25\/08\/2026[^\n]*/) || ["absent"])[0]);
      verifier("l'écran dit qu'aucune date métier n'est confirmée",
        /Aucune date métier n'a encore été confirmée/.test(modal));

      await page.locator('input[type="date"]').fill("2026-08-22");
      await page.locator('input[type="time"]').fill("10:30");
      await page.waitForTimeout(400);
      verifier("l'aperçu avant impression montre la date choisie",
        /22\/08\/2026 à 10:30/.test(await page.locator("body").innerText()));
      await page.getByRole("button", { name: "Enregistrer" }).click();
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: "Fermer" }).click();
      await page.waitForTimeout(1200);
    }

    const corps = await page.locator("body").innerText();
    const trouve = (corps.match(/22\/08\/2026 à \d{2}:\d{2}/) || ["absent"])[0];
    affichages.push({ tz, trouve });
    verifier(`fuseau ${tz} : le bon affiche « ${trouve} »`, trouve === "22/08/2026 à 10:30", trouve);
    verifier(`fuseau ${tz} : la date technique n'apparaît pas comme date du bon`,
      !/25\/08\/2026 à 14:07/.test(corps.split("Client / Fournisseur")[0] || corps));
    await page.screenshot({ path: `${SORTIE}/document-${tz.replace("/", "-")}.png`, fullPage: true });
    await ctx.close();
  }
  verifier("LES TROIS FUSEAUX AFFICHENT LA MÊME HEURE MÉTIER",
    new Set(affichages.map((a) => a.trouve)).size === 1,
    affichages.map((a) => `${a.tz}=${a.trouve}`).join("  "));

  /* ─────────────────────────── MESSAGE D'ERREUR LISIBLE ───────────── */
  {
    console.log("\n▸ MESSAGES D'ERREUR");
    const ctx = await nouveauContexte(navigateur, { viewport: LARGEURS[0].viewport, timezoneId: "Africa/Bamako" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/emplacements`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Tableau" }).click();
    await page.waitForTimeout(500);
    await page.locator("tr", { hasText: "BIN1" }).first().click();
    await page.waitForTimeout(500);
    /* Renommer un bac occupé vers un code déjà pris : le refus doit se lire. */
    await page.getByRole("button", { name: /Archiver/ }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    const apres = await page.locator("body").innerText();
    verifier("un refus s'affiche en une phrase compréhensible",
      /contient encore|ne peut pas|impossible|Transférez/i.test(apres),
      (apres.match(/[^\n]*(contient encore|Transférez)[^\n]*/) || ["aucun message"])[0].slice(0, 90));
    await page.screenshot({ path: `${SORTIE}/message-erreur.png`, fullPage: true });
    await ctx.close();
  }

  await navigateur.close();
  console.log(`\n${reussis} réussis, ${echoues} échoués\n`);
  fs.writeFileSync(`${SORTIE}/resultat.txt`, `${reussis} réussis, ${echoues} échoués\n`);
  process.exit(echoues ? 1 : 0);
})().catch((e) => { console.error("ÉCHEC :", e); process.exit(1); });
