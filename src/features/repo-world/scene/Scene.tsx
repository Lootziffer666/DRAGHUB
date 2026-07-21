"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
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

  return (
    <Canvas
      frameloop={minimized ? "never" : "always"}
      camera={{ position: [10, 12, 18], fov: 50 }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[8, 12, 6]} intensity={0.8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[10, 0, 6]}>
        <planeGeometry args={[40, 40]} />
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
