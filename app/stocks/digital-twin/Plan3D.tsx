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
        placed.slice(0, 80).map((n) => {
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
export default function Plan3D(props: {
  nodes: PlanNode[];
  selected: string | null;
  onSelect: (id: string) => void;
  mode: ColorMode;
  labels: boolean;
  onUnavailable: () => void;
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
        Renseignez les dimensions physiques pour activer la 3D.
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
