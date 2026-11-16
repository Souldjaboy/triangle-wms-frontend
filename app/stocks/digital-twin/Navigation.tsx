"use client";
import type { PlanNode } from "./types";
export default function Navigation({
  nodes,
  selected,
  onSelect,
}: {
  nodes: PlanNode[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const root = nodes.find((n) => n.kind === "warehouse");
  const active = nodes.find((n) => n.id === selected) || root;
  const chain: PlanNode[] = [];
  let n = active;
  while (n) {
    chain.unshift(n);
    n = nodes.find((p) => p.id === n?.parent_id);
  }
  const row = chain.find((n) => n.kind === "aisle");
  const rack = chain.find((n) => n.kind === "rack");
  const level = chain.find((n) => n.kind === "level");
  const rows = nodes.filter((n) => n.kind === "aisle");
  return (
    <div
      className="dt-navigation"
      aria-label="Navigation dans les emplacements"
    >
      <div className="dt-navigation-fields">
        <button
          disabled={!active?.parent_id}
          onClick={() => active?.parent_id && onSelect(active.parent_id)}
        >
          ← Retour
        </button>
        <label>
          Rayon
          <select
            aria-label="Rayon"
            value={row?.id || ""}
            onChange={(e) => onSelect(e.target.value || root!.id)}
          >
            <option value="">Tous les rayons</option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} · {r.metrics?.bins} emplacements
              </option>
            ))}
          </select>
        </label>
        <label>
          Étagère
          <select
            aria-label="Étagère"
            value={rack?.id || ""}
            disabled={!row}
            onChange={(e) => onSelect(e.target.value || row!.id)}
          >
            <option value="">Toutes les étagères</option>
            {nodes
              .filter((n) => n.kind === "rack" && n.parent_id === row?.id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code}
                </option>
              ))}
          </select>
        </label>
        <label>
          Niveau
          <select
            aria-label="Niveau"
            value={level?.id || ""}
            disabled={!rack}
            onChange={(e) => onSelect(e.target.value || rack!.id)}
          >
            <option value="">Tous les niveaux</option>
            {nodes
              .filter((n) => n.kind === "level" && n.parent_id === rack?.id)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code}
                </option>
              ))}
          </select>
        </label>
        <button onClick={() => root && onSelect(root.id)}>
          Vue d’ensemble
        </button>
      </div>
      <div className="dt-rayon-strip" aria-label="Accès direct aux rayons">
        {rows.map((r) => (
          <button
            key={r.id}
            className={row?.id === r.id ? "active" : ""}
            onClick={() => onSelect(r.id)}
          >
            Rayon {r.code}
            <small>{r.metrics?.bins} bins</small>
          </button>
        ))}
      </div>
    </div>
  );
}
