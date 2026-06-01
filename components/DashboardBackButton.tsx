"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const privatePrefixes = [
  "/pos",
  "/attendance-scan",
  "/pointage",
  "/parametres-pointage",
  "/super-admin",
  "/utilisateurs",
  "/produits",
  "/stocks",
  "/documents",
  "/rapports",
  "/parametres",
];

export default function DashboardBackButton() {
  const pathname = usePathname();
  const shouldShow =
    pathname !== "/dashboard" &&
    privatePrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

  if (!shouldShow) return null;

  return (
    <Link
      href="/dashboard"
      className="fixed left-4 top-4 z-[60] rounded-xl bg-yellow-500 px-4 py-2 font-bold text-black shadow-lg print:hidden"
    >
      Tableau de bord
    </Link>
  );
}
