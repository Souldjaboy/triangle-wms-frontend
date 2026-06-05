export const siteUrl = "https://trianglewmspro.com";

export const seoBusiness = {
  appName: "Triangle WMS Pro",
  companyName: "Triangle Logistics Transport & Intérim SARL",
  country: "Mali",
  city: "Bamako",
  district: "ACI",
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  whatsapp: process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "",
  logo: `${siteUrl}/icons/icon-512x512.png`,
};

export const seoKeywords = [
  "logiciel gestion stock Mali",
  "logiciel caisse Mali",
  "WMS Mali",
  "gestion entrepôt Bamako",
  "logiciel pharmacie Mali",
  "logiciel restaurant Mali",
  "logiciel hôtel Mali",
  "logiciel quincaillerie Mali",
  "marketplace entreprise Mali",
  "POS Afrique",
  "gestion logistique Afrique",
  "gestion stock Afrique",
  "Triangle WMS Pro",
];

export const defaultSeoDescription =
  "Triangle WMS Pro est une plateforme française pour gérer stocks, entrepôts, caisse POS, marketplace, logistique, documents et ventes en ligne au Mali et en Afrique.";

export function absoluteUrl(path = "/") {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== "" && entry !== undefined && entry !== null)
  ) as Partial<T>;
}
