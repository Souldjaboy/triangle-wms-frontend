import type { Metadata, Viewport } from "next";
import "./globals.css";
import DashboardBackButton from "../components/DashboardBackButton";
import PWARegister from "../components/PWARegister";

export const metadata: Metadata = {
  title: "Triangle WMS Pro",
  description:
    "Système professionnel de gestion d’entrepôts, stocks, ventes, caisses et pointage",
  applicationName: "Triangle WMS Pro",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Triangle WMS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Triangle WMS",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5b400",
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
      </head>
      <body className="min-h-full flex flex-col">
        <PWARegister />
        <DashboardBackButton />
        {children}
      </body>
    </html>
  );
}
