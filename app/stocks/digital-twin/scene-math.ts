// Perspective sphere fit works for both portrait and landscape viewports.
export function fitDistance(radius: number, aspect: number, verticalFov = 45) {
  const vertical = (verticalFov * Math.PI) / 360;
  const horizontal = Math.atan(Math.tan(vertical) * Math.max(0.01, aspect));
  return (
    (Math.max(1, radius) / Math.sin(Math.min(vertical, horizontal))) * 1.12
  );
}
export type LabelRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export function nonOverlappingLabels(
  items: LabelRect[],
  width: number,
  height: number,
): Set<string> {
  const kept: LabelRect[] = [];
  for (const r of items) {
    if (
      ![r.x, r.y, r.width, r.height].every(Number.isFinite) ||
      r.x < 8 ||
      r.y < 65 ||
      r.x + r.width > width - 8 ||
      r.y + r.height > height - 35
    )
      continue;
    if (
      !kept.some(
        (k) =>
          r.x < k.x + k.width + 12 &&
          r.x + r.width + 12 > k.x &&
          r.y < k.y + k.height + 8 &&
          r.y + r.height + 8 > k.y,
      )
    )
      kept.push(r);
  }
  return new Set(kept.map((r) => r.id));
}
