import type { Metadata } from "next";
import { productConfig } from "../lib/product-config";
import { absoluteUrl } from "../lib/seo";

export const metadata: Metadata = {
  title: productConfig.product === "malilink" ? "Marketplace MaliLink Global" : "Marketplace Mali",
  description:
    productConfig.product === "malilink"
      ? "Marketplace publique MaliLink Global pour produits, services, restaurants, hôtels, laboratoires, immobilier, automobile et entreprises africaines."
      : "Marketplace publique pour produits, services, restaurants, hôtels, laboratoires, immobilier, automobile et entreprises au Mali.",
  alternates: { canonical: "/marketplace" },
  openGraph: {
    title: productConfig.product === "malilink" ? "Marketplace MaliLink Global" : "Marketplace au Mali",
    description:
      "Trouvez les produits et services publiés volontairement par les entreprises : pharmacie, restaurant, hôtel, automobile, immobilier et logistique.",
    url: absoluteUrl("/marketplace"),
  },
};

export default function MarketplaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
