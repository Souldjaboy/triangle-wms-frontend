import type { Metadata } from "next";
import { absoluteUrl } from "../lib/seo";

export const metadata: Metadata = {
  title: "Marketplace Mali",
  description:
    "Marketplace publique Triangle WMS Pro pour produits, services, restaurants, hôtels, laboratoires, immobilier, automobile et entreprises au Mali.",
  alternates: { canonical: "/marketplace" },
  openGraph: {
    title: "Marketplace Triangle WMS Pro au Mali",
    description:
      "Trouvez les produits et services publiés volontairement par les entreprises : pharmacie, restaurant, hôtel, automobile, immobilier et logistique.",
    url: absoluteUrl("/marketplace"),
  },
};

export default function MarketplaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
