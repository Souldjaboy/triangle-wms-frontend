import { productConfig } from "./product-config";

export const siteUrl = productConfig.siteUrl;

export const seoBusiness = {
  appName: productConfig.name,
  companyName:
    productConfig.product === "malilink"
      ? "MaliLink Global"
      : productConfig.product === "hafiya"
        ? "HAFIYA Laboratoire"
        : "Triangle Logistics Transport & Intérim SARL",
  country: "Mali",
  city: "Bamako",
  district: "ACI",
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  whatsapp: process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "",
  logo: `${siteUrl}${productConfig.logoUrl}`,
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
  "MaliLink Global",
  "HAFIYA Laboratoire",
];

export const defaultSeoDescription =
  productConfig.product === "malilink"
    ? "MaliLink Global est une marketplace multi-vendeurs et une plateforme SaaS pour entreprises africaines : commandes, vendeurs, paiements, services, restaurants, immobilier, automobile et laboratoire."
    : productConfig.product === "hafiya"
      ? "HAFIYA Laboratoire est une plateforme médicale pour gérer analyses, rendez-vous, patients, résultats et documents de laboratoire."
      : "Triangle WMS Pro est une plateforme française pour gérer stocks, entrepôts, caisse POS, comptabilité, documents et opérations internes Triangle Logistics.";

export function absoluteUrl(path = "/") {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== "" && entry !== undefined && entry !== null)
  ) as Partial<T>;
}
