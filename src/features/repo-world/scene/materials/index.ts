import * as THREE from "three";
import type { Vitality } from "@/lib/vitality";
import { colorForVitality } from "../buildings";

/**
 * Placeholder only — the maintainer is authoring the retro PSX-look
 * shaders/materials themselves (see docs/PHASE_2_REPO_WORLD_PLAN.md §4.4).
 * This factory exists so M13 is visually testable before that work lands;
 * it must stay swappable without touching world-model.ts or Scene.tsx.
 */
export function createDefaultBuildingMaterial(level: Vitality["level"]): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: colorForVitality(level) });
}
