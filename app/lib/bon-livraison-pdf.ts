"use client";

/**
 * TÉLÉCHARGER, PARTAGER, ENVOYER — UN SEUL PDF.
 *
 * Le navigateur ne fabrique aucun document : il demande au serveur celui que
 * l'email joindra et que le téléphone partagera. Générer le PDF ici aussi
 * donnerait deux documents qui se ressemblent, divergent à la première
 * retouche de mise en page, et se contredisent le jour où un client compare
 * son exemplaire avec celui du classeur.
 */

import { apiUrl, authHeaders } from "./api";

export type FamilleBon = "sable" | "ciment" | "document";

type Pdf = { blob: Blob; nom: string };

/** Le nom du fichier annoncé par le serveur, sans le réinventer ici. */
function nomDepuisEntete(entete: string | null, secours: string): string {
  if (!entete) return secours;
  /* `filename*=UTF-8''…` d'abord : c'est la forme qui survit aux accents. */
  const etoile = /filename\*=UTF-8''([^;]+)/i.exec(entete);
  if (etoile) { try { return decodeURIComponent(etoile[1]); } catch { /* on tentera l'autre */ } }
  const simple = /filename="?([^";]+)"?/i.exec(entete);
  return simple ? simple[1] : secours;
}

/** Va chercher le PDF, une fois, et le garde le temps de l'action en cours. */
export async function obtenirPdfBon(famille: FamilleBon, id: number | string): Promise<Pdf> {
  const reponse = await fetch(apiUrl(`/bons-livraison/${famille}/${id}/pdf`), {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!reponse.ok) {
    /* Le serveur répond en JSON quand il refuse : on relaie SON message
       plutôt qu'un « erreur » générique qui n'aide personne. */
    let message = "Le PDF n’a pas pu être produit.";
    try {
      const d = await reponse.json();
      if (d?.error) message = d.error;
    } catch { /* réponse non JSON : on garde le message par défaut */ }
    throw new Error(message);
  }

  const blob = await reponse.blob();
  const nom = nomDepuisEntete(
    reponse.headers.get("Content-Disposition"),
    `BL_${id}.pdf`
  );
  return { blob, nom };
}

/**
 * TÉLÉCHARGER — et rien d'autre.
 *
 * Surtout pas `window.print()` : « Télécharger PDF » ouvrait jusqu'ici la même
 * fenêtre d'impression que le bouton « Imprimer », si bien qu'on ne pouvait
 * pas obtenir le fichier sans passer par une boîte de dialogue, ni imprimer
 * sans croire qu'on téléchargeait.
 */
export async function telechargerPdfBon(famille: FamilleBon, id: number | string): Promise<string> {
  const { blob, nom } = await obtenirPdfBon(famille, id);
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  /* Libérer tout de suite couperait le téléchargement sur certains
     navigateurs : on laisse le temps au transfert de démarrer. */
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return nom;
}

export type ResultatPartage =
  | { mode: "partage"; nom: string }
  | { mode: "telecharge"; nom: string; raison: string }
  | { mode: "annule" };

/**
 * PARTAGER LE FICHIER, PAS UN LIEN.
 *
 * Un lien oblige le destinataire à se connecter à l'application pour voir le
 * bon — ce qu'un client n'a ni le compte ni l'envie de faire. Ce qu'il attend,
 * c'est le document.
 *
 * Quand le navigateur ne sait pas partager un fichier, on ne retombe pas en
 * silence sur le lien : on télécharge le PDF et on DIT à la personne ce qui
 * s'est passé, pour qu'elle puisse le joindre elle-même.
 */
export async function partagerPdfBon(
  famille: FamilleBon,
  id: number | string,
  texte?: { titre?: string; message?: string }
): Promise<ResultatPartage> {
  const { blob, nom } = await obtenirPdfBon(famille, id);
  const fichier = new File([blob], nom, { type: "application/pdf" });

  const peutPartagerDesFichiers =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [fichier] });

  if (peutPartagerDesFichiers) {
    try {
      await navigator.share({
        files: [fichier],
        title: texte?.titre || nom,
        text: texte?.message || "",
      });
      return { mode: "partage", nom };
    } catch (e: unknown) {
      /* Fermer la feuille de partage n'est pas une panne : on ne télécharge
         pas derrière le dos de quelqu'un qui vient de renoncer. */
      if (e instanceof DOMException && e.name === "AbortError") return { mode: "annule" };
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url; lien.download = nom;
      document.body.appendChild(lien); lien.click(); lien.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return {
        mode: "telecharge", nom,
        raison: "Le partage a échoué. Le PDF a été téléchargé : vous pouvez le joindre depuis vos fichiers.",
      };
    }
  }

  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url; lien.download = nom;
  document.body.appendChild(lien); lien.click(); lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return {
    mode: "telecharge", nom,
    raison:
      "Ce navigateur ne sait pas partager un fichier directement. Le PDF a été "
      + "téléchargé : joignez-le depuis WhatsApp ou votre messagerie.",
  };
}

/**
 * WHATSAPP.
 *
 * Le partage natif reste la seule voie qui dépose le FICHIER dans la
 * conversation : `wa.me` ne sait transporter qu'un texte, jamais une pièce
 * jointe. Quand il n'est pas disponible, on télécharge le PDF et on le dit —
 * plutôt que d'envoyer un lien que le destinataire ne pourra pas ouvrir.
 */
export async function envoyerBonParWhatsApp(
  famille: FamilleBon,
  id: number | string,
  numero?: string,
  message?: string
): Promise<ResultatPartage> {
  const resultat = await partagerPdfBon(famille, id, {
    titre: `Bon de livraison ${numero || ""}`.trim(),
    message: message || `Veuillez trouver le bon de livraison ${numero || ""}.`.trim(),
  });

  if (resultat.mode === "telecharge") {
    return {
      ...resultat,
      raison:
        "Le PDF a été téléchargé. Ouvrez WhatsApp et joignez-le à votre "
        + "conversation : ce navigateur ne peut pas y déposer le fichier lui-même.",
    };
  }
  return resultat;
}
