import type { MetadataRoute } from "next";
import { absoluteUrl } from "./lib/seo";

const publicRoutes = [
  { path: "/", priority: 1 },
  { path: "/marketplace", priority: 0.95 },
  { path: "/installer-application", priority: 0.9 },
  { path: "/solutions", priority: 0.95 },
  { path: "/services", priority: 0.9 },
  { path: "/contact", priority: 0.85 },
  { path: "/a-propos", priority: 0.8 },
  { path: "/client/register", priority: 0.75 },
  { path: "/client/login", priority: 0.7 },
  { path: "/mot-de-passe-oublie", priority: 0.6 },
  { path: "/register", priority: 0.8 },
  { path: "/login", priority: 0.7 },
  { path: "/client/laboratoires", priority: 0.75 },
  { path: "/resultats-laboratoire", priority: 0.65 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return publicRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.path === "/" || route.path === "/marketplace" ? "daily" : "weekly",
    priority: route.priority,
  }));
}
