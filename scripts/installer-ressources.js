#!/usr/bin/env node
"use strict";
/**
 * METTRE À PORTÉE DU NAVIGATEUR CE QUI DOIT ÊTRE SERVI PAR LE SITE.
 *
 * Deux outils tournent dans le navigateur et ont besoin de fichiers servis
 * par le site plutôt qu'empaquetés : Tesseract, pour lire le texte des
 * scans, et pdf.js, pour afficher un PDF page par page. Leurs fichiers
 * arrivent par npm ; ce script les recopie sous « public/vendor/ ».
 *
 * POURQUOI RECOPIER PLUTÔT QUE VERSIONNER. Ces fichiers pèsent une vingtaine
 * de mégaoctets. Les figer dans le dépôt alourdirait chaque clone pour
 * toujours, et il faudrait penser à les remettre à jour à la main. Ils sont
 * donc déclarés comme dépendances ordinaires : « npm install » les apporte,
 * ce script les met en place, et le dépôt ne les porte pas.
 *
 * POURQUOI NE PAS LES PRENDRE SUR UN CDN. Un scanner qui cesse de
 * fonctionner parce qu'un domaine tiers est injoignable n'est pas un outil
 * de travail. Tout est servi depuis le site.
 *
 * CE SCRIPT N'INTERROMPT JAMAIS LA COMPILATION. Si les paquets manquent, il
 * le dit et s'arrête là : le reste de l'application n'a aucune raison de ne
 * pas se construire. L'écran, lui, annonce que la reconnaissance de texte
 * n'est pas disponible au lieu de l'offrir et d'échouer.
 */
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const CIBLE = path.join(RACINE, "public", "vendor", "tesseract");
const CIBLE_PDF = path.join(RACINE, "public", "vendor", "pdfjs");

/* Ce dont le navigateur a besoin.

   TOUTES LES VARIANTES DU MOTEUR, pas seulement celles qu'on croit utiles.
   Tesseract choisit lui-même, à l'exécution, selon ce que le processeur sait
   faire : SIMD, SIMD assoupli, ou rien de tout cela. Une première version
   n'en copiait que deux — et le navigateur réclamait
   « tesseract-core-relaxedsimd-lstm.wasm.js », absent, donc la lecture
   échouait sur les machines récentes. Deviner le matériel de l'utilisateur
   n'est pas une méthode : on apporte le choix complet, et c'est Tesseract
   qui tranche. */
const FIXES = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["@tesseract.js-data/fra/4.0.0/fra.traineddata.gz", "fra.traineddata.gz"],
  ["@tesseract.js-data/eng/4.0.0/eng.traineddata.gz", "eng.traineddata.gz"],
];

/* ON DEMANDE À NODE OÙ EST LE MOTEUR, on ne devine pas son chemin.

   Nommer « node_modules/tesseract.js-core » marche tant que la version
   installée à la racine est celle que tesseract.js utilise — et c'est
   précisément ce qui a manqué : une version 6 posée à la racine pendant que
   tesseract.js 7 réclamait des variantes qui n'existent que dans la 7. Le
   navigateur demandait un fichier absent et la lecture échouait, sans que
   rien dans l'installation ne l'annonce. En passant par la résolution de
   Node, on copie forcément le moteur qui sera réellement utilisé. */
function dossierDuMoteur(racine) {
  try {
    const manifeste = require.resolve("tesseract.js-core/package.json", { paths: [racine] });
    return path.dirname(manifeste);
  } catch {
    const secours = path.join(racine, "node_modules", "tesseract.js-core");
    return fs.existsSync(secours) ? secours : null;
  }
}

function variantesDuMoteur(racine) {
  const dossier = dossierDuMoteur(racine);
  if (!dossier) return [];
  return fs.readdirSync(dossier)
    .filter((f) => /^tesseract-core.*\.(wasm|wasm\.js|js)$/.test(f))
    .map((f) => [path.join(dossier, f), f]);
}

function poids(n) {
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} Ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

function main() {
  const manquants = [];
  const aCopier = [];
  const moteurs = variantesDuMoteur(RACINE);
  if (!moteurs.length) manquants.push("tesseract.js-core/tesseract-core-*");
  const FICHIERS = [...FIXES, ...moteurs];

  for (const [source, nom] of FICHIERS) {
    /* Les fixes sont donnés relativement à node_modules ; les variantes du
       moteur arrivent avec leur chemin complet, résolu par Node. */
    const chemin = path.isAbsolute(source) ? source : path.join(RACINE, "node_modules", source);
    if (!fs.existsSync(chemin)) manquants.push(source);
    else aCopier.push([chemin, path.join(CIBLE, nom)]);
  }

  if (manquants.length) {
    console.log("  Reconnaissance de texte : paquets absents, étape ignorée.");
    for (const m of manquants) console.log(`    manquant : ${m}`);
    console.log("    Pour l'activer : npm install");
    console.log("    L'application se construit normalement ; le scanner");
    console.log("    annoncera simplement que la reconnaissance de texte");
    console.log("    n'est pas disponible.");
    return;
  }

  fs.mkdirSync(CIBLE, { recursive: true });
  let total = 0, copies = 0;
  for (const [de, vers] of aCopier) {
    const sourceStat = fs.statSync(de);
    /* On ne recopie que si c'est nécessaire : une compilation qui réécrit
       vingt mégaoctets à chaque fois pour rien fait perdre du temps à
       chaque déploiement. */
    const dejaLa = fs.existsSync(vers) && fs.statSync(vers).size === sourceStat.size;
    if (!dejaLa) { fs.copyFileSync(de, vers); copies += 1; }
    total += sourceStat.size;
  }
  console.log(`  Reconnaissance de texte : ${FICHIERS.length} fichiers en place ` +
    `(${poids(total)}${copies ? `, ${copies} recopiés` : ", déjà à jour"}).`);
}

/* ─────────────────────────────────────────────────────────────────────────
   pdf.js

   Son ouvrier doit être un FICHIER SERVI : empaqueté avec le reste, il ne
   peut pas être lancé comme ouvrier, et pdf.js bascule alors sur un mode
   dégradé qui bloque le fil principal — une page de cent feuillets fige
   l'onglet. On le recopie donc, comme le reste.
   ───────────────────────────────────────────────────────────────────────── */
function pdfjs() {
  let dossier;
  try {
    dossier = path.dirname(require.resolve("pdfjs-dist/package.json", { paths: [RACINE] }));
  } catch {
    console.log("  Affichage des PDF : paquet pdfjs-dist absent, étape ignorée.");
    console.log("    Pour l'activer : npm install");
    return;
  }
  const source = path.join(dossier, "build", "pdf.worker.min.mjs");
  if (!fs.existsSync(source)) {
    console.log("  Affichage des PDF : l'ouvrier de pdf.js est introuvable dans le paquet.");
    return;
  }
  fs.mkdirSync(CIBLE_PDF, { recursive: true });
  const cible = path.join(CIBLE_PDF, "pdf.worker.min.mjs");
  const taille = fs.statSync(source).size;
  const dejaLa = fs.existsSync(cible) && fs.statSync(cible).size === taille;
  if (!dejaLa) fs.copyFileSync(source, cible);
  console.log(`  Affichage des PDF : ouvrier pdf.js en place (${poids(taille)}` +
    `${dejaLa ? ", déjà à jour" : ""}).`);
}

try { main(); } catch (e) {
  /* Une erreur ici ne doit pas faire échouer la compilation de toute
     l'application pour une fonction facultative. */
  console.log(`  Reconnaissance de texte : mise en place impossible (${e.message}).`);
}

try { pdfjs(); } catch (e) {
  console.log(`  Affichage des PDF : mise en place impossible (${e.message}).`);
}
