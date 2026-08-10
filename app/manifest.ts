import type { MetadataRoute } from "next";
import { productConfig } from "./lib/product-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: productConfig.name,
    short_name: productConfig.shortName,
    description: productConfig.slogan,
    start_url: productConfig.startUrl,
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: productConfig.theme.background,
    theme_color: productConfig.theme.themeColor,
    categories: ["business", "productivity", "shopping"],
    lang: "fr",
    /* Icônes carrées dédiées quand le produit en fournit (Triangle), sinon
       repli sur le logo comme auparavant — MaliLink et HAFIYA inchangés.
       La variante maskable dispose d'une marge interne plus large pour ne pas
       être rognée par les icônes rondes d'Android/iOS. */
    icons: [
      {
        src: productConfig.icon192Url || productConfig.logoUrl,
        sizes: "192x192",
        type: productConfig.iconMimeType || "image/svg+xml",
      },
      {
        src: productConfig.icon512Url || productConfig.logoUrl,
        sizes: "512x512",
        type: productConfig.iconMimeType || "image/svg+xml",
      },
      {
        src:
          productConfig.maskableIconUrl ||
          productConfig.icon512Url ||
          productConfig.logoUrl,
        sizes: "512x512",
        type: productConfig.iconMimeType || "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      ...(productConfig.marketplaceEnabled
        ? [
            {
              name: "Marketplace",
              short_name: "Marketplace",
              description: "Ouvrir la marketplace",
              url: "/marketplace",
              icons: [{ src: productConfig.logoUrl, sizes: "192x192" }],
            },
            {
              name: "Panier",
              short_name: "Panier",
              description: "Voir le panier",
              url: "/marketplace/cart",
              icons: [{ src: productConfig.logoUrl, sizes: "192x192" }],
            },
          ]
        : []),
      {
        name: "Connexion",
        short_name: "Connexion",
        description: "Accéder à son espace",
        url: "/login",
        icons: [{ src: productConfig.logoUrl, sizes: "192x192" }],
      },
    ],
  };
}
