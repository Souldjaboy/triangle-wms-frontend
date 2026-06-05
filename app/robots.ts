import type { MetadataRoute } from "next";
import { absoluteUrl, siteUrl } from "./lib/seo";

export default function robots(): MetadataRoute.Robots {
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
