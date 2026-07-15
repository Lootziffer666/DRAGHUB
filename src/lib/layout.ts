export type LayoutPos = { x: number; y: number };
export type LayoutMap = Record<string, LayoutPos>;

const DB_NAME = "gh-browser-layout";
const STORE = "dirs";

/** Grid cell size in px — both the drag-snap unit and the tile spacing. */
export const CELL = 96;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function keyFor(repoKey: string, branch: string, dirPath: string): string {
  return `${repoKey}@${branch}:${dirPath}`;
}

/** Positions are keyed by (repo, branch, parent dir) so a Grid layout is
 * per-folder, not global — matches PLAN.md M5. */
export async function loadLayout(
  repoKey: string,
  branch: string,
  dirPath: string
): Promise<LayoutMap> {
  const db = await openDb();
  const result = await new Promise<LayoutMap>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(keyFor(repoKey, branch, dirPath));
    req.onsuccess = () => resolve((req.result as LayoutMap | undefined) ?? {});
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function saveLayout(
  repoKey: string,
  branch: string,
  dirPath: string,
  map: LayoutMap
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(map, keyFor(repoKey, branch, dirPath));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function snap(x: number, y: number): LayoutPos {
  return {
    x: Math.max(0, Math.round(x / CELL) * CELL),
    y: Math.max(0, Math.round(y / CELL) * CELL),
  };
}

/** Assigns a free grid cell to every name not already present in `map`,
 * scanning row-major so newly added files land in reading order. */
export function autoPlace(map: LayoutMap, names: string[], columns: number): LayoutMap {
  const occupied = new Set(Object.values(map).map((p) => `${p.x},${p.y}`));
  const next = { ...map };
  let col = 0;
  let row = 0;
  const advance = () => {
    col++;
    if (col >= columns) {
      col = 0;
      row++;
    }
  };
  for (const name of names) {
    if (next[name]) continue;
    while (occupied.has(`${col * CELL},${row * CELL}`)) advance();
    const pos = { x: col * CELL, y: row * CELL };
    next[name] = pos;
    occupied.add(`${pos.x},${pos.y}`);
    advance();
  }
  return next;
}
