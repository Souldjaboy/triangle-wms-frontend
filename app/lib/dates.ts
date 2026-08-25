"use client";

/**
 * DATES À L'HEURE DE BAMAKO.
 *
 * `toLocaleString("fr-FR")` sans fuseau affiche l'heure du NAVIGATEUR. Un bon
 * de sortie ouvert depuis un téléphone réglé sur Paris montrait donc une heure
 * différente de celle imprimée au magasin — le même document, deux vérités.
 *
 * Toutes les dates métier de Triangle s'écrivent ici, dans un seul fuseau,
 * celui de l'entrepôt.
 */

export const FUSEAU = "Africa/Bamako";

export type DateLocale = {
  iso: string;
  date: string;      // AAAA-MM-JJ, pour <input type="date">
  time: string;      // HH:MM,     pour <input type="time">
  affichage: string; // JJ/MM/AAAA à HH:MM
  fuseau: string;
};

/** Découpe un instant selon le fuseau de l'entrepôt. */
export function versLocal(valeur: string | Date | null | undefined): DateLocale | null {
  if (!valeur) return null;
  const d = valeur instanceof Date ? valeur : new Date(valeur);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value])) as Record<string, string>;
  return {
    iso: d.toISOString(),
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    affichage: `${p.day}/${p.month}/${p.year} à ${p.hour}:${p.minute}`,
    fuseau: FUSEAU,
  };
}

/** « 22/08/2026 à 10:30 », ou le repli fourni si la date est absente. */
export function afficherDate(valeur: string | Date | null | undefined, repli = "—"): string {
  return versLocal(valeur)?.affichage ?? repli;
}

/** « 22/08/2026 » seul, pour les colonnes de liste. */
export function afficherJour(valeur: string | Date | null | undefined, repli = "—"): string {
  const l = versLocal(valeur);
  return l ? l.affichage.split(" à ")[0] : repli;
}

/** Aujourd'hui à Bamako, pour préremplir un formulaire. */
export function aujourdhui(): { date: string; time: string } {
  const l = versLocal(new Date());
  return { date: l?.date ?? "", time: l?.time ?? "00:00" };
}
