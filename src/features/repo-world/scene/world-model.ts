import type { TreeEntry } from "@/lib/github";
import type { Vitality } from "@/lib/vitality";
import { archetypeFor } from "./buildings";

export type BuildingArchetype = "tower" | "shed" | "kiosk" | "warehouse" | "yard";

export type Building = {
  path: string;
  archetype: BuildingArchetype;
  heightUnits: number;
  vitalityLevel: Vitality["level"];
  gridX: number;
  gridZ: number;
};

export type WorldModel = {
  buildings: Building[];
};

const GRID_COLUMNS = 8;
const GRID_SPACING = 3;
const MIN_HEIGHT_UNITS = 0.5;

function heightUnitsFor(size: number | undefined): number {
  return Math.max(MIN_HEIGHT_UNITS, Math.log2((size ?? 0) + 1));
}

function isTopLevelBlob(entry: TreeEntry): boolean {
  return entry.type === "blob" && !entry.path.includes("/");
}

export function buildWorldModel(
  topLevelEntries: TreeEntry[],
  vitalityByPath: Map<string, Vitality>
): WorldModel {
  const buildings = topLevelEntries
    .filter(isTopLevelBlob)
    .map((entry, index) => ({
      path: entry.path,
      archetype: archetypeFor(entry.path),
      heightUnits: heightUnitsFor(entry.size),
      vitalityLevel: vitalityByPath.get(entry.path)?.level ?? "unknown",
      gridX: (index % GRID_COLUMNS) * GRID_SPACING,
      gridZ: Math.floor(index / GRID_COLUMNS) * GRID_SPACING,
    }));
  return { buildings };
}
