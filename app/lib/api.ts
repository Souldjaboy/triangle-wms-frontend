"use client";

export function apiUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
  const cleanBase = baseUrl.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return `${cleanBase}${cleanPath}`;
}

export function getAuthToken() {
  if (typeof window === "undefined") return "";

  const localToken = localStorage.getItem("token") || "";
  if (localToken) return localToken;

  const cookieToken = document.cookie
    .split("; ")
    .find((item) => item.startsWith("triangle_token="))
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
      document.cookie = "triangle_token=; path=/; max-age=0";
      document.cookie = "triangle_super_admin=; path=/; max-age=0";
      document.cookie = "triangle_subscription_status=; path=/; max-age=0";
      window.location.href = "/login";
    }
  }

  return response;
}
