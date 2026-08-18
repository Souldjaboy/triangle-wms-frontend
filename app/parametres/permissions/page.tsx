"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../../lib/api";
import { usePermissions, signalerChangementDroits } from "../../lib/permissions";

/**
 * CENTRE DROITS & PERMISSIONS.
 *
 * Un tableau module par module, action par action. Les cases modifiées sont
 * tenues en mémoire et partent en une seule requête : le serveur les applique
 * dans une transaction, et un refus n'en laisse aucune à moitié posée.
 *
 * Trois états par case, pas deux. « Hérité » n'est pas « refusé » : un droit
 * hérité suit le rôle et changera avec lui, tandis qu'un refus explicite tient
 * bon. Confondre les deux ferait perdre au bouton « Réinitialiser selon le
 * rôle » tout son sens.
 *
 * Sur petit écran, une grille de dix-sept colonnes est illisible : chaque
 * module devient une carte dépliable.
 */

type Effet = "ALLOW" | "DENY" | "INHERIT";

type Module = {
  module_key: string; parent_key: string | null; label: string;
  description: string; sort_order: number; is_system: boolean; actions: string[];
};
type ActionRef = { action_key: string; label: string; description: string; is_write: boolean };
type Utilisateur = {
  id: number; fullname: string; email: string; role: string;
  badge_number: string | null; is_active: boolean; is_super_admin: boolean; exceptions: number;
};
type Override = { module_key: string; action: string; effect: "ALLOW" | "DENY" };
type Journal = {
  id: number; changed_at: string; changed_by_name: string; target_user_name: string;
  module_key: string; action: string; old_value: string; new_value: string; origin: string;
};

/* Ordre d'affichage des colonnes, celui du référentiel. */
const COLONNES = [
  "visible", "view", "create", "update", "delete", "import", "export",
  "print", "validate", "cancel", "share",
];

export default function CentrePermissions() {
  const { can, loading: chargementDroits } = usePermissions();

  const [modules, setModules] = useState<Module[]>([]);
  const [actions, setActions] = useState<ActionRef[]>([]);
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [cible, setCible] = useState<number>(0);
  const [source, setSource] = useState<number>(0);
  const [effectifs, setEffectifs] = useState<Record<string, Record<string, boolean>>>({});
  const [overrides, setOverrides] = useState<Map<string, Effet>>(new Map());
  const [enAttente, setEnAttente] = useState<Map<string, Effet>>(new Map());
  const [journal, setJournal] = useState<Journal[]>([]);
  const [onglet, setOnglet] = useState<"droits" | "historique">("droits");
  const [filtreModule, setFiltreModule] = useState("TOUS");
  const [recherche, setRecherche] = useState("");
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [deplies, setDeplies] = useState<Set<string>>(new Set());

  const cle = (m: string, a: string) => `${m}|${a}`;
  const utilisateurCible = utilisateurs.find((u) => u.id === cible) || null;

  /* ─────────────────────────── Chargement ─────────────────────────── */

  useEffect(() => {
    (async () => {
      const [rm, ru] = await Promise.all([
        authFetch("/permissions/modules"),
        authFetch("/permissions/users"),
      ]);
      if (rm.ok) {
        const d = await rm.json();
        setModules(d.modules || []);
        setActions(d.actions || []);
      }
      if (ru.ok) {
        const d = await ru.json();
        setUtilisateurs(d.users || []);
        const premier = (d.users || []).find((u: Utilisateur) => !u.is_super_admin) || (d.users || [])[0];
        if (premier) setCible(premier.id);
      }
    })();
  }, []);

  const chargerCible = useCallback(async (id: number) => {
    if (!id) return;
    setMessage(""); setErreur(""); setEnAttente(new Map());
    const r = await authFetch(`/permissions/users/${id}`);
    if (!r.ok) { setErreur("Impossible de lire les droits de ce compte."); return; }
    const d = await r.json();
    setEffectifs(d.permissions || {});
    setOverrides(new Map((d.overrides || []).map((o: Override) => [cle(o.module_key, o.action), o.effect])));
  }, []);

  useEffect(() => { chargerCible(cible); }, [cible, chargerCible]);

  useEffect(() => {
    if (onglet !== "historique" || !cible) return;
    authFetch(`/permissions/audit?user_id=${cible}`)
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => setJournal(d.entries || []));
  }, [onglet, cible, message]);

  /* ─────────────────────────── État des cases ─────────────────────────── */

  /** Ce que vaut une case, en tenant compte des modifications non enregistrées. */
  const effetDe = (m: string, a: string): Effet =>
    enAttente.get(cle(m, a)) ?? overrides.get(cle(m, a)) ?? "INHERIT";

  /** Le résultat concret : ce que la personne pourra faire. */
  const autorise = (m: string, a: string): boolean => {
    const effet = effetDe(m, a);
    if (effet === "ALLOW") return true;
    if (effet === "DENY") return false;
    return effectifs[m]?.[a] === true;
  };

  const modifier = (m: string, a: string, effet: Effet) => {
    setEnAttente((prec) => {
      const suite = new Map(prec);
      const initial = overrides.get(cle(m, a)) ?? "INHERIT";
      if (effet === initial) suite.delete(cle(m, a));
      else suite.set(cle(m, a), effet);
      return suite;
    });
  };

  /** Un clic bascule autorisé ↔ refusé ; un clic long revient à l'héritage. */
  const basculer = (m: string, a: string) =>
    modifier(m, a, autorise(m, a) ? "DENY" : "ALLOW");

  /* ─────────────────────────── Arborescence ─────────────────────────── */

  const parents = useMemo(
    () => modules.filter((m) => !m.parent_key).sort((a, b) => a.sort_order - b.sort_order),
    [modules]
  );
  const enfantsDe = useCallback(
    (k: string) => modules.filter((m) => m.parent_key === k).sort((a, b) => a.sort_order - b.sort_order),
    [modules]
  );

  const visibles = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    const correspond = (m: Module) =>
      !terme || m.label.toLowerCase().includes(terme) || m.module_key.toLowerCase().includes(terme);
    return parents.filter((p) => {
      if (filtreModule !== "TOUS" && p.module_key !== filtreModule) return false;
      return correspond(p) || enfantsDe(p.module_key).some(correspond);
    });
  }, [parents, enfantsDe, filtreModule, recherche]);

  /** Coché, décoché, ou entre les deux quand seuls certains enfants le sont. */
  const etatParent = (p: Module, a: string): "oui" | "non" | "partiel" => {
    const famille = [p, ...enfantsDe(p.module_key)].filter((m) => m.actions.includes(a));
    if (!famille.length) return "non";
    const oui = famille.filter((m) => autorise(m.module_key, a)).length;
    if (oui === 0) return "non";
    if (oui === famille.length) return "oui";
    return "partiel";
  };

  const basculerFamille = (p: Module, a: string) => {
    const cible_ = etatParent(p, a) === "oui" ? "DENY" : "ALLOW";
    [p, ...enfantsDe(p.module_key)]
      .filter((m) => m.actions.includes(a))
      .forEach((m) => modifier(m.module_key, a, cible_));
  };

  /* ─────────────────────────── Actions groupées ─────────────────────────── */

  const appliquerPartout = (decision: (m: Module, a: string) => Effet) => {
    const suite = new Map(enAttente);
    modules.forEach((m) =>
      m.actions.forEach((a) => {
        const effet = decision(m, a);
        const initial = overrides.get(cle(m.module_key, a)) ?? "INHERIT";
        if (effet === initial) suite.delete(cle(m.module_key, a));
        else suite.set(cle(m.module_key, a), effet);
      })
    );
    setEnAttente(suite);
  };

  const toutAutoriser = () => appliquerPartout(() => "ALLOW");
  const toutRefuser = () => appliquerPartout((m) => (m.is_system ? "INHERIT" : "DENY"));

  /* Lecture seule : le module reste visible et consultable, tout ce qui
     modifie tombe. Les actions non écrivantes — exporter, imprimer — sont
     conservées : lire n'est pas écrire. */
  const lectureSeule = () => {
    const ecrivantes = new Set(actions.filter((a) => a.is_write).map((a) => a.action_key));
    appliquerPartout((_m, a) => (ecrivantes.has(a) ? "DENY" : "ALLOW"));
  };

  const enregistrer = async () => {
    if (!cible || !enAttente.size) return;
    setEnvoi(true); setMessage(""); setErreur("");
    const changes = [...enAttente.entries()].map(([k, effect]) => {
      const [module_key, action] = k.split("|");
      return { module_key, action, effect };
    });
    const r = await authFetch(`/permissions/users/${cible}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes, origin: "manual" }),
    });
    const d = await r.json().catch(() => ({}));
    setEnvoi(false);
    if (!r.ok) { setErreur(d.error || "Enregistrement refusé ; aucun droit n'a été modifié."); return; }
    setMessage(`${d.appliques} droit(s) enregistré(s).`);
    await chargerCible(cible);
    signalerChangementDroits();
  };

  const reinitialiser = async () => {
    if (!cible) return;
    setEnvoi(true); setMessage(""); setErreur("");
    const r = await authFetch(`/permissions/users/${cible}/reset`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setEnvoi(false);
    if (!r.ok) { setErreur(d.error || "Réinitialisation impossible."); return; }
    setMessage(`${d.supprimees} exception(s) retirée(s) : ce compte suit de nouveau son rôle.`);
    await chargerCible(cible);
    signalerChangementDroits();
  };

  const copier = async () => {
    if (!cible || !source) return;
    setMessage(""); setErreur("");
    const apercu = await authFetch(`/permissions/users/${cible}/copy?preview=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_user_id: source }),
    });
    const a = await apercu.json().catch(() => ({}));
    if (!apercu.ok) { setErreur(a.error || "Copie impossible."); return; }
    if (!window.confirm(`${a.message}\n\nContinuer ?`)) return;

    setEnvoi(true);
    const r = await authFetch(`/permissions/users/${cible}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_user_id: source }),
    });
    const d = await r.json().catch(() => ({}));
    setEnvoi(false);
    if (!r.ok) { setErreur(d.error || "Copie impossible."); return; }
    setMessage(`${d.copiees} droit(s) copié(s).`);
    await chargerCible(cible);
    signalerChangementDroits();
  };

  /* ─────────────────────────── Rendu ─────────────────────────── */

  if (!chargementDroits && !can("utilisateur.permissions", "manage")) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 text-black">
        <h1 className="text-2xl font-black">Droits &amp; permissions</h1>
        <p className="mt-4 rounded-xl bg-red-100 p-4 font-bold text-red-700">
          Cet écran est réservé aux comptes autorisés à gérer les permissions.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block font-bold text-blue-700">
          ← Retour au tableau de bord
        </Link>
      </div>
    );
  }

  const colonnesUtiles = COLONNES.filter((a) => modules.some((m) => m.actions.includes(a)));
  const libelle = (a: string) => actions.find((x) => x.action_key === a)?.label || a;

  const Case = ({ m, a }: { m: Module; a: string }) => {
    if (!m.actions.includes(a)) return <span className="text-gray-300">—</span>;
    const effet = effetDe(m.module_key, a);
    const ok = autorise(m.module_key, a);
    const modifie = enAttente.has(cle(m.module_key, a));
    return (
      <button
        type="button"
        onClick={() => basculer(m.module_key, a)}
        onContextMenu={(e) => { e.preventDefault(); modifier(m.module_key, a, "INHERIT"); }}
        title={
          effet === "INHERIT"
            ? `Hérité du rôle : ${ok ? "autorisé" : "refusé"}. Clic droit pour revenir à l'héritage.`
            : effet === "ALLOW" ? "Autorisé explicitement" : "Refusé explicitement"
        }
        aria-label={`${m.label} — ${libelle(a)} — ${ok ? "autorisé" : "refusé"}`}
        className={`h-7 w-7 rounded-md border-2 text-xs font-black transition
          ${ok ? "border-green-600 bg-green-600 text-white" : "border-gray-300 bg-white text-gray-400"}
          ${effet === "INHERIT" ? "opacity-60" : ""}
          ${modifie ? "ring-2 ring-amber-400 ring-offset-1" : ""}`}
      >
        {ok ? "✓" : "·"}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <header className="mb-5">
        <Link href="/dashboard" className="text-sm font-bold text-blue-700">← Tableau de bord</Link>
        <h1 className="mt-1 text-3xl font-black md:text-4xl">🔐 Droits &amp; permissions</h1>
        <p className="mt-1 text-gray-600">
          Chaque case décide de ce que le compte peut faire. Le serveur applique la même règle :
          un bouton masqué ici est aussi une action refusée par l’API.
        </p>
      </header>

      {/* ── Sélection ── */}
      <section className="rounded-2xl bg-white p-4 shadow md:p-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="block">
            <span className="text-sm font-bold">Employé</span>
            <select
              value={cible}
              onChange={(e) => setCible(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border-2 border-gray-200 p-3 font-bold"
            >
              {utilisateurs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullname} — {u.role || "sans rôle"} — {u.email}
                  {u.badge_number ? ` — ${u.badge_number}` : ""}
                  {u.is_active ? "" : " (inactif)"}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-sm font-bold">Rôle actuel</span>
            <p className="mt-1 rounded-xl bg-gray-50 p-3 font-black">
              {utilisateurCible?.role || "—"}
              {utilisateurCible?.is_super_admin && (
                <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">
                  super admin
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {utilisateurCible?.exceptions ?? 0} exception(s) par rapport au rôle.
            </p>
          </div>

          <div>
            <span className="text-sm font-bold">Copier les droits de</span>
            <div className="mt-1 flex gap-2">
              <select
                value={source}
                onChange={(e) => setSource(Number(e.target.value))}
                className="w-full rounded-xl border-2 border-gray-200 p-3"
              >
                <option value={0}>— choisir —</option>
                {utilisateurs.filter((u) => u.id !== cible).map((u) => (
                  <option key={u.id} value={u.id}>{u.fullname} — {u.role}</option>
                ))}
              </select>
              <button
                onClick={copier}
                disabled={!source || envoi}
                className="shrink-0 rounded-xl bg-slate-900 px-4 font-bold text-white disabled:bg-gray-300"
              >
                Copier
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={toutAutoriser} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white">
            Tout autoriser
          </button>
          <button onClick={toutRefuser} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">
            Tout refuser
          </button>
          <button onClick={lectureSeule} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">
            Lecture seule
          </button>
          <button onClick={reinitialiser} disabled={envoi}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-bold shadow disabled:opacity-50">
            Réinitialiser selon le rôle
          </button>
          <button
            onClick={enregistrer}
            disabled={!enAttente.size || envoi}
            className="ml-auto rounded-xl bg-amber-500 px-5 py-2 text-sm font-black text-black disabled:bg-gray-300 disabled:text-gray-600"
          >
            {envoi ? "Enregistrement…" : `Enregistrer les droits${enAttente.size ? ` (${enAttente.size})` : ""}`}
          </button>
        </div>

        {message && <p className="mt-3 rounded-xl bg-green-100 p-3 font-bold text-green-800">{message}</p>}
        {erreur && <p className="mt-3 rounded-xl bg-red-100 p-3 font-bold text-red-700">{erreur}</p>}
        {enAttente.size > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
            {enAttente.size} modification(s) non enregistrée(s). Elles partiront ensemble, en une seule
            transaction : si l’une est refusée, aucune n’est appliquée.
          </p>
        )}
      </section>

      {/* ── Onglets ── */}
      <nav className="mt-5 flex gap-2">
        {(["droits", "historique"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setOnglet(t)}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${
              onglet === t ? "bg-slate-900 text-white" : "bg-white shadow"
            }`}
          >
            {t === "droits" ? "Droits" : "Historique"}
          </button>
        ))}
      </nav>

      {onglet === "droits" ? (
        <>
          <div className="mt-4 flex flex-wrap gap-3">
            <select
              value={filtreModule}
              onChange={(e) => setFiltreModule(e.target.value)}
              className="rounded-xl border-2 border-gray-200 p-2 text-sm font-bold"
            >
              <option value="TOUS">Tous les modules</option>
              {parents.map((m) => <option key={m.module_key} value={m.module_key}>{m.label}</option>)}
            </select>
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher module / sous-module"
              className="min-w-[220px] flex-1 rounded-xl border-2 border-gray-200 p-2 text-sm"
            />
          </div>

          {/* Desktop : la grille complète */}
          <div className="mt-4 hidden overflow-x-auto rounded-2xl bg-white shadow lg:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="sticky left-0 z-10 bg-gray-100 p-3 text-left">Module / sous-module</th>
                  {colonnesUtiles.map((a) => (
                    <th key={a} className="p-2 text-center text-xs font-bold" title={
                      actions.find((x) => x.action_key === a)?.description
                    }>
                      {libelle(a)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => (
                  <FragmentModule
                    key={p.module_key}
                    parent={p}
                    enfants={enfantsDe(p.module_key)}
                    colonnes={colonnesUtiles}
                    Case={Case}
                    etatParent={etatParent}
                    basculerFamille={basculerFamille}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile : une carte dépliable par module */}
          <div className="mt-4 space-y-3 lg:hidden">
            {visibles.map((p) => {
              const ouvert = deplies.has(p.module_key);
              return (
                <article key={p.module_key} className="rounded-2xl bg-white p-4 shadow">
                  <button
                    onClick={() =>
                      setDeplies((s) => {
                        const n = new Set(s);
                        if (n.has(p.module_key)) n.delete(p.module_key); else n.add(p.module_key);
                        return n;
                      })
                    }
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span>
                      <span className="font-black">{p.label}</span>
                      <span className="block text-xs text-gray-500">{p.description}</span>
                    </span>
                    <span className="text-xl">{ouvert ? "−" : "+"}</span>
                  </button>

                  {ouvert && (
                    <div className="mt-3 space-y-4">
                      {[p, ...enfantsDe(p.module_key)].map((m) => (
                        <div key={m.module_key} className={m.parent_key ? "border-l-2 border-gray-200 pl-3" : ""}>
                          <p className="text-sm font-bold">{m.parent_key ? `↳ ${m.label}` : "Module principal"}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {m.actions.map((a) => (
                              <span key={a} className="flex items-center gap-1.5 rounded-lg bg-gray-50 px-2 py-1">
                                <Case m={m} a={a} />
                                <span className="text-xs">{libelle(a)}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Une case pâle est héritée du rôle ; une case vive est une décision explicite.
            Clic pour basculer, clic droit pour revenir à l’héritage.
          </p>
        </>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                {["Date", "Administrateur", "Utilisateur", "Module", "Action", "Avant", "Après", "Origine"].map((t) => (
                  <th key={t} className="p-3 text-left">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {journal.map((e) => (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="p-3 whitespace-nowrap">{new Date(e.changed_at).toLocaleString("fr-FR")}</td>
                  <td className="p-3">{e.changed_by_name || "—"}</td>
                  <td className="p-3">{e.target_user_name || "—"}</td>
                  <td className="p-3">{e.module_key}</td>
                  <td className="p-3">{e.action}</td>
                  <td className="p-3 text-gray-500">{e.old_value}</td>
                  <td className="p-3 font-bold">{e.new_value}</td>
                  <td className="p-3">{e.origin}</td>
                </tr>
              ))}
              {!journal.length && (
                <tr><td colSpan={8} className="p-6 text-center text-gray-500">Aucune modification enregistrée.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Une ligne parent suivie de ses enfants, pour la vue large. */
function FragmentModule({
  parent, enfants, colonnes, Case, etatParent, basculerFamille,
}: {
  parent: Module;
  enfants: Module[];
  colonnes: string[];
  Case: (p: { m: Module; a: string }) => React.ReactElement;
  etatParent: (m: Module, a: string) => "oui" | "non" | "partiel";
  basculerFamille: (m: Module, a: string) => void;
}) {
  return (
    <>
      <tr className="border-t-2 border-gray-200 bg-gray-50">
        <th className="sticky left-0 z-10 bg-gray-50 p-3 text-left">
          <span className="font-black">{parent.label}</span>
          {parent.is_system && (
            <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold">système</span>
          )}
          <span className="block text-xs font-normal text-gray-500">{parent.description}</span>
        </th>
        {colonnes.map((a) => {
          const applicable = [parent, ...enfants].some((m) => m.actions.includes(a));
          if (!applicable) return <td key={a} className="p-2 text-center text-gray-300">—</td>;
          const etat = etatParent(parent, a);
          return (
            <td key={a} className="p-2 text-center">
              <button
                type="button"
                onClick={() => basculerFamille(parent, a)}
                title={
                  etat === "partiel"
                    ? "Une partie seulement des sous-modules est autorisée"
                    : etat === "oui" ? "Tout autorisé" : "Tout refusé"
                }
                className={`h-7 w-7 rounded-md border-2 text-xs font-black
                  ${etat === "oui" ? "border-green-600 bg-green-600 text-white"
                    : etat === "partiel" ? "border-amber-500 bg-amber-100 text-amber-700"
                    : "border-gray-300 bg-white text-gray-400"}`}
              >
                {etat === "oui" ? "✓" : etat === "partiel" ? "–" : "·"}
              </button>
            </td>
          );
        })}
      </tr>
      {enfants.map((m) => (
        <tr key={m.module_key} className="border-t border-gray-100">
          <td className="sticky left-0 z-10 bg-white p-3 pl-8 text-sm">
            ↳ {m.label}
            <span className="block text-xs text-gray-500">{m.description}</span>
          </td>
          {colonnes.map((a) => (
            <td key={a} className="p-2 text-center"><Case m={m} a={a} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}
