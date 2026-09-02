"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { authFetch, apiUrl, getAuthToken } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";

/**
 * IMPORT D'UN CLASSEUR DE STOCK.
 *
 * L'écran montre ce que le fichier PRODUIRAIT avant d'écrire quoi que ce soit,
 * puis laisse trancher ce qui ne peut pas l'être tout seul.
 *
 * Deux principes gouvernent l'affichage :
 *
 *   — Ce qui est bloqué se voit en premier. Une prévisualisation qui met les
 *     anomalies en bas de page laisse valider sans les avoir lues.
 *
 *   — Rien ne se répartit tout seul. Cent soixante-cinq lignes cochent
 *     plusieurs bacs sans dire combien va dans chacun ; la grille ci-dessous
 *     les met côte à côte pour qu'on les saisisse d'affilée, mais elle refuse
 *     toujours une somme qui ne tombe pas juste.
 */

type Apercu = {
  fichier: { nom: string; sha256: string; taille: number };
  feuilles: string[];
  receptions: {
    total: number; fusionnees: number; dejaImportees: number; aCreer: number;
    liste: Array<{
      conteneur: string; date: string; entrepots: string[]; fusionne: boolean;
      totalLignes: number; totalQuantite: number;
      parEntrepot: Array<{ entrepot: string; lignes: number; quantite: number }>;
      dejaImportee: boolean;
      receptionExistante: { id: number; reception_number: string } | null;
      lignes: Array<{
        libelle: string; unite: string; quantite: number; entrepot: string;
        statutProduit: string; provenance: { feuille: string; ligne: number };
      }>;
    }>;
  };
  mouvements: {
    total: number; importables: number; bloques: number; dejaImportes: number;
    liste: Array<{
      description: string; sens: string; quantite: number; couleur: string;
      date: string | null; rayon: string; location: string; niveau: string | null;
      bins: string[]; bloque: boolean; motifsBlocage: string[];
      statutProduit: string; statutEmplacement: string;
      provenance: { feuille: string; ligne: number; cellule: string };
    }>;
  };
  couleurs: Record<string, { lignes: number; quantite: number }>;
  anomalies: {
    total: number; parType: Record<string, number>;
    liste: Array<{
      type: string; message: string; description: string;
      feuille: string; ligne: number; cellule: string;
      payload: Record<string, any>;
    }>;
  };
  produits: { nouveaux: number; ambigus: number };
};

type Anomalie = {
  id: number; anomaly_type: string; status: string; excel_row: number;
  excel_sheet: string; description: string; message: string;
  payload: Record<string, any>;
};

const CARTE = "rounded-2xl bg-white p-4 shadow";
const n = (v: unknown) => Number(v || 0).toLocaleString("fr-FR");

const LIBELLE_COULEUR: Record<string, string> = {
  NOUVELLE_ENTREE: "Nouvelles entrées (jaune-or)",
  NOUVELLE_SORTIE: "Nouvelles sorties (rouge foncé)",
  ANCIENNE_ENTREE: "Anciennes entrées (jaune) — non rejouées",
  ANCIENNE_SORTIE: "Anciennes sorties (rouge) — non rejouées",
  SANS_COULEUR: "Sans couleur métier",
};

const PASTILLE: Record<string, string> = {
  NOUVELLE_ENTREE: "bg-amber-400",
  NOUVELLE_SORTIE: "bg-red-700",
  ANCIENNE_ENTREE: "bg-yellow-300",
  ANCIENNE_SORTIE: "bg-red-500",
  SANS_COULEUR: "bg-gray-300",
};

export default function ImportEm2sPage() {
  const { can } = usePermissions();
  const peutLire = can("stock.import", "import_preview");
  const peutEcrire = can("stock.import", "import_execute");
  const peutResoudre = can("stock.import", "import_resolve");

  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [anomalies, setAnomalies] = useState<Anomalie[]>([]);
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<{ texte: string; type: "ok" | "erreur" } | null>(null);
  const [onglet, setOnglet] = useState<"conteneurs" | "mouvements" | "anomalies">("conteneurs");
  const [filtreEntrepot, setFiltreEntrepot] = useState("TOUS");
  const [filtreMois, setFiltreMois] = useState("TOUS");
  const [confirmation, setConfirmation] = useState(false);

  const notifier = (texte: string, type: "ok" | "erreur" = "ok") => {
    setMessage({ texte, type });
    setTimeout(() => setMessage(null), 8000);
  };

  /* ─────────────────────────────────────────── prévisualisation ── */

  const envoyer = async (chemin: string, extra: Record<string, string> = {}) => {
    if (!fichier) return null;
    const corps = new FormData();
    corps.append("file", fichier);
    for (const [k, v] of Object.entries(extra)) corps.append(k, v);

    const r = await fetch(apiUrl(chemin), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
        ...(typeof window !== "undefined" && localStorage.getItem("active_company_id")
          ? { "x-active-company-id": localStorage.getItem("active_company_id") as string }
          : {}),
      },
      body: corps,
    });
    return { ok: r.ok, statut: r.status, corps: await r.json().catch(() => ({})) };
  };

  const previsualiser = async () => {
    if (!fichier) return notifier("Choisissez d'abord un classeur.", "erreur");
    setChargement(true); setApercu(null); setConfirmation(false);
    try {
      const r = await envoyer("/stock/import-em2s/preview");
      if (!r?.ok) return notifier(r?.corps?.error || "Lecture impossible.", "erreur");
      setApercu(r.corps as Apercu);
      notifier(`Classeur lu : ${r.corps.receptions.total} réception(s), `
             + `${r.corps.anomalies.total} anomalie(s) à trancher.`);
    } finally { setChargement(false); }
  };

  const executer = async () => {
    if (!apercu) return;
    setChargement(true);
    try {
      const r = await envoyer("/stock/import-em2s/execute", { sha256: apercu.fichier.sha256 });
      if (!r?.ok) return notifier(r?.corps?.error || "Import impossible.", "erreur");
      notifier(`Import terminé : ${r.corps.receptions.creees} réception(s) créée(s), `
             + `${r.corps.receptions.dejaPresentes} déjà présente(s), `
             + `${r.corps.anomalies.ouvertes} anomalie(s) ouverte(s). `
             + "Aucun stock n'a bougé : la mise en stock reste à valider.");
      setConfirmation(false);
      await chargerAnomalies();
    } finally { setChargement(false); }
  };

  const chargerAnomalies = async () => {
    const r = await authFetch("/stock/import-em2s/anomalies?status=OPEN&limit=1000",
      { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json().catch(() => ({}));
    setAnomalies(d.anomalies || []);
  };

  /* ─────────────────────────────────────────────────── filtres ── */

  const receptionsFiltrees = useMemo(() => {
    if (!apercu) return [];
    return apercu.receptions.liste.filter((r) => {
      if (filtreEntrepot !== "TOUS" && !r.entrepots.includes(filtreEntrepot)) return false;
      if (filtreMois !== "TOUS" && !(r.date || "").startsWith(filtreMois)) return false;
      return true;
    });
  }, [apercu, filtreEntrepot, filtreMois]);

  if (!peutLire) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className={CARTE}>
          <h1 className="text-xl font-bold text-gray-900">Import de classeur</h1>
          <p className="mt-2 text-sm text-gray-600">
            Vous n&apos;avez pas le droit de prévisualiser un import. Demandez l&apos;accès
            au module « Import de classeur » dans Droits &amp; permissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Import de classeur</h1>
          <p className="text-sm text-gray-500">
            Réceptions conteneur et mouvements historiques. Rien n&apos;est écrit avant
            votre confirmation, et aucune quantité n&apos;est répartie automatiquement.
          </p>
        </div>
        <Link href="/stocks" className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700">
          Retour aux stocks
        </Link>
      </header>

      {message && (
        <div className={`mb-4 rounded-xl p-3 text-sm font-bold ${
          message.type === "ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {message.texte}
        </div>
      )}

      {/* ─────────────────────────────── fichier */}
      <section className={`${CARTE} mb-4`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 text-xs font-bold text-gray-700">
            Classeur Excel
            <input type="file" accept=".xlsx,.xls"
                   onChange={(e) => { setFichier(e.target.files?.[0] || null); setApercu(null); }}
                   className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <button type="button" onClick={previsualiser} disabled={!fichier || chargement}
                  className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white disabled:bg-gray-300">
            {chargement ? "Lecture…" : "Prévisualiser"}
          </button>
        </div>

        {apercu && (
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <p className="break-all rounded-lg bg-gray-50 p-2">
              <span className="font-bold">Empreinte SHA-256 :</span> {apercu.fichier.sha256}
            </p>
            <p className="rounded-lg bg-gray-50 p-2">
              <span className="font-bold">{apercu.feuilles.length} feuille(s) :</span>{" "}
              {apercu.feuilles.join(", ")}
            </p>
          </div>
        )}
      </section>

      {apercu && (
        <>
          {/* ─────────────────────────── ce qui bloque, en premier */}
          {apercu.anomalies.total > 0 && (
            <section className="mb-4 rounded-2xl border border-rose-300 bg-rose-50 p-4">
              <p className="text-sm font-black text-rose-900">
                {n(apercu.anomalies.total)} ligne(s) attendent une décision
              </p>
              <ul className="mt-2 space-y-1 text-xs text-rose-900">
                {Object.entries(apercu.anomalies.parType).map(([type, nb]) => (
                  <li key={type}>
                    <b>{n(nb)}</b> — {
                      type === "MULTI_BIN" ? "quantité répartie sur plusieurs bacs, sans détail"
                      : type === "DATES_MULTIPLES" ? "plusieurs dates dans une cellule, sans quantité par date"
                      : type === "NEW_STOCK_INCOHERENT" ? "le stock final ne correspond pas au calcul"
                      : type}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-rose-800">
                Ces lignes n&apos;écriront aucun mouvement tant qu&apos;elles ne sont pas
                tranchées. Le reste de l&apos;import peut se faire sans elles.
              </p>
            </section>
          )}

          {/* ─────────────────────────── synthèse */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={CARTE}>
              <p className="text-xs font-bold uppercase text-gray-500">Réceptions physiques</p>
              <p className="text-2xl font-black">{n(apercu.receptions.total)}</p>
              <p className="text-xs text-gray-600">
                dont {n(apercu.receptions.fusionnees)} présente(s) dans deux entrepôts
              </p>
            </div>
            <div className={CARTE}>
              <p className="text-xs font-bold uppercase text-gray-500">Déjà importées</p>
              <p className="text-2xl font-black">{n(apercu.receptions.dejaImportees)}</p>
              <p className="text-xs text-gray-600">{n(apercu.receptions.aCreer)} à créer</p>
            </div>
            <div className={CARTE}>
              <p className="text-xs font-bold uppercase text-gray-500">Mouvements nouveaux</p>
              <p className="text-2xl font-black">{n(apercu.mouvements.total)}</p>
              <p className="text-xs text-gray-600">
                {n(apercu.mouvements.importables)} exploitables · {n(apercu.mouvements.bloques)} bloqués
              </p>
            </div>
            <div className={CARTE}>
              <p className="text-xs font-bold uppercase text-gray-500">Produits</p>
              <p className="text-2xl font-black">{n(apercu.produits.nouveaux)}</p>
              <p className="text-xs text-gray-600">
                à créer · {n(apercu.produits.ambigus)} ambigu(s)
              </p>
            </div>
          </div>

          {/* ─────────────────────────── couleurs */}
          <section className={`${CARTE} mb-4`}>
            <p className="mb-2 text-sm font-black">Ce que disent les couleurs du fichier</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(apercu.couleurs).filter(([, v]) => v.lignes > 0).map(([cle, v]) => (
                <div key={cle} className="flex items-center gap-2 rounded-lg bg-gray-50 p-2 text-xs">
                  <span className={`h-4 w-4 shrink-0 rounded ${PASTILLE[cle] || "bg-gray-300"}`} />
                  <span className="flex-1">{LIBELLE_COULEUR[cle] || cle}</span>
                  <span className="font-bold">{n(v.lignes)} lignes · {n(v.quantite)} u.</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Seules les nouvelles couleurs donnent lieu à un mouvement. Les anciennes
              décrivent ce qui a déjà eu lieu : les rejouer doublerait le stock.
            </p>
          </section>

          {/* ─────────────────────────── onglets */}
          <div className="mb-3 flex flex-wrap gap-2">
            {([["conteneurs", `Conteneurs (${apercu.receptions.total})`],
               ["mouvements", `Mouvements (${apercu.mouvements.total})`],
               ["anomalies", `À compléter (${apercu.anomalies.total})`]] as const).map(([cle, label]) => (
              <button key={cle} onClick={() => setOnglet(cle)}
                      className={`rounded-full px-4 py-2 text-xs font-bold ${
                        onglet === cle ? "bg-gray-900 text-white" : "bg-white text-gray-700 shadow"}`}>
                {label}
              </button>
            ))}
          </div>

          {onglet === "conteneurs" && (
            <section className={CARTE}>
              <div className="mb-3 flex flex-wrap gap-2">
                {["TOUS", "A", "C"].map((e) => (
                  <button key={e} onClick={() => setFiltreEntrepot(e)}
                          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                            filtreEntrepot === e ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>
                    {e === "TOUS" ? "Tous les entrepôts" : `Entrepôt ${e}`}
                  </button>
                ))}
                <span className="mx-1 w-px bg-gray-200" />
                {[["TOUS", "Tous les mois"], ["2026-06", "Juin 2026"],
                  ["2026-07", "Juillet 2026"], ["2026-08", "Août 2026"]].map(([v, label]) => (
                  <button key={v} onClick={() => setFiltreMois(v)}
                          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                            filtreMois === v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {receptionsFiltrees.map((r) => (
                  <details key={r.conteneur} className="rounded-xl border border-gray-200">
                    <summary className="cursor-pointer p-3 text-sm">
                      <span className="font-black">{r.conteneur}</span>
                      <span className="text-gray-500"> · {r.date} · </span>
                      <span className="font-bold">{r.entrepots.join(" + ")}</span>
                      <span className="text-gray-600"> · {n(r.totalLignes)} lignes · {n(r.totalQuantite)} u.</span>
                      {r.fusionne && (
                        <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">
                          une seule réception, deux entrepôts
                        </span>
                      )}
                      {(r.dejaImportee || r.receptionExistante) && (
                        <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-700">
                          déjà présent
                        </span>
                      )}
                    </summary>
                    <div className="border-t border-gray-100 p-3">
                      {r.parEntrepot.map((e) => (
                        <div key={e.entrepot} className="mb-3">
                          <p className="mb-1 text-xs font-black uppercase text-gray-500">
                            Entrepôt {e.entrepot} — {n(e.lignes)} ligne(s), {n(e.quantite)} unité(s)
                          </p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="text-left text-gray-500">
                                <tr><th className="py-1">Article</th><th>Unité</th>
                                    <th className="text-right">Quantité</th><th>Produit</th><th>Source</th></tr>
                              </thead>
                              <tbody>
                                {r.lignes.filter((l) => l.entrepot === e.entrepot).map((l, i) => (
                                  <tr key={i} className="border-t border-gray-100">
                                    <td className="py-1 pr-2">{l.libelle}</td>
                                    <td>{l.unite}</td>
                                    <td className="text-right font-bold">{n(l.quantite)}</td>
                                    <td>{l.statutProduit === "NOUVEAU" ? "à créer"
                                       : l.statutProduit === "AMBIGU" ? "ambigu" : "existant"}</td>
                                    <td className="text-gray-400">{l.provenance.feuille}:{l.provenance.ligne}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      <p className="text-xs font-black">Total conteneur : {n(r.totalQuantite)} unité(s)</p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {onglet === "mouvements" && (
            <section className={`${CARTE} overflow-x-auto`}>
              <table className="w-full text-xs">
                <thead className="text-left text-gray-500">
                  <tr>
                    <th className="py-1">Article</th><th>Sens</th><th className="text-right">Qté</th>
                    <th>Date</th><th>Emplacement</th><th>État</th><th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {apercu.mouvements.liste.map((m, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-1 pr-2">{m.description}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 font-bold ${
                          m.sens === "Entrée" ? "bg-amber-100 text-amber-900" : "bg-red-100 text-red-900"}`}>
                          {m.sens}
                        </span>
                      </td>
                      <td className="text-right font-bold">{n(m.quantite)}</td>
                      <td>{m.date || "—"}</td>
                      <td className="text-gray-600">
                        {[m.rayon, m.location, m.niveau, m.bins.join("+")].filter(Boolean).join(" / ")}
                      </td>
                      <td>
                        {m.bloque ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 font-bold text-rose-800">
                            bloqué : {m.motifsBlocage.join(", ")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 font-bold text-green-800">
                            exploitable
                          </span>
                        )}
                      </td>
                      <td className="text-gray-400">{m.provenance.feuille}:{m.provenance.ligne}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {onglet === "anomalies" && (
            <section className={CARTE}>
              <p className="mb-2 text-sm text-gray-700">
                Ces lignes sont listées telles que le fichier les donne. Elles se
                complètent après l&apos;import, dans la grille de répartition —
                aucune n&apos;écrira de mouvement avant d&apos;être tranchée.
              </p>
              <div className="max-h-[28rem] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white text-left text-gray-500">
                    <tr><th className="py-1">Ligne</th><th>Article</th><th>Type</th><th>Détail</th></tr>
                  </thead>
                  <tbody>
                    {apercu.anomalies.liste.map((a, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="py-1 text-gray-400">{a.feuille}:{a.ligne}</td>
                        <td className="pr-2">{a.description}</td>
                        <td className="font-bold">{a.type}</td>
                        <td className="text-gray-600">
                          {a.payload?.bins ? `bacs ${a.payload.bins.join(", ")} · attendu ${n(a.payload.quantiteAttendue)}`
                           : a.payload?.dates ? `dates ${a.payload.dates.join(", ")}`
                           : a.payload?.attendu !== undefined ? `calcul ${n(a.payload.attendu)} ≠ affiché ${n(a.payload.affiche)}`
                           : a.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ─────────────────────────── confirmation */}
          <section className={`${CARTE} mt-4`}>
            {!peutEcrire ? (
              <p className="text-sm text-gray-600">
                Vous pouvez lire ce classeur mais pas l&apos;importer.
              </p>
            ) : (
              <>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" checked={confirmation} className="mt-1"
                         onChange={(e) => setConfirmation(e.target.checked)} />
                  <span>
                    J&apos;ai lu la prévisualisation. J&apos;importe{" "}
                    <b>{n(apercu.receptions.aCreer)} réception(s)</b> et j&apos;ouvre{" "}
                    <b>{n(apercu.anomalies.total)} anomalie(s)</b> à trancher.
                    <span className="mt-1 block text-xs text-gray-600">
                      Aucun stock ne bougera : une réception constate une arrivée,
                      la mise en stock reste une action séparée.
                    </span>
                  </span>
                </label>
                <button type="button" onClick={executer} disabled={!confirmation || chargement}
                        className="mt-3 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white disabled:bg-gray-300">
                  {chargement ? "Import en cours…" : "Importer"}
                </button>
              </>
            )}
          </section>
        </>
      )}

      {/* ─────────────────────────── grille de répartition */}
      {peutResoudre && (
        <GrilleRepartition anomalies={anomalies} onCharger={chargerAnomalies}
                           onMessage={notifier} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════ GRILLE DE RÉPARTITION ══ */

/**
 * Cent soixante-cinq lignes à répartir : les ouvrir une par une ferait cent
 * soixante-cinq allers-retours. La grille les met les unes sous les autres,
 * calcule le reste à mesure, et n'autorise l'enregistrement d'une ligne que
 * lorsque sa somme tombe juste — le total attendu ne se négocie pas.
 */
function GrilleRepartition({
  anomalies, onCharger, onMessage,
}: {
  anomalies: Anomalie[];
  onCharger: () => Promise<void>;
  onMessage: (texte: string, type?: "ok" | "erreur") => void;
}) {
  const BROUILLON = "em2s-repartitions";

  /* Le brouillon survit à un rechargement : cent soixante-cinq lignes ne se
     saisissent pas d'une traite, et perdre la moitié du travail parce qu'on a
     fermé l'onglet serait insupportable. */
  const [saisies, setSaisies] = useState<Record<string, Record<string, string>>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(BROUILLON) || "{}"); } catch { return {}; }
  });
  const [enCours, setEnCours] = useState<number | null>(null);
  const [lot, setLot] = useState(false);
  const [type, setType] = useState<"MULTI_BIN" | "MOUVEMENT" | "DATES_MULTIPLES">("MULTI_BIN");

  const noter = (maj: Record<string, Record<string, string>>) => {
    setSaisies(maj);
    try { localStorage.setItem(BROUILLON, JSON.stringify(maj)); } catch { /* onglet privé */ }
  };

  /* La répartition du MOUVEMENT vit sur les mêmes anomalies multi-bacs, mais
     répond à une autre question : par quel bac les unités sont-elles passées ?
     Les deux saisies sont donc gardées sous des clés distinctes. */
  const cleSaisie = (a: Anomalie) => `${type}:${a.id}`;
  const visibles = anomalies.filter((a) =>
    a.anomaly_type === (type === "MOUVEMENT" ? "MULTI_BIN" : type));

  /** Ce que la somme doit valoir, et ce n'est pas la même chose selon la question posée. */
  const attendue = (a: Anomalie) => {
    if (type === "MULTI_BIN") return Number(a.payload?.quantiteAttendue ?? 0);
    /* Mouvement et dates portent tous deux sur la quantité qui a bougé, pas
       sur le stock présent. */
    return Number(a.payload?.sorties || a.payload?.entrees || 0);
  };

  const clefs = (a: Anomalie): string[] =>
    type === "DATES_MULTIPLES" ? (a.payload?.dates || []) : (a.payload?.bins || []);

  const somme = (a: Anomalie) =>
    clefs(a).reduce((s, k) => s + Number(saisies[cleSaisie(a)]?.[k] || 0), 0);

  const reste = (a: Anomalie) => attendue(a) - somme(a);

  const resolutionDe = (a: Anomalie) => {
    const valeurs = Object.fromEntries(
      clefs(a).map((k) => [k, Number(saisies[cleSaisie(a)]?.[k] || 0)]));
    if (type === "MULTI_BIN") return { parBin: valeurs };
    if (type === "MOUVEMENT") {
      /* La répartition du stock doit accompagner celle du mouvement : le
         serveur exige les deux, et l'une ne se déduit jamais de l'autre. */
      const stock = Object.fromEntries((a.payload?.bins || []).map((b: string) =>
        [b, Number(saisies[`MULTI_BIN:${a.id}`]?.[b] || 0)]));
      return { parBin: stock, parBinMouvement: valeurs, quantiteMouvement: attendue(a) };
    }
    return { parDate: valeurs, quantiteTotale: attendue(a) };
  };

  const enregistrer = async (a: Anomalie) => {
    const resolution = resolutionDe(a);

    setEnCours(a.id);
    try {
      const r = await authFetch(`/stock/import-em2s/anomalies/${a.id}/resolve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return onMessage(d?.error || "Enregistrement refusé.", "erreur");
      onMessage(`Ligne ${a.excel_row} enregistrée.`);
      await onCharger();
    } finally { setEnCours(null); }
  };

  /** Tout le lot passe, ou rien : le serveur refuse en bloc. */
  const enregistrerLot = async () => {
    const prets = visibles.filter((a) => reste(a) === 0 && somme(a) > 0);
    if (prets.length === 0) return onMessage("Aucune ligne complète à enregistrer.", "erreur");
    setLot(true);
    try {
      const r = await authFetch("/stock/import-em2s/anomalies/bulk-resolve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutions: prets.map((a) => ({ id: a.id, resolution: resolutionDe(a) })) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return onMessage(d?.error || "Le lot a été refusé en entier.", "erreur");
      onMessage(`${d.tranchees} ligne(s) enregistrées d'un coup.`);
      await onCharger();
    } finally { setLot(false); }
  };

  return (
    <section className={`${CARTE} mt-4`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black">Grille de répartition</p>
        <div className="flex flex-wrap gap-2">
          {([["MULTI_BIN", "Stock par bac"], ["MOUVEMENT", "Mouvement par bac"],
             ["DATES_MULTIPLES", "Par date"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setType(v)}
                    className={`rounded-full px-4 py-2.5 text-xs font-bold whitespace-nowrap ${
                      type === v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>
              {label}
            </button>
          ))}
          <button onClick={enregistrerLot} disabled={lot}
                  className="rounded-full bg-gray-900 px-4 py-2.5 text-xs font-bold text-white disabled:bg-gray-300">
            {lot ? "Enregistrement…" : "Enregistrer les lignes complètes"}
          </button>
          <button onClick={onCharger}
                  className="rounded-full bg-gray-100 px-4 py-2.5 text-xs font-bold text-gray-700">
            Actualiser
          </button>
        </div>
      </div>

      <p className="mb-2 text-xs text-gray-600">
        {type === "MULTI_BIN"
          ? "Où reposent aujourd'hui les unités de cette ligne ? La somme doit égaler le stock final."
          : type === "MOUVEMENT"
            ? "Par quel bac les unités de ce mouvement sont-elles passées ? Ce n'est pas la même question que ci-contre : la somme doit égaler la quantité du mouvement, pas le stock. Renseignez d'abord « Stock par bac »."
            : "Combien d'unités pour chaque date ? La somme doit égaler la quantité du mouvement."}
      </p>

      {visibles.length === 0 ? (
        <p className="text-sm text-gray-500">
          Rien à répartir ici pour l&apos;instant. Lancez « Actualiser » après un import.
        </p>
      ) : (
        <>
        {/* Sur téléphone, un tableau de dix colonnes oblige à défiler
            latéralement pour atteindre le bouton d'enregistrement — il tombait
            à 626 px d'un écran de 375. Chaque ligne devient donc une fiche
            empilée, où tout est à portée de pouce. */}
        <div className="space-y-3 sm:hidden">
          {visibles.map((a) => {
            const r = reste(a);
            const exact = r === 0 && somme(a) > 0;
            return (
              <div key={a.id} className={`rounded-xl border p-3 ${
                exact ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-black leading-tight">{a.description}</p>
                  <span className="shrink-0 text-xs text-gray-400">L{a.excel_row}</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  {[a.payload?.entrepot || "A", a.payload?.rayon, a.payload?.location,
                    a.payload?.niveau].filter(Boolean).join(" / ") || "—"}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                  {Number(a.payload?.entrees || 0) > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-900">
                      Entrée {n(a.payload.entrees)}
                    </span>
                  )}
                  {Number(a.payload?.sorties || 0) > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-900">
                      Sortie {n(a.payload.sorties)}
                    </span>
                  )}
                  <span className="text-gray-500">{a.payload?.dateUnique || "sans date"}</span>
                </p>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {clefs(a).map((k) => (
                    <label key={k} className="text-xs font-bold text-gray-700">
                      {k}
                      <input type="number" min={0} inputMode="numeric"
                             value={saisies[cleSaisie(a)]?.[k] ?? ""}
                             onChange={(e) => noter({
                               ...saisies,
                               [cleSaisie(a)]: { ...(saisies[cleSaisie(a)] || {}), [k]: e.target.value },
                             })}
                             className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-2.5 text-sm" />
                    </label>
                  ))}
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span>
                    attendu <b>{n(attendue(a))}</b> · reste{" "}
                    <b className={r === 0 ? "text-green-700" : "text-amber-800"}>{n(r)}</b>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 font-bold ${
                    exact ? "bg-green-100 text-green-800" : "bg-rose-100 text-rose-800"}`}>
                    {exact ? "exact" : "à compléter"}
                  </span>
                </div>

                <button type="button" onClick={() => enregistrer(a)}
                        disabled={!exact || enCours === a.id}
                        title={exact ? undefined : "La somme doit égaler la quantité attendue."}
                        className="mt-2 w-full rounded-lg bg-gray-900 py-3 text-sm font-bold text-white disabled:bg-gray-300">
                  {enCours === a.id ? "…" : "Enregistrer cette ligne"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="hidden max-h-[32rem] overflow-auto sm:block">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white text-left text-gray-500">
              <tr>
                <th className="py-1">Ligne</th><th>Article</th>
                <th>Emplacement</th><th>Mouvement</th><th>Date réelle</th>
                <th className="text-right">Attendu</th>
                <th>{type === "DATES_MULTIPLES" ? "Quantité par date" : "Quantité par bac"}</th>
                <th className="text-right">Reste</th><th>Statut</th><th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => {
                const r = reste(a);
                const exact = r === 0 && somme(a) > 0;
                return (
                  <tr key={a.id} className="border-t border-gray-100 align-top">
                    <td className="py-2 text-gray-400">{a.excel_row}</td>
                    <td className="pr-2 font-bold">{a.description}</td>
                    <td className="text-gray-600">
                      {[a.payload?.entrepot || "A", a.payload?.rayon, a.payload?.location,
                        a.payload?.niveau].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td>
                      {Number(a.payload?.entrees || 0) > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-900">
                          Entrée {n(a.payload.entrees)}
                        </span>
                      )}
                      {Number(a.payload?.sorties || 0) > 0 && (
                        <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-900">
                          Sortie {n(a.payload.sorties)}
                        </span>
                      )}
                      {!a.payload?.entrees && !a.payload?.sorties && (
                        <span className="text-gray-400">aucun</span>
                      )}
                    </td>
                    <td className="text-gray-600">{a.payload?.dateUnique || "—"}</td>
                    <td className="text-right font-bold">{n(attendue(a))}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {clefs(a).map((k) => (
                          <label key={k} className="flex items-center gap-1">
                            <span className="text-gray-500">{k}</span>
                            <input type="number" min={0} value={saisies[a.id]?.[k] ?? ""}
                                   onChange={(e) => noter({
                                     ...saisies,
                                     [cleSaisie(a)]: { ...(saisies[cleSaisie(a)] || {}), [k]: e.target.value },
                                   })}
                                   className="w-20 rounded border border-gray-300 px-1 py-0.5" />
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className={`text-right font-black ${r === 0 ? "text-green-700" : "text-amber-800"}`}>
                      {n(r)}
                    </td>
                    <td>
                      {exact ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 font-bold text-green-800">
                          exact
                        </span>
                      ) : (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 font-bold text-rose-800">
                          à compléter
                        </span>
                      )}
                    </td>
                    <td>
                      <button type="button" onClick={() => enregistrer(a)}
                              disabled={!exact || enCours === a.id}
                              title={exact ? undefined : "La somme doit égaler la quantité attendue."}
                              className="rounded-lg bg-gray-900 px-3 py-1 font-bold text-white disabled:bg-gray-300">
                        {enCours === a.id ? "…" : "Enregistrer"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </section>
  );
}
