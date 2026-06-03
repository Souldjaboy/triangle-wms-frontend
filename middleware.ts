import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/super-admin",
  "/chat",
  "/recherche",
  "/assistant",
  "/notifications",
  "/produits",
  "/partenaires",
  "/stocks",
  "/inventaires",
  "/entrepots",
  "/emplacements",
  "/scanner",
  "/pos",
  "/comptabilite",
  "/documents",
  "/rapports",
  "/alertes",
  "/activites",
  "/utilisateurs",
  "/badges",
  "/attendance-scan",
  "/pointage",
  "/parametres-pointage",
  "/parametres",
];

const moduleRouteMap: Record<string, string> = {
  "/assistant": "ia",
  "/produits": "produits",
  "/stocks": "stock",
  "/entrepots": "entrepots",
  "/emplacements": "emplacements",
  "/scanner": "stock",
  "/pos": "pos",
  "/pos/ventes": "ventes",
  "/pos/historique": "ventes",
  "/pos/recus": "ventes",
  "/pos/paiements": "ventes",
  "/pos/parametres-paiement": "paiements",
  "/comptabilite": "comptabilite",
  "/inventaires": "inventaire",
  "/documents": "documents",
  "/rapports": "rapports",
  "/attendance-scan": "pointage",
  "/pointage": "pointage",
  "/parametres-pointage": "pointage",
  "/partenaires": "partenaires",
};

function readJwtPayload(token: string) {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

function readModulesCookie(value?: string) {
  if (!value) return null;

  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get("triangle_token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const payload = readJwtPayload(token);
  const role = String(payload?.role || "").toLowerCase();
  const isSuperAdminCookie = req.cookies.get("triangle_super_admin")?.value;
  const tokenSaysSuperAdmin =
    payload?.is_super_admin === true ||
    payload?.is_super_admin === "true" ||
    payload?.is_super_admin === 1 ||
    role === "super_admin";
  const isAdmin = tokenSaysSuperAdmin || role === "admin";
  const isDirection = role === "directeur" || role === "direction";
  const subscriptionStatus = String(
    req.cookies.get("triangle_subscription_status")?.value || payload?.subscription_status || ""
  ).toLowerCase();
  const modules = readModulesCookie(req.cookies.get("triangle_modules")?.value);
  const subscriptionBlocked = [
    "expired",
    "expiré",
    "expire",
    "suspended",
    "suspendu",
    "inactive",
    "inactif"
  ].includes(subscriptionStatus);

  if (pathname.startsWith("/super-admin")) {
    if (isSuperAdminCookie !== "true" && !tokenSaysSuperAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  if (!tokenSaysSuperAdmin && subscriptionBlocked) {
    return NextResponse.redirect(new URL("/abonnement-expire", req.url));
  }

  if (!tokenSaysSuperAdmin && modules) {
    const matchedModule = Object.entries(moduleRouteMap)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([route]) => pathname === route || pathname.startsWith(route + "/"))?.[1];

    if (matchedModule && modules[matchedModule] === false) {
      return NextResponse.redirect(
        new URL(`/dashboard?module=${matchedModule}`, req.url)
      );
    }
  }

  if (
    pathname.startsWith("/parametres") ||
    pathname.startsWith("/parametres-pointage") ||
    pathname.startsWith("/pos/parametres-paiement")
  ) {
    if (!isAdmin) {
      return NextResponse.redirect(
        new URL("/dashboard?access=admin", req.url)
      );
    }
  }

  if (pathname.startsWith("/documents") || pathname.startsWith("/rapports")) {
    if (!isAdmin && !isDirection) {
      return NextResponse.redirect(
        new URL("/dashboard?access=direction", req.url)
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/super-admin/:path*",
    "/chat/:path*",
    "/recherche/:path*",
    "/assistant/:path*",
    "/notifications/:path*",
    "/produits/:path*",
    "/partenaires/:path*",
    "/stocks/:path*",
    "/inventaires/:path*",
    "/entrepots/:path*",
    "/emplacements/:path*",
    "/scanner/:path*",
    "/pos/:path*",
    "/comptabilite/:path*",
    "/documents/:path*",
    "/rapports/:path*",
    "/alertes/:path*",
    "/activites/:path*",
    "/utilisateurs/:path*",
    "/badges/:path*",
    "/attendance-scan/:path*",
    "/pointage/:path*",
    "/parametres-pointage/:path*",
    "/parametres/:path*",
  ],
};
