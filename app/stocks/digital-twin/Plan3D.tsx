"use client";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { PlanNode, ColorMode, color } from "./types";
function Objects({
  nodes,
  selected,
  onSelect,
  mode,
  labels,
}: {
  nodes: PlanNode[];
  selected: string | null;
  onSelect: (id: string) => void;
  mode: ColorMode;
  labels: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { invalidate } = useThree();
  const placed = useMemo(
    () =>
      nodes.filter(
        (n) =>
          (!n.schematic || n.kind === "bin") &&
          n.geometry &&
          Object.values(n.geometry).length === 7 &&
          Object.values(n.geometry).every(Number.isFinite) &&
          n.geometry.width > 0 &&
          n.geometry.height > 0 &&
          n.geometry.depth > 0,
      ),
    [nodes],
  );
  useLayoutEffect(() => {
    const obj = new THREE.Object3D();
    placed.forEach((n, i) => {
      const g = n.geometry!,
        sw = g.yaw === 90 || g.yaw === 270,
        w = sw ? g.depth : g.width,
        d = sw ? g.width : g.depth;
      obj.position.set(g.x + w / 2, g.y + g.height / 2, g.z + d / 2);
      obj.rotation.set(0, (g.yaw * Math.PI) / 180, 0);
      obj.scale.set(g.width, g.height, g.depth);
      obj.updateMatrix();
      mesh.current!.setMatrixAt(i, obj.matrix);
      mesh.current!.setColorAt(
        i,
        new THREE.Color(n.id === selected ? "#f6c344" : color(n, mode)),
      );
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
    if (mesh.current!.instanceColor)
      mesh.current!.instanceColor.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
    invalidate();
  }, [placed, selected, mode, invalidate]);
  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, Math.max(placed.length, 1)]}
        count={placed.length}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.instanceId !== undefined && placed[e.instanceId])
            onSelect(placed[e.instanceId].id);
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      {labels &&
        placed
          .filter(
            (n) => !n.schematic || placed.length <= 40 || n.id === selected,
          )
          .slice(0, 80)
          .map((n) => {
            const g = n.geometry!,
              sw = g.yaw === 90 || g.yaw === 270;
            return (
              <Html
                key={n.id}
                position={[
                  g.x + (sw ? g.depth : g.width) / 2,
                  g.y + g.height,
                  g.z + (sw ? g.width : g.depth) / 2,
                ]}
                center
                style={{ pointerEvents: "none" }}
              >
                <span className="dt-3d-label">{n.code}</span>
              </Html>
            );
          })}
    </>
  );
}
function RackFrames({
  nodes,
  onSelect,
  labels,
}: {
  nodes: PlanNode[];
  onSelect: (id: string) => void;
  labels: boolean;
}) {
  return (
    <>
      {nodes
        .filter((n) => n.schematic && n.kind === "rack" && n.geometry)
        .map((r) => {
          const g = r.geometry!;
          const beams: [number, number, number, number, number, number][] = [];
          for (const x of [g.x, g.x + g.width])
            for (const z of [g.z, g.z + g.depth])
              beams.push([x, g.height / 2, z, 0.09, g.height, 0.09]);
          for (const l of nodes.filter(
            (n) => n.parent_id === r.id && n.kind === "level" && n.geometry,
          ))
            beams.push([
              g.x + g.width / 2,
              l.geometry!.y - 0.12,
              g.z + g.depth / 2,
              g.width,
              0.12,
              g.depth,
            ]);
          return (
            <group
              key={r.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(r.id);
              }}
            >
              {beams.map((b, i) => (
                <mesh key={i} position={[b[0], b[1], b[2]]}>
                  <boxGeometry args={[b[3], b[4], b[5]]} />
                  <meshStandardMaterial color={i < 4 ? "#18364d" : "#c8a246"} />
                </mesh>
              ))}
              {labels && (
                <Html
                  position={[
                    g.x + g.width / 2,
                    g.height + 0.3,
                    g.z + g.depth / 2,
                  ]}
                  center
                  style={{ pointerEvents: "none" }}
                >
                  <span className="dt-3d-label">
                    {r.name} · Étagère {r.code}
                  </span>
                </Html>
              )}
            </group>
          );
        })}
    </>
  );
}
export default function Plan3D(props: {
  nodes: PlanNode[];
  selected: string | null;
  onSelect: (id: string) => void;
  mode: ColorMode;
  labels: boolean;
  onUnavailable: () => void;
  schematic?: boolean;
}) {
  const placed = props.nodes.filter(
    (n) =>
      n.geometry &&
      Object.values(n.geometry).length === 7 &&
      Object.values(n.geometry).every(Number.isFinite) &&
      n.geometry.width > 0 &&
      n.geometry.height > 0 &&
      n.geometry.depth > 0,
  );
  const box = new THREE.Box3();
  for (const n of placed) {
    const g = n.geometry!,
      sw = g.yaw === 90 || g.yaw === 270;
    box.expandByPoint(new THREE.Vector3(g.x, g.y, g.z));
    box.expandByPoint(
      new THREE.Vector3(
        g.x + (sw ? g.depth : g.width),
        g.y + g.height,
        g.z + (sw ? g.width : g.depth),
      ),
    );
  }
  const center = box.isEmpty()
      ? new THREE.Vector3()
      : box.getCenter(new THREE.Vector3()),
    size = box.isEmpty()
      ? 10
      : Math.max(...box.getSize(new THREE.Vector3()).toArray(), 1);
  if (!placed.length)
    return (
      <div className="dt-empty">
        {props.schematic
          ? "Aucun emplacement enregistré. Les nouveaux emplacements apparaîtront automatiquement."
          : "Renseignez les dimensions physiques pour activer la 3D."}
      </div>
    );
  return (
    <div className="dt-3d">
      <Canvas
        key={placed.map((n) => n.id).join("|")}
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{
          position: [center.x + size, center.y + size * 0.85, center.z + size],
          near: 0.01,
          far: 100000,
          fov: 45,
        }}
        fallback={
          <button onClick={props.onUnavailable}>
            3D indisponible — ouvrir le plan 2D
          </button>
        }
        onCreated={({ gl }) => {
          gl.domElement.addEventListener(
            "webglcontextlost",
            props.onUnavailable,
            { once: true },
          );
        }}
      >
        <color attach="background" args={["#edf2f6"]} />
        <ambientLight intensity={1.6} />
        <directionalLight position={[50, 100, 40]} intensity={2} />
        <Suspense fallback={null}>
          <Objects {...props} />
          <RackFrames {...props} />
          <OrbitControls
            makeDefault
            target={center}
            minDistance={0.2}
            maxDistance={size * 12}
          />
        </Suspense>
      </Canvas>
      <span className="dt-camera-hint">
        Glisser : tourner · Molette : zoomer · Clic droit : déplacer
      </span>
    </div>
  );
}
