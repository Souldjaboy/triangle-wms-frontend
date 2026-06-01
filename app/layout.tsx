import type { Metadata } from "next";
import "./globals.css";
import DashboardBackButton from "../components/DashboardBackButton";

export const metadata: Metadata = {
  title: "Triangle WMS Pro",
  description: "Gestion WMS, stocks, entrepôts et pointage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <DashboardBackButton />
        {children}
      </body>
    </html>
  );
}
