export type AppProduct = "triangle" | "malilink" | "hafiya";

export type ProductModule =
  | "marketplace"
  | "panier"
  | "commandes"
  | "vendeurs"
  | "restaurants"
  | "immobilier"
  | "automobile"
  | "laboratoire"
  | "services"
  | "abonnements"
  | "paiements"
  | "ia"
  | "crm"
  | "stock"
  | "entrepots"
  | "pos"
  | "comptabilite"
  | "rh"
  | "pointage"
  | "documents"
  | "rapports"
  | "utilisateurs"
  | "badges"
  | "notifications"
  | "chat"
  | "demandes"
  | "logistique"
  | "reservations"
  | "profil_patient"
  | "profils_vendeurs";

type ProductTheme = {
  primary: string;
  accent: string;
  background: string;
  foreground: string;
  themeColor: string;
};

type ProductConfig = {
  product: AppProduct;
  name: string;
  shortName: string;
  slogan: string;
  usage: string;
  siteUrl: string;
  logoText: string;
  logoUrl: string;
  theme: ProductTheme;
  modules: Record<ProductModule, boolean>;
  disabledRoutePrefixes: string[];
  allowedRoutePrefixes: string[];
  publicHomeActions: string[];
  marketplaceEnabled: boolean;
  saasPublicEnabled: boolean;
};

const requestedProduct = String(process.env.NEXT_PUBLIC_APP_PRODUCT || "triangle").toLowerCase();
export const appProduct: AppProduct =
  requestedProduct === "malilink" || requestedProduct === "hafiya" ? requestedProduct : "triangle";

const baseModules: Record<ProductModule, boolean> = {
  marketplace: false,
  panier: false,
  commandes: false,
  vendeurs: false,
  restaurants: false,
  immobilier: false,
  automobile: false,
  laboratoire: false,
  services: false,
  abonnements: false,
  paiements: false,
  ia: false,
  crm: false,
  stock: false,
  entrepots: false,
  pos: false,
  comptabilite: false,
  rh: false,
  pointage: false,
  documents: false,
  rapports: false,
  utilisateurs: false,
  badges: false,
  notifications: false,
  chat: false,
  demandes: false,
  logistique: false,
  reservations: false,
  profil_patient: false,
  profils_vendeurs: false,
};

const configs: Record<AppProduct, ProductConfig> = {
  triangle: {
    product: "triangle",
    name: "Triangle WMS Pro",
    shortName: "Triangle WMS",
    slogan: "Gestion interne Triangle Logistics",
    usage: "gestion interne Triangle Logistics",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://trianglewmspro.com",
    logoText: "Triangle WMS Pro",
    logoUrl: "/icons/icon-512x512.png",
    theme: {
      primary: "#050505",
      accent: "#f5b400",
      background: "#ffffff",
      foreground: "#111111",
      themeColor: "#f5b400",
    },
    modules: {
      ...baseModules,
      stock: true,
      entrepots: true,
      pos: true,
      comptabilite: true,
      rh: true,
      pointage: true,
      documents: true,
      rapports: true,
      ia: true,
      crm: true,
      utilisateurs: true,
      badges: true,
      notifications: true,
      chat: true,
      demandes: true,
      logistique: true,
    },
    disabledRoutePrefixes: ["/marketplace", "/client", "/vendor", "/register"],
    allowedRoutePrefixes: [],
    publicHomeActions: ["/login", "/installer-application", "/solutions", "/contact"],
    marketplaceEnabled: false,
    saasPublicEnabled: false,
  },
  malilink: {
    product: "malilink",
    name: "MaliLink Global",
    shortName: "MaliLink",
    slogan: "Marketplace et solutions numériques pour les entreprises africaines.",
    usage: "marketplace publique SaaS et marketplace multi-vendeurs",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://malilinkglobal.com",
    logoText: "MaliLink Global",
    logoUrl: "/icons/icon-512x512.png",
    theme: {
      primary: "#07152f",
      accent: "#f5b400",
      background: "#ffffff",
      foreground: "#07152f",
      themeColor: "#07152f",
    },
    modules: {
      ...baseModules,
      marketplace: true,
      panier: true,
      commandes: true,
      vendeurs: true,
      restaurants: true,
      immobilier: true,
      automobile: true,
      laboratoire: true,
      services: true,
      abonnements: true,
      paiements: true,
      ia: true,
      crm: true,
      documents: true,
      rapports: true,
      notifications: true,
      chat: true,
      reservations: true,
      profils_vendeurs: true,
    },
    disabledRoutePrefixes: [],
    allowedRoutePrefixes: [],
    publicHomeActions: [
      "/marketplace",
      "/client/register",
      "/client/login",
      "/register",
      "/login",
      "/installer-application",
      "/solutions",
      "/contact",
    ],
    marketplaceEnabled: true,
    saasPublicEnabled: true,
  },
  hafiya: {
    product: "hafiya",
    name: "HAFIYA Laboratoire",
    shortName: "HAFIYA",
    slogan: "Laboratoire, analyses, rendez-vous et résultats en ligne",
    usage: "gestion laboratoire, analyses, rendez-vous, patients, résultats et documents",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://hafiyalab.com",
    logoText: "HAFIYA Laboratoire",
    logoUrl: "/icons/icon-512x512.png",
    theme: {
      primary: "#0f7a55",
      accent: "#22c55e",
      background: "#ffffff",
      foreground: "#063f2d",
      themeColor: "#0f7a55",
    },
    modules: {
      ...baseModules,
      laboratoire: true,
      documents: true,
      rapports: true,
      paiements: true,
      ia: true,
      notifications: true,
      profil_patient: true,
      reservations: true,
    },
    disabledRoutePrefixes: [
      "/marketplace/business",
      "/vendor",
      "/automobile",
      "/immobilier",
      "/restaurant",
      "/pos",
      "/stocks",
      "/entrepots",
      "/emplacements",
      "/pointage",
      "/attendance-scan",
      "/comptabilite",
    ],
    allowedRoutePrefixes: [
      "/",
      "/login",
      "/client/login",
      "/client/register",
      "/client/profile",
      "/notifications",
      "/laboratoire",
      "/client/laboratoires",
      "/client/laboratoire",
      "/resultats-laboratoire",
      "/documents",
      "/rapports",
      "/installer-application",
      "/contact",
    ],
    publicHomeActions: ["/client/laboratoires", "/resultats-laboratoire", "/login", "/installer-application", "/contact"],
    marketplaceEnabled: false,
    saasPublicEnabled: false,
  },
};

export const productConfig = configs[appProduct];

const routeModuleRules: Array<{ prefixes: string[]; module: ProductModule }> = [
  { prefixes: ["/marketplace", "/client/orders", "/client/dashboard", "/marketplace/cart"], module: "marketplace" },
  { prefixes: ["/vendor"], module: "vendeurs" },
  { prefixes: ["/restaurant"], module: "restaurants" },
  { prefixes: ["/immobilier"], module: "immobilier" },
  { prefixes: ["/automobile"], module: "automobile" },
  { prefixes: ["/laboratoire", "/client/laboratoires", "/client/laboratoire", "/resultats-laboratoire"], module: "laboratoire" },
  { prefixes: ["/services"], module: "services" },
  { prefixes: ["/pos"], module: "pos" },
  { prefixes: ["/stocks", "/produits", "/scanner", "/inventaires"], module: "stock" },
  { prefixes: ["/entrepots", "/emplacements"], module: "entrepots" },
  { prefixes: ["/comptabilite"], module: "comptabilite" },
  { prefixes: ["/attendance-scan", "/pointage", "/parametres-pointage"], module: "pointage" },
  { prefixes: ["/documents"], module: "documents" },
  { prefixes: ["/rapports"], module: "rapports" },
  { prefixes: ["/assistant"], module: "ia" },
  { prefixes: ["/partenaires"], module: "crm" },
  { prefixes: ["/utilisateurs"], module: "utilisateurs" },
  { prefixes: ["/badges"], module: "badges" },
  { prefixes: ["/notifications", "/alertes"], module: "notifications" },
  { prefixes: ["/chat"], module: "chat" },
  { prefixes: ["/demandes"], module: "demandes" },
  { prefixes: ["/activites"], module: "logistique" },
];

export function isRouteAvailable(pathname: string) {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

  if (productConfig.disabledRoutePrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
    return false;
  }

  if (
    productConfig.allowedRoutePrefixes.length > 0 &&
    !productConfig.allowedRoutePrefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))
  ) {
    return false;
  }

  const rule = routeModuleRules.find(({ prefixes }) =>
    prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))
  );

  return rule ? productConfig.modules[rule.module] !== false : true;
}

export function isProductModuleEnabled(module: ProductModule) {
  return productConfig.modules[module] !== false;
}

export function isModuleEnabled(moduleName: string) {
  return productConfig.modules[moduleName as ProductModule] !== false;
}
