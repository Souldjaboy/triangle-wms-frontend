import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:5050"}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        /* Le manifeste doit être revalidé à chaque chargement : c'est lui qui
           annonce les icônes de l'application installée. Mis en cache, un
           changement de logo n'atteint jamais les appareils existants. */
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" }],
      },
      {
        /* Les icônes portent un numéro de version dans leur nom : leur contenu
           ne change jamais pour une URL donnée, un cache long est donc sûr. */
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
