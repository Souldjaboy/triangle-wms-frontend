"use client";

/**
 * Biométrie et passkeys côté navigateur.
 *
 * • Passkeys : le navigateur demande au système (Face ID, Touch ID, Windows
 *   Hello, empreinte Android) de vérifier la personne et de signer le défi.
 *   Aucune donnée biométrique n'est lue ni envoyée par cette page.
 * • Visage : capture d'UNE image par la caméra, envoyée au serveur pour en
 *   extraire un gabarit ; l'image n'est conservée nulle part.
 * • Empreinte : jamais lue par le navigateur (aucune API ne le permet) ;
 *   elle passe par un terminal ou un lecteur USB avec agent local.
 */

import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { useSyncExternalStore } from "react";
import { apiUrl, authFetch } from "./api";

export type ReponseApi<T = any> = { ok: boolean; status: number; data: T };

export async function api<T = any>(chemin: string, options: RequestInit = {}): Promise<ReponseApi<T>> {
  const reponse = await authFetch(chemin, {
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await reponse.json().catch(() => ({}));
  return { ok: reponse.ok, status: reponse.status, data };
}

export const passkeysSupportees = () => typeof window !== "undefined" && browserSupportsWebAuthn();

const sansAbonnement = () => () => {};
/** Support des passkeys, sans écart d'hydratation (le serveur ne sait pas). */
export function usePasskeysSupportees() {
  return useSyncExternalStore(sansAbonnement, passkeysSupportees, () => false);
}

/** Enregistre une passkey sur cet appareil (Face ID, Touch ID, Windows Hello…). */
export async function enregistrerPasskey(nom: string) {
  const options = await api("/auth/passkeys/register/options", { method: "POST", body: "{}" });
  if (!options.ok) throw new Error(options.data?.error || "Passkeys indisponibles.");
  const reponse = await startRegistration({ optionsJSON: options.data });
  const verif = await api("/auth/passkeys/register/verify", {
    method: "POST",
    body: JSON.stringify({ response: reponse, name: nom }),
  });
  if (!verif.ok) throw new Error(verif.data?.error || "Passkey refusée.");
  return verif.data.passkey;
}

/** Connexion par passkey : renvoie la réponse HTTP de connexion, traitée comme un login classique. */
export async function connexionParPasskey(): Promise<Response> {
  const o = await fetch(apiUrl("/auth/passkeys/login/options"), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  const options = await o.json().catch(() => ({}));
  if (!o.ok) throw new Error(options?.error || "Connexion par passkey indisponible.");
  const assertion = await startAuthentication({ optionsJSON: options });
  return fetch(apiUrl("/auth/passkeys/login/verify"), {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
    body: JSON.stringify({ response: assertion }),
  });
}

/** Validation renforcée : la personne confirme avec sa passkey, valable 5 minutes. */
export async function validationRenforcee(scope: string): Promise<string> {
  const options = await api("/auth/step-up/options", { method: "POST", body: JSON.stringify({ scope }) });
  if (!options.ok) throw new Error(options.data?.error || "Validation renforcée impossible.");
  const assertion = await startAuthentication({ optionsJSON: options.data });
  const verif = await api("/auth/step-up/verify", {
    method: "POST", body: JSON.stringify({ response: assertion, scope }),
  });
  if (!verif.ok) throw new Error(verif.data?.error || "Validation refusée.");
  return verif.data.step_up_token;
}

/**
 * Exécute un appel ; s'il exige une validation renforcée (STEP_UP_REQUIS),
 * la demande à la personne puis rejoue l'appel une seule fois.
 */
export async function avecValidation<T = any>(chemin: string, options: RequestInit, scope: string) {
  const premier = await api<T>(chemin, options);
  if (premier.ok || (premier.data as any)?.code !== "STEP_UP_REQUIS") return premier;
  const jeton = await validationRenforcee(scope);
  return api<T>(chemin, { ...options, headers: { ...(options.headers || {}), "X-Step-Up-Token": jeton } });
}

// ─────────────────────────────────────────────── APPAREIL DE CE NAVIGATEUR

const CLE_APPAREIL = "triangle_biometric_device";

export type AppareilLocal = { device_id: number; device_key: string; name: string; company_id?: number | null };

/** Identifiants du poste (kiosque, poste d'enrôlement) déclarés sur ce navigateur. */
export function appareilLocal(): AppareilLocal | null {
  try {
    const brut = localStorage.getItem(CLE_APPAREIL);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

export function memoriserAppareil(a: AppareilLocal) {
  try {
    localStorage.setItem(CLE_APPAREIL, JSON.stringify(a));
  } catch {
    /* stockage indisponible : le poste devra être redéclaré */
  }
}

export function oublierAppareil() {
  try {
    localStorage.removeItem(CLE_APPAREIL);
  } catch {
    /* rien à faire */
  }
}

const lireAppareilBrut = () => {
  try {
    return localStorage.getItem(CLE_APPAREIL);
  } catch {
    return null;
  }
};
const surStockage = (rappel: () => void) => {
  window.addEventListener("storage", rappel);
  return () => window.removeEventListener("storage", rappel);
};
/** L'appareil associé à ce navigateur, sans écart d'hydratation. */
export function useAppareilLocal(): AppareilLocal | null {
  const brut = useSyncExternalStore(surStockage, lireAppareilBrut, () => null);
  if (!brut) return null;
  try {
    return JSON.parse(brut);
  } catch {
    return null;
  }
}

export const champsAppareil = () => {
  const a = appareilLocal();
  return a ? { device_id: a.device_id, device_key: a.device_key } : {};
};

// ─────────────────────────────────────────────────────────── CAMÉRA

export async function ouvrirCamera(video: HTMLVideoElement, face: "user" | "environment" = "user") {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Caméra indisponible sur cet appareil.");
  let flux: MediaStream;
  try {
    flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face, width: { ideal: 640 } }, audio: false });
  } catch (e) {
    const nom = e instanceof Error ? e.name : "";
    /* Le navigateur répond en anglais (« Permission denied ») : on dit quoi
       faire, en français. Le badge seul et le pointage manuel restent possibles. */
    throw new Error(
      nom === "NotAllowedError" || nom === "SecurityError"
        ? "Accès à la caméra refusé : autorisez-le dans les réglages du navigateur, ou utilisez le badge seul."
        : nom === "NotFoundError" || nom === "OverconstrainedError"
          ? "Aucune caméra disponible sur cet appareil."
          : nom === "NotReadableError"
            ? "La caméra est déjà utilisée par une autre application."
            : "La caméra n'a pas pu démarrer."
    );
  }
  video.srcObject = flux;
  await video.play();
  return flux;
}

export function fermerCamera(flux: MediaStream | null) {
  flux?.getTracks().forEach((t) => t.stop());
}

/** Une image JPEG (640 px max) en base64 — envoyée, jamais conservée. */
export function capturerImage(video: HTMLVideoElement): string {
  const largeur = Math.min(video.videoWidth || 640, 640);
  const hauteur = Math.round(largeur * ((video.videoHeight || 480) / (video.videoWidth || 640)));
  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  toile.getContext("2d")?.drawImage(video, 0, 0, largeur, hauteur);
  return toile.toDataURL("image/jpeg", 0.85);
}

export const LIBELLES_FINALITES: Record<string, string> = {
  pointage: "Pointage entrée / sortie",
  controle_acces: "Contrôle d'accès",
  action_sensible: "Validation d'actions sensibles",
  identification: "Identification sans badge",
};

export const LIBELLES_DOIGTS = [
  "Pouce droit", "Index droit", "Majeur droit", "Annulaire droit", "Auriculaire droit",
  "Pouce gauche", "Index gauche", "Majeur gauche", "Annulaire gauche", "Auriculaire gauche",
];
