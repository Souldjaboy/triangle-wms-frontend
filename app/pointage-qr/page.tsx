"use client";

/**
 * POINTAGE PAR QR CODE — écran distinct du pointage manuel.
 *
 * Ce n'est pas le pointage manuel avec une caméra en plus : c'est un autre
 * geste, dans d'autres conditions. On se tient devant un poste, on présente
 * une carte, on veut une réponse en une seconde et de loin. D'où un écran
 * qui ne demande rien, n'affiche qu'une chose à la fois, et se lit à bout de
 * bras sur un téléphone de 375 px.
 *
 * L'heure retenue est TOUJOURS celle du serveur, dans le fuseau de la
 * société. L'heure du téléphone n'entre jamais dans le calcul — elle se règle
 * à la main en trois gestes.
 *
 * Le QR ne contient qu'un jeton opaque. Rien à en lire : ni nom, ni matricule,
 * ni société.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../lib/api";
import { usePermissions } from "../lib/permissions";

type Resultat = {
  success?: boolean;
  repetition?: boolean;
  action?: string;
  action_libelle?: string;
  retard_minutes?: number;
  heure?: string;
  message?: string;
  employe?: { id: number; nom: string; matricule: number; badge: string; poste: string };
  error?: string;
  code?: string;
};

const ETAPES: Record<string, string> = {
  CHECK_IN: "Arrivée",
  BREAK_OUT: "Début de pause",
  BREAK_IN: "Retour de pause",
  CHECK_OUT: "Fin de journée",
};

/* Les refus qu'un opérateur rencontrera vraiment, dits en français clair.
   Un code technique affiché à quelqu'un qui tient une carte devant une caméra
   ne l'aide pas à savoir quoi faire ensuite. */
const EXPLICATIONS: Record<string, string> = {
  BADGE_NOT_FOR_THIS_COMPANY: "Ce badge n'appartient pas à cette entreprise.",
  BADGE_REPLACED: "Ce badge a été remplacé. Utilisez la nouvelle carte.",
  BADGE_DEACTIVATED: "Ce badge est désactivé.",
  EMPLOYEE_INACTIVE: "Cet employé n'est plus actif.",
  ATTENDANCE_SCOPE_DENIED: "Vous n'êtes pas autorisé à pointer cet employé.",
  ATTENDANCE_DAY_COMPLETE: "La journée de cet employé est déjà complète.",
  NON_WORKING_DAY: "Ce jour n'est pas travaillé pour cet employé.",
  BADGE_TOKEN_INVALID: "Badge illisible. Réessayez, ou saisissez le code au clavier.",
};

export default function PointageQrPage() {
  const { can, loading: chargementDroits } = usePermissions();
  const autorise = can("pointage.qr", "scan");

  const [camera, setCamera] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [cameraChoisie, setCameraChoisie] = useState("");
  const [saisieManuelle, setSaisieManuelle] = useState("");
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [erreurCamera, setErreurCamera] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const scannerRef = useRef<any>(null);
  /* Une caméra lit le même QR dix fois par seconde. Sans ce garde-fou, dix
     requêtes partiraient pour un seul geste. Le serveur les absorberait —
     il a sa propre fenêtre anti-rebond — mais l'écran clignoterait. */
  const dernierJeton = useRef<{ valeur: string; a: number }>({ valeur: "", a: 0 });

  const envoyer = useCallback(async (jeton: string) => {
    const propre = String(jeton || "").trim();
    if (!propre || envoi) return;

    const maintenant = Date.now();
    if (dernierJeton.current.valeur === propre && maintenant - dernierJeton.current.a < 3000) return;
    dernierJeton.current = { valeur: propre, a: maintenant };

    setEnvoi(true);
    try {
      const reponse = await authFetch("/attendance-v2/qr/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_token: propre }),
      });
      const donnees: Resultat = await reponse.json().catch(() => ({}));
      setResultat(reponse.ok ? donnees : { ...donnees, success: false });
    } catch {
      setResultat({ success: false, error: "Le serveur n'a pas répondu. Vérifiez la connexion." });
    } finally {
      setEnvoi(false);
    }
  }, [envoi]);

  /* Le scanner est chargé à la demande : `html5-qrcode` touche au DOM et à
     `navigator.mediaDevices`, absents au rendu serveur. */
  const demarrerCamera = useCallback(async () => {
    setErreurCamera("");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const appareils = await Html5Qrcode.getCameras();
      if (!appareils.length) {
        setErreurCamera("Aucune caméra détectée sur cet appareil.");
        return;
      }
      setCameras(appareils.map((a: any) => ({ id: a.id, label: a.label || "Caméra" })));

      /* Caméra arrière par défaut : c'est elle qu'on présente à une carte.
         Le libellé varie selon les navigateurs, d'où la recherche sur
         plusieurs mots plutôt que sur un identifiant. */
      const arriere = appareils.find((a: any) =>
        /back|rear|arrière|environment/i.test(a.label || "")) || appareils[appareils.length - 1];
      const cible = cameraChoisie || arriere.id;
      setCameraChoisie(cible);

      const scanner = new Html5Qrcode("lecteur-qr");
      scannerRef.current = scanner;
      await scanner.start(
        cible,
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (texte: string) => { envoyer(texte); },
        () => { /* une image sans QR n'est pas une erreur : c'est l'ordinaire */ }
      );
      setCamera(true);
    } catch (e: any) {
      setErreurCamera(
        /permission|denied|NotAllowed/i.test(String(e?.message || e))
          ? "L'accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur, ou saisissez le code du badge."
          : "La caméra n'a pas pu démarrer. Saisissez le code du badge ci-dessous."
      );
    }
  }, [cameraChoisie, envoyer]);

  const arreterCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setCamera(false);
    if (scanner) { try { await scanner.stop(); await scanner.clear(); } catch { /* déjà arrêtée */ } }
  }, []);

  /* Une caméra laissée allumée continue de filmer après qu'on a quitté
     l'écran, et vide la batterie sans que personne ne s'en aperçoive. */
  useEffect(() => () => {
    const scanner = scannerRef.current;
    if (scanner) { scanner.stop().then(() => scanner.clear()).catch(() => {}); }
  }, []);

  const changerCamera = async (id: string) => {
    setCameraChoisie(id);
    await arreterCamera();
    setTimeout(() => demarrerCamera(), 150);
  };

  if (!chargementDroits && !autorise) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 text-slate-950">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black">Pointage QR</h1>
          <p className="mt-3 text-slate-600">
            Vous n’avez pas le droit de scanner les badges. Demandez-le à votre administrateur.
          </p>
        </div>
      </main>
    );
  }

  const succes = resultat?.success === true;
  const explication = resultat?.code ? EXPLICATIONS[resultat.code] : "";

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-xl">
        <header>
          <h1 className="text-3xl font-black md:text-4xl">Pointage par badge</h1>
          <p className="mt-2 text-slate-600">
            Présentez la carte devant la caméra. L’heure retenue est celle du serveur, à Bamako.
          </p>
        </header>

        {/* ── LE RÉSULTAT, EN GRAND ── */}
        {resultat && (
          <section
            aria-live="polite"
            className={`mt-5 rounded-2xl p-5 shadow-sm ${
              succes ? (resultat.repetition ? "bg-amber-100" : "bg-emerald-100") : "bg-red-100"
            }`}
          >
            {succes ? (
              <>
                <p className="text-2xl font-black leading-tight">{resultat.employe?.nom}</p>
                <p className="mt-1 text-sm text-slate-700">
                  Matricule {resultat.employe?.matricule} · {resultat.employe?.poste} · badge {resultat.employe?.badge}
                </p>
                <p className="mt-4 text-3xl font-black">
                  {resultat.action_libelle || ETAPES[String(resultat.action)] || "Pointage"}
                </p>
                <p className="mt-1 text-xl font-bold">
                  {resultat.heure
                    ? new Date(resultat.heure).toLocaleTimeString("fr-FR",
                        { timeZone: "Africa/Bamako", hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </p>
                {Number(resultat.retard_minutes) > 0 && (
                  <p className="mt-2 inline-block rounded-lg bg-red-600 px-3 py-1 font-black text-white">
                    {resultat.retard_minutes} minute(s) de retard
                  </p>
                )}
                {resultat.repetition && (
                  <p className="mt-3 text-sm font-bold text-amber-900">
                    Déjà enregistré à l’instant — rien n’a été compté deux fois.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-xl font-black text-red-900">Pointage refusé</p>
                <p className="mt-2 font-bold text-red-900">
                  {explication || resultat.error || "Badge non reconnu."}
                </p>
              </>
            )}
          </section>
        )}

        {/* ── LA CAMÉRA ── */}
        <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
          <div id="lecteur-qr" className={camera ? "overflow-hidden rounded-xl" : "hidden"} />

          {!camera && (
            <button
              onClick={demarrerCamera}
              className="min-h-14 w-full rounded-xl bg-slate-900 px-4 text-lg font-black text-white"
            >
              Ouvrir la caméra
            </button>
          )}

          {camera && (
            <div className="mt-4 grid gap-3">
              {cameras.length > 1 && (
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Caméra</span>
                  <select
                    className="w-full rounded-xl border p-3"
                    value={cameraChoisie}
                    onChange={(e) => changerCamera(e.target.value)}
                  >
                    {cameras.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
              )}
              <button
                onClick={arreterCamera}
                className="min-h-12 w-full rounded-xl bg-slate-200 px-4 font-black"
              >
                Fermer la caméra
              </button>
            </div>
          )}

          {erreurCamera && (
            <p className="mt-4 rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-900">
              {erreurCamera}
            </p>
          )}
        </section>

        {/* ── LE SECOURS : SAISIE AU CLAVIER ──
            Une caméra tombe en panne, une carte s'abîme, une vitre est sale.
            Sans cette porte, la journée s'arrête. */}
        <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Saisir le code du badge</h2>
          <p className="mt-1 text-sm text-slate-600">
            À utiliser si la caméra ne lit pas la carte. Le code figure sous le QR.
          </p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); envoyer(saisieManuelle); setSaisieManuelle(""); }}
          >
            <input
              className="min-h-12 flex-1 rounded-xl border p-3 font-mono"
              value={saisieManuelle}
              onChange={(e) => setSaisieManuelle(e.target.value)}
              placeholder="Code du badge"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={envoi || !saisieManuelle.trim()}
              className="min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white disabled:opacity-40"
            >
              {envoi ? "…" : "Pointer"}
            </button>
          </form>
        </section>

        <p className="mt-5 text-center text-xs text-slate-500">
          Le QR ne contient aucune donnée personnelle : ni nom, ni matricule, ni entreprise.
        </p>
      </div>
    </main>
  );
}
