"use client";

import { useEffect, useState } from "react";
import { authFetch } from "../../lib/api";

/**
 * LES ENTREPÔTS OÙ L'ON PEUT RÉELLEMENT RECEVOIR.
 *
 * La liste était écrite en dur : ["W-EM2S-A","W-EM2S-B","W-EM2S-C"]. Triangle
 * en possède cinq. D et E n'apparaissaient donc nulle part dans la réception,
 * et — plus grave — un produit rattaché à D voyait son entrepôt remplacé par A
 * sans un mot, parce que le code réaffectait tout ce qui n'était pas dans la
 * liste. Une réception partait dans le mauvais entrepôt sans que personne ne
 * puisse s'en apercevoir à l'écran.
 *
 * Les entrepôts viennent maintenant du serveur, qui seul connaît ceux de
 * l'entreprise active, leur état et les droits de l'utilisateur. Créer
 * W-EM2S-F demain suffira pour qu'il apparaisse : il n'y a plus de liste à
 * tenir à jour ici.
 *
 * `actifs_seulement=1` : un entrepôt archivé ne doit pas pouvoir recevoir.
 */
export function useEntrepotsAutorises() {
  const [codes, setCodes] = useState<string[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const r = await authFetch("/warehouses?actifs_seulement=1", { cache: "no-store" });
        const data = await r.json().catch(() => null);
        if (!vivant) return;
        if (!r.ok) {
          setErreur(data?.error || "Impossible de charger les entrepôts.");
          return;
        }
        const liste = Array.isArray(data) ? data : [];
        setCodes(
          liste
            .map((w: any) => String(w?.code || "").trim())
            .filter(Boolean)
            .sort((a: string, b: string) => a.localeCompare(b, "fr"))
        );
      } catch {
        if (vivant) setErreur("Impossible de charger les entrepôts.");
      } finally {
        if (vivant) setChargement(false);
      }
    })();
    return () => { vivant = false; };
  }, []);

  return { codes, chargement, erreur };
}

/**
 * Les options d'un sélecteur, en y ajoutant la valeur déjà enregistrée même si
 * elle n'est pas dans la liste. Une ligne saisie hier sur un entrepôt depuis
 * archivé doit continuer d'afficher son entrepôt : le masquer donnerait à
 * croire qu'elle en désigne un autre.
 */
export function optionsEntrepot(codes: string[], valeurActuelle?: string | null) {
  const actuelle = String(valeurActuelle || "").trim();
  return actuelle && !codes.includes(actuelle) ? [...codes, actuelle] : codes;
}
