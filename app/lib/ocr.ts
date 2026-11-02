"use client";

/**
 * LIRE LE TEXTE D'UNE PAGE SCANNÉE.
 *
 * Sans texte reconnu, un scan ne se retrouve que par le nom qu'on lui a
 * donné — et personne ne se souvient, six mois plus tard, d'avoir appelé un
 * fichier « bon 2026-03 ». Avec le texte, on retrouve le document par le nom
 * du chauffeur, le numéro du camion ou la station-service.
 *
 * CE QUE CELA COÛTE, ET POURQUOI C'EST FACULTATIF.
 *
 * Le moteur et les données de langue pèsent une dizaine de mégaoctets par
 * langue, téléchargés une fois puis gardés par le navigateur. Ce n'est pas
 * un détail sur une connexion mobile : la reconnaissance est donc un choix
 * fait au début d'une séance, annoncé avec son poids, et jamais imposé.
 *
 * TOUT EST SERVI PAR LE SITE. Aucune image, aucun texte ne part vers un
 * service extérieur : la reconnaissance se fait dans le navigateur, sur
 * l'appareil. Un bulletin de paie scanné ne quitte pas la maison.
 *
 * SI LES FICHIERS N'ONT PAS ÉTÉ MIS EN PLACE — « npm install » puis la
 * compilation s'en chargent — ce module le dit clairement au lieu de laisser
 * l'écran proposer une fonction qui échouera.
 */

export type ProgresOcr = { etape: string; part: number };

const DOSSIER = "/vendor/tesseract";
/* Les langues qu'on sait lire. Le français d'abord : c'est la langue des
   documents d'ici. L'anglais pour les connaissements et les factures des
   fournisseurs étrangers. */
export const LANGUES: Record<string, { nom: string; poids: string }> = {
  fra: { nom: "Français", poids: "6 Mo" },
  eng: { nom: "Anglais", poids: "10 Mo" },
  "fra+eng": { nom: "Français et anglais", poids: "16 Mo" },
};

let disponible: boolean | null = null;

/** Les fichiers sont-ils réellement servis ? On vérifie avant de proposer. */
export async function ocrDisponible(): Promise<boolean> {
  if (disponible !== null) return disponible;
  try {
    /* Une requête HEAD sur le plus petit des fichiers : inutile de
       télécharger six mégaoctets pour savoir s'ils sont là. */
    const r = await fetch(`${DOSSIER}/worker.min.js`, { method: "HEAD" });
    disponible = r.ok && !!(r.headers.get("content-type") || "").includes("javascript");
  } catch {
    disponible = false;
  }
  return disponible;
}

type Ouvrier = {
  recognize: (image: unknown) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<unknown>;
};

const ouvriers = new Map<string, Promise<Ouvrier>>();

/* Un ouvrier par langue, gardé pour la séance : le créer coûte le
   chargement du moteur, qu'il serait absurde de refaire à chaque page. */
async function ouvrier(langue: string, progres?: (p: ProgresOcr) => void): Promise<Ouvrier> {
  const existant = ouvriers.get(langue);
  if (existant) return existant;

  const promesse = (async () => {
    /* Import paresseux : le moteur ne doit pas peser sur le premier
       affichage de l'application pour ceux qui ne scannent jamais. */
    const { createWorker } = await import("tesseract.js");
    return createWorker(langue, 1, {
      workerPath: `${DOSSIER}/worker.min.js`,
      corePath: DOSSIER,
      langPath: DOSSIER,
      gzip: true,
      logger: (m: { status?: string; progress?: number }) => {
        if (!progres) return;
        progres({
          etape: etapeLisible(m.status || ""),
          part: typeof m.progress === "number" ? m.progress : 0,
        });
      },
    }) as unknown as Ouvrier;
  })().catch((e) => {
    /* On oublie l'échec : un incident passager ne doit pas condamner la
       reconnaissance pour toute la visite. */
    ouvriers.delete(langue);
    throw e;
  });

  ouvriers.set(langue, promesse);
  return promesse;
}

/* Les étapes de Tesseract sont en anglais et parlent de son fonctionnement
   interne. On dit ce qui se passe, pas comment c'est fait. */
function etapeLisible(statut: string): string {
  if (/loading language|loading tesseract|initializing tesseract/i.test(statut)) {
    return "Chargement du moteur de lecture…";
  }
  if (/initializing api|initialized api/i.test(statut)) return "Préparation…";
  if (/recognizing text/i.test(statut)) return "Lecture du texte…";
  return statut ? "Lecture en cours…" : "";
}

/**
 * Lit le texte d'une image. Rend le texte et la confiance moyenne.
 * N'échoue jamais en silence : une erreur remonte avec son message.
 */
export async function lireTexte(
  image: HTMLCanvasElement | Blob,
  langue = "fra",
  progres?: (p: ProgresOcr) => void,
): Promise<{ texte: string; confiance: number }> {
  if (!(await ocrDisponible())) {
    throw new Error(
      "La reconnaissance de texte n'est pas installée sur ce serveur. " +
      "Les pages seront enregistrées sans texte.");
  }
  const w = await ouvrier(langue, progres);
  const { data } = await w.recognize(image);
  return {
    /* Tesseract rend des lignes avec des espaces en trop et des retours
       multiples : on resserre, car ce texte sert à chercher, pas à lire. */
    texte: String(data?.text || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(),
    confiance: Number(data?.confidence || 0),
  };
}

/** À appeler en quittant le scanner : un ouvrier retient son moteur en mémoire. */
export async function fermerOcr(): Promise<void> {
  const tous = [...ouvriers.values()];
  ouvriers.clear();
  for (const p of tous) {
    try { (await p).terminate(); } catch { /* déjà parti */ }
  }
}
