"use client";
import { useEffect, useState } from "react";
import { authFetch } from "../../lib/api";
import {
  Geometry,
  Kind,
  PlanNode,
  Snapshot,
  labels,
  stateLabels,
  descendants,
} from "./types";
import Scene from "./Scene";
const steps: Kind[] = ["warehouse", "zone", "aisle", "rack", "level", "bin"];
const emptyNode = (
  kind: Kind,
  code: string,
  parent_id: string | null,
): PlanNode => ({
  id: crypto.randomUUID(),
  parent_id,
  kind,
  code,
  name: "",
  zone_type: kind === "zone" ? "stockage" : null,
  location_id: null,
  geometry: null,
  capacity: null,
  capacity_unit: null,
  operational_state: "active",
});
export default function Configurator({
  data,
  onClose,
  onPublished,
}: {
  data: Snapshot;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [nodes, setNodes] = useState<PlanNode[]>(() =>
    data.nodes.length
      ? structuredClone(data.nodes)
      : [emptyNode("warehouse", data.warehouse.code, null)],
  );
  const [step, setStep] = useState(0),
    [selected, setSelected] = useState(nodes[0].id),
    [threshold, setThreshold] = useState(
      Number(data.layout?.high_threshold || 80),
    );
  const [draft, setDraft] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState(false),
    [view, setView] = useState("2d");
  const [history, setHistory] = useState<
    { id: string; state: string; created_at: string }[]
  >([]);
  useEffect(() => {
    const c = new AbortController();
    authFetch(`/digital-twin/warehouses/${data.warehouse.id}/layouts`, {
      signal: c.signal,
    })
      .then(async (r) => {
        if (r.ok) setHistory(await r.json());
      })
      .catch(() => {});
    return () => c.abort();
  }, [data.warehouse.id, draft]);
  async function resume(id: string) {
    if (!id) return;
    setBusy(true);
    try {
      const r = await authFetch(
        `/digital-twin/warehouses/${data.warehouse.id}/layouts/${id}`,
      );
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      if (
        String(j.base_id ?? "") !== String(data.layout?.id ?? "") &&
        j.state === "draft"
      )
        throw Error(
          "Ce brouillon repose sur une ancienne version. Reprenez le plan publié.",
        );
      setNodes(
        j.nodes.map((n: PlanNode) => ({
          ...n,
          capacity: n.capacity === null ? null : Number(n.capacity),
        })),
      );
      setThreshold(Number(j.high_threshold));
      setSelected(j.nodes[0]?.id || "");
      setDraft(j.state === "draft" ? j.id : null);
      setStep(6);
      setMessage("Version chargée pour vérification.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Version indisponible.");
    } finally {
      setBusy(false);
    }
  }
  const node = nodes.find((n) => n.id === selected),
    kind = steps[Math.min(step, 5)];
  const change = (patch: Partial<PlanNode>) => {
    setNodes((old) =>
      old.map((n) => (n.id === selected ? { ...n, ...patch } : n)),
    );
    setDraft(null);
    setConfirm(false);
  };
  const setDimension = (key: keyof Geometry, value: string) => {
    const next = { ...(node?.geometry || {}) } as Geometry;
    if (value === "") delete next[key];
    else next[key] = Number(value);
    change({ geometry: next });
  };
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const r = await authFetch(
        `/digital-twin/warehouses/${data.warehouse.id}/layouts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base_id: data.layout?.id || null,
            high_threshold: threshold,
            nodes,
          }),
        },
      );
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setDraft(j.id);
      setMessage("Brouillon enregistré. Les stocks sont inchangés.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Échec de sauvegarde.");
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!draft || !confirm) return;
    setBusy(true);
    try {
      const r = await authFetch(
        `/digital-twin/warehouses/${data.warehouse.id}/layouts/${draft}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmed: true }),
        },
      );
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      onPublished();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Échec de publication.");
    } finally {
      setBusy(false);
    }
  }
  const preview = nodes.filter((n) => n.kind === "zone");
  return (
    <section className="dt-config" aria-label="Assistant de configuration">
      <div className="dt-heading">
        <div>
          <span className="dt-eyebrow">IMPLANTATION RÉELLE</span>
          <h2>Configurer {data.warehouse.name || data.warehouse.code}</h2>
        </div>
        <button onClick={onClose}>Fermer</button>
      </div>
      <p>
        Les positions sont des coordonnées absolues en mètres, depuis l’origine
        du bâtiment. Aucune dimension n’est déduite. Les codes et identifiants
        métier restent conservés.
      </p>
      <label>
        Historique des plans{" "}
        <select defaultValue="" onChange={(e) => void resume(e.target.value)}>
          <option value="">Charger une version…</option>
          {history.map((h) => (
            <option key={h.id} value={h.id}>
              Version {h.id} · {h.state} ·{" "}
              {new Date(h.created_at).toLocaleString("fr-FR")}
            </option>
          ))}
        </select>
      </label>
      <div className="dt-tabs">
        {[...steps.map((k) => labels[k]), "Validation"].map((s, i) => (
          <button
            key={s}
            className={step === i ? "active" : ""}
            onClick={() => {
              setStep(i);
              setSelected(
                nodes.find((n) => n.kind === steps[i])?.id || nodes[0].id,
              );
            }}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>
      {step < 6 ? (
        <div className="dt-config-grid">
          <div>
            <h3>{labels[kind]}</h3>
            {nodes
              .filter((n) => n.kind === kind)
              .map((n) => (
                <button
                  className={`dt-node-option ${selected === n.id ? "active" : ""}`}
                  key={n.id}
                  onClick={() => setSelected(n.id)}
                >
                  {n.code}
                </button>
              ))}
            {kind !== "warehouse" && (
              <button
                onClick={() => {
                  const p = nodes.find((n) => n.kind === steps[step - 1]);
                  if (!p) {
                    setMessage("Créez d’abord le parent à l’étape précédente.");
                    return;
                  }
                  const n = emptyNode(kind, "", p.id);
                  setNodes([...nodes, n]);
                  setSelected(n.id);
                  setDraft(null);
                }}
              >
                + Ajouter {labels[kind].toLowerCase()}
              </button>
            )}
          </div>
          <div>
            {node && node.kind === kind && (
              <div className="dt-form">
                <label>
                  Code
                  <input
                    value={node.code}
                    onChange={(e) => change({ code: e.target.value })}
                  />
                </label>
                <label>
                  Nom
                  <input
                    value={node.name}
                    onChange={(e) => change({ name: e.target.value })}
                  />
                </label>
                {kind !== "warehouse" && (
                  <label>
                    Parent
                    <select
                      value={node.parent_id || ""}
                      onChange={(e) => change({ parent_id: e.target.value })}
                    >
                      {nodes
                        .filter((n) => n.kind === steps[step - 1])
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.code}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <label>
                  État
                  <select
                    value={node.operational_state}
                    onChange={(e) =>
                      change({ operational_state: e.target.value })
                    }
                  >
                    {Object.entries(stateLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                {kind === "zone" && (
                  <label>
                    Type
                    <select
                      value={node.zone_type || "stockage"}
                      onChange={(e) => change({ zone_type: e.target.value })}
                    >
                      {[
                        "stockage",
                        "réception",
                        "préparation",
                        "expédition",
                        "quarantaine",
                        "retour",
                        "circulation",
                        "sécurité",
                      ].map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  </label>
                )}
                {kind === "bin" && (
                  <>
                    <label>
                      Emplacement officiel
                      <select
                        value={node.location_id || ""}
                        disabled={data.nodes.some((n) => n.id === node.id)}
                        onChange={(e) =>
                          change({ location_id: Number(e.target.value) })
                        }
                      >
                        <option value="">Sélectionner un bin existant</option>
                        {data.locations
                          .filter((l) => l.physical)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.full_code || l.emplacement_code} · {l.bin_code}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Capacité maximale
                      <input
                        type="number"
                        min="0.00001"
                        step="any"
                        value={node.capacity ?? ""}
                        onChange={(e) =>
                          change({
                            capacity: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                      />
                    </label>
                    <label>
                      Unité exacte du stock
                      <input
                        placeholder="Ex. carton — sans conversion implicite"
                        value={node.capacity_unit || ""}
                        onChange={(e) =>
                          change({ capacity_unit: e.target.value || null })
                        }
                      />
                    </label>
                  </>
                )}
                {(
                  ["x", "y", "z", "width", "height", "depth", "yaw"] as const
                ).map((k) => (
                  <label key={k}>
                    {
                      {
                        x: "X — origine horizontale",
                        y: "Y — altitude",
                        z: "Z — profondeur",
                        width: "Largeur",
                        height: "Hauteur",
                        depth: "Profondeur",
                        yaw: "Rotation (degrés)",
                      }[k]
                    }
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Non renseigné"
                      value={node.geometry?.[k] ?? ""}
                      onChange={(e) => setDimension(k, e.target.value)}
                    />
                  </label>
                ))}
                <button onClick={() => change({ geometry: null })}>
                  Laisser la géométrie non renseignée
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <label>
            Seuil d’occupation élevée (%){" "}
            <input
              type="number"
              min="1"
              max="99"
              value={threshold}
              onChange={(e) => {
                setThreshold(Number(e.target.value));
                setDraft(null);
              }}
            />
          </label>
          <p>
            {nodes.length} éléments ·{" "}
            {nodes.filter((n) => n.kind === "bin").length} bins liés ·{" "}
            {
              data.locations.filter(
                (l) =>
                  l.physical &&
                  !nodes.some((n) => Number(n.location_id) === Number(l.id)),
              ).length
            }{" "}
            bins restant à positionner.
          </p>
          <div className="dt-toolbar">
            <button onClick={() => setView(view === "2d" ? "3d" : "2d")}>
              {view === "2d" ? "Prévisualiser en 3D" : "Prévisualiser en 2D"}
            </button>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {labels[n.kind]} · {n.code}
                </option>
              ))}
            </select>
          </div>
          <Scene
            nodes={
              node?.kind === "warehouse"
                ? preview
                : descendants(nodes, selected).filter(
                    (n) => n.parent_id === selected,
                  )
            }
            selected={null}
            onSelect={setSelected}
            mode="etat"
            view={view}
            labels={true}
            onUnavailable={() => setView("2d")}
          />
          <p>
            Contrôlez les mesures sur site, les dégagements et les charges
            admissibles avant validation. Le plan ne remplace pas une
            vérification de sécurité physique.
          </p>
          {draft && data.capabilities.publish && (
            <label className="dt-confirm">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />{" "}
              J’ai vérifié l’implantation réelle et je valide cette version du
              plan.
            </label>
          )}
        </>
      )}
      <div className="dt-toolbar">
        <button disabled={busy} className="dt-primary" onClick={save}>
          Enregistrer le brouillon
        </button>
        {step === 6 && data.capabilities.publish && (
          <button disabled={busy || !draft || !confirm} onClick={publish}>
            Publier le plan validé
          </button>
        )}
        <span role="status">{message}</span>
      </div>
    </section>
  );
}
