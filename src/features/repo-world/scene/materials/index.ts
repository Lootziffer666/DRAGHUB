import { MeshBasicNodeMaterial } from "three/webgpu";
import { color, floor, mix, mod, positionWorld, posterize } from "three/tsl";
import type { Vitality } from "@/lib/vitality";
import { colorForVitality } from "../buildings";

const LEVELS: Vitality["level"][] = ["fresh", "active", "stale", "ancient", "unknown"];

/**
 * One TSL node material per vitality tier, built on three/webgpu's
 * node-material system (compiles to WGSL under WebGPURenderer, to GLSL
 * under the WebGLRenderer fallback — same material works either way).
 * `posterize` quantizes the tier color into flat bands for a chunky
 * retro-pixel look instead of a smooth-shaded solid color.
 */
export function createVitalityMaterials(): Record<Vitality["level"], MeshBasicNodeMaterial> {
  const materials = {} as Record<Vitality["level"], MeshBasicNodeMaterial>;
  for (const level of LEVELS) {
    const material = new MeshBasicNodeMaterial();
    material.colorNode = posterize(color(colorForVitality(level)), 4);
    materials[level] = material;
  }
  return materials;
}

/** Procedural pixel-tile checkerboard ground, TSL-driven so it never needs
 * a texture asset. World-space tiling keeps it stable as the grid grows. */
export function createGroundMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();
  const tile = floor(positionWorld.xz.mul(0.5));
  const checker = mod(tile.x.add(tile.y), 2);
  material.colorNode = mix(color("#1c2027"), color("#262c36"), checker);
  return material;
}
