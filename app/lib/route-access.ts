/** Module nécessaire pour ouvrir une URL interne depuis une notification.
 * La protection décisive reste côté API ; ceci évite aussi d'envoyer
 * l'utilisateur vers un écran qu'il n'a pas le droit de consulter. */
const ROUTES: Array<[string, string]> = [
  ["/paie/avances", "paie.avance"],
  ["/paie", "paie"],
  ["/comptabilite", "comptabilite"],
  ["/accounting", "comptabilite"],
  ["/fret-chine-mali", "fret_chine_mali"],
  ["/chat", "chat"],
  ["/reunion", "presentation_reunion"],
  ["/stocks", "stock"],
  ["/inventaires", "stock.inventaire"],
  ["/entrepots", "entrepot"],
  ["/emplacements", "stock.emplacement"],
  ["/produits", "produit"],
  ["/documents", "document"],
  ["/pointage", "pointage"],
  ["/rapports", "rapport"],
  ["/utilisateurs", "utilisateur"],
  ["/badges", "badge"],
  ["/cameras", "centre_camera"],
];

export function moduleForInternalUrl(raw: string): string | null {
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  let path = raw;
  try { path = new URL(raw, "https://triangle.local").pathname; } catch {}
  return ROUTES
    .sort((a, b) => b[0].length - a[0].length)
    .find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] || null;
}
