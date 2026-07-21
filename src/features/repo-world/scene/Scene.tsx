"use client";

import { useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Instances, Instance } from "@react-three/drei";
import { useWindowManager } from "@/features/desktop/WindowManagerProvider";
import { colorForVitality } from "./buildings";
import type { BuildingArchetype, WorldModel } from "./world-model";

const archetypeFootprint: Record<BuildingArchetype, [number, number]> = {
  tower: [0.8, 0.8],
  shed: [1, 0.7],
  kiosk: [0.6, 0.6],
  warehouse: [1.4, 1.2],
  yard: [1.2, 1],
};

/** M13 has a fixed, non-interactive camera angle (navigation is M14) — this
 * just points that fixed camera at the grid's actual center once, since the
 * grid isn't always centered on the origin. */
function FixedCameraRig({ center, distance }: { center: { x: number; z: number }; distance: number }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(center.x + distance * 0.7, distance * 0.55, center.z + distance);
    camera.lookAt(center.x, 1, center.z);
    camera.updateProjectionMatrix();
  }, [camera, center.x, center.z, distance]);
  return null;
}

export function Scene({ windowId, model }: { windowId: string; model: WorldModel }) {
  const wm = useWindowManager();
  const own = wm.session.windows.find((w) => w.id === windowId);
  const minimized = own?.minimized ?? false;

  const buckets = useMemo(() => {
    const byArchetype = new Map<BuildingArchetype, WorldModel["buildings"]>();
    for (const building of model.buildings) {
      const bucket = byArchetype.get(building.archetype) ?? [];
      bucket.push(building);
      byArchetype.set(building.archetype, bucket);
    }
    return byArchetype;
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

  return (
    <Canvas frameloop={minimized ? "never" : "always"}>
      <FixedCameraRig center={center} distance={span * 1.1 + 6} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[center.x + 8, 12, center.z + 6]} intensity={0.8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0, center.z]}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial color="#2b2f36" />
      </mesh>
      {Array.from(buckets.entries()).map(([archetype, buildings]) => {
        const [width, depth] = archetypeFootprint[archetype];
        return (
          <Instances key={archetype} limit={buildings.length}>
            <boxGeometry args={[width, 1, depth]} />
            <meshStandardMaterial />
            {buildings.map((building) => (
              <Instance
                key={building.path}
                position={[building.gridX, building.heightUnits / 2, building.gridZ]}
                scale={[1, building.heightUnits, 1]}
                color={colorForVitality(building.vitalityLevel)}
              />
            ))}
          </Instances>
        );
      })}
    </Canvas>
  );
}
