"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "./api";

/**
 * DROITS CÔTÉ NAVIGATEUR — SOURCE UNIQUE.
 *
 * Menus, boutons et gardes de route lisent tous ici. Une page qui déciderait
 * elle-même à partir du rôle finirait par diverger du backend le jour où un
 * droit est retiré à un compte sans changer son rôle.
 *
 * Ce que dit ce module n'est qu'un affichage. Le refus qui compte est celui du
 * backend : masquer un bouton n'a jamais empêché personne d'appeler l'API.
 *
 * Le contrat historique — { perms, loading, can, reload } — est conservé : les
 * écrans qui s'en servent déjà continuent de fonctionner sans modification.
 * S'y ajoutent la visibilité des modules et le référentiel, que le nouveau
 * centre des droits utilise.
 */

export const ACTIONS = [
  "visible", "view", "create", "update", "delete", "import", "export",
  "print", "validate", "cancel", "putaway", "transfer", "reserve",
  "assign", "configure", "share", "manage",
] as const;
export type Action = (typeof ACTIONS)[number] | string;

export type ModulePermission = {
  module_key: string;
  parent_key: string | null;
  label: string;
  description: string;
  sort_order: number;
  is_system: boolean;
  actions: string[];
};

type ModulePerms = Record<string, boolean>;
export type EffectivePermissions = {
  is_super_admin: boolean;
  role?: string;
  company_id?: number | null;
  modules: Record<string, ModulePerms>;
  /* Repli appliqué aux modules absents du référentiel. */
  fallback_allowed: boolean;
  /* Référentiel hiérarchisé, vide tant que le centre des droits n'est pas
     déployé — les écrans historiques n'en ont pas besoin. */
  catalogue: ModulePermission[];
};

/* Miroir des alias du backend : un menu qui pointe « stocks » et un droit
   enregistré sur « stock » doivent désigner la même chose. */
const ALIASES: Record<string, string> = {
  stocks: "stock", inventaires: "stock.inventaire", inventaire: "stock.inventaire",
  emplacements: "stock.emplacement", emplacement: "stock.emplacement",
  produits: "produit", utilisateurs: "utilisateur", entrepots: "entrepot",
  demandes: "demande", receptions: "reception", documents: "document",
  rapports: "rapport", badges: "badge", notifications: "notification",
  assistant_ia: "ia", assistant: "ia", tresorerie: "comptabilite",
  factures: "comptabilite", camions: "logistique", clients: "crm",
  fournisseurs: "fournisseur", partenaires: "partenaire",
  ventes: "vente", achats: "achat", parametres: "parametre",
};

function normalizeModuleKey(key: string): string {
  const k = String(key || "").trim().toLowerCase().replace(/\s+/g, "_");
  return ALIASES[k] || k;
}

/** « stock.entree.x » → ["stock.entree.x", "stock.entree", "stock"]. */
function chaineDeCles(key: string): string[] {
  const morceaux = normalizeModuleKey(key).split(".");
  const out: string[] = [];
  for (let i = morceaux.length; i > 0; i -= 1) out.push(morceaux.slice(0, i).join("."));
  return out;
}

const ROLES_ADMIN = [
  "super_admin", "admin", "administrateur", "direction", "directeur", "gerant", "manager",
];

/**
 * Interroge le centre des droits, et retombe sur l'ancienne route tant qu'il
 * n'est pas déployé : le frontend peut ainsi précéder le backend sans que les
 * écrans existants perdent leurs permissions.
 */
async function charger(): Promise<EffectivePermissions | null> {
  try {
    const r = await authFetch("/permissions/me", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      return {
        is_super_admin: d.is_super_admin === true,
        role: d.role || "",
        company_id: d.company_id ?? null,
        modules: d.permissions || {},
        fallback_allowed:
          d.is_super_admin === true ||
          ROLES_ADMIN.includes(String(d.role || "").toLowerCase().trim()),
        catalogue: Array.isArray(d.modules) ? d.modules : [],
      };
    }
  } catch { /* on tente l'ancienne route */ }

  try {
    const r = await authFetch("/me/permissions", { cache: "no-store" });
    if (!r.ok) return null;
    const d = await r.json();
    return {
      is_super_admin: d.is_super_admin === true,
      role: d.role || "",
      modules: d.modules || {},
      fallback_allowed: d.fallback_allowed === true,
      catalogue: [],
    };
  } catch {
    return null;
  }
}

export function usePermissions() {
  const [perms, setPerms] = useState<EffectivePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    charger()
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

  const resoudre = useCallback(
    (moduleKey: string, action: Action): boolean => {
      /* Avant chargement on ne masque rien : un menu qui clignote à chaque
         navigation coûte plus cher qu'un bouton visible une seconde de trop,
         et le backend refuse de toute façon ce qui n'est pas permis. */
      if (!perms) return true;
      if (perms.is_super_admin) return true;

      for (const cle of chaineDeCles(moduleKey)) {
        const mod = perms.modules[cle];
        if (mod && action in mod) return mod[action] === true;
      }
      /* Module absent du référentiel : comportement historique. */
      return perms.fallback_allowed;
    },
    [perms]
  );

  /** can("stock.entree", "create") — même verdict que le backend. */
  const can = useCallback(
    (moduleKey: string, action: Action = "view") => resoudre(moduleKey, action),
    [resoudre]
  );

  /**
   * Un module masqué disparaît du menu et de la navigation. Son URL et ses
   * routes API sont refusées côté serveur, indépendamment de cet appel.
   */
  const isModuleVisible = useCallback(
    (moduleKey: string) => {
      if (!perms) return true;
      if (perms.is_super_admin) return true;
      for (const cle of chaineDeCles(moduleKey)) {
        const mod = perms.modules[cle];
        if (mod && "visible" in mod) return mod.visible === true;
        if (mod && "view" in mod) return mod.view === true;
      }
      return perms.fallback_allowed;
    },
    [perms]
  );

  const catalogue = useMemo(() => perms?.catalogue ?? [], [perms]);

  return { perms, loading, can, isModuleVisible, catalogue, reload: load };
}

/** Prévient tous les écrans montés qu'un droit vient de changer. */
export function signalerChangementDroits() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("triangle-permissions-updated"));
  }
}
