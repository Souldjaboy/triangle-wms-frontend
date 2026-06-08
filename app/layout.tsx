import type { Metadata, Viewport } from "next";
import "./globals.css";
import DashboardBackButton from "../components/DashboardBackButton";
import PWARegister from "../components/PWARegister";
import { absoluteUrl, compactObject, defaultSeoDescription, seoBusiness, seoKeywords, siteUrl } from "./lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Triangle WMS Pro | Gestion de stock, caisse POS et marketplace au Mali",
    template: "%s | Triangle WMS Pro",
  },
  description: defaultSeoDescription,
  keywords: seoKeywords,
  applicationName: "Triangle WMS Pro",
  authors: [{ name: seoBusiness.companyName }],
  creator: seoBusiness.companyName,
  publisher: seoBusiness.companyName,
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Triangle WMS Pro",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Triangle WMS Pro | Gestion d’entreprise au Mali et en Afrique",
    description: defaultSeoDescription,
    url: siteUrl,
    siteName: "Triangle WMS Pro",
    locale: "fr_ML",
    type: "website",
    images: [
      {
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "Logo Triangle WMS Pro",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Triangle WMS Pro",
    description: defaultSeoDescription,
    images: ["/icons/icon-512x512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Triangle WMS Pro",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5b400",
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
    <html lang="fr" className="h-full antialiased">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f5b400" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512x512.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationJsonLd, localBusinessJsonLd, websiteJsonLd, softwareJsonLd]) }}
        />
        <PWARegister />
        <DashboardBackButton />
        {children}
      </body>
    </html>
  );
}
