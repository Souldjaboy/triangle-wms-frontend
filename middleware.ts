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

function readJwtPayload(token: string) {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
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

  if (pathname.startsWith("/super-admin")) {
    const isSuperAdmin = req.cookies.get("triangle_super_admin")?.value;
    const payload = readJwtPayload(token);
    const role = String(payload?.role || "").toLowerCase();
    const tokenSaysSuperAdmin =
      payload?.is_super_admin === true ||
      payload?.is_super_admin === "true" ||
      payload?.is_super_admin === 1 ||
      role === "super_admin";

    if (isSuperAdmin !== "true" && !tokenSaysSuperAdmin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
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
