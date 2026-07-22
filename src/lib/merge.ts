export type ConflictSide = "ours" | "theirs" | "both";
export type ConflictHunk = { id: string; before: string[]; ours: string[]; theirs: string[] };

const CONFLICT_BLOCK_RE =
  /<<<<<<<[^\n]*\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>>[^\n]*/g;

export function parseConflictHunks(content: string): ConflictHunk[] {
  const lines = content.split("\n");
  const hunks: ConflictHunk[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].startsWith("<<<<<<<")) { i++; continue; }
    const ours: string[] = [];
    const theirs: string[] = [];
    const before = lines.slice(Math.max(0, i - 3), i);
    i++;
    while (i < lines.length && !lines[i].startsWith("=======")) ours.push(lines[i++]);
    if (lines[i]?.startsWith("=======")) i++;
    while (i < lines.length && !lines[i].startsWith(">>>>>>>")) theirs.push(lines[i++]);
    if (lines[i]?.startsWith(">>>>>>>")) i++;
    // Positional, not random: this same content string gets re-parsed by
    // resolveConflict/resolveConflictAt, and a hunk's identity only needs to
    // be stable within one parse of one content string, in document order —
    // never compared across two different contents.
    hunks.push({ id: String(hunks.length), before, ours, theirs });
  }
  return hunks;
}

/** True if `content` still contains at least one unresolved conflict-marker
 * region. The single source of truth for every "block staging/commit"
 * check in the app — content-based, so it stays correct whether markers
 * were removed via an Accept action or a manual edit. */
export function hasUnresolvedConflicts(content: string): boolean {
  return parseConflictHunks(content).length > 0;
}

/** Applies a side choice to every hunk in `content` at once (e.g. "accept
 * all incoming"). `choices` must cover every hunk id present — an
 * unlisted hunk falls back to "ours" rather than being left unresolved, so
 * callers that mean to touch only some hunks should use
 * `resolveConflictAt` instead. */
export function resolveConflict(content: string, choices: Record<string, ConflictSide>): string {
  const hunks = parseConflictHunks(content);
  let index = 0;
  return content.replace(CONFLICT_BLOCK_RE, (_m, ours: string, theirs: string) => {
    const h = hunks[index++];
    const choice = choices[h?.id ?? ""] ?? "ours";
    if (choice === "both") return `${ours}\n${theirs}`;
    return choice === "theirs" ? theirs : ours;
  });
}

/** Resolves exactly one hunk (by the id an earlier `parseConflictHunks(content)`
 * call on this same content assigned it) and leaves every other hunk in
 * `content` — resolved or not — completely untouched. Returns `content`
 * unchanged if `hunkId` no longer matches any hunk (e.g. a stale id after a
 * manual edit already removed it). */
export function resolveConflictAt(
  content: string,
  hunkId: string,
  side: ConflictSide,
): string {
  const hunks = parseConflictHunks(content);
  const targetIndex = hunks.findIndex((h) => h.id === hunkId);
  if (targetIndex === -1) return content;
  const target = hunks[targetIndex];
  const replacement =
    side === "both"
      ? [...target.ours, ...target.theirs].join("\n")
      : side === "theirs"
        ? target.theirs.join("\n")
        : target.ours.join("\n");
  let index = 0;
  return content.replace(CONFLICT_BLOCK_RE, (match) =>
    index++ === targetIndex ? replacement : match,
  );
}
