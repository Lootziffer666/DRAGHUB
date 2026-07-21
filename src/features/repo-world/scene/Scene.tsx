"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas, type GLProps } from "@react-three/fiber";
import { Instances, Instance } from "@react-three/drei";
import { useWindowManager } from "@/features/desktop/WindowManagerProvider";
import { SnapRotateCameraRig, nextFacing, type Facing } from "../camera/world-camera-controller";
import { createGroundMaterial, createVitalityMaterials } from "./materials";
import type { BuildingArchetype, WorldModel } from "./world-model";
import type { Vitality } from "@/lib/vitality";

const archetypeFootprint: Record<BuildingArchetype, [number, number]> = {
  tower: [0.8, 0.8],
  shed: [1, 0.7],
  kiosk: [0.6, 0.6],
  warehouse: [1.4, 1.2],
  yard: [1.2, 1],
};

/** Renderer factory: tries three's WebGPU backend first (TSL node
 * materials compile to WGSL there), falls back to WebGLRenderer — where
 * the same node materials compile to GLSL instead — if WebGPU can't be
 * initialized (unsupported browser/GPU, headless/software environments).
 * `forceWebGL` skips the WebGPU attempt entirely — used by Scene's runtime
 * fallback below, for WebGPU implementations that initialize successfully
 * but then throw asynchronously on the first actual render (observed on
 * this sandbox's bundled Chromium's experimental WebGPU backend). */
function makeRendererFactory(forceWebGL: boolean): GLProps {
  return async (props) => {
    // R3F types `canvas` against its own minimal OffscreenCanvas stub,
    // structurally incompatible with the DOM lib's OffscreenCanvas that
    // three's renderer constructors expect — in practice R3F always hands
    // us the real HTMLCanvasElement here (this app never renders off-thread).
    const canvas = props.canvas as HTMLCanvasElement;
    const powerPreference = props.powerPreference as "high-performance" | "low-power" | undefined;
    if (!forceWebGL) {
      try {
        const { WebGPURenderer } = await import("three/webgpu");
        const renderer = new WebGPURenderer({ canvas, antialias: props.antialias, alpha: props.alpha, powerPreference });
        await renderer.init();
        return renderer;
      } catch (err) {
        console.warn("[repo-world] WebGPU unavailable, falling back to WebGLRenderer:", err);
      }
    }
    return new THREE.WebGLRenderer({ canvas, antialias: props.antialias, alpha: props.alpha, powerPreference });
  };
}

export function Scene({ windowId, model }: { windowId: string; model: WorldModel }) {
  const wm = useWindowManager();
  const own = wm.session.windows.find((w) => w.id === windowId);
  const minimized = own?.minimized ?? false;
  const [facing, setFacing] = useState<Facing>(0);
  const [forceWebGL, setForceWebGL] = useState(false);

  useEffect(() => {
    if (forceWebGL) return;
    // WebGPU can initialize successfully and still throw asynchronously on
    // the first real render (seen on this sandbox's Chromium build) — that
    // surfaces as an unhandled error/rejection after init, not as a
    // catchable exception inside the renderer factory above. One-shot: on
    // any such error while still on the WebGPU attempt, remount the Canvas
    // (via the `forceWebGL` key below) with WebGLRenderer forced.
    function isWebGpuFailure(message: string) {
      return /GPUTexture|GPUDevice|WebGPU|WGSL/i.test(message);
    }
    function onError(e: ErrorEvent) {
      if (isWebGpuFailure(e.message ?? "")) setForceWebGL(true);
    }
    function onRejection(e: PromiseRejectionEvent) {
      if (isWebGpuFailure(String(e.reason))) setForceWebGL(true);
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [forceWebGL]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "q" || e.key === "Q" || e.key === "ArrowLeft") setFacing((f) => nextFacing(f, -1));
      else if (e.key === "e" || e.key === "E" || e.key === "ArrowRight") setFacing((f) => nextFacing(f, 1));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const vitalityMaterials = useMemo(() => createVitalityMaterials(), []);
  const groundMaterial = useMemo(() => createGroundMaterial(), []);

  const buckets = useMemo(() => {
    const byKey = new Map<string, { archetype: BuildingArchetype; level: Vitality["level"]; buildings: WorldModel["buildings"] }>();
    for (const building of model.buildings) {
      const key = `${building.archetype}:${building.vitalityLevel}`;
      const bucket = byKey.get(key) ?? { archetype: building.archetype, level: building.vitalityLevel, buildings: [] };
      bucket.buildings.push(building);
      byKey.set(key, bucket);
    }
    return Array.from(byKey.values());
  }, [model]);

  const { center, span, groundSize } = useMemo(() => {
    if (model.buildings.length === 0) {
      return { center: { x: 0, z: 0 }, span: 6, groundSize: 12 };
    }
    const xs = model.buildings.map((b) => b.gridX);
    const zs = model.buildings.map((b) => b.gridZ);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const c = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
    const s = Math.max(maxX - minX, maxZ - minZ, 6);
    return { center: c, span: s, groundSize: s + 8 };
  }, [model]);

  const glFactory = useMemo(() => makeRendererFactory(forceWebGL), [forceWebGL]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        key={forceWebGL ? "webgl" : "auto"}
        orthographic
        frameloop={minimized ? "never" : "always"}
        gl={glFactory}
      >
        <SnapRotateCameraRig facing={facing} center={center} groundSize={groundSize} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0, center.z]} material={groundMaterial}>
          <planeGeometry args={[groundSize, groundSize]} />
        </mesh>
        {buckets.map(({ archetype, level, buildings }) => {
          const [width, depth] = archetypeFootprint[archetype];
          return (
            <Instances
              key={`${archetype}:${level}`}
              limit={buildings.length}
              material={vitalityMaterials[level]}
            >
              <boxGeometry args={[width, 1, depth]} />
              {buildings.map((building) => (
                <Instance
                  key={building.path}
                  position={[building.gridX, building.heightUnits / 2, building.gridZ]}
                  scale={[1, building.heightUnits, 1]}
                />
              ))}
            </Instances>
          );
        })}
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-2">
        <button
          onClick={() => setFacing((f) => nextFacing(f, -1))}
          title="Rotate world left (Q)"
          className="pointer-events-auto rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface)]/90 px-3 py-1.5 text-xs text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
        >
          ⟲ Rotate
        </button>
        <button
          onClick={() => setFacing((f) => nextFacing(f, 1))}
          title="Rotate world right (E)"
          className="pointer-events-auto rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface)]/90 px-3 py-1.5 text-xs text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
        >
          Rotate ⟳
        </button>
      </div>
    </div>
  );
}
