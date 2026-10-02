"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Fingerprint, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import {
  api,
  capturerImage,
  champsAppareil,
  enregistrerPasskey,
  fermerCamera,
  LIBELLES_FINALITES,
  ouvrirCamera,
  usePasskeysSupportees,
} from "../../lib/biometrie";

/**
 * PROFIL → SÉCURITÉ.
 *
 * Passkeys : Face ID, Touch ID, Windows Hello, empreinte Android. La
 * biométrie reste dans l'appareil ; le serveur ne garde qu'une clé publique.
 * Biométrie de l'entreprise (si elle l'a activée) : consentement explicite,
 * état de mes profils, révocation, et — si l'entreprise l'autorise —
 * enregistrement de mon visage. Aucune photo n'est conservée.
 *
 * Triangle : la biométrie vise la FICHE EMPLOYÉ rattachée à ce compte. Un
 * compte sans fiche (direction, comptabilité…) n'a que ses passkeys.
 */

type Passkey = { id: number; name: string; created_at: string; last_used_at: string | null; backed_up: boolean };
type Profil = {
  id: number; biometric_type: "face" | "fingerprint"; provider: string; finger_index: number | null; status: string;
  enrolled_at: string; expires_at: string | null; last_verified_at: string | null; has_server_template: boolean;
};
type Consentement = { id: number; modalities: string[]; purposes: string[]; method: string; given_at: string; withdrawn_at: string | null };

const date = (v?: string | null) => (v ? new Date(v).toLocaleString("fr-FR") : "—");
const carte = "rounded-2xl bg-white p-5 shadow md:p-6";

export default function SecuriteComptePage() {
  const supportees = usePasskeysSupportees();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [statut, setStatut] = useState<{ profils: Profil[]; consentements: Consentement[] } | null>(null);
  const [sansFiche, setSansFiche] = useState("");
  const [nomAppareil, setNomAppareil] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [modalites, setModalites] = useState<string[]>(["face"]);
  const [finalites, setFinalites] = useState<string[]>(["pointage"]);
  const [accepte, setAccepte] = useState(false);
  const [camera, setCamera] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const flux = useRef<MediaStream | null>(null);

  const charger = useCallback(async () => {
    const [p, c] = await Promise.all([api("/auth/passkeys"), api("/biometrics/config")]);
    if (p.ok) setPasskeys(p.data.passkeys || []);
    if (c.ok) {
      setConfig(c.data);
      const s = await api("/biometrics/status");
      if (s.ok) {
        setStatut(s.data);
        setSansFiche("");
      } else if (s.data?.code === "SANS_FICHE_EMPLOYE") {
        setSansFiche(s.data.error);
      }
    } else {
      setConfig(null);
    }
  }, []);

  useEffect(() => {
    charger();
    return () => fermerCamera(flux.current);
  }, [charger]);

  const action = async (fn: () => Promise<string | void>) => {
    setOccupe(true);
    setMessage(null);
    try {
      const texte = await fn();
      if (texte) setMessage({ type: "ok", texte });
      await charger();
    } catch (e) {
      setMessage({ type: "erreur", texte: e instanceof Error ? e.message : "Opération impossible." });
    } finally {
      setOccupe(false);
    }
  };

  const ajouterPasskey = () => action(async () => {
    await enregistrerPasskey(nomAppareil.trim() || "Mon appareil");
    setNomAppareil("");
    return "Passkey ajoutée : vous pouvez maintenant vous connecter avec Face ID, Touch ID ou Windows Hello.";
  });

  const renommer = (p: Passkey) => {
    const nom = window.prompt("Nouveau nom de l'appareil", p.name);
    if (!nom) return;
    action(async () => {
      const r = await api(`/auth/passkeys/${p.id}`, { method: "PATCH", body: JSON.stringify({ name: nom }) });
      if (!r.ok) throw new Error(r.data?.error || "Renommage impossible.");
      return "Appareil renommé.";
    });
  };

  const supprimer = (p: Passkey) => {
    if (!window.confirm(`Supprimer la passkey « ${p.name} » ? Cet appareil ne pourra plus vous connecter.`)) return;
    action(async () => {
      const r = await api(`/auth/passkeys/${p.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(r.data?.error || "Suppression impossible.");
      return "Passkey supprimée.";
    });
  };

  const consentir = () => action(async () => {
    const r = await api("/biometrics/consents", {
      method: "POST", body: JSON.stringify({ accepte, modalities: modalites, purposes: finalites }),
    });
    if (!r.ok) throw new Error(r.data?.error || "Consentement refusé.");
    setAccepte(false);
    return "Consentement enregistré. Vous pouvez le retirer à tout moment.";
  });

  const retirer = (c: Consentement) => {
    if (!window.confirm("Retirer ce consentement ? Vos gabarits biométriques correspondants seront effacés.")) return;
    action(async () => {
      const r = await api(`/biometrics/consents/${c.id}/withdraw`, { method: "POST", body: JSON.stringify({ reason: "Retrait par la personne" }) });
      if (!r.ok) throw new Error(r.data?.error || "Retrait impossible.");
      return `Consentement retiré — ${r.data.profils_revoques} profil(s) effacé(s).`;
    });
  };

  const revoquer = (p: Profil) => {
    if (!window.confirm("Révoquer ce profil ? Son gabarit sera définitivement effacé.")) return;
    action(async () => {
      const r = await api("/biometrics/revoke", { method: "POST", body: JSON.stringify({ profile_id: p.id }) });
      if (!r.ok) throw new Error(r.data?.error || "Révocation impossible.");
      return "Profil révoqué et gabarit effacé.";
    });
  };

  const demarrerCamera = async () => {
    setCamera(true);
    try {
      await new Promise((r) => setTimeout(r, 50));
      if (video.current) flux.current = await ouvrirCamera(video.current, "user");
    } catch (e) {
      setCamera(false);
      setMessage({ type: "erreur", texte: e instanceof Error ? e.message : "Caméra indisponible." });
    }
  };

  const enregistrerVisage = () => action(async () => {
    if (!video.current) throw new Error("Caméra non prête.");
    const image = capturerImage(video.current);
    fermerCamera(flux.current);
    flux.current = null;
    setCamera(false);
    const r = await api("/biometrics/enroll-face", {
      method: "POST", body: JSON.stringify({ capture: { image_base64: image }, ...champsAppareil() }),
    });
    if (!r.ok) throw new Error(r.data?.error || "Enregistrement refusé.");
    return "Visage enregistré : seul un gabarit chiffré est conservé, jamais la photo.";
  });

  const actifs = statut?.profils.filter((p) => p.status === "actif") || [];
  const consentementsActifs = statut?.consentements.filter((c) => !c.withdrawn_at) || [];
  const basculer = (liste: string[], v: string, set: (l: string[]) => void) =>
    set(liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-sm text-gray-600">Profil › Sécurité</p>
          <h1 className="text-3xl font-black md:text-4xl">Sécurité du compte</h1>
        </div>

        {message && (
          <p role={message.type === "erreur" ? "alert" : "status"}
            className={`rounded-xl p-4 font-bold ${message.type === "erreur" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>
            {message.texte}
          </p>
        )}

        <section className={carte} aria-labelledby="passkeys">
          <div className="flex items-center gap-2">
            <KeyRound size={22} aria-hidden="true" />
            <h2 id="passkeys" className="text-xl font-black">Passkeys</h2>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Connectez-vous avec Face ID, Touch ID, Windows Hello ou l&apos;empreinte de votre téléphone. Votre visage et
            votre empreinte restent dans votre appareil : Triangle ne reçoit qu&apos;une clé publique.
          </p>
          {!supportees ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
              Ce navigateur ne prend pas en charge les passkeys.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input value={nomAppareil} onChange={(e) => setNomAppareil(e.target.value)} maxLength={60}
                placeholder="Nom de l'appareil (ex. iPhone de travail)" aria-label="Nom de l'appareil"
                className="min-w-0 flex-1 rounded-xl border p-3" />
              <button type="button" onClick={ajouterPasskey} disabled={occupe}
                className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-60">
                Ajouter une passkey
              </button>
            </div>
          )}
          <ul className="mt-4 divide-y">
            {passkeys.length === 0 && <li className="py-3 text-sm text-gray-500">Aucune passkey enregistrée.</li>}
            {passkeys.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">{p.name}</p>
                  <p className="text-xs text-gray-500">Ajoutée le {date(p.created_at)} · dernier usage : {date(p.last_used_at)}
                    {p.backed_up ? " · synchronisée" : ""}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => renommer(p)} className="rounded-lg border px-3 py-2 text-sm font-bold">Renommer</button>
                  <button type="button" onClick={() => supprimer(p)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-bold text-red-700">
                    <Trash2 size={14} aria-hidden="true" /> Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {config === null || sansFiche ? (
          <section className={carte}>
            <h2 className="text-xl font-black">Biométrie de pointage</h2>
            <p className="mt-2 text-sm text-gray-600">
              {sansFiche
                ? `${sansFiche} La biométrie (visage, empreinte) sert au pointage des employés ; vos passkeys protègent votre compte.`
                : "Votre entreprise n'utilise pas la biométrie (visage ou empreinte)."}
            </p>
          </section>
        ) : (
          <>
            <section className={carte} aria-labelledby="consentement">
              <div className="flex items-center gap-2">
                <ShieldCheck size={22} aria-hidden="true" />
                <h2 id="consentement" className="text-xl font-black">Mon consentement biométrique</h2>
              </div>
              <p className="mt-2 text-sm text-gray-600">{config.alternative}</p>
              {consentementsActifs.map((c) => (
                <div key={c.id} className="mt-4 flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <p className="font-bold">{c.modalities.map((m) => (m === "face" ? "Visage" : "Empreinte")).join(" + ")}</p>
                    <p className="text-gray-600">{c.purposes.map((f) => LIBELLES_FINALITES[f] || f).join(", ")} · donné le {date(c.given_at)}
                      {c.method === "papier" ? " (formulaire papier)" : ""}</p>
                  </div>
                  <button type="button" onClick={() => retirer(c)} className="rounded-lg border px-3 py-2 text-sm font-bold text-red-700">
                    Retirer
                  </button>
                </div>
              ))}
              <details className="mt-4 rounded-xl border p-4" open={consentementsActifs.length === 0}>
                <summary className="cursor-pointer font-bold">Donner mon consentement</summary>
                <blockquote className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{config.consentement?.texte}</blockquote>
                <fieldset className="mt-3">
                  <legend className="text-sm font-bold">Modalités</legend>
                  {[["face", "Visage"], ["fingerprint", "Empreinte digitale"]].map(([v, l]) => (
                    <label key={v} className="mr-4 inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={modalites.includes(v)} onChange={() => basculer(modalites, v, setModalites)} /> {l}
                    </label>
                  ))}
                </fieldset>
                <fieldset className="mt-3">
                  <legend className="text-sm font-bold">Finalités</legend>
                  {Object.entries(LIBELLES_FINALITES).map(([v, l]) => (
                    <label key={v} className="mr-4 inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={finalites.includes(v)} onChange={() => basculer(finalites, v, setFinalites)} /> {l}
                    </label>
                  ))}
                </fieldset>
                <label className="mt-3 flex items-start gap-2 text-sm font-bold">
                  <input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} className="mt-1" />
                  J&apos;ai lu ce texte et j&apos;accepte, pour les modalités et finalités cochées.
                </label>
                <button type="button" onClick={consentir} disabled={!accepte || occupe || !modalites.length || !finalites.length}
                  className="mt-3 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50">
                  Enregistrer mon consentement
                </button>
              </details>
            </section>

            <section className={carte} aria-labelledby="mes-profils">
              <h2 id="mes-profils" className="text-xl font-black">Ma biométrie</h2>
              <ul className="mt-3 divide-y">
                {actifs.length === 0 && <li className="py-3 text-sm text-gray-500">Aucun profil biométrique actif.</li>}
                {actifs.map((p) => (
                  <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm">
                      <p className="font-bold">{p.biometric_type === "face" ? "Visage" : `Empreinte (doigt ${Number(p.finger_index) + 1})`}</p>
                      <p className="text-gray-600">
                        {p.has_server_template ? "Gabarit chiffré" : "Enregistré sur un terminal"} · enrôlé le {date(p.enrolled_at)} ·
                        dernière vérification : {date(p.last_verified_at)} · valable jusqu&apos;au {date(p.expires_at)}
                      </p>
                    </div>
                    <button type="button" onClick={() => revoquer(p)} className="rounded-lg border px-3 py-2 text-sm font-bold text-red-700">
                      Révoquer
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <p className="flex items-center gap-2 font-bold"><Camera size={18} aria-hidden="true" /> Mon visage</p>
                  {config.modalites?.face && config.auto_enrolement ? (
                    camera ? (
                      <div className="mt-3 space-y-2">
                        <video ref={video} muted playsInline className="w-full rounded-lg bg-black" />
                        <button type="button" onClick={enregistrerVisage} disabled={occupe}
                          className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white">Capturer et enregistrer</button>
                      </div>
                    ) : (
                      <button type="button" onClick={demarrerCamera} disabled={occupe}
                        className="mt-3 rounded-xl border px-4 py-2 font-bold">Enregistrer mon visage</button>
                    )
                  ) : (
                    <p className="mt-2 text-sm text-gray-600">
                      {config.modalites?.face ? "L'enregistrement du visage se fait avec un responsable, sur un poste de l'entreprise."
                        : "La reconnaissance faciale n'est pas activée par votre entreprise."}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border p-4">
                  <p className="flex items-center gap-2 font-bold"><Fingerprint size={18} aria-hidden="true" /> Mon empreinte</p>
                  <p className="mt-2 text-sm text-gray-600">
                    Un navigateur ne peut pas lire une empreinte. Elle s&apos;enregistre sur un terminal biométrique ou un lecteur
                    USB de l&apos;entreprise : demandez à votre responsable.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

        {config?.droits?.["biometrie.voir"] && (
          <p className="text-center text-sm font-bold">
            <Link href="/parametres/securite/biometrie" className="underline">Gérer la biométrie de l&apos;entreprise →</Link>
          </p>
        )}
        <p className="text-center text-sm text-gray-500">
          <Link href="/dashboard" className="underline">Retour au tableau de bord</Link>
        </p>
      </div>
    </div>
  );
}
