"use client";

import { useEffect, useState } from "react";

/**
 * Version ADAPTÉE à Triangle WMS du hook de permissions.
 * Triangle n'a pas (encore) le moteur RBAC complet : les droits d'import sont
 * dérivés du RÔLE de l'utilisateur (miroir de importRolePermission côté backend).
 * Même interface que la version MaliLink pour réutiliser ImportButton / l'assistant.
 */

const IMPORT_ROLES = ["super_admin", "admin", "administrateur", "direction", "directeur", "comptable", "manager", "gerant"];

type UserLite = { role?: string; is_super_admin?: boolean | string | number } | null;

function readUser(): UserLite {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
}

function isImporter(user: UserLite): boolean {
  if (!user) return false;
  const superAdmin = user.is_super_admin === true || user.is_super_admin === "true" || user.is_super_admin === 1;
  const role = String(user.role || "").toLowerCase().trim();
  return superAdmin || IMPORT_ROLES.includes(role);
}

export function usePermissions() {
  const [user, setUser] = useState<UserLite>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setUser(readUser()); setLoading(false); }, []);

  // Un module/sous-module est toujours "actif" côté Triangle (pas de gating par entreprise ici).
  const isEnabled = () => true;

  // Droit d'action : les clés « import » suivent le rôle ; le reste est permis.
  const can = (key: string, action?: string) => {
    void action;
    if (String(key).startsWith("import")) return isImporter(user);
    return true;
  };

  const reload = () => setUser(readUser());

  return { me: user, loading, isEnabled, can, reload };
}
