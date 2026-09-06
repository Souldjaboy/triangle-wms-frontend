"use client";

/**
 * BADGES DE POINTAGE — émettre, imprimer, remplacer.
 *
 * Le QR imprimé n'encode QUE le jeton opaque du badge. L'ancien écran des
 * badges de comptes y mettait un objet JSON avec le nom, le rôle et
 * l'entreprise : une carte photographiée livrait alors tout, et le code se
 * devinait d'un badge à l'autre. Ici, une carte perdue n'apprend rien à qui
 * la ramasse, et ne vaut que jusqu'à ce qu'on la désactive.
 *
 * Un employé n'a qu'un badge actif à la fois. Donner une nouvelle carte passe
 * donc par le remplacement, qui invalide l'ancienne — jamais par une seconde
 * émission qui laisserait deux cartes valides circuler.
 */

import { useCallback, useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { authFetch } from "../lib/api";
import { usePermissions } from "../lib/permissions";

type Badge = {
  id: number; badge_code: string; status: string; issued_at: string;
  print_count: number; last_printed_at: string | null;
  deactivation_reason: string; replaced_by_badge_id: number | null;
  employee_id: number; full_name: string; employee_number: number;
  job_title: string; site: string | null;
};
type Fiche = Badge & { qr_token: string; societe: string; badge_prefix: string };
type Employe = { id: number; employee_number: number; full_name: string; job_title?: string };

const STATUTS: Record<string, { texte: string; classe: string }> = {
  ACTIF:     { texte: "Actif",     classe: "bg-emerald-100 text-emerald-800" },
  DESACTIVE: { texte: "Désactivé", classe: "bg-slate-200 text-slate-700" },
  REMPLACE:  { texte: "Remplacé",  classe: "bg-amber-100 text-amber-900" },
};

export default function BadgesPointagePage() {
  const { can } = usePermissions();
  const peutEmettre   = can("pointage.badge", "create");
  const peutImprimer  = can("pointage.badge", "print");
  const peutRemplacer = can("pointage.badge", "replace");
  const peutAuditer   = can("pointage.badge", "audit");

  const [badges, setBadges] = useState<Badge[]>([]);
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [inclureInactifs, setInclureInactifs] = useState(false);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [journal, setJournal] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(async () => {
    setErreur("");
    const [rb, re] = await Promise.all([
      authFetch(`/attendance-v2/badges?inclure_inactifs=${inclureInactifs ? "1" : "0"}`, { cache: "no-store" }),
      authFetch("/attendance-v2/employees", { cache: "no-store" }),
    ]);
    const db = await rb.json().catch(() => ({}));
    const de = await re.json().catch(() => ({}));
    if (!rb.ok) { setErreur(db.error || "Impossible de charger les badges."); return; }
    setBadges(Array.isArray(db.badges) ? db.badges : []);
    setEmployes(Array.isArray(de.employees) ? de.employees : []);
  }, [inclureInactifs]);

  useEffect(() => { charger(); }, [charger]);

  const agir = async (chemin: string, corps?: unknown, succes?: string) => {
    setOccupe(true); setMessage(""); setErreur("");
    try {
      const r = await authFetch(chemin, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps ?? {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || "Opération refusée."); return null; }
      setMessage(d.message || succes || "Enregistré.");
      await charger();
      return d;
    } finally { setOccupe(false); }
  };

  const ouvrirFiche = async (badgeId: number) => {
    setMessage(""); setErreur("");
    const r = await authFetch(`/attendance-v2/badges/${badgeId}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErreur(d.error || "Badge illisible."); return; }
    setFiche(d.badge);
    if (peutAuditer) {
      const rj = await authFetch(`/attendance-v2/badges/${badgeId}/journal`, { cache: "no-store" });
      const dj = await rj.json().catch(() => ({}));
      setJournal(Array.isArray(dj.journal) ? dj.journal : []);
    }
  };

  /* L'impression compte : on la déclare au serveur AVANT d'ouvrir la boîte
     d'impression, pour que la réimpression d'un badge perdu se voie à
     l'audit même si la personne annule ensuite. Compter après coup ne
     marcherait pas : rien ne dit si l'impression a eu lieu. */
  const imprimer = async () => {
    if (!fiche) return;
    await agir(`/attendance-v2/badges/${fiche.id}/impression`, {}, "Impression enregistrée.");
    window.print();
  };

  const remplacer = async (badge: Badge) => {
    const motif = window.prompt(
      `Remplacer le badge ${badge.badge_code} de ${badge.full_name}.\n\nMotif (perdu, abîmé, volé…) :`);
    if (!motif || motif.trim().length < 3) return;
    await agir(`/attendance-v2/badges/${badge.id}/remplacement`, { reason: motif.trim() });
  };

  const desactiver = async (badge: Badge) => {
    const motif = window.prompt(
      `Désactiver le badge ${badge.badge_code} de ${badge.full_name}.\n\nMotif :`);
    if (!motif || motif.trim().length < 3) return;
    await agir(`/attendance-v2/badges/${badge.id}/desactivation`, { reason: motif.trim() },
      "Badge désactivé : il ne pointe plus.");
  };

  const sansBadge = employes.filter(
    (e) => !badges.some((b) => b.employee_id === e.id && b.status === "ACTIF"));

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 md:p-8">
      {/* La fiche imprimée ne doit contenir que la carte. */}
      <style>{`@media print {
        body { background: #fff; }
        .sans-impression { display: none !important; }
        .a-imprimer { position: fixed; inset: 0; margin: 0; padding: 24px; }
      }`}</style>

      <div className="mx-auto max-w-6xl">
        <header className="sans-impression">
          <h1 className="text-3xl font-black md:text-4xl">Badges de pointage</h1>
          <p className="mt-2 text-slate-600">
            Le QR n’encode qu’un jeton : ni nom, ni matricule, ni entreprise. Une carte perdue
            n’apprend rien à qui la ramasse.
          </p>
        </header>

        {(message || erreur) && (
          <div className={`sans-impression mt-5 rounded-xl p-4 font-bold ${
            erreur ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
            {erreur || message}
          </div>
        )}

        {/* ── LA CARTE, TELLE QU'ELLE S'IMPRIME ── */}
        {fiche && (
          <section className="a-imprimer mt-6 rounded-2xl bg-white p-6 shadow-sm">
            <div className="mx-auto max-w-sm rounded-2xl border-2 border-slate-900 p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{fiche.societe}</p>
              <p className="mt-3 text-xl font-black leading-tight">{fiche.full_name}</p>
              <p className="text-sm text-slate-600">{fiche.job_title}</p>
              {fiche.site && <p className="text-sm text-slate-600">{fiche.site}</p>}
              <div className="mt-4 flex justify-center">
                {/* Le jeton, et rien d'autre. */}
                <QRCodeCanvas value={fiche.qr_token} size={190} includeMargin level="M" />
              </div>
              <p className="mt-3 font-mono text-lg font-black tracking-wider">{fiche.badge_code}</p>
              <p className="text-xs text-slate-500">Matricule {fiche.employee_number}</p>
            </div>

            <div className="sans-impression mt-5 flex flex-wrap gap-3">
              {peutImprimer && (
                <button onClick={imprimer} disabled={occupe}
                  className="min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white disabled:opacity-40">
                  {fiche.print_count > 0 ? "Réimprimer" : "Imprimer"}
                </button>
              )}
              <button onClick={() => { setFiche(null); setJournal([]); }}
                className="min-h-12 rounded-xl bg-slate-200 px-5 font-black">Fermer</button>
              <p className="self-center text-sm text-slate-500">
                {fiche.print_count} impression(s)
                {fiche.last_printed_at
                  ? ` · dernière le ${new Date(fiche.last_printed_at).toLocaleDateString("fr-FR")}`
                  : ""}
              </p>
            </div>

            {peutAuditer && journal.length > 0 && (
              <div className="sans-impression mt-5 rounded-xl bg-slate-50 p-4">
                <h3 className="font-black">Historique de ce badge</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {journal.map((e, i) => (
                    <li key={i} className="flex flex-wrap gap-x-2 text-slate-700">
                      <span className="font-bold">{e.event_type}</span>
                      <span>{new Date(e.created_at).toLocaleString("fr-FR")}</span>
                      <span className="text-slate-500">{e.performed_by_name}</span>
                      {e.reason && <span className="w-full text-slate-500">{e.reason}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* ── LES EMPLOYÉS SANS BADGE ── */}
        {peutEmettre && sansBadge.length > 0 && (
          <section className="sans-impression mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Sans badge actif ({sansBadge.length})</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sansBadge.map((e) => (
                <button key={e.id} disabled={occupe}
                  onClick={() => agir("/attendance-v2/badges", { employee_id: e.id }, "Badge émis.")}
                  className="min-h-12 rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-left font-bold hover:border-slate-900 disabled:opacity-40">
                  <span className="block">{e.full_name}</span>
                  <span className="block text-xs font-normal text-slate-500">
                    Matricule {e.employee_number} — émettre un badge
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── LA LISTE ── */}
        <section className="sans-impression mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <h2 className="text-xl font-black">Badges ({badges.length})</h2>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={inclureInactifs}
                onChange={(e) => setInclureInactifs(e.target.checked)} />
              Afficher les badges désactivés et remplacés
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="p-4">Employé</th>
                  <th className="p-4">Badge</th>
                  <th className="p-4">Site</th>
                  <th className="p-4">État</th>
                  <th className="p-4">Impressions</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {badges.map((b) => {
                  const s = STATUTS[b.status] || { texte: b.status, classe: "bg-slate-200" };
                  return (
                    <tr key={b.id} className="border-t align-top">
                      <td className="p-4">
                        <span className="font-bold">{b.full_name}</span>
                        <span className="block text-xs text-slate-500">
                          {b.employee_number} · {b.job_title}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold">{b.badge_code}</td>
                      <td className="p-4 text-sm">{b.site || "—"}</td>
                      <td className="p-4">
                        <span className={`rounded-lg px-2 py-1 text-xs font-black ${s.classe}`}>{s.texte}</span>
                        {b.deactivation_reason && (
                          <span className="mt-1 block text-xs text-slate-500">{b.deactivation_reason}</span>
                        )}
                      </td>
                      <td className="p-4 text-sm">{b.print_count}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          {peutImprimer && (
                            <button onClick={() => ouvrirFiche(b.id)}
                              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-black text-white">
                              Voir le QR
                            </button>
                          )}
                          {peutRemplacer && b.status === "ACTIF" && (
                            <>
                              <button onClick={() => remplacer(b)} disabled={occupe}
                                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-black text-black disabled:opacity-40">
                                Remplacer
                              </button>
                              <button onClick={() => desactiver(b)} disabled={occupe}
                                className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-black disabled:opacity-40">
                                Désactiver
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {badges.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-500">
                    Aucun badge pour l’instant.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
