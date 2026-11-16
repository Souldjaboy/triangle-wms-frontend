"use client";
import { PlanNode, ColorMode, color } from "./types";
export default function Plan2D({
  nodes,
  selected,
  onSelect,
  mode,
  facade = false,
  labels = true,
}: {
  nodes: PlanNode[];
  selected: string | null;
  onSelect: (id: string) => void;
  mode: ColorMode;
  facade?: boolean;
  labels?: boolean;
}) {
  const placed = nodes.filter(
    (n) =>
      n.geometry &&
      Object.values(n.geometry).length === 7 &&
      Object.values(n.geometry).every(Number.isFinite) &&
      n.geometry.width > 0 &&
      n.geometry.height > 0 &&
      n.geometry.depth > 0,
  );
  if (!placed.length)
    return (
      <div className="dt-empty">
        Aucune position physique renseignée pour cette vue.
      </div>
    );
  const boxes = placed.map((n) => {
    const g = n.geometry!;
    const swapped = g.yaw === 90 || g.yaw === 270;
    return {
      n,
      x: g.x,
      y: facade ? -g.y - g.height : g.z,
      w: swapped ? g.depth : g.width,
      h: facade ? g.height : swapped ? g.width : g.depth,
    };
  });
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y));
  const w = Math.max(...boxes.map((b) => b.x + b.w)) - x,
    h = Math.max(...boxes.map((b) => b.y + b.h)) - y;
  const pad = Math.max(w, h) * 0.06;
  return (
    <svg
      className="dt-plan"
      role="group"
      aria-label={
        facade
          ? "Façade du rack — dimensions réelles"
          : "Plan physique — dimensions réelles"
      }
      viewBox={`${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`}
    >
      {boxes.map(({ n, x, y, w, h }) => (
        <g
          key={n.id}
          role="button"
          tabIndex={0}
          aria-label={`${n.code} ${n.name}`}
          onClick={() => onSelect(n.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(n.id);
            }
          }}
          style={{ cursor: "pointer" }}
        >
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={Math.min(w, h) * 0.04}
            fill={color(n, mode)}
            fillOpacity={0.65}
            stroke={selected === n.id ? "#102a43" : "#ffffff"}
            strokeWidth={selected === n.id ? 4 : 2}
            vectorEffect="non-scaling-stroke"
          />
          {labels && (
            <text
              x={x + w / 2}
              y={y + h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#102a43"
              fontSize={Math.min(
                h * 0.24,
                (w / Math.max(n.code.length, 4)) * 1.3,
              )}
              fontWeight="700"
            >
              {n.code}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
