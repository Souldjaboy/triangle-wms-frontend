"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authFetch } from "../lib/api";
import { usePermissions } from "../lib/permissions";
import { afficherDate } from "../lib/dates";

/**
 * ADMINISTRATION DES EMPLACEMENTS.
 *
 * L'écran précédent codait ses niveaux et ses bacs en dur — `["1","2","3","Top"]`
 * et `["1","2","3"]` — et son bouton « Full Bin » envoyait UN emplacement
 * nommé « 1,2,3 ». Les bacs 1, 2 et 3 n'existaient donc jamais : c'est ce qui
 * les faisait disparaître des sélecteurs.
 *
 * Ici, rien n'est codé en dur. Les niveaux sont ceux que porte l'étagère,
 * Level 4 comme Level Top se créent en les nommant, et tous les bacs sont
 * visibles — libres, occupés, partiellement réservés, désactivés — avec ce
 * qu'ils contiennent. Un bac qu'on ne voit pas est un bac que personne ne
 * corrigera.
 */

type Produit = {
  product_id: number; reference: string; name: string; unit: string;
  quantity: number; reserved: number; available: number;
};
type Bin = {
  id: number; warehouse_code: string; row_code: string; shelf_code: string;
  level_code: string; bin_code: string; code: string; previous_full_code: string | null;
  quantity: number; reserved: number; available: number; nb_produits: number;
  statut: "EMPTY" | "OCCUPIED" | "PARTIAL" | "DISABLED" | "ARCHIVED" | "A_REGULARISER";
  statut_libelle: string;
  ambigu: boolean; regularisable: boolean;
  exploitable: boolean; motif: string | null; motif_libelle: string | null;
  composite: boolean; bins_suggeres: string[]; is_top: boolean;
  is_active: boolean; archived_at: string | null; contenu: Produit[];
};
type Compteurs = Record<string, number>;

const STATUTS: { cle: string; label: string }[] = [
  { cle: "TOUS", label: "Tous" },
  { cle: "EMPTY", label: "Libres" },
  { cle: "OCCUPIED", label: "Occupés" },
  { cle: "PARTIAL", label: "Partiellement occupés" },
  { cle: "DISABLED", label: "Désactivés" },
  { cle: "A_REGULARISER", label: "À régulariser" },
];

const COULEUR: Record<string, string> = {
  EMPTY: "bg-emerald-100 text-emerald-800",
  OCCUPIED: "bg-blue-100 text-blue-800",
  PARTIAL: "bg-amber-100 text-amber-800",
  DISABLED: "bg-gray-200 text-gray-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
  A_REGULARISER: "bg-rose-100 text-rose-800",
};
const LIBELLE: Record<string, string> = {
  EMPTY: "Libre", OCCUPIED: "Occupé", PARTIAL: "Partiellement occupé",
  DISABLED: "Désactivé", ARCHIVED: "Archivé",
  A_REGULARISER: "Emplacement historique à régulariser",
};

const n = (v: unknown) => Number(v || 0).toLocaleString("fr-FR");
const CHAMP = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

/** Le résumé d'un bac tel qu'on veut le lire d'un coup d'œil dans une liste. */
function resume(b: Bin): string {
  if (b.ambigu) {
    return b.quantity > 0
      ? `${b.nb_produits} produit(s) — ${n(b.quantity)} unité(s) à répartir`
      : "Historique, sans stock";
  }
  if (b.statut === "DISABLED") return "Désactivé";
  if (b.statut === "ARCHIVED") return "Archivé";
  if (b.quantity <= 0) return "Libre";
  if (b.nb_produits === 1) {
    const p = b.contenu[0];
    return `${p?.name || "Produit"} — ${n(b.quantity)} ${p?.unit || "unité(s)"}`;
  }
  return `${b.nb_produits} produits — ${n(b.quantity)} unités au total`;
}

export default function EmplacementsPage() {
  const { can } = usePermissions();
  const [bins, setBins] = useState<Bin[]>([]);
  const [compteurs, setCompteurs] = useState<Compteurs>({});
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState<{ texte: string; type: "ok" | "erreur" } | null>(null);

  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState("TOUS");
  const [archives, setArchives] = useState(false);
  const [vue, setVue] = useState<"arbre" | "tableau">("arbre");
  const [selection, setSelection] = useState<Bin | null>(null);
  const [chemin, setChemin] = useState<{ w: string; r: string; s: string; l: string }>(
    { w: "", r: "", s: "", l: "" });

  const peutCreer = can("stock.emplacement", "create");
  const peutModifier = can("stock.emplacement", "update");
  const peutArchiver = can("stock.emplacement", "archive");
  const peutReorganiser = can("stock.emplacement", "reorganize");

  const charger = useCallback(async () => {
    setChargement(true);
    const params = new URLSearchParams();
    if (recherche.trim()) params.set("q", recherche.trim());
    if (archives) { params.set("archived", "1"); }
    const r = await authFetch(`/stock/locations/inventory?${params.toString()}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMessage({ texte: d?.error || "Chargement impossible.", type: "erreur" });
      setBins([]); setChargement(false); return;
    }
    setBins(d.bins || []);
    setCompteurs(d.compteurs || {});
    setChargement(false);
  }, [recherche, archives]);

  useEffect(() => {
    const t = setTimeout(charger, recherche ? 300 : 0);
    return () => clearTimeout(t);
  }, [charger, recherche]);

  /* Le filtre de statut s'applique côté navigateur : les compteurs restent
     ceux de l'ensemble, sinon l'onglet « Libres » afficherait « 0 occupés ». */
  const visibles = useMemo(
    () => (statut === "TOUS" ? bins : bins.filter((b) => b.statut === statut)),
    [bins, statut]
  );

  /* Arborescence dérivée de la liste plate : elle suit exactement ce que le
     serveur a renvoyé, filtres compris. */
  const arbre = useMemo(() => {
    const out: Record<string, Record<string, Record<string, Record<string, Bin[]>>>> = {};
    for (const b of visibles) {
      const w = b.warehouse_code || "—", r = b.row_code || "—";
      const s = b.shelf_code || "—", l = b.level_code || "—";
      out[w] ??= {}; out[w][r] ??= {}; out[w][r][s] ??= {}; out[w][r][s][l] ??= [];
      out[w][r][s][l].push(b);
    }
    return out;
  }, [visibles]);

  const notifier = (texte: string, type: "ok" | "erreur" = "ok") => {
    setMessage({ texte, type });
    setTimeout(() => setMessage(null), 6000);
  };

  const agirSurBin = async (id: number, corps: Record<string, unknown>, succes: string) => {
    const r = await authFetch(`/stock/locations/bins/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return notifier(d?.error || "Opération impossible.", "erreur");
    notifier(succes);
    setSelection(null);
    await charger();
  };

  const decouper = async (b: Bin) => {
    const r = await authFetch(`/stock/locations/bins/${b.id}/split`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return notifier(d?.error || "Découpage impossible.", "erreur");
    notifier(d.message || "Bacs créés.");
    await charger();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Emplacements</h1>
          <p className="text-sm text-gray-500">
            Entrepôt → Rayon → Étagère → Niveau → Bac. Tous les bacs sont listés, occupés compris.
          </p>
        </div>
        {peutReorganiser && (
          <Link href="/emplacements/reorganiser"
                className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white">
            Réorganiser les emplacements
          </Link>
        )}
      </header>

      {message && (
        <div className={`mb-4 rounded-xl p-3 text-sm font-bold ${
          message.type === "ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {message.texte}
        </div>
      )}

      {/* ─────────────────────────────── filtres et recherche */}
      <section className="mb-4 rounded-2xl bg-white p-4 shadow">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block text-xs font-bold text-gray-700">
            Rechercher
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
                   placeholder="Code de bac, rayon, niveau, nom de produit, référence…"
                   className={CHAMP} />
          </label>
          <label className="flex items-end gap-2 text-xs font-bold text-gray-700">
            <input type="checkbox" checked={archives} onChange={(e) => setArchives(e.target.checked)}
                   className="mb-3 h-4 w-4" />
            <span className="mb-2.5">Inclure les archivés</span>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUTS.map((s) => (
            <button key={s.cle} onClick={() => setStatut(s.cle)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      statut === s.cle ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}>
              {s.label} {compteurs[s.cle] !== undefined && `(${compteurs[s.cle]})`}
            </button>
          ))}
          <span className="ml-auto flex gap-1 rounded-full bg-gray-100 p-1">
            {(["arbre", "tableau"] as const).map((v) => (
              <button key={v} onClick={() => setVue(v)}
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        vue === v ? "bg-white shadow" : "text-gray-600"}`}>
                {v === "arbre" ? "Arborescence" : "Tableau"}
              </button>
            ))}
          </span>
        </div>
        {Number(compteurs.A_REGULARISER || 0) > 0 && (
          <p className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
            <span className="font-bold">
              {compteurs.A_REGULARISER} emplacement(s) historique(s) à régulariser
            </span>{" "}
            — « 1,2,3 », « BIN1-2 » : une ligne qui nomme plusieurs bacs à la fois. Elles viennent de
            l&apos;ancien écran et des imports, et elles portent souvent du stock réel. Elles ne sont
            plus masquées : ouvrez-les pour dire ce qui va où. Rien n&apos;est réparti automatiquement.
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ─────────────────────────────── liste */}
        <section className="rounded-2xl bg-white p-4 shadow">
          {chargement ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : visibles.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun emplacement ne correspond.</p>
          ) : vue === "tableau" ? (
            <div className="overflow-x-auto">
              {/* Une largeur minimale : sur un téléphone le tableau DÉFILE au
                  lieu de s'écraser, sinon les en-têtes se collent les uns aux
                  autres et le code du bac se casse sur cinq lignes. */}
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-gray-500">
                  <tr>
                    <th className="py-2">Code</th><th>Rayon</th><th>Étagère</th>
                    <th>Niveau</th><th>Bac</th><th>Contenu</th><th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((b) => (
                    <tr key={b.id} onClick={() => setSelection(b)}
                        className="cursor-pointer border-b hover:bg-gray-50">
                      <td className="py-2.5 font-bold text-blue-700">{b.code}</td>
                      <td>{b.row_code}</td><td>{b.shelf_code}</td>
                      <td>{b.level_code}{b.is_top && " ▲"}</td>
                      <td className="font-bold">{b.bin_code}</td>
                      <td className="text-gray-600">{resume(b)}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${COULEUR[b.statut]}`}>
                          {LIBELLE[b.statut]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Arborescence arbre={arbre} onSelect={setSelection} selection={selection}
                          onChemin={setChemin} />
          )}
        </section>

        {/* ─────────────────────────────── détail et actions */}
        <aside className="space-y-4">
          {selection ? (
            <DetailBin bac={selection} peutModifier={peutModifier} peutArchiver={peutArchiver}
                       onAgir={agirSurBin} onDecouper={decouper}
                       onRegularise={(m, e) => { notifier(m, e ? "erreur" : "ok"); if (!e) { setSelection(null); charger(); } }}
                       onFermer={() => setSelection(null)} />
          ) : (
            <div className="rounded-2xl bg-white p-4 text-sm text-gray-500 shadow">
              Sélectionnez un bac pour voir son contenu et agir dessus.
            </div>
          )}
          {peutCreer && <CreerSerie chemin={chemin} onFait={(m) => { notifier(m); charger(); }}
                                    onErreur={(m) => notifier(m, "erreur")} />}
        </aside>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════ ARBORESCENCE ══ */

function Arborescence({
  arbre, onSelect, selection, onChemin,
}: {
  arbre: Record<string, Record<string, Record<string, Record<string, Bin[]>>>>;
  onSelect: (b: Bin) => void;
  selection: Bin | null;
  onChemin: (c: { w: string; r: string; s: string; l: string }) => void;
}) {
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});
  const bascule = (cle: string) => setOuverts((o) => ({ ...o, [cle]: !o[cle] }));

  return (
    <div className="space-y-1 text-sm">
      {Object.entries(arbre).sort().map(([w, rayons]) => (
        <details key={w} open>
          <summary className="cursor-pointer rounded-lg px-2 py-1.5 font-bold text-gray-900 hover:bg-gray-50">
            Entrepôt {w}
          </summary>
          <div className="ml-3 border-l border-gray-200 pl-3">
            {Object.entries(rayons).sort().map(([r, etageres]) => (
              <details key={r} open={Boolean(ouverts[`${w}|${r}`])}
                       onToggle={() => bascule(`${w}|${r}`)}>
                <summary className="cursor-pointer rounded-lg px-2 py-1.5 font-bold text-gray-800 hover:bg-gray-50">
                  Rayon {r}
                </summary>
                <div className="ml-3 border-l border-gray-200 pl-3">
                  {Object.entries(etageres).sort().map(([s, niveaux]) => (
                    <details key={s}>
                      <summary className="cursor-pointer rounded-lg px-2 py-1.5 text-gray-700 hover:bg-gray-50">
                        Étagère {s}
                      </summary>
                      <div className="ml-3 border-l border-gray-200 pl-3">
                        {/* Les niveaux arrivent déjà triés par rang : Top passe
                            après Level 3 comme après Level 4. */}
                        {Object.entries(niveaux).map(([l, bacs]) => (
                          <div key={l} className="py-1">
                            <p className="px-2 text-xs font-bold uppercase text-gray-500">
                              Niveau {l} {bacs[0]?.is_top && "▲ (haut)"}
                            </p>
                            <ul className="mt-1 space-y-0.5">
                              {bacs.map((b) => (
                                <li key={b.id}>
                                  <button
                                    onClick={() => { onSelect(b); onChemin({ w, r, s, l }); }}
                                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50 ${
                                      selection?.id === b.id ? "bg-indigo-50 ring-1 ring-indigo-300" : ""}`}>
                                    <span className="font-bold text-gray-900">{b.bin_code}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${COULEUR[b.statut]}`}>
                                      {LIBELLE[b.statut]}
                                    </span>
                                    <span className="truncate text-xs text-gray-600">{resume(b)}</span>
                                    {b.composite && (
                                      <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                                        à découper
                                      </span>
                                    )}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════ DÉTAIL D'UN BAC ══ */

function DetailBin({
  bac, peutModifier, peutArchiver, onAgir, onDecouper, onRegularise, onFermer,
}: {
  bac: Bin;
  peutModifier: boolean;
  peutArchiver: boolean;
  onAgir: (id: number, corps: Record<string, unknown>, succes: string) => Promise<void>;
  onDecouper: (b: Bin) => Promise<void>;
  onRegularise: (message: string, erreur?: boolean) => void;
  onFermer: () => void;
}) {
  const [nouveauCode, setNouveauCode] = useState(bac.bin_code);
  const [nouveauNiveau, setNouveauNiveau] = useState(bac.level_code);
  const [motif, setMotif] = useState("");
  useEffect(() => {
    setNouveauCode(bac.bin_code); setNouveauNiveau(bac.level_code); setMotif("");
  }, [bac]);

  const modifie = nouveauCode !== bac.bin_code || nouveauNiveau !== bac.level_code;

  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase text-gray-500">Bac sélectionné</p>
          <h2 className="text-lg font-bold text-gray-900">{bac.code}</h2>
        </div>
        <button onClick={onFermer} className="text-sm font-bold text-gray-400 hover:text-gray-700">✕</button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-xs text-gray-500">Statut</dt>
          <dd><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${COULEUR[bac.statut]}`}>
            {LIBELLE[bac.statut]}</span></dd></div>
        <div><dt className="text-xs text-gray-500">Produits</dt>
          <dd className="font-bold">{bac.nb_produits}</dd></div>
        <div><dt className="text-xs text-gray-500">Quantité</dt>
          <dd className="font-bold">{n(bac.quantity)}</dd></div>
        <div><dt className="text-xs text-gray-500">Disponible</dt>
          <dd className="font-bold">{n(bac.available)}</dd></div>
      </dl>

      {bac.previous_full_code && (
        <p className="mt-2 text-xs text-gray-500">
          Anciennement <span className="font-bold">{bac.previous_full_code}</span>
        </p>
      )}
      {bac.archived_at && (
        <p className="mt-2 text-xs text-gray-500">Archivé le {afficherDate(bac.archived_at)}</p>
      )}

      {/* Ce que contient le bac. Plusieurs produits est un cas normal : ne pas
          les montrer tous ferait disparaître du stock de l'écran. */}
      {bac.contenu.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase text-gray-500">Contenu</p>
          <ul className="mt-1 space-y-1">
            {bac.contenu.map((p) => (
              <li key={p.product_id} className="rounded-lg bg-gray-50 p-2 text-sm">
                <span className="font-bold">{p.name}</span>
                <span className="text-gray-500"> · {p.reference}</span>
                <br />
                <span className="text-gray-700">
                  {n(p.quantity)} {p.unit} · réservé {n(p.reserved)} · disponible {n(p.available)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!bac.exploitable && bac.motif_libelle && (
        <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          Ce bac n&apos;est pas proposable comme destination : {bac.motif_libelle}.
        </p>
      )}

      {bac.regularisable && (
        <Regulariser bac={bac} onDecouper={onDecouper} onFait={onRegularise} />
      )}

      {peutModifier && (
        <div className="mt-4 border-t border-gray-200 pt-3">
          <p className="text-xs font-bold uppercase text-gray-500">Renommer / déplacer</p>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <label className="block text-xs text-gray-600">Code du bac
              <input value={nouveauCode} onChange={(e) => setNouveauCode(e.target.value.toUpperCase())}
                     className={CHAMP} />
            </label>
            <label className="block text-xs text-gray-600">Niveau
              <input value={nouveauNiveau} onChange={(e) => setNouveauNiveau(e.target.value.toUpperCase())}
                     className={CHAMP} />
            </label>
          </div>
          <label className="mt-2 block text-xs text-gray-600">Motif
            <input value={motif} onChange={(e) => setMotif(e.target.value)}
                   placeholder="Réétiquetage, harmonisation…" className={CHAMP} />
          </label>
          <button disabled={!modifie}
                  onClick={() => onAgir(bac.id, { bin: nouveauCode, level: nouveauNiveau, reason: motif },
                    "Bac renommé. Le stock n'a pas bougé.")}
                  className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">
            Enregistrer le nouveau nom
          </button>
          <p className="mt-1 text-xs text-gray-500">
            Renommer ne déplace aucun stock : l&apos;identifiant interne du bac ne change pas.
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-200 pt-3">
        {peutModifier && (
          <button onClick={() => onAgir(bac.id, { is_active: !bac.is_active, reason: motif },
                    bac.is_active ? "Bac désactivé." : "Bac réactivé.")}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700">
            {bac.is_active ? "Désactiver" : "Réactiver"}
          </button>
        )}
        {peutArchiver && !bac.archived_at && (
          <button onClick={() => onAgir(bac.id, { archive: true, reason: motif }, "Bac archivé.")}
                  disabled={bac.quantity > 0}
                  title={bac.quantity > 0 ? "Un bac occupé ne s'archive pas : videz-le d'abord." : ""}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700 disabled:opacity-40">
            Archiver
          </button>
        )}
      </div>
      {bac.quantity > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Ce bac contient encore du stock : il ne peut pas être archivé. Transférez-le d&apos;abord.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════ CRÉATION EN SÉRIE ══ */

type LignePlan = { bin: string; full_code: string; existe: boolean; creable: boolean; motif_libelle: string | null };

function CreerSerie({
  chemin, onFait, onErreur,
}: {
  chemin: { w: string; r: string; s: string; l: string };
  onFait: (m: string) => void;
  onErreur: (m: string) => void;
}) {
  const [f, setF] = useState({
    warehouse: "", row: "", shelf: "", level: "",
    prefix: "BIN-", start: "1", end: "10", padding: "2",
  });
  const [plan, setPlan] = useState<LignePlan[] | null>(null);
  const [resumeSerie, setResumeSerie] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);

  /* Le chemin suit la sélection de l'arborescence : on crée presque toujours
     une série là où l'on vient de regarder. */
  useEffect(() => {
    if (chemin.w) setF((x) => ({ ...x, warehouse: chemin.w, row: chemin.r, shelf: chemin.s, level: chemin.l }));
  }, [chemin]);

  const corps = () => ({
    warehouse: f.warehouse, row: f.row, shelf: f.shelf, level: f.level,
    prefix: f.prefix, start: Number(f.start), end: Number(f.end), padding: Number(f.padding),
  });

  const apercu = async () => {
    setBusy(true);
    const r = await authFetch("/stock/locations/bins/bulk?preview=1", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps()),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setPlan(null); return onErreur(d?.error || "Aperçu impossible."); }
    setPlan(d.plan || []); setResumeSerie(d.resume || null);
  };

  const creer = async () => {
    setBusy(true);
    const r = await authFetch("/stock/locations/bins/bulk", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps()),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return onErreur(d?.error || "Création impossible.");
    setPlan(null); setResumeSerie(null);
    onFait(`${d.crees?.length || 0} bac(s) créé(s), vide(s). Aucun stock n'y a été placé.`);
  };

  const complet = f.warehouse && f.row && f.shelf && f.level && f.prefix;

  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <p className="text-sm font-bold text-gray-900">Ajouter des bacs</p>
      <p className="mt-1 text-xs text-gray-500">
        Une série entière d&apos;un coup — BIN-01 à BIN-10. Créez ici Level 4 ou Level Top en
        les nommant : aucun niveau n&apos;est prédéfini.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {([["warehouse", "Entrepôt"], ["row", "Rayon"], ["shelf", "Étagère"], ["level", "Niveau"]] as const)
          .map(([k, label]) => (
            <label key={k} className="block text-xs font-bold text-gray-700">{label}
              <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value.toUpperCase() })}
                     className={CHAMP} />
            </label>
          ))}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <label className="block text-xs font-bold text-gray-700">Préfixe
          <input value={f.prefix} onChange={(e) => setF({ ...f, prefix: e.target.value.toUpperCase() })}
                 className={CHAMP} /></label>
        <label className="block text-xs font-bold text-gray-700">De
          <input type="number" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })}
                 className={CHAMP} /></label>
        <label className="block text-xs font-bold text-gray-700">À
          <input type="number" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })}
                 className={CHAMP} /></label>
        <label className="block text-xs font-bold text-gray-700">Chiffres
          <input type="number" value={f.padding} onChange={(e) => setF({ ...f, padding: e.target.value })}
                 className={CHAMP} /></label>
      </div>

      <button onClick={apercu} disabled={busy || !complet}
              className="mt-3 w-full rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-800 disabled:opacity-40">
        {busy ? "…" : "Aperçu avant création"}
      </button>

      {plan && (
        <div className="mt-3 rounded-xl border border-gray-200 p-3">
          <p className="text-xs font-bold text-gray-700">
            {resumeSerie?.a_creer ?? 0} à créer · {resumeSerie?.deja_presents ?? 0} déjà présents
            {Number(resumeSerie?.refuses ?? 0) > 0 && ` · ${resumeSerie?.refuses} refusés`}
          </p>
          <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs">
            {plan.map((p) => (
              <li key={p.full_code} className={p.creable ? "text-gray-800" : "text-gray-400 line-through"}>
                {p.full_code}
                {p.existe && " — existe déjà"}
                {p.motif_libelle && ` — refusé : ${p.motif_libelle}`}
              </li>
            ))}
          </ul>
          <button onClick={creer} disabled={busy || !(resumeSerie?.a_creer)}
                  className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">
            Créer {resumeSerie?.a_creer ?? 0} bac(s)
          </button>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════ RÉGULARISATION D'UN AMBIGU ══ */

/**
 * « 1,2,3 » ou « BIN1-2 » : une ligne qui nomme plusieurs bacs à la fois.
 *
 * Le système sait quels bacs auraient dû exister. Il ne sait PAS lequel
 * contient quoi — et personne ne peut le deviner depuis un écran. C'est donc
 * l'utilisateur qui répartit, produit par produit, avec ce qu'il a sous les
 * yeux à l'entrepôt.
 *
 * La somme doit tomber juste : réparti + reliquat = quantité présente. Le
 * total s'affiche en permanence, parce qu'une addition fausse découverte
 * après coup est du stock perdu.
 */
function Regulariser({
  bac, onDecouper, onFait,
}: {
  bac: Bin;
  onDecouper: (b: Bin) => Promise<void>;
  onFait: (message: string, erreur?: boolean) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  /* clé « produit|bac » → quantité saisie */
  const [saisie, setSaisie] = useState<Record<string, string>>({});
  const bins = bac.bins_suggeres.length ? bac.bins_suggeres : ["BIN1", "BIN2"];

  const q = (pid: number, bin: string) => Number(saisie[`${pid}|${bin}`] || 0);
  const totalPour = (pid: number) => bins.reduce((n, b) => n + q(pid, b), 0);

  const lignes = bac.contenu.map((p) => {
    const reparti = totalPour(p.product_id);
    return { ...p, reparti, reliquat: p.quantity - reparti, juste: reparti <= p.quantity };
  });
  const pret = motif.trim().length > 0
    && lignes.length > 0
    && lignes.every((l) => l.juste)
    && lignes.some((l) => l.reparti > 0);

  const envoyer = async () => {
    setBusy(true);
    const repartitions: { product_id: number; bin: string; quantity: number }[] = [];
    const reliquats: Record<number, number> = {};
    for (const l of lignes) {
      for (const b of bins) if (q(l.product_id, b) > 0) {
        repartitions.push({ product_id: l.product_id, bin: b, quantity: q(l.product_id, b) });
      }
      reliquats[l.product_id] = l.reliquat;
    }
    const r = await authFetch(`/stock/locations/bins/${bac.id}/regulariser`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repartitions, reliquats, reason: motif.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return onFait(d?.error || "Régularisation impossible.", true);
    onFait(d.message || "Emplacement régularisé.");
  };

  return (
    <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3">
      <p className="text-sm font-bold text-rose-900">Emplacement historique à régulariser</p>
      <p className="mt-1 text-xs text-rose-900">
        Cette ligne nomme {bins.length} bacs à la fois ({bins.join(", ")}) : ils n&apos;ont jamais
        existé séparément. {bac.motif_libelle ? `Motif : ${bac.motif_libelle}.` : ""}
      </p>

      {bac.quantity <= 0 ? (
        <>
          <p className="mt-2 text-xs text-rose-900">
            Elle ne contient aucun stock : créer les vrais bacs suffit.
          </p>
          <button onClick={() => onDecouper(bac)}
                  className="mt-2 w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white">
            Créer les {bins.length} vrais bacs
          </button>
        </>
      ) : !ouvert ? (
        <>
          <p className="mt-2 text-xs text-rose-900">
            Elle contient <span className="font-bold">{n(bac.quantity)} unité(s)</span>. Rien ne sera
            réparti automatiquement : vous dites ce qui va où, et de vrais mouvements de transfert
            sont écrits.
          </p>
          <button onClick={() => setOuvert(true)}
                  className="mt-2 w-full rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white">
            Régulariser / Découper
          </button>
        </>
      ) : (
        <div className="mt-3">
          {lignes.map((l) => (
            <div key={l.product_id} className="mb-3 rounded-lg bg-white p-2">
              <p className="text-xs font-bold text-gray-900">{l.name}</p>
              <p className="text-xs text-gray-500">
                {n(l.quantity)} {l.unit} présent(s){l.reserved > 0 && ` · ${n(l.reserved)} réservé(s)`}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {bins.map((b) => (
                  <label key={b} className="block text-xs text-gray-600">{b}
                    <input type="number" min={0} inputMode="numeric"
                           value={saisie[`${l.product_id}|${b}`] ?? ""}
                           onChange={(e) => setSaisie({ ...saisie, [`${l.product_id}|${b}`]: e.target.value })}
                           className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
                  </label>
                ))}
              </div>
              <p className={`mt-1 text-xs font-bold ${l.juste ? "text-gray-700" : "text-red-700"}`}>
                réparti {n(l.reparti)} + reliquat {n(l.reliquat)} = {n(l.reparti + l.reliquat)}
                {l.juste ? ` sur ${n(l.quantity)}` : ` — dépasse les ${n(l.quantity)} présents`}
              </p>
              {l.reliquat > 0 && l.juste && (
                <p className="text-xs text-gray-500">
                  Le reliquat reste dans l&apos;emplacement d&apos;origine, qui ne sera pas archivé.
                </p>
              )}
            </div>
          ))}
          <label className="block text-xs font-bold text-gray-700">
            Motif <span className="text-red-600">— obligatoire</span>
            <input value={motif} onChange={(e) => setMotif(e.target.value)}
                   placeholder="Comptage physique du 22/08" className={CHAMP} />
          </label>
          <div className="mt-2 flex gap-2">
            <button onClick={envoyer} disabled={busy || !pret}
                    className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">
              {busy ? "Régularisation…" : "Régulariser"}
            </button>
            <button onClick={() => setOuvert(false)} disabled={busy}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-700">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
