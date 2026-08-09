"use client";

import { useEffect } from "react";

export default function ActiveCompanyTheme() {
  useEffect(() => {
    const applyTheme = () => {
      let companyId = localStorage.getItem("active_company_id") || "";

      if (!companyId) {
        try {
          const user = JSON.parse(localStorage.getItem("user") || "{}");
          companyId = String(user.company_id || "");
        } catch {
          companyId = "";
        }
      }

      document.documentElement.setAttribute(
        "data-active-company",
        companyId || "1"
      );
    };

    applyTheme();

    window.addEventListener("storage", applyTheme);

    return () => {
      window.removeEventListener("storage", applyTheme);
    };
  }, []);

  return null;
}
