"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Cpu, Fingerprint, History, ScanFace, Settings2, ShieldAlert, Users } from "lucide-react";
import {
  api,
  appareilLocal,
  avecValidation,
  capturerImage,
  champsAppareil,
  fermerCamera,
  LIBELLES_DOIGTS,
  LIBELLES_FINALITES,
  memoriserAppareil,
  oublierAppareil,
  ouvrirCamera,
} from "../../../lib/biometrie";

/**
 * PARAMÈTRES → SÉCURITÉ → BIOMÉTRIE (direction / administration).
 *
 * Personnel enrôlé, appareils, réglages, journal. Rien ici n'affiche un
 * gabarit, une photo ou un secret — sauf le secret d'un appareil, montré une
 * seule fois au moment de sa déclaration.
 */

type Onglet = "personnel" | "appareils" | "reglages" | "journal";
type Personne = {
  subject_type: string; user_id: number | null; employee_id: number | null; nom: string; role: string;
  profils: { face: number; fingerprint: number };
  consentement: { id: number; modalities: string[]; purposes: string[]; method: string } | null;
};
type Profil = {
  id: number; subject_type: string; user_id: number | null; employee_id: number | null; subject_name: string;
  biometric_type: string; provider: string; finger_index: number | null; status: string; enrolled_at: string;
  last_verified_at: string | null; expires_at: string | null; has_server_template: boolean;
};
type Appareil = { id: number; name: string; device_type: string; serial: string; provider: string; enabled: boolean; last_seen_at: string | null; site_id: number | null };

const date = (v?: string | null) => (v ? new Date(v).toLocaleString("fr-FR") : "—");
const carte = "rounded-2xl bg-white p-5 shadow md:p-6";
const champ = "w-full rounded-xl border p-3";
const TYPES_APPAREIL: Record<string, string> = {
  kiosque: "Kiosque (navigateur)", pc_local: "Poste d'enrôlement (navigateur)", mobile: "Mobile",
  terminal_visage: "Terminal visage", terminal_empreinte: "Terminal empreinte",
};
const LIBELLE_ACTION: Record<string, string> = {
  enrolement: "Enrôlement", verification: "Vérification", identification: "Identification", revocation: "Révocation",
  desactivation: "Désactivation", reactivation: "Réactivation", renouvellement: "Renouvellement", consentement: "Consentement",
  retrait_consentement: "Retrait du consentement", appareil: "Appareil", evenement_appareil: "Terminal", reglages: "Réglages", purge: "Purge",
};

export default function BiometrieAdminPage() {
  const [onglet, setOnglet] = useState<Onglet>("personnel");
  const [config, setConfig] = useState<any>(null);
  const [erreurChargement, setErreurChargement] = useState("");
  const [personnes, setPersonnes] = useState<Personne[]>([]);
  const [profils, setProfils] = useState<Profil[]>([]);
  const [appareils, setAppareils] = useState<Appareil[]>([]);
  const [evenements, setEvenements] = useState<any[]>([]);
  const [reglages, setReglages] = useState<any>(null);
  const [message, setMessage] = useState<{ type: "ok" | "erreur"; texte: string } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [secretAffiche, setSecretAffiche] = useState<{ appareil: Appareil; secret: string } | null>(null);
  const [enrolement, setEnrolement] = useState<{ personne: Personne; type: "face" | "fingerprint" } | null>(null);

  const droits = config?.droits || {};

  const charger = useCallback(async () => {
    const c = await api("/biometrics/config");
    if (!c.ok) {
      setErreurChargement(c.data?.error || "Biométrie indisponible.");
      return;
    }
    setConfig(c.data);
    setReglages(c.data.reglages || null);
    const d = c.data.droits || {};
    const [pp, pr, ap, ev] = await Promise.all([
      d["biometrie.voir"] ? api("/biometrics/people") : null,
      d["biometrie.voir"] ? api("/biometrics/profiles") : null,
      d["biometrie.appareils"] ? api("/biometrics/devices") : null,
      d["biometrie.audit"] ? api("/biometrics/events?limit=200") : null,
    ]);
    if (pp?.ok) setPersonnes(pp.data.personnes || []);
    if (pr?.ok) setProfils(pr.data.profils || []);
    if (ap?.ok) setAppareils(ap.data.appareils || []);
    if (ev?.ok) setEvenements(ev.data.evenements || []);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const executer = async (fn: () => Promise<string | void>) => {
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

  if (erreurChargement) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 md:p-8">
        <p className="mx-auto max-w-3xl rounded-xl bg-amber-50 p-4 font-bold text-amber-800">{erreurChargement}</p>
      </div>
    );
  }
  if (!config) return <div className="min-h-screen bg-gray-100 p-4 md:p-8">Chargement…</div>;

  const local = appareilLocal();
  const ONGLETS: Array<[Onglet, string, any, boolean]> = [
    ["personnel", "Employés", Users, droits["biometrie.voir"]],
    ["appareils", "Appareils", Cpu, droits["biometrie.appareils"]],
    ["reglages", "Réglages", Settings2, droits["biometrie.parametres"] || droits["biometrie.voir"]],
    ["journal", "Journal", History, droits["biometrie.audit"]],
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm text-gray-600"><Link href="/parametres" className="underline">Paramètres</Link> › Sécurité › Biométrie</p>
          <h1 className="text-3xl font-black md:text-4xl">Biométrie</h1>
          <p className="mt-1 max-w-3xl text-gray-600">
            Visage et empreinte des employés, avec consentement, pour le pointage. Aucune photo n&apos;est conservée : seulement des gabarits
            chiffrés, ou rien du tout quand la comparaison se fait sur un terminal. {config.alternative}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Etat titre="Chiffrement" ok={config.chiffrement_configure}
            texte={config.chiffrement_configure ? "BIOMETRIC_ENC_KEY configurée" : "BIOMETRIC_ENC_KEY absente : aucun enregistrement possible"} />
          <Etat titre="Visage" ok={config.modalites?.face} texte={config.modalites?.face ? "Activé" : "Désactivé"} />
          <Etat titre="Empreinte" ok={config.modalites?.fingerprint} texte={config.modalites?.fingerprint ? "Activée (terminal / lecteur)" : "Désactivée"} />
        </div>

        {message && (
          <p role={message.type === "erreur" ? "alert" : "status"}
            className={`rounded-xl p-4 font-bold ${message.type === "erreur" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>
            {message.texte}
          </p>
        )}

        {secretAffiche && (
          <div role="alert" className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5">
            <p className="font-black">Secret de l&apos;appareil « {secretAffiche.appareil.name} » — affiché une seule fois</p>
            <code className="mt-2 block break-all rounded-lg bg-white p-3 text-sm">{secretAffiche.secret}</code>
            <p className="mt-2 text-sm text-amber-900">
              Pour un terminal ou un agent local : saisissez-le dans sa configuration (signature HMAC). Pour un kiosque
              ou un poste dans CE navigateur : associez-le ci-dessous.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["kiosque", "pc_local", "mobile"].includes(secretAffiche.appareil.device_type) && (
                <button type="button" className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white"
                  onClick={() => {
                    memoriserAppareil({ device_id: secretAffiche.appareil.id, device_key: secretAffiche.secret, name: secretAffiche.appareil.name });
                    setSecretAffiche(null);
                    setMessage({ type: "ok", texte: "Ce navigateur est maintenant associé à l'appareil." });
                  }}>Associer ce navigateur</button>
              )}
              <button type="button" className="rounded-xl border px-4 py-2 font-bold" onClick={() => setSecretAffiche(null)}>J&apos;ai noté le secret</button>
            </div>
          </div>
        )}

        <nav className="flex flex-wrap gap-2" aria-label="Sections">
          {ONGLETS.filter(([, , , visible]) => visible).map(([cle, label, Icone]) => (
            <button key={cle} type="button" onClick={() => setOnglet(cle)} aria-pressed={onglet === cle}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 font-bold ${onglet === cle ? "bg-slate-900 text-white" : "bg-white"}`}>
              <Icone size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>

        {onglet === "personnel" && droits["biometrie.voir"] && (
          <section className={carte}>
            <h2 className="text-xl font-black">Employés</h2>
            <p className="mt-1 text-sm text-gray-600">Les fiches employés actives de l&apos;entreprise — celles qu&apos;on pointe. Consentement : formulaire papier signé et référencé, ou l&apos;employé lui-même depuis Profil › Sécurité quand sa fiche est rattachée à son compte.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead><tr className="border-b text-gray-500">
                  <th className="py-2">Employé</th><th>Consentement</th><th>Visage</th><th>Empreintes</th><th className="text-right">Actions</th>
                </tr></thead>
                <tbody>
                  {personnes.map((p) => (
                    <tr key={`${p.subject_type}-${p.user_id || p.employee_id}`} className="border-b align-top">
                      <td className="py-3"><p className="font-bold">{p.nom}</p><p className="text-xs text-gray-500">{p.role}</p></td>
                      <td className="py-3">{p.consentement
                        ? <span className="text-green-700">{p.consentement.modalities.map((m) => (m === "face" ? "visage" : "empreinte")).join(" + ")}
                            <span className="block text-xs text-gray-500">{p.consentement.purposes.map((f) => LIBELLES_FINALITES[f] || f).join(", ")}</span></span>
                        : <span className="text-gray-500">Aucun</span>}</td>
                      <td className="py-3">{p.profils.face ? "✓ actif" : "—"}</td>
                      <td className="py-3">{p.profils.fingerprint ? `${p.profils.fingerprint} doigt(s)` : "—"}</td>
                      <td className="py-3 text-right">
                        {droits["biometrie.enroler"] && (
                          <div className="flex justify-end gap-2">
                            {config.modalites?.face && <button type="button" className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-bold"
                              onClick={() => setEnrolement({ personne: p, type: "face" })}><ScanFace size={14} aria-hidden="true" /> Visage</button>}
                            {config.modalites?.fingerprint && <button type="button" className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-bold"
                              onClick={() => setEnrolement({ personne: p, type: "fingerprint" })}><Fingerprint size={14} aria-hidden="true" /> Empreinte</button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-8 text-lg font-black">Profils biométriques</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead><tr className="border-b text-gray-500">
                  <th className="py-2">Employé</th><th>Modalité</th><th>Fournisseur</th><th>Statut</th><th>Dernière vérification</th><th>Expire</th><th className="text-right">Actions</th>
                </tr></thead>
                <tbody>
                  {profils.length === 0 && <tr><td colSpan={7} className="py-3 text-gray-500">Aucun profil.</td></tr>}
                  {profils.map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="py-2 font-bold">{p.subject_name || `#${p.user_id || p.employee_id}`}</td>
                      <td>{p.biometric_type === "face" ? "Visage" : LIBELLES_DOIGTS[Number(p.finger_index)] || "Empreinte"}</td>
                      <td>{p.provider}{p.has_server_template ? "" : " (sur terminal)"}</td>
                      <td>{p.status}</td>
                      <td>{date(p.last_verified_at)}</td>
                      <td>{date(p.expires_at)}</td>
                      <td className="py-2 text-right">
                        {droits["biometrie.revoquer"] && p.status !== "revoque" && (
                          <div className="flex justify-end gap-2">
                            <button type="button" className="rounded-lg border px-2 py-1 font-bold" disabled={occupe}
                              onClick={() => executer(async () => {
                                const r = await api(`/biometrics/profiles/${p.id}/status`, { method: "POST",
                                  body: JSON.stringify({ status: p.status === "actif" ? "inactif" : "actif" }) });
                                if (!r.ok) throw new Error(r.data?.error);
                                return p.status === "actif" ? "Profil désactivé." : "Profil réactivé.";
                              })}>{p.status === "actif" ? "Désactiver" : "Réactiver"}</button>
                            <button type="button" className="rounded-lg border px-2 py-1 font-bold text-red-700" disabled={occupe}
                              onClick={() => {
                                const motif = window.prompt("Motif de la révocation (le gabarit sera effacé) :");
                                if (!motif) return;
                                executer(async () => {
                                  const r = await avecValidation("/biometrics/revoke", { method: "POST",
                                    body: JSON.stringify({ profile_id: p.id, reason: motif }) }, "biometrie.revoquer");
                                  if (!r.ok) throw new Error(r.data?.error);
                                  return "Profil révoqué, gabarit effacé.";
                                });
                              }}>Révoquer</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {onglet === "appareils" && droits["biometrie.appareils"] && (
          <Appareils appareils={appareils} local={local} occupe={occupe}
            onDeclarer={(corps) => executer(async () => {
              const r = await api("/biometrics/devices", { method: "POST", body: JSON.stringify(corps) });
              if (!r.ok) throw new Error(r.data?.error);
              setSecretAffiche({ appareil: r.data.appareil, secret: r.data.secret });
              return "Appareil déclaré.";
            })}
            onBasculer={(a) => executer(async () => {
              const r = await api(`/biometrics/devices/${a.id}/status`, { method: "POST", body: JSON.stringify({ enabled: !a.enabled }) });
              if (!r.ok) throw new Error(r.data?.error);
              return a.enabled ? "Appareil désactivé." : "Appareil réactivé.";
            })}
            onSecret={(a) => executer(async () => {
              if (!window.confirm(`Régénérer le secret de « ${a.name} » ? L'ancien cessera immédiatement de fonctionner.`)) return;
              const r = await avecValidation(`/biometrics/devices/${a.id}/secret`, { method: "POST", body: "{}" }, "biometrie.appareils");
              if (!r.ok) throw new Error(r.data?.error);
              setSecretAffiche({ appareil: a, secret: r.data.secret });
              return "Nouveau secret généré.";
            })}
            onOublier={() => { oublierAppareil(); setMessage({ type: "ok", texte: "Ce navigateur n'est plus associé à un appareil." }); }} />
        )}

        {onglet === "reglages" && reglages && (
          <Reglages reglages={reglages} config={config} modifiable={droits["biometrie.parametres"]} occupe={occupe}
            onEnregistrer={(corps) => executer(async () => {
              const r = await avecValidation("/biometrics/settings", { method: "PUT", body: JSON.stringify(corps) }, "biometrie.parametres");
              if (!r.ok) throw new Error(r.data?.error);
              return "Réglages enregistrés.";
            })}
            onPurger={() => executer(async () => {
              const r = await api("/biometrics/purge", { method: "POST", body: "{}" });
              if (!r.ok) throw new Error(r.data?.error);
              return `Conservation appliquée : ${r.data.evenements} événement(s), ${r.data.gabarits_effaces} gabarit(s) effacé(s).`;
            })} />
        )}

        {onglet === "journal" && droits["biometrie.audit"] && (
          <section className={carte}>
            <h2 className="text-xl font-black">Journal biométrique</h2>
            <p className="mt-1 text-sm text-gray-600">Chaque enrôlement, vérification, refus et révocation. Aucun gabarit ni image n&apos;y figure.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead><tr className="border-b text-gray-500"><th className="py-2">Date</th><th>Employé</th><th>Action</th><th>Résultat</th><th>Motif</th><th>Score</th></tr></thead>
                <tbody>
                  {evenements.map((e) => (
                    <tr key={e.id} className="border-b">
                      <td className="py-2 whitespace-nowrap">{date(e.created_at)}</td>
                      <td>{e.subject_name || "—"}</td>
                      <td>{LIBELLE_ACTION[e.action] || e.action}{e.biometric_type ? ` · ${e.biometric_type === "face" ? "visage" : "empreinte"}` : ""}</td>
                      <td className={e.result === "accepte" ? "text-green-700" : "text-red-700"}>{e.result}</td>
                      <td className="font-mono text-xs">{e.reason_code || ""}</td>
                      <td>{e.confidence !== null && e.confidence !== undefined ? Number(e.confidence).toFixed(3) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {enrolement && (
        <Enrolement personne={enrolement.personne} type={enrolement.type} config={config} appareils={appareils}
          onFermer={() => setEnrolement(null)}
          onTermine={(texte) => { setEnrolement(null); setMessage({ type: "ok", texte }); charger(); }} />
      )}
    </div>
  );
}

function Etat({ titre, ok, texte }: { titre: string; ok: boolean; texte: string }) {
  return (
    <div className={`rounded-2xl p-4 ${ok ? "bg-green-50" : "bg-white"} shadow`}>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{titre}</p>
      <p className={`mt-1 font-bold ${ok ? "text-green-800" : "text-gray-700"}`}>{texte}</p>
    </div>
  );
}

function Appareils({ appareils, local, occupe, onDeclarer, onBasculer, onSecret, onOublier }: {
  appareils: Appareil[]; local: ReturnType<typeof appareilLocal>; occupe: boolean;
  onDeclarer: (c: any) => void; onBasculer: (a: Appareil) => void; onSecret: (a: Appareil) => void; onOublier: () => void;
}) {
  const [f, setF] = useState({ name: "", device_type: "kiosque", serial: "", provider: "" });
  return (
    <section className={carte}>
      <h2 className="text-xl font-black">Appareils</h2>
      <p className="mt-1 text-sm text-gray-600">
        Un appareil inconnu est refusé. Ce navigateur : {local ? <strong>associé à « {local.name} »</strong> : "non associé"}
        {local && <button type="button" onClick={onOublier} className="ml-2 underline">dissocier</button>}
      </p>
      <form className="mt-4 grid gap-2 md:grid-cols-5" onSubmit={(e) => { e.preventDefault(); onDeclarer(f); }}>
        <input className={champ} placeholder="Nom (ex. Kiosque entrée)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required aria-label="Nom" />
        <select className={champ} value={f.device_type} onChange={(e) => setF({ ...f, device_type: e.target.value })} aria-label="Type">
          {Object.entries(TYPES_APPAREIL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className={champ} placeholder="N° de série" value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} required aria-label="Numéro de série" />
        <input className={champ} placeholder="Marque (zkteco, hikvision…)" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} aria-label="Marque" />
        <button type="submit" disabled={occupe} className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">Déclarer</button>
      </form>
      <ul className="mt-4 divide-y">
        {appareils.length === 0 && <li className="py-3 text-sm text-gray-500">Aucun appareil déclaré.</li>}
        {appareils.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold">{a.name} <span className="text-xs font-normal text-gray-500">#{a.id} · {TYPES_APPAREIL[a.device_type]} · {a.serial}</span></p>
              <p className="text-xs text-gray-500">{a.enabled ? "Actif" : "Désactivé"} · dernier contact : {date(a.last_seen_at)}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="rounded-lg border px-3 py-1.5 font-bold" onClick={() => onBasculer(a)} disabled={occupe}>{a.enabled ? "Désactiver" : "Réactiver"}</button>
              <button type="button" className="rounded-lg border px-3 py-1.5 font-bold" onClick={() => onSecret(a)} disabled={occupe}>Nouveau secret</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Reglages({ reglages, config, modifiable, occupe, onEnregistrer, onPurger }: {
  reglages: any; config: any; modifiable: boolean; occupe: boolean; onEnregistrer: (c: any) => void; onPurger: () => void;
}) {
  const [r, setR] = useState(reglages);
  const bascule = (cle: string, label: string, aide: string) => (
    <label className="flex items-start gap-3 rounded-xl border p-3">
      <input type="checkbox" checked={r[cle] === true} disabled={!modifiable} onChange={(e) => setR({ ...r, [cle]: e.target.checked })} className="mt-1 h-4 w-4" />
      <span><span className="font-bold">{label}</span><span className="block text-xs text-gray-600">{aide}</span></span>
    </label>
  );
  const fournisseurs = (type: "face" | "fingerprint") => (
    <select className={champ} disabled={!modifiable} value={r[`${type}_provider`] || ""} aria-label={`Fournisseur ${type}`}
      onChange={(e) => setR({ ...r, [`${type}_provider`]: e.target.value })}>
      <option value="">— Aucun —</option>
      {(config.fournisseurs?.[type] || []).map((f: any) => (
        <option key={f.cle} value={f.cle} disabled={!f.disponible}>{f.label}{f.disponible ? "" : " (indisponible)"} — {f.note}</option>
      ))}
    </select>
  );
  return (
    <section className={carte}>
      <h2 className="text-xl font-black">Réglages</h2>
      {!config.chiffrement_configure && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">
          <ShieldAlert size={18} aria-hidden="true" /> BIOMETRIC_ENC_KEY n&apos;est pas configurée sur le serveur : l&apos;activation est refusée.
        </p>
      )}
      <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); onEnregistrer(r); }}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border p-4">
            <p className="flex items-center gap-2 font-bold"><Camera size={16} aria-hidden="true" /> Visage</p>
            {bascule("face_enabled", "Activer la reconnaissance faciale", "Mode recommandé : badge + visage 1:1.")}
            {fournisseurs("face")}
            <label className="block text-sm">Seuil de correspondance
              <input type="number" step="0.01" min="0.5" max="0.9999" className={champ} disabled={!modifiable}
                value={r.face_threshold} onChange={(e) => setR({ ...r, face_threshold: Number(e.target.value) })} /></label>
          </div>
          <div className="space-y-2 rounded-xl border p-4">
            <p className="flex items-center gap-2 font-bold"><Fingerprint size={16} aria-hidden="true" /> Empreinte</p>
            {bascule("fingerprint_enabled", "Activer l'empreinte digitale", "Terminal biométrique ou lecteur USB + agent local.")}
            {fournisseurs("fingerprint")}
            <label className="block text-sm">Seuil de correspondance
              <input type="number" step="0.01" min="0.5" max="0.9999" className={champ} disabled={!modifiable}
                value={r.fingerprint_threshold} onChange={(e) => setR({ ...r, fingerprint_threshold: Number(e.target.value) })} /></label>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {bascule("require_liveness", "Exiger la détection du vivant", "Refuse photos et vidéos ; un fournisseur qui ne sait pas l'évaluer est refusé.")}
          {bascule("require_known_device", "Refuser les appareils inconnus", "Seuls les appareils déclarés peuvent enrôler ou vérifier.")}
          {bascule("require_challenge", "Défi anti-rejeu obligatoire", "Chaque vérification consomme un défi à usage unique.")}
          {bascule("allow_identification", "Autoriser l'identification 1:N", "Sans badge. Déconseillé : plus de faux positifs.")}
          {bascule("self_enrollment", "Auto-enrôlement du visage", "L'employé enregistre lui-même son visage depuis un poste déclaré.")}
          {bascule("stepup_required", "Validation renforcée obligatoire", "Les actions sensibles exigent une passkey récente (5 min).")}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">Validité d&apos;un profil (jours)
            <input type="number" min="1" max="3650" className={champ} disabled={!modifiable} value={r.profile_validity_days}
              onChange={(e) => setR({ ...r, profile_validity_days: Number(e.target.value) })} /></label>
          <label className="text-sm">Conservation du journal (jours)
            <input type="number" min="30" max="3650" className={champ} disabled={!modifiable} value={r.event_retention_days}
              onChange={(e) => setR({ ...r, event_retention_days: Number(e.target.value) })} /></label>
          <label className="text-sm">Durée d&apos;un défi (secondes)
            <input type="number" min="15" max="900" className={champ} disabled={!modifiable} value={r.challenge_ttl_seconds}
              onChange={(e) => setR({ ...r, challenge_ttl_seconds: Number(e.target.value) })} /></label>
        </div>
        {modifiable && (
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={occupe} className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white">Enregistrer</button>
            <button type="button" disabled={occupe} onClick={onPurger} className="rounded-xl border px-5 py-3 font-bold">Appliquer la conservation maintenant</button>
          </div>
        )}
      </form>
    </section>
  );
}

function Enrolement({ personne, type, config, appareils, onFermer, onTermine }: {
  personne: Personne; type: "face" | "fingerprint"; config: any; appareils: Appareil[];
  onFermer: () => void; onTermine: (texte: string) => void;
}) {
  const fournisseur = type === "face" ? config.reglages?.face_provider : config.reglages?.fingerprint_provider;
  const surTerminal = fournisseur === "terminal" || fournisseur === "agent_local";
  const [consentement, setConsentement] = useState(personne.consentement);
  const consentOk = consentement?.modalities.includes(type);
  const [reference, setReference] = useState("");
  const [papier, setPapier] = useState("");
  const [finalites, setFinalites] = useState<string[]>(["pointage"]);
  const [doigt, setDoigt] = useState(1);
  const [terminal, setTerminal] = useState<number | "">("");
  const [cleTerminal, setCleTerminal] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [camera, setCamera] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const flux = useRef<MediaStream | null>(null);
  const sujet = { subject_type: personne.subject_type, user_id: personne.user_id, employee_id: personne.employee_id };

  useEffect(() => () => fermerCamera(flux.current), []);

  const lancer = async (fn: () => Promise<void>) => {
    setOccupe(true);
    setErreur("");
    try {
      await fn();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Opération impossible.");
    } finally {
      setOccupe(false);
    }
  };

  const enregistrerConsentement = () => lancer(async () => {
    const r = await api("/biometrics/consents", { method: "POST", body: JSON.stringify({ subject: sujet, accepte: true,
      method: "papier", paper_reference: papier, modalities: [type], purposes: finalites }) });
    if (!r.ok) throw new Error(r.data?.error);
    setConsentement(r.data.consentement);
    setPapier("");
  });

  const enroler = (capture?: any) => lancer(async () => {
    const corps: any = { subject: sujet, replace: personne.profils[type] > 0 && type === "face" };
    if (type === "fingerprint") corps.finger_index = doigt;
    if (surTerminal) {
      Object.assign(corps, { external_reference: reference, device_id: terminal, device_key: cleTerminal });
    } else {
      Object.assign(corps, { capture, ...champsAppareil() });
    }
    const r = await api(type === "face" ? "/biometrics/enroll-face" : "/biometrics/enroll-fingerprint", { method: "POST", body: JSON.stringify(corps) });
    if (!r.ok) throw new Error(r.data?.error);
    onTermine(`${personne.nom} : ${type === "face" ? "visage" : "empreinte"} enregistré${type === "face" ? "" : "e"}.`);
  });

  return (
    <div className="fixed inset-0 z-[9000] flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Enrôlement">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-black">
        <h2 className="text-xl font-black">{type === "face" ? "Enregistrer le visage" : "Enregistrer une empreinte"} — {personne.nom}</h2>
        {erreur && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{erreur}</p>}

        {!consentOk ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-700">
              Aucun consentement pour cette modalité. La personne peut le donner elle-même (Profil → Sécurité), ou vous
              enregistrez ici la référence de son formulaire signé.
            </p>
            <input className={champ} placeholder="Référence du formulaire signé" value={papier} onChange={(e) => setPapier(e.target.value)} aria-label="Référence du formulaire" />
            <fieldset className="text-sm">
              <legend className="font-bold">Finalités cochées sur le formulaire</legend>
              {Object.entries(LIBELLES_FINALITES).map(([v, l]) => (
                <label key={v} className="mr-3 inline-flex items-center gap-1">
                  <input type="checkbox" checked={finalites.includes(v)}
                    onChange={() => setFinalites(finalites.includes(v) ? finalites.filter((x) => x !== v) : [...finalites, v])} /> {l}
                </label>
              ))}
            </fieldset>
            <button type="button" disabled={occupe || !papier.trim() || !finalites.length} onClick={enregistrerConsentement}
              className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white disabled:opacity-50">Enregistrer le consentement papier</button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {type === "fingerprint" && (
              <label className="block text-sm font-bold">Doigt
                <select className={champ} value={doigt} onChange={(e) => setDoigt(Number(e.target.value))}>
                  {LIBELLES_DOIGTS.map((l, i) => <option key={l} value={i}>{l}</option>)}
                </select></label>
            )}
            {surTerminal ? (
              <>
                <p className="text-sm text-gray-700">Enrôlez d&apos;abord la personne sur le terminal, puis indiquez la référence qu&apos;il lui a attribuée.</p>
                <select className={champ} value={terminal} onChange={(e) => setTerminal(Number(e.target.value) || "")} aria-label="Terminal">
                  <option value="">— Terminal —</option>
                  {appareils.filter((a) => a.enabled && a.device_type.startsWith("terminal")).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input className={champ} placeholder="Secret du terminal" value={cleTerminal} onChange={(e) => setCleTerminal(e.target.value)} aria-label="Secret du terminal" />
                <input className={champ} placeholder="Référence de la personne dans le terminal" value={reference} onChange={(e) => setReference(e.target.value)} aria-label="Référence" />
                <button type="button" disabled={occupe || !reference || !terminal} onClick={() => enroler()}
                  className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white disabled:opacity-50">Enregistrer</button>
              </>
            ) : type === "face" ? (
              camera ? (
                <>
                  <video ref={video} muted playsInline className="w-full rounded-lg bg-black" />
                  <button type="button" disabled={occupe} className="w-full rounded-xl bg-slate-900 py-3 font-bold text-white"
                    onClick={() => { if (!video.current) return; const image = capturerImage(video.current); fermerCamera(flux.current); setCamera(false);
                      enroler({ image_base64: image }); }}>Capturer et enregistrer</button>
                </>
              ) : (
                <button type="button" disabled={occupe} className="w-full rounded-xl border py-3 font-bold"
                  onClick={async () => { setCamera(true); await new Promise((r) => setTimeout(r, 50));
                    try { if (video.current) flux.current = await ouvrirCamera(video.current, "user"); } catch (e) { setCamera(false); setErreur(e instanceof Error ? e.message : "Caméra indisponible."); } }}>
                  Ouvrir la caméra
                </button>
              )
            ) : (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Un navigateur ne lit pas les empreintes : choisissez un terminal biométrique ou un lecteur USB avec agent local dans les réglages.
              </p>
            )}
          </div>
        )}
        <button type="button" onClick={onFermer} className="mt-4 w-full rounded-xl border py-2 font-bold">Fermer</button>
      </div>
    </div>
  );
}
