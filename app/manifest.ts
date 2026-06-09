import type { MetadataRoute } from "next";
import { productConfig } from "./lib/product-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: productConfig.name,
    short_name: productConfig.shortName,
    description: productConfig.slogan,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: productConfig.theme.background,
    theme_color: productConfig.theme.themeColor,
    categories: ["business", "productivity", "shopping"],
    lang: "fr",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
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
              icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
            },
            {
              name: "Panier",
              short_name: "Panier",
              description: "Voir le panier",
              url: "/marketplace/cart",
              icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
            },
          ]
        : []),
      {
        name: "Connexion",
        short_name: "Connexion",
        description: "Accéder à son espace",
        url: "/login",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
    ],
  };
}
