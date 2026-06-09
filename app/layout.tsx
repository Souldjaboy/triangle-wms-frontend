import type { Metadata, Viewport } from "next";
import "./globals.css";
import DashboardBackButton from "../components/DashboardBackButton";
import PWARegister from "../components/PWARegister";
import ProductAvailabilityGuard from "../components/ProductAvailabilityGuard";
import { productConfig } from "./lib/product-config";
import { absoluteUrl, compactObject, defaultSeoDescription, seoBusiness, seoKeywords, siteUrl } from "./lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${productConfig.name} | ${productConfig.slogan}`,
    template: `%s | ${productConfig.name}`,
  },
  description: defaultSeoDescription,
  keywords: seoKeywords,
  applicationName: productConfig.name,
  authors: [{ name: seoBusiness.companyName }],
  creator: seoBusiness.companyName,
  publisher: seoBusiness.companyName,
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: productConfig.shortName,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: productConfig.faviconUrl, sizes: "any", type: "image/svg+xml" },
      { url: productConfig.logoUrl, sizes: "any", type: "image/svg+xml" },
    ],
    apple: [
      { url: productConfig.appleTouchIconUrl, sizes: "512x512", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: `${productConfig.name} | ${productConfig.slogan}`,
    description: defaultSeoDescription,
    url: siteUrl,
    siteName: productConfig.name,
    locale: "fr_ML",
    type: "website",
    images: [
      {
        url: productConfig.logoUrl,
        width: 512,
        height: 512,
        alt: `Logo ${productConfig.name}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: productConfig.name,
    description: defaultSeoDescription,
    images: [productConfig.logoUrl],
  },
  robots: {
    index: productConfig.publicIndexing,
    follow: productConfig.publicIndexing,
    googleBot: {
      index: productConfig.publicIndexing,
      follow: productConfig.publicIndexing,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": productConfig.shortName,
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: productConfig.theme.themeColor,
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const organizationJsonLd = compactObject({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: seoBusiness.companyName,
  alternateName: seoBusiness.appName,
  url: siteUrl,
  logo: seoBusiness.logo,
  email: seoBusiness.email,
  telephone: seoBusiness.phone,
  address: {
    "@type": "PostalAddress",
    streetAddress: seoBusiness.district,
    addressLocality: seoBusiness.city,
    addressCountry: seoBusiness.country,
  },
});

const localBusinessJsonLd = compactObject({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: seoBusiness.companyName,
  url: siteUrl,
  image: seoBusiness.logo,
  email: seoBusiness.email,
  telephone: seoBusiness.phone,
  address: {
    "@type": "PostalAddress",
    streetAddress: seoBusiness.district,
    addressLocality: seoBusiness.city,
    addressCountry: seoBusiness.country,
  },
  areaServed: ["Mali", "Afrique de l’Ouest", "Afrique"],
});

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: seoBusiness.appName,
  url: siteUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: `${absoluteUrl("/marketplace")}?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: seoBusiness.appName,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Android, iOS",
  url: siteUrl,
  image: seoBusiness.logo,
  description: defaultSeoDescription,
  offers: {
    "@type": "Offer",
    category: "SaaS",
    priceCurrency: "XOF",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased" data-product={productConfig.product}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content={productConfig.theme.themeColor} />
        <link rel="icon" href={productConfig.faviconUrl} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={productConfig.appleTouchIconUrl} />
      </head>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationJsonLd, localBusinessJsonLd, websiteJsonLd, softwareJsonLd]) }}
        />
        <PWARegister />
        <DashboardBackButton />
        <ProductAvailabilityGuard>{children}</ProductAvailabilityGuard>
      </body>
    </html>
  );
}
