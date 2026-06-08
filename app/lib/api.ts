"use client";

export function apiUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
  const cleanBase = baseUrl.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return `${cleanBase}${cleanPath}`;
}

export function getAuthToken() {
  if (typeof window === "undefined") return "";

  const pathname = window.location.pathname || "";
  const isClientSpace =
    pathname.startsWith("/client") ||
    pathname.startsWith("/marketplace/cart") ||
    pathname.startsWith("/marketplace/checkout") ||
    pathname.startsWith("/marketplace/orders");
  const preferredKey = isClientSpace ? "client_token" : "business_token";
  const fallbackKey = isClientSpace ? "business_token" : "client_token";

  const localToken =
    localStorage.getItem(preferredKey) ||
    (!isClientSpace ? localStorage.getItem("admin_token") : "") ||
    localStorage.getItem("token") ||
    localStorage.getItem(fallbackKey) ||
    "";
  if (localToken) return localToken;

  const preferredCookie = isClientSpace ? "triangle_client_token=" : "triangle_business_token=";
  const cookieToken = document.cookie
    .split("; ")
    .find((item) => item.startsWith(preferredCookie) || item.startsWith("triangle_token="))
    ?.split("=")[1];

  return cookieToken ? decodeURIComponent(cookieToken) : "";
}

export function authHeaders(extraHeaders: HeadersInit = {}) {
  const token = getAuthToken();
  const headers = new Headers(extraHeaders);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const activeCompanyId =
    typeof window !== "undefined" ? localStorage.getItem("active_company_id") || "" : "";
  if (activeCompanyId) {
    headers.set("x-active-company-id", activeCompanyId);
  }

  return headers;
}

export async function authFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: authHeaders(options.headers || {}),
  });

  if (
    typeof window !== "undefined" &&
    (response.status === 401 || response.status === 403)
  ) {
    const payload = await response.clone().json().catch(() => ({}));
    const message = String(payload?.error || "").toLowerCase();

    if (
      response.status === 401 ||
      message.includes("token") ||
      message.includes("auth")
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("client_token");
      localStorage.removeItem("client_user");
      localStorage.removeItem("business_token");
      localStorage.removeItem("business_user");
      localStorage.removeItem("admin_token");
      document.cookie = "triangle_token=; path=/; max-age=0";
      document.cookie = "triangle_client_token=; path=/; max-age=0";
      document.cookie = "triangle_business_token=; path=/; max-age=0";
      document.cookie = "triangle_super_admin=; path=/; max-age=0";
      document.cookie = "triangle_subscription_status=; path=/; max-age=0";
      const pathname = window.location.pathname;
      window.location.href =
        pathname.startsWith("/client") || pathname.startsWith("/marketplace")
          ? "/client/login"
          : "/login";
    }
  }

  return response;
}
