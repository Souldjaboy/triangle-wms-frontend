/**
 * ÉCRAN DE PAIE — LES BOUTONS DE LA DIRECTION, VUS DANS UN VRAI NAVIGATEUR.
 *
 * Ce que les tests d'API ne peuvent pas prouver : ce que l'écran AFFICHE quand
 * le serveur répond ceci plutôt que cela. Le défaut corrigé était précisément
 * là — le backend ne renvoyait pas encore `droits`, et la page en concluait
 * « la validation revient à quelqu'un d'autre », sans proposer le moindre
 * bouton pour en sortir.
 *
 * Les cas A, C, D et E réécrivent la réponse du serveur pour placer l'écran
 * dans chaque situation, y compris celle d'un backend qui n'a PAS encore été
 * mis à jour. La règle serveur, elle, est éprouvée par
 * scripts/test-droits-paie-direction.js, contre les vraies routes. Ici on
 * n'éprouve que la vue.
 *
 *   BACKEND=http://127.0.0.1:5050 SECRET=… SORTIE=/tmp/captures \
 *     node scripts/verif-paie-droits.js
 */
const { chromium } = require("playwright-core");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const BASE = process.env.BASE || "http://localhost:3000";
const BACKEND = process.env.BACKEND || "http://127.0.0.1:5050";
const SECRET = process.env.SECRET || "test_droits";
const SORTIE = process.env.SORTIE;
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const MOIS = process.env.MOIS || "2026-09";

const SUPER = { id: 900, fullname: "Super Triangle", email: "sup.tri@t.local",
                role: "super_admin", company_id: 1, is_super_admin: true };
const TOKEN = jwt.sign({ ...SUPER, tenant_id: "triangle" }, SECRET, { expiresIn: "2h" });

let reussis = 0, echoues = 0;
const v = (nom, ok, detail = "") => {
  if (ok) { reussis += 1; console.log(`    ✓ ${nom}`); }
  else { echoues += 1; console.log(`    ✗ ${nom}${detail ? `\n        → ${detail}` : ""}`); }
};

const api = async (m, chemin, corps) => {
  const r = await fetch(BACKEND + chemin, {
    method: m,
    headers: { Authorization: `Bearer ${TOKEN}`, "x-tenant-id": "triangle",
               "x-active-company-id": "1", "Content-Type": "application/json" },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, data: d };
};

const LARGEURS = [
  { nom: "ordinateur", viewport: { width: 1280, height: 900 } },
  { nom: "téléphone", viewport: { width: 375, height: 812 } },
];

/* Les cinq situations. `droits: null` laisse passer la réponse réelle du
   serveur ; une fonction la réécrit avant que la page ne la lise. */
const PHRASE_AUTEUR = "la validation revient à quelqu'un d'autre";
const CAS = [
  {
    cle: "A-backend-non-a-jour",
    titre: "A — le backend ne renvoie PAS encore « droits » (le cas de production)",
    reecrire: (d) => { delete d.droits; delete d.demande; return d; },
    attendus: [
      ["le bandeau technique explique l'absence de droits", (t) => /n'a pas renvoyé vos droits/i.test(t)],
      ["il nomme la route à mettre à jour", (t) => /attendance-v2\/payroll/.test(t)],
      ["la page n'affirme PLUS que la validation revient à un autre", (t) => !t.includes(PHRASE_AUTEUR)],
    ],
    boutons: { "Retirer ma soumission": false, "Autoriser la paie": false, "Demander une correction": false },
  },
  {
    cle: "B-super-admin-auteur",
    titre: "B — le vrai super administrateur, auteur de la soumission",
    reecrire: null,
    attendus: [
      ["l'écran annonce l'auto-validation tracée", (t) => /auto-validation/i.test(t)],
      ["il précise qu'autoriser ne paie personne", (t) => /ne paie personne/i.test(t)],
      ["la phrase « revient à quelqu'un d'autre » a disparu", (t) => !t.includes(PHRASE_AUTEUR)],
    ],
    boutons: { "Retirer ma soumission": true, "Autoriser la paie": true, "Demander une correction": false },
  },
  {
    cle: "C-auteur-ordinaire",
    titre: "C — l'auteur ordinaire : le message ET le bouton de retrait",
    reecrire: (d) => {
      d.droits = { est_super_admin: false, est_auteur_de_la_soumission: true,
        soumission_en_attente: true, peut_valider: true, peut_soumettre: true,
        peut_decider: false, peut_retirer_sa_soumission: true,
        motif_sans_decision: "AUTEUR_DE_LA_SOUMISSION", motif_sans_retrait: null, incoherence: null };
      return d;
    },
    attendus: [
      ["le message d'origine est conservé", (t) => t.includes(PHRASE_AUTEUR)],
      ["il propose de retirer la soumission", (t) => /retirer votre soumission/i.test(t)],
    ],
    boutons: { "Retirer ma soumission": true, "Autoriser la paie": false, "Demander une correction": false },
  },
  {
    cle: "D-tiers-validateur",
    titre: "D — un tiers habilité : autoriser, corriger, refuser",
    reecrire: (d) => {
      d.droits = { est_super_admin: false, est_auteur_de_la_soumission: false,
        soumission_en_attente: true, peut_valider: true, peut_soumettre: false,
        peut_decider: true, peut_retirer_sa_soumission: false,
        motif_sans_decision: null, motif_sans_retrait: "NI_AUTEUR_NI_SUPER_ADMIN", incoherence: null };
      return d;
    },
    attendus: [
      ["l'écran dit que la paie vient de quelqu'un d'autre", (t) => /soumise par quelqu'un d'autre/i.test(t)],
      ["il précise qu'autoriser ne débite aucune caisse", (t) => /ne débite aucune caisse/i.test(t)],
      ["la phrase de l'auteur n'apparaît pas", (t) => !t.includes(PHRASE_AUTEUR)],
    ],
    boutons: { "Retirer ma soumission": false, "Autoriser la paie": true, "Demander une correction": true, "Refuser": true },
  },
  {
    cle: "E-incoherence",
    titre: "E — paie « en attente » sans demande en attente",
    reecrire: (d) => {
      d.droits = { est_super_admin: true, est_auteur_de_la_soumission: false,
        soumission_en_attente: false, peut_valider: true, peut_soumettre: true,
        peut_decider: false, peut_retirer_sa_soumission: false,
        motif_sans_decision: "DEMANDE_INTROUVABLE", motif_sans_retrait: "DEMANDE_INTROUVABLE",
        incoherence: { code: "DEMANDE_INTROUVABLE", derniere_demande_statut: "ANNULEE" } };
      return d;
    },
    attendus: [
      ["l'incohérence est nommée", (t) => /aucune demande en\s+attente ne lui correspond/i.test(t)],
      ["le dernier statut connu est affiché", (t) => /ANNULEE/.test(t)],
      ["l'écran dit quoi faire", (t) => /soumettez-la\s+à nouveau/i.test(t)],
    ],
    boutons: { "Retirer ma soumission": false, "Autoriser la paie": false },
  },
];

(async () => {
  console.log("── état de départ : paie de septembre préparée puis soumise par le super administrateur");
  const emp = await api("GET", `/attendance-v2/payroll?month=${MOIS}`);
  const directeur = (emp.data?.employees || []).find((e) => /Mohamedou Diallo/i.test(e.employee_name || e.full_name || ""));
  if (directeur) {
    await api("POST", `/paie/salaries/${directeur.employee_id || directeur.id}/non-remunere`,
      { reason: "Directeur : ne percoit volontairement aucun salaire. Decision direction." });
  }
  await api("POST", `/paie/periodes/${MOIS}/preparer`, {});
  const paie = (await api("GET", `/attendance-v2/payroll?month=${MOIS}`)).data?.run;
  if (!paie) { console.error("aucune paie préparée : abandon"); process.exit(1); }
  if (paie.status === "DRAFT") await api("POST", `/paie/runs/${paie.id}/soumettre`, {});
  const etat = (await api("GET", `/attendance-v2/payroll?month=${MOIS}`)).data;
  console.log(`   paie ${etat.run?.id} — ${etat.run?.status} — droits renvoyés : ${etat.droits ? "oui" : "non"}`);
  if (etat.run?.status !== "EN_ATTENTE_DIRECTION") {
    console.error(`état inattendu : ${etat.run?.status}`); process.exit(1);
  }

  const navigateur = await chromium.launch({ executablePath: CHROME });
  for (const l of LARGEURS) {
    console.log(`\n▸ ${l.nom.toUpperCase()} (${l.viewport.width} px)`);
    for (const cas of CAS) {
      console.log(`\n  ${cas.titre}`);
      const ctx = await navigateur.newContext({ ...l, locale: "fr-FR", timezoneId: "Africa/Bamako" });
      await ctx.addCookies([
        { name: "triangle_token", value: TOKEN, url: BASE },
        { name: "triangle_business_token", value: TOKEN, url: BASE },
        { name: "triangle_super_admin", value: "true", url: BASE },
      ]);
      await ctx.addInitScript((t) => {
        localStorage.setItem("token", t);
        localStorage.setItem("business_token", t);
        localStorage.setItem("user", JSON.stringify(
          { id: 900, fullname: "Super Triangle", role: "super_admin", is_super_admin: true, company_id: 1 }));
      }, TOKEN);

      if (cas.reecrire) {
        await ctx.route("**/attendance-v2/payroll?**", async (route) => {
          const rep = await route.fetch();
          let corps = {}; try { corps = await rep.json(); } catch {}
          await route.fulfill({ response: rep, json: cas.reecrire(corps) });
        });
      }

      const page = await ctx.newPage();
      await page.goto(`${BASE}/paie`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2500);
      /* La bannière d'installation flotte au-dessus de tout et intercepte les
         clics : elle n'a rien à voir avec ce qu'on mesure. */
      await page.evaluate(() => {
        document.querySelectorAll("*").forEach((n) => {
          const z = Number(getComputedStyle(n).zIndex || 0);
          if (z >= 9000 && n.tagName !== "BODY") n.remove();
        });
      });
      const texte = await page.locator("body").innerText();

      v("la page s'ouvre sans erreur", !/Application error|Erreur de chargement/i.test(texte));
      for (const [nom, predicat] of cas.attendus) {
        v(nom, predicat(texte), texte.slice(0, 400).replace(/\n+/g, " | "));
      }
      for (const [libelle, attendu] of Object.entries(cas.boutons)) {
        const n = await page.locator(`button:visible:text-is("${libelle}")`).count();
        v(`bouton « ${libelle} » ${attendu ? "présent" : "absent"}`, attendu ? n > 0 : n === 0, `${n} trouvé(s)`);
      }
      if (l.viewport.width === 375) {
        const debord = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth);
        v("aucun débordement horizontal au-delà du seuil connu", debord <= 0, `${debord} px`);
      }
      if (SORTIE) {
        fs.mkdirSync(SORTIE, { recursive: true });
        await page.screenshot({ path: `${SORTIE}/paie-${cas.cle}-${l.viewport.width}.png`, fullPage: true });
      }
      await ctx.close();
    }
  }
  await navigateur.close();
  console.log(`\n${echoues === 0 ? "✅" : "❌"} ${reussis} réussis, ${echoues} échoués\n`);
  process.exit(echoues === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
