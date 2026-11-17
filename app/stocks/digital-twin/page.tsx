"use client";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import {
  Box,
  Building2,
  Layers3,
  Search,
  RefreshCw,
  Settings2,
  ArrowLeft,
  MapPin,
  Triangle,
  AlertTriangle,
  PackageOpen,
} from "lucide-react";
import { authFetch } from "../../lib/api";
import {
  Warehouse,
  Snapshot,
  PlanNode,
  Metrics,
  ColorMode,
  format,
  quantityText,
  labels,
  stateLabels,
  descendants,
  Balance,
  Location,
} from "./types";
import Scene from "./Scene";
import { AccessGate } from "./Access";
import Navigation from "./Navigation";
import { automaticNodes, automaticScene, address } from "./automatic";
import Configurator from "./Configurator";
import "./twin.css";
type Detail = {
  location: Location;
  balances: Balance[];
  movements: {
    id: number;
    type: string;
    quantity: number;
    status: string;
    created_at: string;
    product_name: string;
  }[];
  next_cursor: number | null;
  lots_serials: string;
};
type Hit = {
  location_id: number;
  warehouse_id: number;
  full_code: string;
  emplacement_code: string;
  products: {
    product_id: number;
    name: string;
    reference: string;
    unit: string;
    quantity: string;
  }[];
};
const legends: Record<ColorMode, string[]> = {
  contenu: [
    "Gris : aucun stock enregistré",
    "Vert : stock enregistré",
    "Bleu : réservation",
    "Jaune : contenu à vérifier",
    "Violet : indisponible",
  ],
  occupation: [
    "Gris : vide",
    "Vert : normal",
    "Jaune : occupation élevée",
    "Rouge : plein ou dépassement (voir %)",
    "Ardoise : occupation inconnue",
  ],
  disponibilite: [
    "Vert : capacité disponible connue",
    "Bleu : réservation",
    "Violet : indisponible",
    "Rouge : capacité atteinte",
    "Ardoise : disponibilité inconnue",
  ],
  etat: [
    "Vert : actif",
    "Violet : bloqué, quarantaine, maintenance ou inactif",
  ],
  alertes: [
    "Vert : aucune alerte de capacité détectée",
    "Jaune : capacité à vérifier",
    "Rouge : surcharge",
  ],
};
export default function DigitalTwinPage() {
  return <AccessGate><DigitalTwin /></AccessGate>;
}
function DigitalTwin() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]),
    [warehouseId, setWarehouseId] = useState<number | null>(null),
    [rawData, setData] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<string | null>(null),
    [view, setView] = useState("2d"),
    [mode, setMode] = useState<ColorMode>("contenu"),
    [showLabels, setShowLabels] = useState(true),
    [facade, setFacade] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null),
    [detailLocation, setDetailLocation] = useState<number | null>(null),
    [config, setConfig] = useState(false);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [asOf, setAsOf] = useState(""),
    [q, setQ] = useState(""),
    [hits, setHits] = useState<Hit[]>([]),
    [searchCursor, setSearchCursor] = useState<number | null>(null),
    [searchError, setSearchError] = useState("");
  const [automatic, setAutomatic] = useState(true);
  const schematic = automatic || !rawData?.layout;
  const data = useMemo(
    () =>
      rawData
        ? {
            ...rawData,
            nodes: schematic ? automaticNodes(rawData) : rawData.nodes,
          }
        : null,
    [rawData, schematic],
  );
  const pendingLocation = useRef<number | null>(null),
    generation = useRef(0);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const g = ++generation.current;
      setLoading(true);
      try {
        const r = await authFetch(
          warehouseId
            ? `/digital-twin/warehouses/${warehouseId}`
            : "/digital-twin/warehouses",
          { cache: "no-store", signal },
        );
        const j = await r.json().catch(() => ({
          error: "Module non activé ou réponse indisponible.",
        }));
        if (!r.ok) throw Error(j.error || "Chargement impossible.");
        if (g !== generation.current) return;
        if (warehouseId) {
          setData(j);
          const refreshedNodes =
            automatic || !j.layout ? automaticNodes(j) : j.nodes;
          setSelected((previous) =>
            refreshedNodes.some((n: PlanNode) => n.id === previous)
              ? previous
              : null,
          );
          setDetailLocation((previous) =>
            j.locations.some((l: Location) => l.id === previous)
              ? previous
              : null,
          );
          if (pendingLocation.current) {
            const viewNodes =
              automatic || !j.layout ? automaticNodes(j) : j.nodes;
            const n = viewNodes.find(
              (n: PlanNode) =>
                Number(n.location_id) === pendingLocation.current,
            );
            if (n) setSelected(n.id);
            setDetailLocation(pendingLocation.current);
            pendingLocation.current = null;
          }
        } else setWarehouses(j.warehouses);
        setAsOf(j.as_of);
        setError("");
      } catch (e) {
        if (
          e instanceof Error &&
          e.name !== "AbortError" &&
          g === generation.current
        )
          setError(e.message);
      } finally {
        if (g === generation.current) setLoading(false);
      }
    },
    [warehouseId, automatic],
  );
  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    const timer = setInterval(() => {
      if (!document.hidden && !config) void load(c.signal);
    }, 15000);
    const focus = () => {
      if (!config) void load(c.signal);
    };
    window.addEventListener("focus", focus);
    window.addEventListener("triangle:stock-committed", focus);
    return () => {
      c.abort();
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("triangle:stock-committed", focus);
    };
  }, [load, config]);
  const node = data?.nodes.find((n) => n.id === selected) || null;
  useEffect(() => {
    if (node?.kind === "bin") setDetailLocation(node.location_id);
    else if (node) setDetailLocation(null);
  }, [node?.id, node?.kind, node?.location_id]);
  useEffect(() => {
    const c = new AbortController();
    setDetail(null);
    if (!warehouseId || !detailLocation) return;
    authFetch(
      `/digital-twin/warehouses/${warehouseId}/locations/${detailLocation}`,
      { signal: c.signal, cache: "no-store" },
    )
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        setDetail(j);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, [warehouseId, detailLocation, data?.as_of]);
  useEffect(() => {
    const c = new AbortController();
    if (q.trim().length < 2) {
      setHits([]);
      setSearchCursor(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const r = await authFetch(
          `/digital-twin/search?q=${encodeURIComponent(q)}`,
          { signal: c.signal },
        );
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        setHits(j.results);
        setSearchCursor(j.next_cursor);
        setSearchError("");
      } catch (e) {
        if (e instanceof Error && e.name !== "AbortError")
          setSearchError(e.message);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [q]);
  function openWarehouse(id: number, nextView = view) {
    setWarehouseId(id);
    setData(null);
    setSelected(null);
    setDetailLocation(null);
    setConfig(false);
    setView(nextView);
    setFacade(false);
  }
  function select(id: string) {
    setSelected(id);
    setFacade(false);
  }
  function locate(hit: Hit) {
    pendingLocation.current = hit.location_id;
    if (warehouseId === hit.warehouse_id) {
      const n = data?.nodes.find(
        (n) => Number(n.location_id) === hit.location_id,
      );
      setSelected(n?.id || null);
      setDetailLocation(hit.location_id);
      pendingLocation.current = null;
    } else openWarehouse(hit.warehouse_id);
  }
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    if (expanded) window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [expanded]);
  const root = data?.nodes.find((n) => n.kind === "warehouse");
  const focus = node || root;
  const breadcrumb: PlanNode[] = [];
  let current = focus;
  while (current) {
    breadcrumb.unshift(current);
    current = data?.nodes.find((n) => n.id === current?.parent_id);
  }
  const sceneNodes = !data
    ? []
    : schematic
      ? automaticScene(data.nodes, focus)
      : facade && node?.kind === "rack"
        ? descendants(data.nodes, node.id).filter((n) => n.kind === "bin")
        : focus?.kind === "bin"
          ? data.nodes.filter((n) => n.parent_id === focus.parent_id)
          : data.nodes.filter((n) => n.parent_id === focus?.id);
  const visible = data?.nodes.filter((n) => n.parent_id === focus?.id) || [];
  const sceneLocations = new Set(
    sceneNodes
      .filter((n) => n.location_id != null)
      .map((n) => Number(n.location_id)),
  );
  const tableLocations =
    data?.locations.filter(
      (l) => !schematic || sceneLocations.has(Number(l.id)),
    ) || [];
  const allMetrics = warehouses
    .map((w) => w.metrics)
    .filter((m): m is Metrics => !!m);
  return (
    <main className="dt-shell">
      <aside className="dt-sidebar">
        <Link href="/stocks" className="dt-brand">
          <Triangle size={34} />
          <span>
            TRIANGLE<small>WMS PRO</small>
          </span>
        </Link>
        <p className="dt-nav-label">OPÉRATIONS</p>
        <Link href="/dashboard">Tableau de bord</Link>
        <button
          className="dt-current"
          onClick={() => {
            setWarehouseId(null);
            setData(null);
            setSelected(null);
            setDetailLocation(null);
            setConfig(false);
          }}
        >
          ◈ Digital Twin 3D
        </button>
        <Link href="/stocks/entrepots">Entrepôts</Link>
        <Link href="/emplacements">Emplacements</Link>
        <Link href="/stocks">Stocks & sorties</Link>
        <Link href="/stocks/receptions">Réceptions</Link>
        <Link href="/inventaires">Inventaires</Link>
        <Link href="/rapports">Rapports</Link>
        <div className="dt-sidebar-note">
          <Layers3 size={24} />
          <p>
            Une implantation réelle.
            <br />
            Un stock unique.
          </p>
        </div>
      </aside>
      <div className="dt-main">
        <header className="dt-topbar">
          <div>
            <span className="dt-eyebrow">VISUALISATION INTELLIGENTE</span>
            <h1>
              Digital Twin <em>3D</em>
            </h1>
          </div>
          <div className="dt-search">
            <Search size={18} />
            <input
              aria-label="Rechercher un produit ou un emplacement"
              placeholder="Produit, référence, code-barres, emplacement…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            aria-label="Actualiser les données"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={18} />
          </button>
        </header>
        {q.trim().length >= 2 && (
          <section className="dt-search-results">
            <div className="dt-heading">
              <h3>Localisations accessibles</h3>
              <button onClick={() => setQ("")}>Fermer</button>
            </div>
            {searchError ? (
              <p role="alert">{searchError}</p>
            ) : !hits.length ? (
              <p>Aucun emplacement trouvé.</p>
            ) : (
              hits.map((h) => (
                <button key={h.location_id} onClick={() => locate(h)}>
                  <MapPin size={17} />
                  <span>
                    {h.full_code || h.emplacement_code}
                    <small>
                      {h.products
                        .map(
                          (p) => `${p.name} : ${format(p.quantity)} ${p.unit}`,
                        )
                        .join(" · ")}
                    </small>
                  </span>
                </button>
              ))
            )}
            {searchCursor && (
              <button
                onClick={async () => {
                  const r = await authFetch(
                    `/digital-twin/search?q=${encodeURIComponent(q)}&after=${searchCursor}`,
                  );
                  if (r.ok) {
                    const j = await r.json();
                    setHits([...hits, ...j.results]);
                    setSearchCursor(j.next_cursor);
                  } else setSearchError("Suite des résultats indisponible.");
                }}
              >
                Voir les localisations suivantes
              </button>
            )}
          </section>
        )}
        <div className="dt-content">
          {error && (
            <p role="alert" className="dt-error">
              {error}{" "}
              {asOf && "Les dernières données affichées peuvent être périmées."}
            </p>
          )}
          <div className="dt-heading">
            <div>
              <span className="dt-eyebrow">
                {warehouseId ? "EXPLORATION" : "VUE D’ENSEMBLE"}
              </span>
              <h2>
                {data?.warehouse.name ||
                  data?.warehouse.code ||
                  (warehouseId
                    ? "Chargement de l’entrepôt…"
                    : "Vos entrepôts, en un regard")}
              </h2>
              <p>
                {warehouseId
                  ? data?.warehouse.location
                  : "Explorez les zones, les racks et les emplacements de stockage."}
              </p>
            </div>
            <span className="dt-sync">
              {loading
                ? "Actualisation…"
                : asOf
                  ? `Lu à ${new Date(asOf).toLocaleTimeString("fr-FR")} · actualisation 15 s`
                  : ""}
            </span>
          </div>
          {!warehouseId ? (
            <>
              <div className="dt-kpis">
                <Stat title="Entrepôts accessibles" value={warehouses.length} />
                <Stat
                  title="Emplacements enregistrés"
                  value={warehouses.reduce((sum, w) => sum + w.locations, 0)}
                />
                <Stat
                  title="Bins vides confirmés¹"
                  value={allMetrics.reduce((s, m) => s + m.empty, 0)}
                />
                <Stat
                  title="Bins occupés¹"
                  value={allMetrics.reduce((s, m) => s + m.occupied, 0)}
                />
                <Stat
                  title="Bins indisponibles¹"
                  value={allMetrics.reduce((s, m) => s + m.blocked, 0)}
                />
                <Stat
                  title="Surcharges détectées¹"
                  value={allMetrics.reduce((s, m) => s + m.overloaded, 0)}
                />
              </div>
              <p className="dt-footnote">
                ¹ Sur les plans configurés uniquement. Les capacités de
                différentes unités ne sont pas additionnées.
              </p>
              <div className="dt-warehouse-grid">
                {warehouses.map((w) => (
                  <article className="dt-warehouse" key={w.id}>
                    <div className="dt-warehouse-visual">
                      <Building2 size={66} />
                      <span>{w.code}</span>
                      <small>
                        {w.configured
                          ? `${w.locations} emplacements · plan mesuré disponible`
                          : "Vue automatique 2D / 3D disponible"}
                      </small>
                    </div>
                    <div className="dt-card-body">
                      <span className="dt-eyebrow">{w.code}</span>
                      <h3>{w.name || w.code}</h3>
                      <p>
                        <MapPin size={14} />
                        {w.location || "Adresse non renseignée"}
                      </p>
                      <div className="dt-card-stats">
                        <span>{w.locations} emplacements</span>
                        <span>Visuel synchronisé avec les emplacements</span>
                      </div>
                      {w.metrics && <CapacityBlock metrics={w.metrics} />}
                      {(w.discrepancies > 0 || w.unallocated > 0) && (
                        <details className="dt-integrity">
                          <summary>Répartition des stocks à vérifier</summary>
                          <p>
                            {w.discrepancies || 0} références en écart ·{" "}
                            {w.unallocated} répartitions historiques. Le visuel
                            reste disponible.
                          </p>
                        </details>
                      )}
                      <div className="dt-toolbar">
                        <button
                          className="dt-primary"
                          onClick={() => openWarehouse(w.id, "3d")}
                        >
                          Explorer en 3D
                        </button>
                        <button onClick={() => openWarehouse(w.id, "2d")}>
                          Plan 2D
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {!loading && !warehouses.length && (
                <div className="dt-empty">
                  Aucun entrepôt autorisé à afficher.
                </div>
              )}
            </>
          ) : data ? (
            <>
              <nav
                className="dt-breadcrumb"
                aria-label="Navigation hiérarchique"
              >
                <button
                  onClick={() => {
                    setWarehouseId(null);
                    setData(null);
                    setDetailLocation(null);
                    setConfig(false);
                  }}
                >
                  <ArrowLeft size={14} /> Entrepôts
                </button>
                {breadcrumb.map((n) => (
                  <button key={n.id} onClick={() => select(n.id)}>
                    {n.code}
                  </button>
                ))}
              </nav>
              {config ? (
                <Configurator
                  key={data.warehouse.id}
                  data={rawData!}
                  onClose={() => setConfig(false)}
                  onPublished={() => {
                    setConfig(false);
                    void load();
                  }}
                />
              ) : (
                <>
                  <div className="dt-toolbar">
                    <div className="dt-segment">
                      <button
                        className={view === "2d" ? "active" : ""}
                        onClick={() => setView("2d")}
                      >
                        Plan 2D
                      </button>
                      <button
                        className={view === "3d" ? "active" : ""}
                        onClick={() => {
                          setView("3d");
                          setFacade(false);
                        }}
                      >
                        Vue 3D
                      </button>
                    </div>
                    <select
                      aria-label="Type de plan"
                      value={schematic ? "auto" : "physical"}
                      onChange={(e) => {
                        const next = e.target.value === "auto";
                        const ns = next
                          ? automaticNodes(rawData!)
                          : rawData!.nodes;
                        const matched = detailLocation
                          ? ns.find((n) => n.location_id === detailLocation)
                          : null;
                        setAutomatic(next);
                        setSelected(matched?.id || null);
                        setMode("contenu");
                      }}
                    >
                      <option value="auto">Vue automatique</option>
                      <option value="physical" disabled={!rawData?.layout}>
                        Plan physique mesuré
                      </option>
                    </select>
                    <select
                      aria-label="Mode de couleur"
                      value={mode}
                      onChange={(e) => setMode(e.target.value as ColorMode)}
                    >
                      <option value="contenu">Contenu enregistré</option>
                      <option value="occupation" disabled={schematic}>
                        Occupation physique
                      </option>
                      <option value="disponibilite" disabled={schematic}>
                        Disponibilité physique
                      </option>
                      <option value="etat">État opérationnel</option>
                      <option value="alertes">Alertes de capacité</option>
                      <option disabled>Rotation — données à qualifier</option>
                      <option disabled>Marchandise — règles à qualifier</option>
                    </select>
                    <label>
                      <input
                        type="checkbox"
                        checked={showLabels}
                        onChange={(e) => setShowLabels(e.target.checked)}
                      />{" "}
                      Étiquettes
                    </label>
                    {!schematic && node?.kind === "rack" && (
                      <button
                        onClick={() => {
                          setFacade(!facade);
                          setView("2d");
                        }}
                      >
                        Façade du rack
                      </button>
                    )}
                    {data.capabilities.configure && (
                      <button onClick={() => setConfig(true)}>
                        <Settings2 size={16} /> Plan mesuré (facultatif)
                      </button>
                    )}
                  </div>
                  {schematic && (
                    <p className="dt-auto-notice">
                      Sélectionnez un rayon pour voir ses étagères, puis un bin
                      pour consulter son contenu. Vue schématique · positions et
                      mobilier illustratifs · stocks enregistrés · actualisation
                      15 s.
                    </p>
                  )}
                  {(data.unallocated.length > 0 ||
                    data.discrepancies?.length > 0) && (
                    <details className="dt-integrity">
                      <summary>
                        <AlertTriangle size={16} /> Stocks à vérifier :{" "}
                        {data.discrepancies?.length || 0} références en écart ·{" "}
                        {data.unallocated.length} répartitions historiques
                      </summary>
                      {data.unallocated.length > 0 && (
                        <p className="dt-warning">
                          <AlertTriangle size={16} /> {data.unallocated.length}{" "}
                          produits historiques ont une répartition à vérifier.
                          Leur stock global n’est pas attribué artificiellement
                          à un bin.
                        </p>
                      )}
                      {data.discrepancies?.length > 0 && (
                        <div className="dt-warning" role="status">
                          <AlertTriangle size={16} />{" "}
                          {data.discrepancies.length} références ont un écart
                          entre stock global et répartition. Les quantités
                          enregistrées restent consultables ; les emplacements
                          concernés ne sont pas déclarés libres et leurs
                          capacités disponibles ne sont pas calculées.
                          <details>
                            <summary>
                              Références à vérifier dans les stocks
                            </summary>
                            <ul>
                              {data.discrepancies.map((p) => (
                                <li key={p.id}>
                                  {p.reference} — {p.name}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </div>
                      )}
                    </details>
                  )}
                  {schematic && (
                    <Navigation
                      nodes={data.nodes}
                      selected={selected}
                      onSelect={select}
                    />
                  )}
                  <div className="dt-explorer">
                    <section
                      className={
                        "dt-scene-card" + (expanded ? " dt-expanded" : "")
                      }
                    >
                      <div className="dt-scene-title">
                        <div>
                          <h3>
                            {focus
                              ? `${focus.display_label || labels[focus.kind]} · ${focus.code}`
                              : "Implantation non configurée"}
                          </h3>
                          <span>
                            {schematic
                              ? "Organisation automatique des emplacements enregistrés"
                              : view === "3d"
                                ? "Volumes aux dimensions enregistrées"
                                : "Coordonnées physiques en mètres"}
                          </span>
                        </div>
                        <button onClick={() => setExpanded(!expanded)}>
                          {expanded ? "Réduire la vue" : "Agrandir la vue"}
                        </button>
                      </div>
                      {schematic || data.layout ? (
                        <Scene
                          nodes={sceneNodes}
                          schematic={schematic}
                          overview={focus?.kind === "warehouse"}
                          selected={selected}
                          onSelect={select}
                          mode={mode}
                          view={view}
                          labels={showLabels}
                          facade={facade}
                          onUnavailable={() => setView("2d")}
                        />
                      ) : (
                        <div className="dt-empty">
                          <PackageOpen size={44} />
                          <h3>Aucun plan publié</h3>
                          <p>
                            Les emplacements existants restent consultables
                            ci-dessous. Un administrateur doit renseigner les
                            zones, allées, racks et dimensions réelles.
                          </p>
                        </div>
                      )}
                      <div className="dt-legend">
                        {legends[mode].map((s) => (
                          <span key={s}>{s}</span>
                        ))}
                      </div>
                    </section>
                    <aside className="dt-details">
                      <span className="dt-eyebrow">FICHE DÉTAILLÉE</span>
                      <h3>
                        {detail?.location.full_code ||
                          node?.code ||
                          data.warehouse.code}
                      </h3>
                      <p>{node?.name}</p>
                      {node && (
                        <span className="dt-status">
                          {
                            stateLabels[
                              node.effective_state || node.operational_state
                            ]
                          }
                        </span>
                      )}
                      {!schematic && (
                        <CapacityBlock metrics={focus?.metrics || null} />
                      )}
                      {focus?.metrics && (
                        <dl>
                          <dt>Emplacements</dt>
                          <dd>{focus.metrics.bins}</dd>
                          <dt>
                            {schematic
                              ? "Sans stock enregistré"
                              : "Vides confirmés"}
                          </dt>
                          <dd>{focus.metrics.empty}</dd>
                          <dt>Occupés</dt>
                          <dd>{focus.metrics.occupied}</dd>
                          <dt>Indisponibles</dt>
                          <dd>{focus.metrics.blocked}</dd>
                        </dl>
                      )}
                      {node?.geometry && !schematic && (
                        <p>
                          Dimensions : {format(node.geometry.width)} ×{" "}
                          {format(node.geometry.depth)} ×{" "}
                          {format(node.geometry.height)} m
                        </p>
                      )}
                      {detail && (
                        <>
                          <h4>Stock réel par référence</h4>
                          {detail.location.unverified && (
                            <p className="dt-warning">
                              Répartition à vérifier : aucune disponibilité
                              physique ne peut être confirmée.
                            </p>
                          )}
                          {detail.balances.length ? (
                            detail.balances.map((b) => (
                              <div className="dt-product" key={b.product_id}>
                                <strong>{b.name}</strong>
                                <small>{b.reference}</small>
                                {b.unverified && (
                                  <p className="dt-warning">
                                    Quantité enregistrée — répartition non
                                    vérifiée
                                  </p>
                                )}
                                <p>
                                  {quantityText(b.quantity)} {b.unit} ·{" "}
                                  {quantityText(b.reserved_quantity)} réservés ·{" "}
                                  {quantityText(b.available)}{" "}
                                  {b.unverified
                                    ? "hors réservation (à vérifier)"
                                    : "disponibles"}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p>Aucune balance de stock enregistrée.</p>
                          )}
                          <p className="dt-footnote">{detail.lots_serials}</p>
                          <h4>Historique des mouvements</h4>
                          {detail.movements.map((m) => (
                            <div className="dt-movement" key={m.id}>
                              <strong>
                                {m.type} · {format(m.quantity)}
                              </strong>
                              <small>
                                {m.product_name} · {m.status}
                                <br />
                                {new Date(m.created_at).toLocaleString("fr-FR")}
                              </small>
                            </div>
                          ))}
                          {!detail.movements.length && (
                            <p>Aucun mouvement rattaché.</p>
                          )}
                          {detail.next_cursor && (
                            <button
                              onClick={async () => {
                                const r = await authFetch(
                                  `/digital-twin/warehouses/${warehouseId}/locations/${detailLocation}?before=${detail.next_cursor}`,
                                );
                                if (r.ok) {
                                  const j = await r.json();
                                  setDetail({
                                    ...j,
                                    movements: [
                                      ...detail.movements,
                                      ...j.movements,
                                    ],
                                  });
                                } else setError("Historique indisponible.");
                              }}
                            >
                              Mouvements précédents
                            </button>
                          )}
                        </>
                      )}
                    </aside>
                  </div>
                  {!schematic && !!visible.length && (
                    <div className="dt-zone-grid">
                      {visible.map((n) => (
                        <button
                          className="dt-zone"
                          key={n.id}
                          onClick={() => select(n.id)}
                        >
                          <span className="dt-eyebrow">
                            {n.display_label || labels[n.kind]}
                          </span>
                          <strong>
                            {n.code} {n.name}
                          </strong>
                          {!schematic && (
                            <CapacityBlock metrics={n.metrics || null} />
                          )}
                          <small>
                            {n.metrics?.empty || 0} sans stock enregistré ·{" "}
                            {n.metrics?.occupied || 0} occupés ·{" "}
                            {
                              stateLabels[
                                n.effective_state || n.operational_state
                              ]
                            }
                          </small>
                        </button>
                      ))}
                    </div>
                  )}
                  <section className="dt-panel">
                    <h3>Emplacements et contenu · {tableLocations.length}</h3>
                    <div className="dt-table-scroll">
                      <table className="dt-location-table">
                        <thead>
                          <tr>
                            {[
                              "Code",
                              "Rayon",
                              "Étagère",
                              "Niveau",
                              "Bin",
                              "Contenu",
                            ].map((h) => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableLocations.map((l) => {
                            const a = address(l),
                              bs = data.balances.filter(
                                (b) => Number(b.location_id) === Number(l.id),
                              );
                            return (
                              <tr
                                key={l.id}
                                className={
                                  detailLocation === l.id ? "selected" : ""
                                }
                              >
                                <td>
                                  <button
                                    onClick={() => {
                                      const n = data.nodes.find(
                                        (n) => n.location_id === l.id,
                                      );
                                      setSelected(n?.id || null);
                                      setDetailLocation(l.id);
                                    }}
                                  >
                                    {l.full_code || l.emplacement_code || l.id}
                                  </button>
                                </td>
                                <td>{a.rayon || "—"}</td>
                                <td>{a.etagere || "—"}</td>
                                <td>{a.niveau || "—"}</td>
                                <td>{a.bin || "—"}</td>
                                <td>
                                  {bs.length
                                    ? bs.map((b) => (
                                        <div key={b.product_id}>
                                          {b.reference} · {b.name} :{" "}
                                          {quantityText(b.quantity)} {b.unit}
                                        </div>
                                      ))
                                    : l.unverified
                                      ? "Contenu à vérifier"
                                      : "Aucune balance enregistrée"}
                                  {l.configuration_issue && (
                                    <small>Repère à préciser</small>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <section className="dt-panel">
                    <h3>Préparer les opérations</h3>
                    <p>
                      Planning d’arrivées : informations non communiquées au
                      module. Les réceptions, sorties et inventaires restent
                      validés dans leurs écrans métier.
                    </p>
                    <div className="dt-toolbar">
                      <Link href="/stocks/receptions">
                        Ouvrir les réceptions →
                      </Link>
                      <Link href="/stocks">Préparer une sortie →</Link>
                      <Link href="/inventaires">Ouvrir les inventaires →</Link>
                    </div>
                  </section>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="dt-stat">
      <Box size={18} />
      <span>{title}</span>
      <strong>{format(value)}</strong>
    </div>
  );
}
function CapacityBlock({ metrics }: { metrics: Metrics | null }) {
  return (
    <div className="dt-capacity">
      {!metrics || !metrics.capacities.length ? (
        <p>Capacité physique non renseignée</p>
      ) : (
        metrics.capacities.map((c) => (
          <div key={c.unit}>
            <div className="dt-capacity-label">
              <span>
                {c.used === null
                  ? "Occupation inconnue"
                  : `${format(c.used)} / ${format(c.capacity)} ${c.unit}`}
              </span>
              <strong>
                {c.percent === null ? "—" : `${format(c.percent)} %`}
              </strong>
            </div>
            <div className="dt-meter">
              <i
                style={{
                  width: `${Math.min(100, c.percent || 0)}%`,
                  background:
                    c.percent !== null && c.percent >= 100
                      ? "#df4c59"
                      : c.percent !== null &&
                          c.percent >= metrics.high_threshold
                        ? "#eab849"
                        : "#16a37d",
                }}
              />
            </div>
            <small>
              {c.available === null
                ? "Unité ou répartition à vérifier"
                : `${format(c.available)} ${c.unit} disponibles`}{" "}
              · {c.bins} bins avec cette capacité
            </small>
          </div>
        ))
      )}
      {metrics?.unknown ? (
        <small>{metrics.unknown} bins : taux non calculable</small>
      ) : null}
    </div>
  );
}
