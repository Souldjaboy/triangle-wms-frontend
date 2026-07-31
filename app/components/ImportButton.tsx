"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Upload } from "lucide-react";
import { usePermissions } from "../lib/permissions";

/**
 * Bouton « Importer un fichier » à placer dans un module.
 * - visible seulement avec la permission import.create ;
 * - ouvre l'assistant avec le profil présélectionné ;
 * - revient au module après l'importation (?back).
 */
export default function ImportButton({ profile, label = "Importer un fichier", className = "" }: { profile: string; label?: string; className?: string }) {
  const { can } = usePermissions();
  const pathname = usePathname();
  if (!can("import", "create")) return null;
  const href = `/import?type=${encodeURIComponent(profile)}&back=${encodeURIComponent(pathname || "/dashboard")}`;
  return (
    <Link
      href={href}
      className={className || "inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"}
    >
      <Upload size={16} /> {label}
    </Link>
  );
}
