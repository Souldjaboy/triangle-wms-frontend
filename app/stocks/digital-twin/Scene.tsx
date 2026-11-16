"use client";
import dynamic from "next/dynamic";
import { Component, ReactNode } from "react";
import Plan2D from "./Plan2D";
import Automatic2D from "./Automatic2D";
import { PlanNode, ColorMode } from "./types";
const Plan3D = dynamic(() => import("./Plan3D"), {
  ssr: false,
  loading: () => <div className="dt-empty">Chargement du moteur 3D…</div>,
});
class Boundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export default function Scene(p: {
  nodes: PlanNode[];
  selected: string | null;
  onSelect: (id: string) => void;
  mode: ColorMode;
  view: string;
  labels: boolean;
  onUnavailable: () => void;
  facade?: boolean;
  schematic?: boolean;
  overview?: boolean;
}) {
  const Flat = p.schematic ? Automatic2D : Plan2D;
  const fallback = (
    <>
      <p role="status">3D indisponible. Le plan 2D reste utilisable.</p>
      <Flat {...p} />
    </>
  );
  return p.view === "3d" ? (
    <Boundary fallback={fallback}>
      <Plan3D {...p} />
    </Boundary>
  ) : (
    <Flat {...p} />
  );
}
