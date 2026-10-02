"use client";

import { useEffect, useRef, useState } from "react";
import { api, capturerImage, champsAppareil, fermerCamera, ouvrirCamera } from "../lib/biometrie";

/**
 * POINTAGE « BADGE + VISAGE » — le mode recommandé.
 *
 * Le badge QR v2 (jeton aléatoire) désigne l'employé ; le visage confirme que
 * c'est bien lui (vérification 1:1, sur un appareil déclaré, avec un défi à
 * usage unique). Le pointage est écrit par le MÊME moteur que le scan QR :
 * périmètre d'opérateur, anti-rebond, ordre des étapes. L'image est envoyée
 * une fois pour comparaison, jamais conservée. En cas d'échec, le badge seul
 * ou le pointage manuel restent disponibles.
 */

export type ResultatVisage = {
  ok: boolean;
  message: string;
  nom?: string;
  action?: string;
  repetition?: boolean;
  retard?: number;
};

type Props = {
  badge: string;
  onTermine: (resultat: ResultatVisage) => void;
};

export default function PointageVisage({ badge, onTermine }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const flux = useRef<MediaStream | null>(null);
  const [etat, setEtat] = useState<"camera" | "envoi" | "erreur">("camera");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        if (video.current) flux.current = await ouvrirCamera(video.current, "user");
      } catch (e) {
        if (!annule) {
          setEtat("erreur");
          setErreur(e instanceof Error ? e.message : "Caméra indisponible.");
        }
      }
    })();
    return () => {
      annule = true;
      fermerCamera(flux.current);
    };
  }, []);

  const verifier = async () => {
    if (!video.current) return;
    setEtat("envoi");
    const image = capturerImage(video.current);
    fermerCamera(flux.current);
    flux.current = null;
    const appareil = champsAppareil();
    const defi = await api("/biometrics/challenges", {
      method: "POST",
      body: JSON.stringify({ biometric_type: "face", purpose: "pointage", badge, ...appareil }),
    });
    if (!defi.ok) {
      onTermine({ ok: false, message: defi.data?.error || "Défi refusé." });
      return;
    }
    const r = await api("/biometrics/attendance", {
      method: "POST",
      body: JSON.stringify({
        badge, biometric_type: "face", capture: { image_base64: image },
        challenge: { challenge_id: defi.data.challenge_id, nonce: defi.data.nonce }, ...appareil,
      }),
    });
    if (!r.ok) {
      onTermine({ ok: false, message: r.data?.error || "Visage non confirmé : utilisez le badge seul ou le pointage manuel." });
      return;
    }
    const repetition = r.data.statut === "deja_enregistre";
    onTermine({
      ok: true,
      nom: r.data.employee?.nom,
      action: r.data.action,
      repetition,
      retard: Number(r.data.attendance?.late_minutes || 0),
      message: `${r.data.employee?.nom || "Employé"} — ${r.data.action || "Pointage"} ${repetition ? "déjà enregistré" : "enregistré"} (visage confirmé)`,
    });
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog"
      aria-modal="true" aria-label="Vérification du visage">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 text-slate-950">
        <h2 className="text-xl font-black">Confirmez le visage</h2>
        <p className="mt-1 text-sm text-slate-600">
          Badge lu. L&apos;employé regarde la caméra, puis appuyez sur « Vérifier ». Aucune photo n&apos;est conservée.
        </p>
        {etat === "erreur" ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{erreur}</p>
        ) : (
          <video ref={video} muted playsInline className="mt-3 w-full rounded-xl bg-black" />
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onTermine({ ok: false, message: "Vérification annulée." })}
            className="min-h-12 rounded-xl border font-bold">Annuler</button>
          <button type="button" onClick={verifier} disabled={etat !== "camera"}
            className="min-h-12 rounded-xl bg-slate-900 font-bold text-white disabled:opacity-50">
            {etat === "envoi" ? "Vérification…" : "Vérifier"}
          </button>
        </div>
      </div>
    </div>
  );
}
