"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "./api";

/**
 * RBAC Triangle côté frontend — MÊME SOURCE DE VÉRITÉ que le backend.
 *
 * Les permissions sont lues via GET /me/permissions à chaque montage (PHASE 31 :
 * propagation immédiate — elles ne proviennent PAS du JWT, donc une modification
 * par le Super Admin est effective dès le rechargement suivant).
 *
 * Règle (identique au backend) :
 *   case cochée   = action autorisée
 *   case décochée = action refusée
 *   module non configuré = repli sur le rôle (fallback_allowed)
 */

export const ACTIONS = ["view", "create", "update", "delete", "validate"] as const;
export type Action = (typeof ACTIONS)[number];

type ModulePerms = Record<string, boolean>;
export type EffectivePermissions = {
  is_super_admin: boolean;
  role?: string;
  modules: Record<string, ModulePerms>;
  fallback_allowed: boolean;
};

// Aliases : miroir de normalizeModuleKey() du backend (évite les doublons).
const ALIASES: Record<string, string> = {
  stocks: "stock", inventaires: "inventaire", emplacements: "emplacement",
  produits: "produit", utilisateurs: "utilisateur", entrepots: "entrepot",
  demandes: "demande", receptions: "reception", documents: "document",
  rapports: "rapport", assistant_ia: "ia", assistant: "ia",
  tresorerie: "comptabilite", factures: "comptabilite", camions: "logistique",
};
function normalizeModuleKey(key: string): string {
  const k = String(key || "").trim().toLowerCase().replace(/\s+/g, "_");
  return ALIASES[k] || k;
}

export function usePermissions() {
  const [perms, setPerms] = useState<EffectivePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    authFetch("/me/permissions", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as EffectivePermissions) : null))
      .then(setPerms)
      .catch(() => setPerms(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const onUpdate = () => load();
    window.addEventListener("triangle-permissions-updated", onUpdate);
    return () => window.removeEventListener("triangle-permissions-updated", onUpdate);
  }, [load]);

  /** can("stock", "validate") — identique au verdict backend. */
  const can = useCallback(
    (moduleKey: string, action: Action = "view"): boolean => {
      if (!perms) return true; // avant chargement : ne rien masquer (évite le clignotement)
      if (perms.is_super_admin) return true;
      const root = normalizeModuleKey(String(moduleKey).split(".")[0]);
      const mod = perms.modules[normalizeModuleKey(moduleKey)] || perms.modules[root];
      if (!mod) return perms.fallback_allowed; // module non configuré -> repli rôle
      return mod[action] === true;
    },
    [perms]
  );

  return { perms, loading, can, reload: load };
}
