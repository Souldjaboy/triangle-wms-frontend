"use client";

import { useEffect } from "react";

export default function ProductScanQueryPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code =
      params.get("ref") ||
      params.get("product") ||
      params.get("code") ||
      "";

    if (code) {
      window.location.replace(`/scan/product/${encodeURIComponent(code)}`);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8 text-black">
      Chargement produit...
    </div>
  );
}
