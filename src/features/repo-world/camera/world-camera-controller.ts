"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

export type Facing = 0 | 1 | 2 | 3;

const TAU = Math.PI * 2;

/**
 * FEZ-style camera: an orthographic view that snaps between four 90°
 * azimuth positions instead of free-roaming. Each facing shows what looks
 * like a flat 2D scene; rotating reveals the depth axis that was hidden
 * behind it. This is a distinct interaction concern from FLUBBER (touch
 * text-selection) — see docs/PHASE_2_REPO_WORLD_PLAN.md §4.6.
 */
export function SnapRotateCameraRig({
  facing,
  center,
  groundSize,
}: {
  facing: Facing;
  center: { x: number; z: number };
  groundSize: number;
}) {
  const { camera, size } = useThree();
  const currentAngle = useRef((facing * Math.PI) / 2);
  const distance = groundSize * 1.15;

  useEffect(() => {
    const ortho = camera as unknown as { isOrthographicCamera?: boolean; zoom: number; updateProjectionMatrix: () => void };
    if (!ortho.isOrthographicCamera) return;
    ortho.zoom = (Math.min(size.width, size.height) * 0.82) / groundSize;
    ortho.updateProjectionMatrix();
  }, [camera, size.width, size.height, groundSize]);

  useFrame(() => {
    const target = (facing * Math.PI) / 2;
    let delta = target - currentAngle.current;
    while (delta > Math.PI) delta -= TAU;
    while (delta < -Math.PI) delta += TAU;
    currentAngle.current += delta * 0.18;

    const elevation = distance * 0.62;
    camera.position.set(
      center.x + Math.sin(currentAngle.current) * distance,
      elevation,
      center.z + Math.cos(currentAngle.current) * distance
    );
    camera.lookAt(center.x, elevation * 0.28, center.z);
  });

  return null;
}

export function nextFacing(facing: Facing, direction: 1 | -1): Facing {
  return (((facing + direction) % 4) + 4) % 4 as Facing;
}
