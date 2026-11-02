"use client";

/**
 * AFFICHER UN PDF, PAGE PAR PAGE.
 *
 * Le navigateur sait déjà montrer un PDF dans un cadre — mais sans dire où
 * l'on clique dans le document. Or poser une signature demande exactement
 * cela : convertir un point de l'écran en coordonnées du PDF. pdf.js le fait,
 * et gère au passage la rotation des pages, que les scanners produisent sans
 * arrêt.
 *
 * TOUT EST SERVI PAR LE SITE. L'ouvrier de pdf.js est recopié dans
 * « public/vendor/pdfjs » par le script d'installation : empaqueté avec le
 * reste, il ne pourrait pas être lancé comme ouvrier, et pdf.js basculerait
 * sur un mode dégradé qui bloque le fil principal — un document de cent
 * feuillets figerait l'onglet.
 */

export type PageRendue = {
  canvas: HTMLCanvasElement;
  /** Convertit un point de l'écran (pixels du canvas) en point du PDF. */
  versPdf: (x: number, y: number) => { x: number; y: number };
  /** Et l'inverse, pour dessiner un repère à la bonne place. */
  versEcran: (x: number, y: number) => { x: number; y: number };
  largeurPdf: number;
  hauteurPdf: number;
  rotation: number;
  echelle: number;
};

type Doc = {
  numPages: number;
  getPage: (n: number) => Promise<any>;
  destroy: () => Promise<void>;
};

let moteur: Promise<any> | null = null;

async function charger() {
  if (moteur) return moteur;
  moteur = (async () => {
    const lib = await import("pdfjs-dist");
    /* L'ouvrier doit être une URL servie, pas un module empaqueté. */
    lib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
    return lib;
  })().catch((e) => { moteur = null; throw e; });
  return moteur;
}

/** Ouvre un PDF depuis ses octets. À refermer avec `destroy()`. */
export async function ouvrir(octets: ArrayBuffer | Uint8Array): Promise<Doc> {
  const lib = await charger();
  /* pdf.js prend possession du tampon qu'on lui donne et le vide : si
     l'appelant le réutilise ensuite — pour un téléchargement, par exemple —
     il trouve zéro octet. On lui en donne donc une copie. */
  const donnees = octets instanceof Uint8Array
    ? new Uint8Array(octets)
    : new Uint8Array(octets.slice(0));
  const tache = lib.getDocument({ data: donnees });
  return tache.promise as Promise<Doc>;
}

/**
 * Rend une page dans un canvas neuf.
 *
 * LA HAUTEUR COMPTE AUTANT QUE LA LARGEUR. Rendre à la largeur disponible
 * seule donne, pour une A4, une page de 1,4 fois sa largeur : sur un écran
 * ordinaire, le bas sort du champ. Pour lire, ce n'est qu'un défilement ;
 * pour POSER une signature, c'est une gêne constante — on ne voit pas où
 * l'on pose, et le cadre de départ se retrouve hors de l'écran. On tient
 * donc compte des deux, et la page entière reste visible.
 *
 * @param largeurCible largeur disponible à l'écran, en pixels CSS.
 * @param hauteurMax   hauteur disponible ; omise, elle ne contraint rien.
 */
export async function rendre(
  doc: Doc, numero: number, largeurCible: number, hauteurMax?: number,
): Promise<PageRendue> {
  const page = await doc.getPage(numero);
  /* On mesure à l'échelle 1 pour en déduire le facteur, plutôt que de
     deviner : une page A4 et une page A3 n'ont pas la même largeur en
     points, et une page tournée échange les deux. */
  const base = page.getViewport({ scale: 1 });
  const echelle = Math.max(0.1, Math.min(
    largeurCible / base.width,
    hauteurMax ? hauteurMax / base.height : Infinity,
  ));
  const vue = page.getViewport({ scale: echelle });

  const canvas = document.createElement("canvas");
  /* On rend à la densité réelle de l'écran : un rendu à 1× sur un téléphone
     donne un texte flou qu'on ne peut pas relire pour vérifier où signer. */
  const densite = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = Math.ceil(vue.width * densite);
  canvas.height = Math.ceil(vue.height * densite);
  canvas.style.width = `${Math.round(vue.width)}px`;
  canvas.style.height = `${Math.round(vue.height)}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Le navigateur n'a pas fourni de surface de dessin.");
  ctx.save();
  ctx.scale(densite, densite);
  /* Fond blanc : un PDF sans fond laisserait voir le noir derrière, et l'on
     ne distinguerait plus le papier de la page. */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, vue.width, vue.height);
  ctx.restore();

  await page.render({ canvasContext: ctx, viewport: vue, canvas, transform: [densite, 0, 0, densite, 0, 0] }).promise;

  return {
    canvas,
    /* Les coordonnées reçues sont en pixels CSS, pas en pixels du canvas :
       c'est ce que donnent les événements de la souris et du doigt. */
    versPdf: (x, y) => {
      const [px, py] = vue.convertToPdfPoint(x, y);
      return { x: px, y: py };
    },
    versEcran: (x, y) => {
      const [ex, ey] = vue.convertToViewportPoint(x, y);
      return { x: ex, y: ey };
    },
    largeurPdf: base.width, hauteurPdf: base.height,
    rotation: vue.rotation || 0,
    echelle,
  };
}
