"use client";

import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";

type Company = {
  id: number;
  name: string;
  business_type?: string;
  status?: string;
  logo_url?: string;
};

export default function CompanySwitcher() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [current, setCurrent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let companyId = "";

    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      companyId =
        localStorage.getItem("active_company_id") ||
        String(user.company_id || "");
    } catch {
      companyId = localStorage.getItem("active_company_id") || "";
    }

    setCurrent(companyId);

    authFetch("/companies/available")
      .then(async (response) => {
        const data = await response.json().catch(() => []);

        if (!response.ok) {
          throw new Error(data?.error || "Chargement impossible");
        }

        const list = Array.isArray(data) ? data : [];
        setCompanies(list);

        if (!companyId && list.length > 0) {
          setCurrent(String(list[0].id));
        }
      })
      .catch((error) => {
        console.error("Erreur entreprises :", error);
        setCompanies([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeCompany = useMemo(
    () => companies.find((company) => String(company.id) === current),
    [companies, current]
  );

  const isFatMat = Number(current) === 5;

  function changeCompany(companyId: string) {
    if (!companyId || companyId === current) return;

    localStorage.setItem("active_company_id", companyId);
    setCurrent(companyId);

    window.location.href = "/dashboard";
  }

  if (loading || companies.length <= 1) return null;

  return (
    <div
      className={[
        "flex min-w-[330px] items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm transition",
        isFatMat
          ? "border-neutral-800 bg-neutral-950 text-white"
          : "border-yellow-300 bg-white text-black",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border",
          isFatMat
            ? "border-white/30 bg-white"
            : "border-yellow-400 bg-gray-50",
        ].join(" ")}
      >
        {activeCompany?.logo_url ? (
          <img
            src={activeCompany.logo_url}
            alt={activeCompany.name}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-lg font-black">
            {activeCompany?.name?.slice(0, 2) || "EN"}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <label
          htmlFor="active-company"
          className={[
            "mb-1 block text-[10px] font-bold uppercase tracking-[0.18em]",
            isFatMat ? "text-neutral-400" : "text-gray-500",
          ].join(" ")}
        >
          Entreprise active
        </label>

        <select
          id="active-company"
          value={current}
          onChange={(event) => changeCompany(event.target.value)}
          className={[
            "w-full cursor-pointer bg-transparent text-base font-black outline-none",
            isFatMat ? "text-white" : "text-black",
          ].join(" ")}
        >
          {companies.map((company) => (
            <option
              key={company.id}
              value={company.id}
              className="bg-white text-black"
            >
              {company.name}
            </option>
          ))}
        </select>

        <div
          className={[
            "mt-1 truncate text-xs",
            isFatMat ? "text-neutral-400" : "text-gray-500",
          ].join(" ")}
        >
          {activeCompany?.business_type || "Gestion d’entreprise"}
        </div>
      </div>
    </div>
  );
}
