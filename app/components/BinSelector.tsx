"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "../lib/api";

/**
 * SÉLECTEUR D'EMPLACEMENT EN CASCADE.
 *
 * Entrepôt → Rayon → Location → Level → BIN. Chaque niveau ne propose que ce
 * qui existe SOUS le niveau choisi : un bin d'un autre rayon n'apparaît jamais.
 *
 * L'arborescence vient du serveur, qui n'y met que les bacs exploitables. Les
 * emplacements de rebut, les bins non précisés, les plages « BIN1-2 » et les
 * composantes générées en sont absents — ils ne sont pas des destinations.
 */

export type Bin = {
  id: number; bin: string; code: string;
  quantity: number; reserved: number; available: number;
  status: "EMPTY" | "OCCUPIED";
};
type Tree = Record<string, Record<string, Record<string, Record<string, Bin[]>>>>;

/** Un rayon réel dont aucun bac n'est sélectionnable, et pourquoi. */
export type RayonIndisponible = {
  motif: string; explication: string; bacs: number; quantite: number;
};
type Indisponibles = Record<string, Record<string, RayonIndisponible>>;

/** Un niveau réel dont aucun bac n'est sélectionnable, et pourquoi. */
export type NiveauIndisponible = RayonIndisponible & { rang: number; regularisable: boolean };
/* entrepôt → rayon → étagère → niveau */
type Chemins = Record<string, Record<string, Record<string, Record<string, NiveauIndisponible>>>>;

const n = (v: unknown) => Number(v || 0).toLocaleString("fr-FR");
const SELECT = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400";

export function useBinTree() {
  const [tree, setTree] = useState<Tree>({});
  /* Les rayons réels qu'on ne peut pas proposer comme destination. Ils sont
     tenus à part de `tree` : les y mettre les rendrait sélectionnables, et un
     transfert partirait vers un emplacement que personne ne peut retrouver. */
  const [indisponibles, setIndisponibles] = useState<Indisponibles>({});
  /* Le détail complet : un niveau écarté ne doit pas disparaître davantage
     qu'un rayon écarté. C'est ce qui manquait — le niveau D1 s'évaporait
     parce que D2 et D3 allaient bien. */
  const [chemins, setChemins] = useState<Chemins>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await authFetch("/stock/locations/tree", { cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      setTree(data.tree || {});
      setIndisponibles(data.rayonsIndisponibles || {});
      setChemins(data.cheminsIndisponibles || {});
    } else setError("Erreur de chargement des emplacements.");
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return { tree, indisponibles, chemins, loading, error, reload: load };
}

export default function BinSelector({
  tree, indisponibles = {}, chemins = {}, value, onSelect, label = "Emplacement",
  disabled = false, compact = false,
}: {
  tree: Tree;
  indisponibles?: Indisponibles;
  chemins?: Chemins;
  value: Bin | null;
  onSelect: (bin: Bin | null) => void;
  label?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [w, setW] = useState("");
  const [r, setR] = useState("");
  const [l, setL] = useState("");
  const [lv, setLv] = useState("");

  /* Un emplacement choisi ailleurs (ou rechargé) repositionne les sélecteurs,
     sinon l'écran afficherait un bin sans son chemin. */
  useEffect(() => {
    if (!value) return;
    for (const [kw, rows] of Object.entries(tree)) {
      for (const [kr, locs] of Object.entries(rows)) {
        for (const [kl, levels] of Object.entries(locs)) {
          for (const [klv, bins] of Object.entries(levels)) {
            if (bins.some((b) => b.id === value.id)) {
              setW(kw); setR(kr); setL(kl); setLv(klv);
              return;
            }
          }
        }
      }
    }
  }, [value, tree]);

  const entrepots = useMemo(() => Object.keys(tree).sort(), [tree]);
  const rayons = useMemo(() => (w && tree[w] ? Object.keys(tree[w]).sort() : []), [tree, w]);
  const locations = useMemo(
    () => (w && r && tree[w]?.[r] ? Object.keys(tree[w][r]).sort() : []), [tree, w, r]);
  /* PAS de .sort() : le serveur les a déjà rangés par rang physique, et
     l'ordre d'insertion de l'objet JSON le conserve. Trier ici remettrait
     « TOP » entre « 3 » et « 4 », et « D10 » avant « D2 ». */
  const levels = useMemo(
    () => (w && r && l && tree[w]?.[r]?.[l] ? Object.keys(tree[w][r][l]) : []), [tree, w, r, l]);
  const bins: Bin[] = useMemo(
    () => (w && r && l && lv ? tree[w]?.[r]?.[l]?.[lv] || [] : []), [tree, w, r, l, lv]);

  /* Changer un niveau invalide tout ce qui est en dessous : on ne garde jamais
     un bin qui n'appartient plus au chemin affiché. */
  const set = (niveau: "w" | "r" | "l" | "lv", v: string) => {
    onSelect(null);
    if (niveau === "w") { setW(v); setR(""); setL(""); setLv(""); }
    if (niveau === "r") { setR(v); setL(""); setLv(""); }
    if (niveau === "l") { setL(v); setLv(""); }
    if (niveau === "lv") setLv(v);
  };

  /* Les étagères du rayon choisi qui n'offrent aucun niveau sélectionnable. */
  const etageresEcartees = useMemo(() => {
    const sous = w && r ? chemins[w]?.[r] || {} : {};
    return Object.entries(sous)
      .filter(([et]) => !(tree[w]?.[r]?.[et]))
      .map(([et, niveaux]) => {
        const liste = Object.values(niveaux);
        return [et, {
          explication: liste[0]?.explication || "emplacement précis requis",
          bacs: liste.reduce((n2, x) => n2 + x.bacs, 0),
          quantite: liste.reduce((n2, x) => n2 + x.quantite, 0),
        }] as const;
      })
      .sort(([a2], [b2]) => a2.localeCompare(b2));
  }, [chemins, tree, w, r]);

  /* Les niveaux écartés de l'étagère choisie, à leur place physique. */
  const niveauxEcartes = useMemo(() => {
    const sous = w && r && l ? chemins[w]?.[r]?.[l] || {} : {};
    return Object.entries(sous).sort((a2, b2) => (a2[1].rang ?? 8999) - (b2[1].rang ?? 8999));
  }, [chemins, w, r, l]);

  const rayonsEcartes = useMemo(
    () => (w && indisponibles[w] ? Object.entries(indisponibles[w]).sort(([a], [b]) => a.localeCompare(b)) : []),
    [indisponibles, w]
  );

  const grille = compact ? "grid gap-2 sm:grid-cols-5" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-5";

  return (
    <div>
      {label && <p className="text-xs font-bold text-gray-700">{label}</p>}
      <div className={grille}>
        <label className="block text-xs text-gray-500">Entrepôt
          <select value={w} disabled={disabled} onChange={(e) => set("w", e.target.value)} className={SELECT}>
            <option value="">—</option>
            {entrepots.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="block text-xs text-gray-500">Rayon / ROW
          <select value={r} disabled={disabled || !w} onChange={(e) => set("r", e.target.value)} className={SELECT}>
            <option value="">—</option>
            {rayons.map((x) => <option key={x} value={x}>{x}</option>)}
            {/* Un rayon réel sans bac précis reste VISIBLE mais non choisissable.
                Le faire disparaître donnait à croire qu'il n'existait plus :
                la liste commençait à F et personne ne pouvait deviner où
                étaient passés A à E. */}
            {rayonsEcartes.map(([nom, info]) => (
              <option key={`x-${nom}`} value="" disabled>
                {nom} — emplacement précis requis{info.quantite > 0 ? ` (${n(info.quantite)} en stock)` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-500">Location
          <select value={l} disabled={disabled || !r} onChange={(e) => set("l", e.target.value)} className={SELECT}>
            <option value="">—</option>
            {locations.map((x) => <option key={x} value={x}>{x}</option>)}
            {/* Une étagère entière peut n'avoir aucun niveau utilisable : elle
                reste affichée, sinon elle semblerait ne pas exister. */}
            {etageresEcartees.map(([nom, info]) => (
              <option key={`x-${nom}`} value="" disabled>
                {nom} — emplacement précis requis{info.quantite > 0 ? ` (${n(info.quantite)} en stock)` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-500">Level
          <select value={lv} disabled={disabled || !l} onChange={(e) => set("lv", e.target.value)} className={SELECT}>
            <option value="">—</option>
            {levels.map((x) => <option key={x} value={x}>{x}</option>)}
            {/* LE CAS ZERBO : D2 et D3 sont bons, D1 n'a que des FULLBIN. Sans
                cette ligne, D1 disparaissait purement et simplement et son
                stock devenait introuvable. */}
            {niveauxEcartes.map(([nom, info]) => (
              <option key={`x-${nom}`} value="" disabled>
                {nom} — emplacement précis requis{info.quantite > 0 ? ` (${n(info.quantite)} en stock)` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-500">BIN
          <select value={value?.id || ""} disabled={disabled || !lv}
                  onChange={(e) => onSelect(bins.find((b) => String(b.id) === e.target.value) || null)}
                  className={SELECT}>
            <option value="">—</option>
            {bins.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bin} — {b.status === "EMPTY" ? "VIDE" : `OCCUPÉ ${n(b.quantity)}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* Un rayon écarté laisse le doute : « est-il perdu ? ». On répond, avec
          le chiffre qui compte — le stock qui attend d'être localisé. */}
      {/* Un niveau écarté sous le chemin courant : la phrase la plus utile,
          parce qu'elle répond à « où est passé D1 ? » au moment exact où la
          question se pose. */}
      {niveauxEcartes.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-bold">
            {niveauxEcartes.length} niveau{niveauxEcartes.length > 1 ? "x" : ""} de {r} / {l}{" "}
            {niveauxEcartes.length > 1 ? "existent" : "existe"} mais ne {niveauxEcartes.length > 1 ? "peuvent" : "peut"} pas
            recevoir de transfert.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {niveauxEcartes.map(([nom, info]) => (
              <li key={nom}>
                <b>{nom}</b> — {info.explication}
                {info.quantite > 0 ? ` · ${n(info.quantite)} en stock` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1">
            Leur stock est conservé. Pour les rendre utilisables, précisez le bac
            depuis l’inventaire des emplacements.
          </p>
          <a href="/emplacements?statut=A_REGULARISER"
             className="mt-1 inline-block font-bold text-blue-700 underline">
            Ouvrir la régularisation des emplacements
          </a>
        </div>
      )}

      {w && rayonsEcartes.length > 0 && rayons.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-bold">
            {rayonsEcartes.length} rayon{rayonsEcartes.length > 1 ? "s" : ""} de {w} ne {rayonsEcartes.length > 1 ? "peuvent" : "peut"} pas encore recevoir de transfert
            {rayonsEcartes.some(([, i]) => i.quantite > 0)
              ? ` (${n(rayonsEcartes.reduce((t, [, i]) => t + i.quantite, 0))} unités concernées)`
              : ""}.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {rayonsEcartes.map(([nom, info]) => (
              <li key={nom}>
                <b>{nom}</b> — {info.explication}
                {info.quantite > 0 ? ` · ${n(info.quantite)} en stock` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1">
            Leur stock est conservé et reste consultable. Pour les rendre
            utilisables, précisez le bac depuis l’inventaire des emplacements —
            rien n’est déplacé sans que vous indiquiez les quantités.
          </p>
        </div>
      )}
      {w && rayons.length === 0 && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-bold">
            L’entrepôt {w} existe, mais il n’a encore aucun bac physique précis utilisable.
          </p>
          <p className="mt-1">
            Ses anciens emplacements « FULLBIN » doivent être confirmés avant tout transfert.
          </p>
          <a
            href="/emplacements?statut=A_REGULARISER"
            className="mt-2 inline-block font-bold text-blue-700 underline"
          >
            Ouvrir la régularisation des emplacements
          </a>
        </div>
      )}

      {value && (
        <p className="mt-1 text-xs text-gray-600">
          <span className="font-bold">{value.code}</span> — {value.status === "EMPTY" ? "vide" : "occupé"} ·
          quantité {n(value.quantity)} · réservé {n(value.reserved)} ·
          <span className="font-bold"> disponible {n(value.available)}</span>
        </p>
      )}
    </div>
  );
}
