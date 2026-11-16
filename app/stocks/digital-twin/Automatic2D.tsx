"use client";
import { PlanNode, ColorMode, color, quantityText } from "./types";
export default function Automatic2D({
  nodes,
  selected,
  onSelect,
  mode,
  labels = true,
}: {
  nodes: PlanNode[];
  selected: string | null;
  onSelect: (id: string) => void;
  mode: ColorMode;
  labels?: boolean;
}) {
  const racks = nodes.filter((n) => n.kind === "rack");
  return (
    <div
      className="dt-auto-map"
      aria-label="Vue schématique des étagères et bins"
    >
      {racks.map((r) => (
        <section className="dt-auto-rack" key={r.id}>
          <button className="dt-auto-rack-title" onClick={() => onSelect(r.id)}>
            {r.name} · Étagère {r.code}{" "}
            <small>{r.metrics?.bins} emplacements</small>
          </button>
          {nodes
            .filter((n) => n.parent_id === r.id)
            .slice()
            .reverse()
            .map((level) => (
              <div className="dt-auto-level" key={level.id}>
                <button
                  onClick={() => onSelect(level.id)}
                  className="dt-auto-level-title"
                >
                  Niveau {level.code}
                </button>
                <div className="dt-auto-bins">
                  {nodes
                    .filter((b) => b.parent_id === level.id)
                    .map((b) => (
                      <button
                        key={b.id}
                        className={
                          "dt-auto-bin " + (b.id === selected ? "selected" : "")
                        }
                        onClick={() => onSelect(b.id)}
                        style={{ borderTopColor: color(b, mode) }}
                        aria-label={"Bin " + b.code}
                      >
                        {labels && <strong>{b.code}</strong>}
                        {b.contents?.length ? (
                          b.contents.map((p) => (
                            <span key={p.product_id}>
                              {p.name} · {quantityText(p.quantity)} {p.unit}
                            </span>
                          ))
                        ) : (
                          <span>
                            {b.unverified
                              ? "Contenu à vérifier"
                              : "Aucun stock enregistré"}
                          </span>
                        )}
                        {b.unverified && <small>À vérifier</small>}
                      </button>
                    ))}
                </div>
              </div>
            ))}
        </section>
      ))}
      {!racks.length && (
        <p className="dt-empty">
          Aucun emplacement enregistré dans cet entrepôt. Les nouveaux
          emplacements apparaîtront ici automatiquement.
        </p>
      )}
    </div>
  );
}
