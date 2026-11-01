/**
 * TROUVER LE NAVIGATEUR, OÙ QU'IL SOIT.
 *
 * Les chemins de Playwright et de Chromium changent d'une machine à l'autre :
 * un numéro de révision figé dans le script (« chromium-1194 ») marche le
 * jour où on l'écrit et casse à la mise à jour suivante — ce qui fait passer
 * une suite d'essais pour un échec du code. On cherche donc, au lieu de
 * supposer.
 */
const fs = require("fs");
const path = require("path");

const CANDIDATS_MODULE = ["playwright", "playwright-core"];
const RACINES = [
  "/opt/node-tools/node_modules",
  "/usr/lib/node_modules",
  "/usr/local/lib/node_modules",
];

function chargerPlaywright() {
  const essais = [];
  for (const nom of CANDIDATS_MODULE) {
    try { return require(nom); } catch (e) { essais.push(`${nom}: ${e.code || e.message}`); }
  }
  for (const racine of RACINES) {
    for (const nom of CANDIDATS_MODULE) {
      const p = path.join(racine, nom);
      if (fs.existsSync(p)) {
        try { return require(p); } catch (e) { essais.push(`${p}: ${e.code || e.message}`); }
      }
    }
  }
  throw new Error(
    `Playwright est introuvable. Essais : ${essais.join(" | ")}\n` +
    `  Installez-le (npm i -D playwright-core) ou donnez PLAYWRIGHT_DIR.`);
}

/* Le binaire : la variable d'environnement d'abord — c'est elle qui permet
   de viser une version précise sans toucher au script. */
function cheminChrome() {
  const donnes = [process.env.CHROME, process.env.CHROMIUM_PATH].filter(Boolean);
  for (const c of donnes) if (fs.existsSync(c)) return c;

  const fixes = [
    "/opt/pw-browsers/chromium",
    "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
  ];
  for (const c of fixes) if (fs.existsSync(c)) return c;

  /* Les dépôts de Playwright rangent le binaire sous un numéro de révision :
     on prend le plus récent plutôt que d'en figer un. */
  for (const base of ["/opt/pw-browsers", path.join(process.env.HOME || "/root", ".cache/ms-playwright")]) {
    if (!fs.existsSync(base)) continue;
    const dossiers = fs.readdirSync(base)
      .filter((d) => d.startsWith("chromium"))
      .sort((a, b) => (Number(b.split("-").pop()) || 0) - (Number(a.split("-").pop()) || 0));
    for (const d of dossiers) {
      for (const sous of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
        const c = path.join(base, d, sous);
        if (fs.existsSync(c)) return c;
      }
    }
  }
  /* Aucun chemin : on rend null et Playwright utilisera le navigateur de son
     propre dépôt, s'il en a un. Mieux vaut cela qu'un chemin inventé, dont
     l'erreur ne dirait rien d'utile. */
  return null;
}

async function lancer(options = {}) {
  const { chromium } = chargerPlaywright();
  const chemin = cheminChrome();
  return chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    ...(chemin ? { executablePath: chemin } : {}),
    ...options,
  });
}

module.exports = { chargerPlaywright, cheminChrome, lancer };
