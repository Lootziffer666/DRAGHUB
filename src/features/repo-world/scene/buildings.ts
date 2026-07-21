import type { Vitality } from "@/lib/vitality";
import type { BuildingArchetype } from "./world-model";

const extensionArchetypes: Record<string, BuildingArchetype> = {
  ts: "tower",
  tsx: "tower",
  js: "tower",
  jsx: "tower",
  py: "tower",
  rs: "tower",
  go: "tower",
  java: "tower",
  c: "tower",
  cpp: "tower",
  json: "shed",
  yaml: "shed",
  yml: "shed",
  toml: "shed",
  md: "kiosk",
  mdx: "kiosk",
  txt: "kiosk",
  png: "warehouse",
  jpg: "warehouse",
  jpeg: "warehouse",
  gif: "warehouse",
  svg: "warehouse",
  zip: "warehouse",
  lock: "warehouse",
};

export function archetypeFor(path: string): BuildingArchetype {
  const fileName = path.split("/").pop() ?? path;
  if (/\.test\.|\.spec\.|__tests__/.test(fileName)) return "yard";
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  return extensionArchetypes[ext] ?? "shed";
}

const vitalityTierColor: Record<Vitality["level"], string> = {
  fresh: "#7ac36c",
  active: "#c7d16b",
  stale: "#c79a5b",
  ancient: "#8a6a4d",
  unknown: "#9aa0a6",
};

export function colorForVitality(level: Vitality["level"]): string {
  return vitalityTierColor[level];
}
