"use client";
import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import type { OrbitControls as Controls } from "three-stdlib";
import * as THREE from "three";
import { PlanNode, ColorMode, color } from "./types";
import { fitDistance, nonOverlappingLabels } from "./scene-math";
type Props = {
  nodes: PlanNode[];
  selected: string | null;
  onSelect: (id: string) => void;
  mode: ColorMode;
  labels: boolean;
  onUnavailable: () => void;
  schematic?: boolean;
  overview?: boolean;
};
function valid(n: PlanNode) {
  return (
    n.geometry &&
    Object.values(n.geometry).length === 7 &&
    Object.values(n.geometry).every(Number.isFinite) &&
    n.geometry.width > 0 &&
    n.geometry.height > 0 &&
    n.geometry.depth > 0
  );
}
function Objects(p: Props & { hover: (id: string | null) => void }) {
  const mesh = useRef<THREE.InstancedMesh>(null),
    tags = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const placed = useMemo(
    () => p.nodes.filter((n) => valid(n) && (!n.schematic || n.kind === "bin")),
    [p.nodes],
  );
  useLayoutEffect(() => {
    const obj = new THREE.Object3D();
    placed.forEach((n, i) => {
      const g = n.geometry!,
        sw = g.yaw === 90 || g.yaw === 270;
      const occupied = n.contents?.some((b) => Number(b.quantity) > 0);
      const h = n.schematic ? (occupied ? g.height * 0.85 : 0.16) : g.height;
      obj.position.set(
        g.x + (sw ? g.depth : g.width) / 2,
        g.y + h / 2,
        g.z + (sw ? g.width : g.depth) / 2,
      );
      obj.rotation.set(0, (g.yaw * Math.PI) / 180, 0);
      obj.scale.set(
        g.width * (n.schematic ? 0.94 : 1),
        h,
        g.depth * (n.schematic ? 0.94 : 1),
      );
      obj.updateMatrix();
      mesh.current!.setMatrixAt(i, obj.matrix);
      mesh.current!.setColorAt(
        i,
        new THREE.Color(
          n.id === p.selected
            ? "#ffd349"
            : n.schematic
              ? occupied
                ? "#d5b48a"
                : "#b7c4cf"
              : color(n, p.mode),
        ),
      );
      // The status is a small front marker, separate from the rack's finish.
      obj.position.set(g.x + g.width / 2, g.y + 0.1, g.z + g.depth + 0.025);
      obj.scale.set(g.width * 0.6, 0.18, 0.055);
      obj.updateMatrix();
      tags.current!.setMatrixAt(i, obj.matrix);
      tags.current!.setColorAt(i, new THREE.Color(color(n, p.mode)));
    });
    for (const m of [mesh.current!, tags.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
    invalidate();
  }, [placed, p.selected, p.mode, invalidate]);
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && placed[e.instanceId])
      p.onSelect(placed[e.instanceId].id);
  };
  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, Math.max(1, placed.length)]}
        count={placed.length}
        onClick={click}
        onPointerMove={(e) => {
          e.stopPropagation();
          p.hover(
            e.instanceId === undefined
              ? null
              : placed[e.instanceId]?.id || null,
          );
        }}
        onPointerOut={() => p.hover(null)}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh
        ref={tags}
        visible={!!p.schematic}
        args={[undefined, undefined, Math.max(1, placed.length)]}
        count={placed.length}
        onClick={click}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial />
      </instancedMesh>
    </>
  );
}
function RackFrames({ nodes, onSelect }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const beams = useMemo(() => {
    const result: {
      id: string;
      pos: [number, number, number];
      size: [number, number, number];
      color: string;
    }[] = [];
    for (const r of nodes.filter(
      (n) => n.schematic && n.kind === "rack" && valid(n),
    )) {
      const g = r.geometry!,
        bays = Math.max(1, Math.ceil(g.width / 5));
      for (let i = 0; i <= bays; i++)
        for (const z of [g.z, g.z + g.depth])
          result.push({
            id: r.id,
            pos: [g.x + (i * g.width) / bays, g.y + g.height / 2, z],
            size: [0.12, g.height, 0.12],
            color: "#245b92",
          });
      for (const l of nodes.filter(
        (n) => n.kind === "level" && n.parent_id === r.id && valid(n),
      )) {
        const y = l.geometry!.y - 0.1;
        result.push({
          id: r.id,
          pos: [g.x + g.width / 2, y, g.z + g.depth / 2],
          size: [g.width, 0.07, g.depth],
          color: "#b4bec6",
        });
        for (const z of [g.z, g.z + g.depth])
          result.push({
            id: r.id,
            pos: [g.x + g.width / 2, y, z],
            size: [g.width, 0.17, 0.12],
            color: "#eb842c",
          });
      }
    }
    return result;
  }, [nodes]);
  useLayoutEffect(() => {
    const obj = new THREE.Object3D();
    beams.forEach((b, i) => {
      obj.position.set(...b.pos);
      obj.scale.set(...b.size);
      obj.updateMatrix();
      mesh.current!.setMatrixAt(i, obj.matrix);
      mesh.current!.setColorAt(i, new THREE.Color(b.color));
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
    if (mesh.current!.instanceColor)
      mesh.current!.instanceColor.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
    invalidate();
  }, [beams, invalidate]);
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, Math.max(1, beams.length)]}
      count={beams.length}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined && beams[e.instanceId])
          onSelect(beams[e.instanceId].id);
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.6} />
    </instancedMesh>
  );
}
function Labels(p: Props & { hovered: string | null }) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const { camera, size } = useThree();
  const candidates = useMemo(() => {
    if (!p.labels) return [];
    const selected = p.nodes.filter(
      (n) => valid(n) && (n.id === p.selected || n.id === p.hovered),
    );
    const contextual = p.nodes.filter(
      (n) =>
        valid(n) &&
        (p.schematic
          ? p.overview
            ? n.kind === "aisle"
            : n.kind === "rack"
          : true),
    );
    return [
      ...selected,
      ...contextual.filter((n) => !selected.includes(n)),
    ].slice(0, 70);
  }, [p.nodes, p.selected, p.hovered, p.labels, p.schematic, p.overview]);
  useFrame(() => {
    const rectangles = candidates.map((n) => {
      const g = n.geometry!,
        v = new THREE.Vector3(
          g.x + g.width / 2,
          g.y + g.height + 0.6,
          g.z + g.depth / 2,
        ).project(camera);
      const el = refs.current.get(n.id),
        width = el?.offsetWidth || 100,
        height = el?.offsetHeight || 28;
      return {
        id: n.id,
        x:
          v.z < -1 || v.z > 1
            ? -10000
            : ((v.x + 1) * size.width) / 2 - width / 2,
        y: ((1 - v.y) * size.height) / 2 - height / 2,
        width,
        height,
      };
    });
    const shown = nonOverlappingLabels(rectangles, size.width, size.height);
    for (const n of candidates) {
      const el = refs.current.get(n.id);
      if (el) el.style.visibility = shown.has(n.id) ? "visible" : "hidden";
    }
  });
  return (
    <>
      {candidates.map((n) => {
        const g = n.geometry!;
        return (
          <Html
            key={n.id}
            center
            zIndexRange={[20, 0]}
            position={[
              g.x + g.width / 2,
              g.y + g.height + 0.6,
              g.z + g.depth / 2,
            ]}
          >
            <button
              ref={(el) => {
                if (el) refs.current.set(n.id, el);
                else refs.current.delete(n.id);
              }}
              className={
                "dt-3d-label" + (p.selected === n.id ? " selected" : "")
              }
              style={{ visibility: "hidden" }}
              onClick={() => p.onSelect(n.id)}
            >
              {n.display_label || n.kind} {n.code}
            </button>
          </Html>
        );
      })}
    </>
  );
}
type Command = { action: "fit" | "top" | "in" | "out"; tick: number };
function Camera({ box, command }: { box: THREE.Box3; command: Command }) {
  const controls = useRef<Controls>(null);
  const lastCommand = useRef<Command | null>(null);
  const { camera, size, invalidate } = useThree();
  const center = box.getCenter(new THREE.Vector3()),
    radius = Math.max(1, box.getSize(new THREE.Vector3()).length() / 2);
  const cx = center.x,
    cy = center.y,
    cz = center.z;
  useLayoutEffect(() => {
    const c = controls.current;
    if (!c) return;
    const freshZoom =
      lastCommand.current !== null && lastCommand.current !== command;
    lastCommand.current = command;
    if (freshZoom && (command.action === "in" || command.action === "out")) {
      camera.position
        .sub(c.target)
        .multiplyScalar(command.action === "in" ? 0.75 : 1.33)
        .add(c.target);
    } else {
      c.target.set(cx, cy, cz);
      const distance = fitDistance(radius, size.width / size.height);
      const direction =
        command.action === "top"
          ? new THREE.Vector3(0, 1, 0.001)
          : new THREE.Vector3(1, 0.85, 1).normalize();
      camera.position.copy(c.target).addScaledVector(direction, distance);
      camera.lookAt(c.target);
    }
    c.update();
    invalidate();
  }, [
    camera,
    cx,
    cy,
    cz,
    radius,
    size.width,
    size.height,
    command,
    invalidate,
  ]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      minDistance={0.5}
      maxDistance={radius * 20}
      maxPolarAngle={Math.PI / 2 - 0.03}
      enableDamping={false}
    />
  );
}
export default function Plan3D(p: Props) {
  const [command, setCommand] = useState<Command>({ action: "fit", tick: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const box = useMemo(() => {
    const b = new THREE.Box3();
    for (const n of p.nodes.filter(
      (n) => valid(n) && (!n.schematic || n.kind === "rack"),
    )) {
      const g = n.geometry!,
        sw = g.yaw === 90 || g.yaw === 270;
      b.expandByPoint(new THREE.Vector3(g.x, g.y, g.z));
      b.expandByPoint(
        new THREE.Vector3(
          g.x + (sw ? g.depth : g.width),
          g.y + g.height,
          g.z + (sw ? g.width : g.depth),
        ),
      );
    }
    return b;
  }, [p.nodes]);
  if (box.isEmpty())
    return (
      <div className="dt-empty">
        {p.schematic
          ? "Aucun emplacement enregistré. Les nouveaux emplacements apparaîtront automatiquement."
          : "Renseignez les dimensions physiques pour activer la 3D."}
      </div>
    );
  const center = box.getCenter(new THREE.Vector3()),
    size = box.getSize(new THREE.Vector3());
  const scope = p.nodes
    .filter((n) => n.kind === "rack")
    .map((n) => n.id)
    .join("|");
  return (
    <div className="dt-3d" ref={container}>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ near: 0.01, far: 100000, fov: 45 }}
        fallback={
          <button onClick={p.onUnavailable}>
            3D indisponible — ouvrir le plan 2D
          </button>
        }
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", p.onUnavailable, {
            once: true,
          });
        }}
      >
        <color attach="background" args={["#e5ebef"]} />
        <ambientLight intensity={1.5} />
        <directionalLight
          position={[center.x + 20, 80, center.z + 30]}
          intensity={2.2}
        />
        <Suspense fallback={null}>
          {p.schematic && (
            <mesh position={[center.x, -0.16, center.z]}>
              <boxGeometry args={[size.x + 5, 0.15, size.z + 5]} />
              <meshStandardMaterial color="#9daab4" roughness={1} />
            </mesh>
          )}
          <Objects {...p} hover={setHovered} />
          <RackFrames {...p} />
          <Labels {...p} hovered={hovered} />
          <Camera key={scope} box={box} command={command} />
        </Suspense>
      </Canvas>
      <div className="dt-camera-tools" aria-label="Commandes de caméra">
        {(
          [
            ["fit", "Recentrer"],
            ["top", "Vue du dessus"],
            ["in", "+"],
            ["out", "−"],
          ] as const
        ).map(([action, label]) => (
          <button
            key={action}
            aria-label={
              action === "in"
                ? "Zoom avant"
                : action === "out"
                  ? "Zoom arrière"
                  : label
            }
            onClick={() => setCommand((c) => ({ action, tick: c.tick + 1 }))}
          >
            {label}
          </button>
        ))}
      </div>
      <span className="dt-camera-hint">
        {p.overview
          ? "Cliquez sur un rayon ou choisissez-le dans les filtres."
          : "Cliquez sur un bin pour consulter le stock."}{" "}
        Glisser : tourner · Molette : zoomer
      </span>
    </div>
  );
}
