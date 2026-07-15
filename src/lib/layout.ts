export type ViewMode = "list" | "grid" | "city";
export type GridPosition = { x: number; y: number };
const DB_NAME = "gh-browser-layout";
const STORE = "positions";
const CELL = 112;

export function snapToGrid(x: number, y: number): GridPosition {
  return { x: Math.max(0, Math.round(x / CELL) * CELL), y: Math.max(0, Math.round(y / CELL) * CELL) };
}

export function layoutKey(repoKey: string, branch: string, path: string): string {
  return `${repoKey}@${branch}:${path}`;
}

export async function getLayoutPosition(repoKey: string, branch: string, path: string): Promise<GridPosition | null> {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(layoutKey(repoKey, branch, path));
    req.onsuccess = () => resolve((req.result as GridPosition | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function putLayoutPosition(repoKey: string, branch: string, path: string, pos: GridPosition): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(pos, layoutKey(repoKey, branch, path));
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function exportLayout(repoKey: string, branch: string): Promise<Record<string, GridPosition>> {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const prefix = `${repoKey}@${branch}:`;
    const result: Record<string, GridPosition> = {};
    const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve(result);
      const key = String(cursor.key);
      if (key.startsWith(prefix)) result[key.slice(prefix.length)] = cursor.value as GridPosition;
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
