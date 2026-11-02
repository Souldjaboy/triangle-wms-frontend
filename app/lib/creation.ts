"use client";

/**
 * LA MISE EN PAGE D'UNE CRÉATION, ET SON RENDU.
 *
 * UN SEUL CHEMIN DE RENDU, pour l'aperçu comme pour l'export. L'écran dessine
 * à la taille de la fenêtre, l'export à 300 points par pouce : c'est le même
 * code, avec une échelle différente. Deux chemins finiraient par diverger, et
 * l'on imprimerait autre chose que ce qu'on a validé — ce qui ne se voit
 * qu'une fois les cartes de visite livrées.
 *
 * TOUT EST EN MILLIMÈTRES. Une carte de visite n'est pas « 1004 pixels de
 * large » : c'est 85 millimètres. En travaillant en millimètres, la même mise
 * en page sort juste à l'écran, à l'impression et sur un autre appareil.
 *
 * LES MODÈLES SONT ORIGINAUX. Aucun modèle sous licence n'est repris : ce
 * sont des mises en page simples, écrites ici, que chacun modifie ensuite.
 */

export type Element =
  | { id: string; type: "texte"; x: number; y: number; l: number;
      texte: string; taille: number; couleur: string; graisse: number;
      alignement: "gauche" | "centre" | "droite"; police: string;
      interligne: number; majuscules?: boolean }
  | { id: string; type: "rect"; x: number; y: number; l: number; h: number;
      couleur: string; rayon: number; bordure: number; couleurBordure: string }
  | { id: string; type: "ellipse"; x: number; y: number; l: number; h: number;
      couleur: string; bordure: number; couleurBordure: string }
  | { id: string; type: "ligne"; x: number; y: number; l: number;
      epaisseur: number; couleur: string }
  | { id: string; type: "image"; x: number; y: number; l: number; h: number;
      src: string; arrondi: number }
  | { id: string; type: "qr"; x: number; y: number; taille: number;
      valeur: string; couleur: string };

export type Plan = {
  fond: string;
  elements: Element[];
};

export type Modele = {
  cle: string; nom: string; description: string;
  largeurMm: number; hauteurMm: number;
  plan: Plan;
};

export const POLICES = [
  { cle: "sans", nom: "Sans empattement", css: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { cle: "serif", nom: "Avec empattement", css: "Georgia, 'Times New Roman', serif" },
  { cle: "mono", nom: "Chasse fixe", css: "'Courier New', monospace" },
];
const cssPolice = (cle: string) =>
  POLICES.find((p) => p.cle === cle)?.css || POLICES[0].css;

let compteur = 0;
export const nouvelId = () => `e${Date.now().toString(36)}${(compteur++).toString(36)}`;

/* ═══════════════════════════ LES MODÈLES ═══════════════════════════════ */

const BLEU = "#1d4ed8";
const ARDOISE = "#0f172a";
const GRIS = "#64748b";

export const MODELES: Modele[] = [
  {
    cle: "carte-visite", nom: "Carte de visite", description: "85 × 55 mm, le format qui entre dans un porte-cartes.",
    largeurMm: 85, hauteurMm: 55,
    plan: {
      fond: "#ffffff",
      elements: [
        { id: "f1", type: "rect", x: 0, y: 0, l: 85, h: 10, couleur: BLEU, rayon: 0, bordure: 0, couleurBordure: BLEU },
        { id: "t1", type: "texte", x: 6, y: 17, l: 73, texte: "Prénom NOM", taille: 6.5,
          couleur: ARDOISE, graisse: 700, alignement: "gauche", police: "sans", interligne: 1.2 },
        { id: "t2", type: "texte", x: 6, y: 24, l: 73, texte: "Fonction", taille: 3.6,
          couleur: GRIS, graisse: 400, alignement: "gauche", police: "sans", interligne: 1.2, majuscules: true },
        { id: "l1", type: "ligne", x: 6, y: 30, l: 20, epaisseur: 0.6, couleur: BLEU },
        { id: "t3", type: "texte", x: 6, y: 34, l: 73,
          texte: "Téléphone · courriel\nAdresse", taille: 3.2,
          couleur: ARDOISE, graisse: 400, alignement: "gauche", police: "sans", interligne: 1.4 },
      ],
    },
  },
  {
    cle: "badge", nom: "Badge", description: "100 × 70 mm, avec un QR que le pointage sait lire.",
    largeurMm: 100, hauteurMm: 70,
    plan: {
      fond: "#ffffff",
      elements: [
        { id: "f1", type: "rect", x: 0, y: 0, l: 100, h: 16, couleur: ARDOISE, rayon: 0, bordure: 0, couleurBordure: ARDOISE },
        { id: "t0", type: "texte", x: 5, y: 5, l: 90, texte: "NOM DE L'ENTREPRISE", taille: 4.5,
          couleur: "#ffffff", graisse: 700, alignement: "gauche", police: "sans", interligne: 1.2 },
        { id: "t1", type: "texte", x: 5, y: 24, l: 58, texte: "Prénom NOM", taille: 7,
          couleur: ARDOISE, graisse: 700, alignement: "gauche", police: "sans", interligne: 1.2 },
        { id: "t2", type: "texte", x: 5, y: 34, l: 58, texte: "Fonction", taille: 4,
          couleur: GRIS, graisse: 400, alignement: "gauche", police: "sans", interligne: 1.2 },
        { id: "t3", type: "texte", x: 5, y: 44, l: 58, texte: "Matricule 000", taille: 3.4,
          couleur: ARDOISE, graisse: 400, alignement: "gauche", police: "mono", interligne: 1.2 },
        { id: "q1", type: "qr", x: 68, y: 24, taille: 28, valeur: "MATRICULE-000", couleur: ARDOISE },
      ],
    },
  },
  {
    cle: "certificat", nom: "Certificat", description: "A4 à l'italienne, pour une attestation ou une remise.",
    largeurMm: 297, hauteurMm: 210,
    plan: {
      fond: "#ffffff",
      elements: [
        { id: "c1", type: "rect", x: 10, y: 10, l: 277, h: 190, couleur: "#ffffff", rayon: 2, bordure: 1.2, couleurBordure: BLEU },
        { id: "t1", type: "texte", x: 30, y: 38, l: 237, texte: "CERTIFICAT", taille: 16,
          couleur: ARDOISE, graisse: 700, alignement: "centre", police: "serif", interligne: 1.1 },
        { id: "l1", type: "ligne", x: 118, y: 58, l: 60, epaisseur: 0.8, couleur: BLEU },
        { id: "t2", type: "texte", x: 40, y: 72, l: 217, texte: "décerné à", taille: 6,
          couleur: GRIS, graisse: 400, alignement: "centre", police: "serif", interligne: 1.2 },
        { id: "t3", type: "texte", x: 30, y: 88, l: 237, texte: "Prénom NOM", taille: 14,
          couleur: BLEU, graisse: 700, alignement: "centre", police: "serif", interligne: 1.1 },
        { id: "t4", type: "texte", x: 50, y: 118, l: 197,
          texte: "pour avoir accompli ce qui est décrit ici, en toutes lettres et sur deux lignes si besoin.",
          taille: 5, couleur: ARDOISE, graisse: 400, alignement: "centre", police: "serif", interligne: 1.5 },
        { id: "t5", type: "texte", x: 30, y: 168, l: 100, texte: "Date", taille: 4,
          couleur: GRIS, graisse: 400, alignement: "centre", police: "sans", interligne: 1.2 },
        { id: "t6", type: "texte", x: 167, y: 168, l: 100, texte: "Signature", taille: 4,
          couleur: GRIS, graisse: 400, alignement: "centre", police: "sans", interligne: 1.2 },
        { id: "l2", type: "ligne", x: 40, y: 165, l: 80, epaisseur: 0.3, couleur: GRIS },
        { id: "l3", type: "ligne", x: 177, y: 165, l: 80, epaisseur: 0.3, couleur: GRIS },
      ],
    },
  },
  {
    cle: "affichette", nom: "Affichette A4", description: "210 × 297 mm, pour une consigne ou une annonce.",
    largeurMm: 210, hauteurMm: 297,
    plan: {
      fond: "#ffffff",
      elements: [
        { id: "f1", type: "rect", x: 0, y: 0, l: 210, h: 70, couleur: BLEU, rayon: 0, bordure: 0, couleurBordure: BLEU },
        { id: "t1", type: "texte", x: 15, y: 22, l: 180, texte: "TITRE DE L'ANNONCE", taille: 13,
          couleur: "#ffffff", graisse: 700, alignement: "gauche", police: "sans", interligne: 1.1 },
        { id: "t2", type: "texte", x: 15, y: 86, l: 180,
          texte: "Le texte de l'annonce, en quelques lignes. Ce qui doit être lu depuis l'autre bout du couloir va dans le titre ; le détail va ici.",
          taille: 6, couleur: ARDOISE, graisse: 400, alignement: "gauche", police: "sans", interligne: 1.5 },
        { id: "l1", type: "ligne", x: 15, y: 250, l: 180, epaisseur: 0.5, couleur: GRIS },
        { id: "t3", type: "texte", x: 15, y: 256, l: 180, texte: "Date · Service",
          taille: 4.5, couleur: GRIS, graisse: 400, alignement: "gauche", police: "sans", interligne: 1.2 },
      ],
    },
  },
  {
    cle: "etiquette", nom: "Étiquette", description: "70 × 40 mm, pour un colis ou un emplacement.",
    largeurMm: 70, hauteurMm: 40,
    plan: {
      fond: "#ffffff",
      elements: [
        { id: "c1", type: "rect", x: 1, y: 1, l: 68, h: 38, couleur: "#ffffff", rayon: 1.5, bordure: 0.5, couleurBordure: ARDOISE },
        { id: "t1", type: "texte", x: 4, y: 6, l: 40, texte: "RÉFÉRENCE", taille: 5,
          couleur: ARDOISE, graisse: 700, alignement: "gauche", police: "sans", interligne: 1.2 },
        { id: "t2", type: "texte", x: 4, y: 14, l: 40, texte: "Description\nsur deux lignes", taille: 3,
          couleur: GRIS, graisse: 400, alignement: "gauche", police: "sans", interligne: 1.3 },
        { id: "q1", type: "qr", x: 46, y: 8, taille: 22, valeur: "REF-0000", couleur: ARDOISE },
      ],
    },
  },
  {
    cle: "vierge", nom: "Page blanche", description: "A4 debout, à composer entièrement.",
    largeurMm: 210, hauteurMm: 297,
    plan: { fond: "#ffffff", elements: [] },
  },
];

/* ═══════════════════════════ LE RENDU ══════════════════════════════════ */

/** Découpe un texte en lignes qui tiennent dans la largeur donnée. */
function lignes(ctx: CanvasRenderingContext2D, texte: string, largeur: number): string[] {
  const out: string[] = [];
  /* Les retours à la ligne saisis sont respectés : ils sont voulus. */
  for (const paragraphe of String(texte).split("\n")) {
    const mots = paragraphe.split(/\s+/).filter(Boolean);
    if (!mots.length) { out.push(""); continue; }
    let courante = mots[0];
    for (const mot of mots.slice(1)) {
      const essai = `${courante} ${mot}`;
      if (ctx.measureText(essai).width <= largeur) courante = essai;
      else { out.push(courante); courante = mot; }
    }
    out.push(courante);
  }
  return out;
}

function rectArrondi(ctx: CanvasRenderingContext2D,
  x: number, y: number, l: number, h: number, r: number) {
  const rayon = Math.max(0, Math.min(r, l / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rayon, y);
  ctx.lineTo(x + l - rayon, y);
  ctx.quadraticCurveTo(x + l, y, x + l, y + rayon);
  ctx.lineTo(x + l, y + h - rayon);
  ctx.quadraticCurveTo(x + l, y + h, x + l - rayon, y + h);
  ctx.lineTo(x + rayon, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rayon);
  ctx.lineTo(x, y + rayon);
  ctx.quadraticCurveTo(x, y, x + rayon, y);
  ctx.closePath();
}

export type Ressources = {
  /** Les images déjà chargées, par identifiant d'élément. */
  images?: Map<string, CanvasImageSource>;
  /** Les QR déjà dessinés, par identifiant d'élément. */
  qr?: Map<string, CanvasImageSource>;
};

/**
 * Dessine le plan dans un canvas neuf.
 * @param pxParMm pixels par millimètre : 3,78 pour l'écran, 11,81 pour 300 ppp.
 */
export function rendre(
  plan: Plan, largeurMm: number, hauteurMm: number,
  pxParMm: number, ressources: Ressources = {},
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(largeurMm * pxParMm));
  canvas.height = Math.max(1, Math.round(hauteurMm * pxParMm));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = plan.fond || "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  /* Tout est exprimé en millimètres : une seule mise à l'échelle, et le
     reste du code ne connaît plus les pixels. */
  ctx.scale(pxParMm, pxParMm);
  ctx.textBaseline = "top";

  for (const el of plan.elements) {
    ctx.save();
    switch (el.type) {
      case "rect": {
        rectArrondi(ctx, el.x, el.y, el.l, el.h, el.rayon || 0);
        if (el.couleur && el.couleur !== "transparent") { ctx.fillStyle = el.couleur; ctx.fill(); }
        if (el.bordure > 0) {
          ctx.lineWidth = el.bordure; ctx.strokeStyle = el.couleurBordure || "#000000"; ctx.stroke();
        }
        break;
      }
      case "ellipse": {
        ctx.beginPath();
        ctx.ellipse(el.x + el.l / 2, el.y + el.h / 2, el.l / 2, el.h / 2, 0, 0, Math.PI * 2);
        if (el.couleur && el.couleur !== "transparent") { ctx.fillStyle = el.couleur; ctx.fill(); }
        if (el.bordure > 0) {
          ctx.lineWidth = el.bordure; ctx.strokeStyle = el.couleurBordure || "#000000"; ctx.stroke();
        }
        break;
      }
      case "ligne": {
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + el.l, el.y);
        ctx.lineWidth = el.epaisseur || 0.3;
        ctx.strokeStyle = el.couleur || "#000000";
        ctx.stroke();
        break;
      }
      case "texte": {
        const texte = el.majuscules ? String(el.texte).toUpperCase() : String(el.texte);
        ctx.fillStyle = el.couleur || "#000000";
        ctx.font = `${el.graisse || 400} ${el.taille}px ${cssPolice(el.police)}`;
        const hauteurLigne = el.taille * (el.interligne || 1.3);
        const ls = lignes(ctx, texte, el.l);
        ctx.textAlign = el.alignement === "centre" ? "center"
          : el.alignement === "droite" ? "right" : "left";
        const ax = el.alignement === "centre" ? el.x + el.l / 2
          : el.alignement === "droite" ? el.x + el.l : el.x;
        ls.forEach((ligne, i) => ctx.fillText(ligne, ax, el.y + i * hauteurLigne));
        break;
      }
      case "image": {
        const src = ressources.images?.get(el.id);
        if (src) {
          if (el.arrondi > 0) { rectArrondi(ctx, el.x, el.y, el.l, el.h, el.arrondi); ctx.clip(); }
          ctx.drawImage(src, el.x, el.y, el.l, el.h);
        } else {
          /* ON MONTRE QUE L'IMAGE MANQUE au lieu de laisser un trou blanc :
             sinon on imprime cent cartes avec un vide à la place du logo. */
          ctx.fillStyle = "#f1f5f9";
          rectArrondi(ctx, el.x, el.y, el.l, el.h, el.arrondi || 0);
          ctx.fill();
          ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 0.3; ctx.stroke();
          ctx.fillStyle = "#94a3b8";
          ctx.font = `400 ${Math.max(2, Math.min(el.h / 4, 4))}px ${cssPolice("sans")}`;
          ctx.textAlign = "center";
          ctx.fillText("image absente", el.x + el.l / 2, el.y + el.h / 2 - 1.5);
        }
        break;
      }
      case "qr": {
        const src = ressources.qr?.get(el.id);
        if (src) ctx.drawImage(src, el.x, el.y, el.taille, el.taille);
        else {
          ctx.fillStyle = "#f1f5f9";
          ctx.fillRect(el.x, el.y, el.taille, el.taille);
          ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 0.3;
          ctx.strokeRect(el.x, el.y, el.taille, el.taille);
        }
        break;
      }
    }
    ctx.restore();
  }
  return canvas;
}

/** Le rectangle occupé par un élément, en millimètres. */
export function cadre(el: Element): { x: number; y: number; l: number; h: number } {
  if (el.type === "qr") return { x: el.x, y: el.y, l: el.taille, h: el.taille };
  if (el.type === "ligne") return { x: el.x, y: el.y - 1, l: el.l, h: 2 };
  if (el.type === "texte") {
    /* Une estimation suffit : le cadre sert à attraper l'élément au doigt,
       pas à décider du rendu. */
    const nbLignes = Math.max(1, String(el.texte).split("\n").length);
    return { x: el.x, y: el.y, l: el.l, h: el.taille * (el.interligne || 1.3) * nbLignes };
  }
  return { x: el.x, y: el.y, l: (el as { l: number }).l, h: (el as { h: number }).h };
}

/* 300 points par pouce : la finesse attendue par un imprimeur. */
export const PX_PAR_MM_IMPRESSION = 300 / 25.4;
