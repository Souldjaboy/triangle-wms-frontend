"use client";

/**
 * CHARGER LA VISION PAR ORDINATEUR, UNE SEULE FOIS.
 *
 * OpenCV compilé pour le navigateur pèse 8,6 Mo. Ce n'est pas un détail à
 * Bamako : sur une connexion mobile, c'est une attente qu'il faut annoncer
 * au lieu de laisser croire à une page cassée. Ce module est donc chargé
 * À LA DEMANDE — jamais depuis la mise en page générale — et il rend compte
 * de son avancement.
 *
 * Les deux fichiers sont servis depuis le site lui-même, pas depuis un CDN.
 * Un scanner qui cesse de fonctionner parce qu'un domaine tiers est
 * injoignable n'est pas un outil de travail.
 */

declare global {
  interface Window {
    cv?: any;
    jscanify?: any;
  }
}

export type Coin = { x: number; y: number };
export type Coins = {
  topLeftCorner: Coin; topRightCorner: Coin;
  bottomLeftCorner: Coin; bottomRightCorner: Coin;
};

export type Vision = {
  cv: any;
  /** L'instance jscanify : findPaperContour, getCornerPoints, extractPaper. */
  scanner: any;
};

let enCours: Promise<Vision> | null = null;

function script(src: string, id: string, delaiMs = 120_000): Promise<void> {
  return new Promise((ok, non) => {
    const deja = document.getElementById(id) as HTMLScriptElement | null;
    if (deja?.dataset.charge === "oui") { ok(); return; }
    if (deja) {
      /* Un second appel pendant le premier chargement ne doit pas réinjecter
         la balise : OpenCV initialisé deux fois laisse un runtime WASM dans
         un état incertain. */
      deja.addEventListener("load", () => ok());
      deja.addEventListener("error", () => non(new Error(`Chargement de ${src} impossible.`)));
      return;
    }
    const el = document.createElement("script");
    el.id = id; el.src = src; el.async = true;
    const minuteur = window.setTimeout(
      () => non(new Error(`Le chargement de ${src} n'aboutit pas.`)), delaiMs);
    el.onload = () => { window.clearTimeout(minuteur); el.dataset.charge = "oui"; ok(); };
    el.onerror = () => { window.clearTimeout(minuteur); non(new Error(`Chargement de ${src} impossible.`)); };
    document.head.appendChild(el);
  });
}

/* OpenCV expose window.cv AVANT que son runtime WASM soit utilisable :
   appeler cv.imread à ce moment-là échoue sans message clair. On attend donc
   que les fonctions dont on se sert répondent réellement.

   ON NE REND JAMAIS L'OBJET cv DEPUIS UNE FONCTION « async ».

   Le module OpenCV est un objet Emscripten, et un objet Emscripten possède
   une méthode « then » : JavaScript le prend donc pour une promesse. Rendre
   cet objet depuis une fonction asynchrone — ou simplement l'attendre — fait
   appeler son « then », qui rend… le module lui-même. La chaîne de
   micro-tâches ne se termine jamais, le fil principal ne rend plus la main,
   et l'onglet GÈLE : plus de rendu, plus de clic, rien. Aucune erreur, aucun
   message : la page a simplement l'air morte.

   C'est exactement ce qui arrivait ici, et il a fallu mettre le débogueur en
   pause pour voir que le navigateur était garé dans « Module.then ». Cette
   fonction ne rend donc rien du tout ; l'appelant lit window.cv ensuite, en
   code synchrone, où aucun « await » ne peut déclencher le piège. */
async function attendreCv(delaiMs = 120_000): Promise<void> {
  const debut = Date.now();
  while (Date.now() - debut < delaiMs) {
    const cv = window.cv;
    if (cv && typeof cv.Mat === "function" && typeof cv.imread === "function" &&
        typeof cv.Canny === "function" && typeof cv.minAreaRect === "function") {
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("OpenCV s'est chargé mais ne répond pas.");
}

/**
 * @param avancement appelé avec un message lisible à chaque étape.
 */
export function chargerVision(avancement?: (etape: string) => void): Promise<Vision> {
  /* Une seule promesse pour toute la page : deux composants qui demandent la
     vision en même temps ne doivent pas télécharger 8,6 Mo deux fois. */
  if (enCours) return enCours;

  enCours = (async () => {
    avancement?.("Chargement de la reconnaissance d'image (8,6 Mo)…");
    await script("/vendor/opencv.js", "triangle-opencv");
    avancement?.("Initialisation…");
    await attendreCv();
    /* Lecture SYNCHRONE, après l'attente : aucun « await » ne touche cet
       objet, donc son « then » n'est jamais appelé. */
    const cv = window.cv;
    avancement?.("Chargement du détecteur de contours…");
    await script("/vendor/jscanify.min.js", "triangle-jscanify", 30_000);
    if (typeof window.jscanify !== "function") {
      throw new Error("Le détecteur de contours ne s'est pas installé.");
    }
    avancement?.("Prêt.");
    /* On rend un objet ORDINAIRE qui PORTE cv, jamais cv lui-même : un objet
       sans « then » n'est pas confondu avec une promesse. */
    return { cv, scanner: new window.jscanify() };
  })().catch((e) => {
    /* On oublie l'échec : sans cela un incident réseau passager condamnerait
       le scanner pour toute la durée de la visite. */
    enCours = null;
    throw e;
  });

  return enCours;
}

/** Les quatre coins d'une feuille dans une image, ou null si rien de net. */
export function detecterCoins(vision: Vision, source: HTMLCanvasElement): Coins | null {
  const { cv, scanner } = vision;
  let image: any = null, contour: any = null;
  try {
    image = cv.imread(source);
    contour = scanner.findPaperContour(image);
    if (!contour) return null;
    const coins = scanner.getCornerPoints(contour);
    const quatre = [coins?.topLeftCorner, coins?.topRightCorner,
      coins?.bottomLeftCorner, coins?.bottomRightCorner];
    if (quatre.some((c) => !c || !Number.isFinite(c.x) || !Number.isFinite(c.y))) return null;
    return coins as Coins;
  } catch {
    return null;
  } finally {
    /* OpenCV en WebAssembly ne ramasse pas ses miettes : une Mat non libérée
       fuit à chaque image analysée, et la page finit par être tuée par le
       navigateur après quelques minutes de visée. */
    try { image?.delete?.(); } catch { /* déjà libérée */ }
    try { contour?.delete?.(); } catch { /* déjà libérée */ }
  }
}

/** L'aire du quadrilatère, en pixels. Sert à écarter les détections absurdes. */
export function aire(c: Coins): number {
  const p = [c.topLeftCorner, c.topRightCorner, c.bottomRightCorner, c.bottomLeftCorner];
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = p[i], b = p[(i + 1) % 4];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** Les dimensions que doit avoir la page redressée, d'après ses côtés. */
export function tailleRedressee(c: Coins, maxCote = 2400): { largeur: number; hauteur: number } {
  const d = (a: Coin, b: Coin) => Math.hypot(a.x - b.x, a.y - b.y);
  /* La moyenne des deux côtés opposés : un seul côté, pris de biais, donnerait
     une page étirée. */
  let largeur = (d(c.topLeftCorner, c.topRightCorner) +
                 d(c.bottomLeftCorner, c.bottomRightCorner)) / 2;
  let hauteur = (d(c.topLeftCorner, c.bottomLeftCorner) +
                 d(c.topRightCorner, c.bottomRightCorner)) / 2;
  largeur = Math.max(64, Math.round(largeur));
  hauteur = Math.max(64, Math.round(hauteur));
  /* On plafonne : une page de 4000 px de côté donne un JPEG de plusieurs
     mégaoctets par feuille, pour une lisibilité qui ne gagne rien. */
  const facteur = Math.min(1, maxCote / Math.max(largeur, hauteur));
  return {
    largeur: Math.max(64, Math.round(largeur * facteur)),
    hauteur: Math.max(64, Math.round(hauteur * facteur)),
  };
}

/** Redresse la zone délimitée par les coins. Rend un canvas. */
export function redresser(
  vision: Vision, source: HTMLCanvasElement, coins: Coins, maxCote = 2400
): HTMLCanvasElement {
  const { largeur, hauteur } = tailleRedressee(coins, maxCote);
  return vision.scanner.extractPaper(source, largeur, hauteur, coins);
}
