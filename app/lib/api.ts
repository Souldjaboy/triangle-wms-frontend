"use client";

export function apiUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
  const cleanBase = baseUrl.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return `${cleanBase}${cleanPath}`;
}
