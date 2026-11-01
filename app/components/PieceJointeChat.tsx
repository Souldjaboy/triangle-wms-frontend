"use client";

/**
 * UNE PIÈCE JOINTE DU CHAT, RÉCUPÉRÉE AVEC LE JETON DE LA SESSION.
 *
 * POURQUOI PASSER PAR UNE REQUÊTE PLUTÔT QUE PAR UN SIMPLE LIEN.
 *
 * Le chat posait `href={message.file_url}`, c'est-à-dire « /uploads/chat/… ».
 * Le navigateur demandait cette adresse à l'origine du FRONTEND, qui ne
 * réécrit que « /api/:path* » vers le serveur : réponse 404. C'était le
 * défaut visible au clic sur un classeur Excel.
 *
 * Préfixer par « /api » suffirait à joindre le serveur, mais une navigation
 * ordinaire n'emporte pas l'en-tête `Authorization` : elle ne transporterait
 * que le cookie. Or le jeton de cette application vit aussi dans le stockage
 * local. Une pièce jointe s'ouvrirait donc chez les uns et pas chez les
 * autres, selon l'état du cookie — un défaut intermittent, le pire à
 * diagnostiquer.
 *
 * On récupère donc le fichier par `authFetch`, qui porte le jeton à coup sûr,
 * puis on l'ouvre depuis la mémoire du navigateur. Avantage secondaire :
 * l'adresse du fichier ne reste pas dans l'historique de navigation.
 *
 * Les adresses anciennes (« /uploads/chat/… ») fonctionnent toujours : le
 * serveur les garde avec les mêmes contrôles.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../lib/api";

/** Les types que l'on affiche directement ; le reste se télécharge. */
const AFFICHABLES = /^(image\/|video\/|audio\/|application\/pdf|text\/plain)/;

type Etat = "repos" | "chargement" | "pret" | "erreur";

/**
 * Récupère une pièce jointe et en fait une adresse utilisable par <img>,
 * <video> ou <a>. L'adresse est libérée quand le composant disparaît : sans
 * cela, chaque fichier ouvert resterait en mémoire jusqu'au rechargement de
 * la page.
 */
export function usePieceJointe(fileUrl: string | null | undefined) {
  const [adresse, setAdresse] = useState<string | null>(null);
  const [etat, setEtat] = useState<Etat>("repos");
  const [erreur, setErreur] = useState("");
  const objet = useRef<string | null>(null);

  const liberer = useCallback(() => {
    if (objet.current) {
      URL.revokeObjectURL(objet.current);
      objet.current = null;
    }
  }, []);

  useEffect(() => liberer, [liberer]);

  const charger = useCallback(async () => {
    if (!fileUrl || etat === "chargement") return null;
    if (objet.current) return objet.current;
    setEtat("chargement"); setErreur("");
    try {
      const r = await authFetch(fileUrl);
      if (!r.ok) {
        /* Le serveur répond la même chose pour « inexistant » et « pas pour
           vous » : distinguer les deux apprendrait quels noms sont valides. */
        let message = "Pièce jointe introuvable ou inaccessible.";
        try {
          const d = await r.json();
          if (d?.error) message = d.error;
        } catch { /* corps non JSON */ }
        setEtat("erreur"); setErreur(message);
        return null;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      objet.current = url;
      setAdresse(url); setEtat("pret");
      return url;
    } catch {
      setEtat("erreur");
      setErreur("Le fichier n'a pas pu être récupéré.");
      return null;
    }
  }, [fileUrl, etat]);

  return { adresse, etat, erreur, charger, liberer };
}

/** Le nom du fichier, raccourci sans perdre son extension. */
function nomCourt(nom: string, max = 42) {
  if (nom.length <= max) return nom;
  const point = nom.lastIndexOf(".");
  const ext = point > 0 ? nom.slice(point) : "";
  return `${nom.slice(0, max - ext.length - 1)}…${ext}`;
}

export default function PieceJointeChat({
  fileUrl, fileName, fileMime, fileSize, surFondSombre = false,
}: {
  fileUrl: string;
  fileName?: string | null;
  fileMime?: string | null;
  fileSize?: number | null;
  surFondSombre?: boolean;
}) {
  const { adresse, etat, erreur, charger } = usePieceJointe(fileUrl);
  const nom = fileName || "Pièce jointe";
  const mime = String(fileMime || "");
  const affichable = AFFICHABLES.test(mime);

  /* Les images et vidéos se chargent d'elles-mêmes : on les voit dans le fil
     sans avoir à cliquer. Les documents attendent un clic — en charger
     cinquante en arrivant sur une conversation serait du gaspillage. */
  useEffect(() => {
    if (affichable && mime.startsWith("image/")) charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affichable, mime]);

  const ouvrir = async () => {
    const url = adresse || (await charger());
    if (!url) return;
    if (affichable) {
      window.open(url, "_blank", "noopener");
    } else {
      /* Un type non affichable se télécharge sous son VRAI nom, celui que la
         personne reconnaîtra — pas le nom de stockage. */
      const a = document.createElement("a");
      a.href = url; a.download = nom;
      document.body.appendChild(a); a.click(); a.remove();
    }
  };

  const classeTexte = surFondSombre ? "text-white/80" : "text-gray-600";

  if (mime.startsWith("image/")) {
    return (
      <div>
        {adresse ? (
          <button type="button" onClick={ouvrir} className="block">
            <img src={adresse} alt={nom}
              className="max-h-80 max-w-full rounded-xl object-contain" />
          </button>
        ) : (
          <div className={`rounded-xl border border-dashed p-6 text-center text-sm ${classeTexte}`}>
            {etat === "chargement" ? "Chargement de l'image…" : erreur || "Image"}
          </div>
        )}
        <div className={`mt-2 text-xs ${classeTexte}`}>{nomCourt(nom)}</div>
      </div>
    );
  }

  if (mime.startsWith("video/") || mime.startsWith("audio/")) {
    const Balise = mime.startsWith("video/") ? "video" : "audio";
    return (
      <div>
        {adresse ? (
          <Balise controls src={adresse}
            className={mime.startsWith("video/")
              ? "max-h-80 max-w-full rounded-xl"
              : "w-full max-w-sm"} />
        ) : (
          <button type="button" onClick={() => charger()}
            className="rounded-xl border px-3 py-2 text-sm font-bold">
            {etat === "chargement" ? "Chargement…" : `▶ Écouter / voir — ${nomCourt(nom)}`}
          </button>
        )}
        {erreur && <div className="mt-1 text-xs text-red-600">{erreur}</div>}
        <div className={`mt-2 text-xs ${classeTexte}`}>{nomCourt(nom)}</div>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={ouvrir}
        className="block w-full rounded-xl border border-current/20 p-3 text-left font-bold underline">
        📎 {nomCourt(nom)}
        {fileSize ? (
          <span className={`ml-2 text-xs font-normal ${classeTexte}`}>
            {Math.max(1, Math.round(Number(fileSize) / 1024))} Ko
          </span>
        ) : null}
        {etat === "chargement" && (
          <span className={`ml-2 text-xs font-normal ${classeTexte}`}>chargement…</span>
        )}
      </button>
      {erreur && <div className="mt-1 text-xs text-red-600">{erreur}</div>}
    </div>
  );
}
