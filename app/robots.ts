import type { MetadataRoute } from "next";
import { productConfig } from "./lib/product-config";
import { absoluteUrl, siteUrl } from "./lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (!productConfig.publicIndexing) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
      host: siteUrl,
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/marketplace",
          "/solutions",
          "/services",
          "/contact",
          "/a-propos",
          "/client/login",
          "/client/register",
          "/register",
          "/login",
          "/resultats-laboratoire",
        ],
        disallow: [
          "/api/",
          "/dashboard",
          "/stocks",
          "/produits",
          "/utilisateurs",
          "/comptabilite",
          "/pos",
          "/super-admin",
          "/parametres",
          "/parametres-pointage",
          "/documents",
          "/notifications",
          "/badges",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl,
  };
}
