"use client";

/**
 * LES PRÉSENTATIONS : FORMATS, MODÈLES DE DIAPOSITIVE, RENDU.
 *
 * UN SEUL MOTEUR DE RENDU POUR TOUT LE STUDIO. Une diapositive est une
 * planche comme une autre : même type `Plan`, même fonction `rendre`. Ce qui
 * change est qu'une présentation en contient plusieurs, et que les
 * dimensions sont celles d'un écran plutôt que d'une carte de visite.
 *
 * Écrire un second moteur pour les diapositives aurait garanti qu'un jour
 * l'aperçu et l'export cessent de se ressembler — et cela ne se découvre
 * qu'une fois la réunion commencée.
 *
 * LA DENSITÉ D'EXPORT N'EST PAS CELLE DE L'IMPRESSION.
 *
 * Une carte de visite part à 300 points par pouce : elle sera imprimée, et on
 * la regardera à vingt centimètres. Une diapositive est projetée : à 300
 * points par pouce, une seule ferait 4000 pixels de large et une
 * présentation de vingt diapositives dépasserait trente mégaoctets à
 * envoyer, pour un résultat que personne ne distinguerait. On rend donc à
 * 150, ce qui donne 2000 pixels de large — au-dessus de ce que projette un
 * vidéoprojecteur courant — et laisse de la marge pour une impression en
 * polycopié.
 *
 * LES MODÈLES SONT ORIGINAUX. Ce sont des mises en page simples, écrites ici,
 * qu'on modifie ensuite. Aucun modèle sous licence n'est repris.
 */

import type { Element, Plan } from "./creation";
import { nouvelId, rendre } from "./creation";

export type { Element, Plan };
export { rendre };

export const PX_PAR_MM_DIAPOSITIVE = 150 / 25.4;

export type Format = {
  cle: string; nom: string; largeurMm: number; hauteurMm: number;
};

/* Les dimensions de PowerPoint, au millimètre : un export s'ouvre alors sans
   bande noire sur les côtés. */
export const FORMATS: Format[] = [
  { cle: "16-9", nom: "16/9 — écran large", largeurMm: 338.667, hauteurMm: 190.5 },
  { cle: "4-3", nom: "4/3 — vidéoprojecteur ancien", largeurMm: 254, hauteurMm: 190.5 },
];

export const formatDe = (cle: string) =>
  FORMATS.find((f) => f.cle === cle) || FORMATS[0];

export type Presentation = {
  diapositives: Plan[];
};

/* ═══════════════════════ LES MODÈLES ═══════════════════════ */

const ARDOISE = "#0f172a";
const BLEU = "#1d4ed8";
const GRIS = "#475569";
const BLANC = "#ffffff";

export type ModeleDiapo = {
  cle: string; nom: string; description: string;
  /** Le plan dépend des dimensions : un 4/3 n'a pas la même largeur. */
  plan: (f: Format) => Plan;
};

const texte = (
  x: number, y: number, l: number, contenu: string, taille: number,
  extra: Partial<Extract<Element, { type: "texte" }>> = {},
): Element => ({
  id: nouvelId(), type: "texte", x, y, l, texte: contenu, taille,
  couleur: ARDOISE, graisse: 400, alignement: "gauche", police: "sans",
  interligne: 1.3, ...extra,
});

export const MODELES_DIAPO: ModeleDiapo[] = [
  {
    cle: "titre", nom: "Titre", description: "Le titre de la présentation et sa date.",
    plan: (f) => ({
      fond: BLANC,
      elements: [
        { id: nouvelId(), type: "rect", x: 0, y: f.hauteurMm - 14, l: f.largeurMm, h: 14,
          couleur: BLEU, rayon: 0, bordure: 0, couleurBordure: BLEU },
        texte(f.largeurMm * 0.08, f.hauteurMm * 0.34, f.largeurMm * 0.84,
          "Titre de la présentation", f.hauteurMm * 0.09,
          { graisse: 700, alignement: "centre" }),
        texte(f.largeurMm * 0.08, f.hauteurMm * 0.52, f.largeurMm * 0.84,
          "Sous-titre · Triangle Logistics", f.hauteurMm * 0.035,
          { couleur: GRIS, alignement: "centre" }),
      ],
    }),
  },
  {
    cle: "titre-contenu", nom: "Titre et contenu", description: "Un titre, puis du texte.",
    plan: (f) => ({
      fond: BLANC,
      elements: [
        texte(f.largeurMm * 0.07, f.hauteurMm * 0.09, f.largeurMm * 0.86,
          "Titre de la diapositive", f.hauteurMm * 0.065, { graisse: 700 }),
        { id: nouvelId(), type: "ligne", x: f.largeurMm * 0.07, y: f.hauteurMm * 0.21,
          l: f.largeurMm * 0.12, epaisseur: 1.2, couleur: BLEU },
        texte(f.largeurMm * 0.07, f.hauteurMm * 0.28, f.largeurMm * 0.86,
          "Premier point\nDeuxième point\nTroisième point", f.hauteurMm * 0.038,
          { interligne: 1.7 }),
      ],
    }),
  },
  {
    cle: "deux-colonnes", nom: "Deux colonnes", description: "Comparer deux choses côte à côte.",
    plan: (f) => ({
      fond: BLANC,
      elements: [
        texte(f.largeurMm * 0.07, f.hauteurMm * 0.09, f.largeurMm * 0.86,
          "Comparaison", f.hauteurMm * 0.065, { graisse: 700 }),
        texte(f.largeurMm * 0.07, f.hauteurMm * 0.26, f.largeurMm * 0.40,
          "À gauche", f.hauteurMm * 0.042, { graisse: 700, couleur: BLEU }),
        texte(f.largeurMm * 0.07, f.hauteurMm * 0.34, f.largeurMm * 0.40,
          "Ce qui se dit de ce côté.", f.hauteurMm * 0.034, { interligne: 1.6 }),
        texte(f.largeurMm * 0.53, f.hauteurMm * 0.26, f.largeurMm * 0.40,
          "À droite", f.hauteurMm * 0.042, { graisse: 700, couleur: BLEU }),
        texte(f.largeurMm * 0.53, f.hauteurMm * 0.34, f.largeurMm * 0.40,
          "Et ce qui se dit de l'autre.", f.hauteurMm * 0.034, { interligne: 1.6 }),
      ],
    }),
  },
  {
    cle: "section", nom: "Intertitre", description: "Une rupture, pour annoncer une partie.",
    plan: (f) => ({
      fond: ARDOISE,
      elements: [
        texte(f.largeurMm * 0.08, f.hauteurMm * 0.42, f.largeurMm * 0.84,
          "Deuxième partie", f.hauteurMm * 0.075,
          { graisse: 700, couleur: BLANC, alignement: "centre" }),
      ],
    }),
  },
  {
    cle: "chiffre", nom: "Un chiffre", description: "Un seul nombre, en grand, et ce qu'il signifie.",
    plan: (f) => ({
      fond: BLANC,
      elements: [
        texte(f.largeurMm * 0.08, f.hauteurMm * 0.28, f.largeurMm * 0.84,
          "1 248", f.hauteurMm * 0.22,
          { graisse: 700, couleur: BLEU, alignement: "centre" }),
        texte(f.largeurMm * 0.08, f.hauteurMm * 0.62, f.largeurMm * 0.84,
          "tonnes livrées ce trimestre", f.hauteurMm * 0.04,
          { couleur: GRIS, alignement: "centre" }),
      ],
    }),
  },
  {
    cle: "vierge", nom: "Vierge", description: "Rien, pour tout poser soi-même.",
    plan: () => ({ fond: BLANC, elements: [] }),
  },
];

/** Une copie profonde avec des identifiants neufs : dupliquer sans partager. */
export function copier(plan: Plan): Plan {
  return {
    fond: plan.fond,
    elements: plan.elements.map((el) => ({ ...el, id: nouvelId() } as Element)),
  };
}

/**
 * LES IMAGES D'UNE DIAPOSITIVE, CHARGÉES POUR LE RENDU.
 *
 * `rendre` attend des images déjà décodées : il dessine sur une toile, et une
 * toile ne sait pas attendre. Charger à la volée dessinerait des cadres
 * vides — ce que l'on verrait seulement sur le PDF produit.
 */
export async function ressourcesDe(plan: Plan): Promise<{ images: Map<string, HTMLImageElement> }> {
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(plan.elements
    .filter((el): el is Extract<Element, { type: "image" }> => el.type === "image")
    .map((el) => new Promise<void>((fini) => {
      const img = new Image();
      img.onload = () => { images.set(el.id, img); fini(); };
      /* UNE IMAGE QUI NE CHARGE PAS NE BLOQUE PAS LE RENDU : `rendre` dessine
         alors un cadre marqué « image manquante », ce qui se voit, au lieu
         d'un blanc qu'on prendrait pour voulu. */
      img.onerror = () => fini();
      img.src = el.src;
    })));
  return { images };
}

/** Une diapositive, rendue en PNG, prête à être envoyée. */
export async function enPng(
  plan: Plan, f: Format, pxParMm = PX_PAR_MM_DIAPOSITIVE,
): Promise<Blob> {
  const ressources = await ressourcesDe(plan);
  const canvas = rendre(plan, f.largeurMm, f.hauteurMm, pxParMm, ressources);
  return new Promise<Blob>((resoudre, rejeter) => {
    canvas.toBlob((b) => {
      if (b) resoudre(b);
      else rejeter(new Error("Le navigateur n'a pas pu produire l'image de la diapositive."));
    }, "image/png");
  });
}
