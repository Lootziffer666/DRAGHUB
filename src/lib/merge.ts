/**
 * Line-based three-way merge (base/ours/theirs), pure logic — no network,
 * no DOM. See PLAN.md M6. The result is a set of hunks; a conflict hunk
 * carries both sides' lines so a UI can offer Ours/Theirs/Both per hunk.
 * The resolved text is a plain string that the caller stages as a regular
 * working-changes delta (M2) — there is no special commit path for merges.
 */

export type BaseOp = {
  baseStart: number;
  baseEnd: number;
  lines: string[];
  changed: boolean;
};

export type MergeHunk =
  | { kind: "same"; lines: string[] }
  | { kind: "ours"; lines: string[] }
  | { kind: "theirs"; lines: string[] }
  | { kind: "conflict"; baseLines: string[]; oursLines: string[]; theirsLines: string[] };

export type MergeResult = {
  hunks: MergeHunk[];
  hasConflict: boolean;
};

const MAX_LINES = 4000;

export function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.split("\n");
}

export function joinLines(lines: string[]): string {
  return lines.join("\n");
}

/**
 * Diffs `other` against `base` and returns ops anchored to `base` indices.
 * Ranged ops (baseStart < baseEnd) fully partition [0, base.length) with no
 * gaps or overlaps. Pure insertions are zero-width ops (baseStart ===
 * baseEnd) sitting between two ranged ops (or at the very start/end) — kept
 * separate rather than folded into a neighbor, so an insertion next to an
 * untouched region never makes that whole region look "changed".
 */
export function computeBaseOps(base: string[], other: string[]): BaseOp[] {
  const n = base.length;
  const m = other.length;
  if (n > MAX_LINES || m > MAX_LINES) {
    throw new Error("File too large to diff in-browser.");
  }

  const dp: Int32Array[] = new Array(n + 1);
  for (let i = 0; i <= n; i++) dp[i] = new Int32Array(m + 1);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        base[i] === other[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  type Raw = { type: "equal" | "delete" | "insert"; baseIdx: number; line: string };
  const raw: Raw[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (base[i] === other[j]) {
      raw.push({ type: "equal", baseIdx: i, line: base[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: "delete", baseIdx: i, line: base[i] });
      i++;
    } else {
      raw.push({ type: "insert", baseIdx: i, line: other[j] });
      j++;
    }
  }
  while (i < n) {
    raw.push({ type: "delete", baseIdx: i, line: base[i] });
    i++;
  }
  while (j < m) {
    raw.push({ type: "insert", baseIdx: i, line: other[j] });
    j++;
  }

  const ops: BaseOp[] = [];
  let k = 0;
  while (k < raw.length) {
    if (raw[k].type === "equal") {
      const start = k;
      while (k < raw.length && raw[k].type === "equal") k++;
      const chunk = raw.slice(start, k);
      ops.push({
        baseStart: chunk[0].baseIdx,
        baseEnd: chunk[chunk.length - 1].baseIdx + 1,
        lines: chunk.map((r) => r.line),
        changed: false,
      });
    } else {
      let baseStart = Infinity;
      let baseEnd = -Infinity;
      let hasDelete = false;
      const lines: string[] = [];
      while (k < raw.length && raw[k].type !== "equal") {
        const r = raw[k];
        baseStart = Math.min(baseStart, r.baseIdx);
        if (r.type === "delete") {
          hasDelete = true;
          baseEnd = Math.max(baseEnd, r.baseIdx + 1);
        } else {
          lines.push(r.line);
        }
        k++;
      }
      if (!hasDelete) baseEnd = baseStart;
      ops.push({ baseStart, baseEnd, lines, changed: true });
    }
  }

  return ops;
}

function linesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function reconstruct(ops: BaseOp[], base: string[], ws: number, we: number): string[] {
  const out: string[] = [];
  for (const op of ops) {
    if (op.baseEnd <= ws || op.baseStart >= we) continue;
    if (!op.changed) {
      const s = Math.max(op.baseStart, ws);
      const e = Math.min(op.baseEnd, we);
      out.push(...base.slice(s, e));
    } else {
      out.push(...op.lines);
    }
  }
  return out;
}

/**
 * Three-way merge of base/ours/theirs text. Non-conflicting edits on either
 * side are applied automatically; regions both sides changed differently
 * become a `conflict` hunk. Disjoint edits (even on adjacent lines) do not
 * conflict — only base ranges both diffs actually touch do.
 */
export function mergeThreeWay(
  baseText: string,
  oursText: string,
  theirsText: string
): MergeResult {
  const base = splitLines(baseText);
  const ours = splitLines(oursText);
  const theirs = splitLines(theirsText);

  if (base.length === 0) {
    if (oursText === theirsText) {
      return { hunks: oursText === "" ? [] : [{ kind: "same", lines: ours }], hasConflict: false };
    }
    if (oursText === "") return { hunks: [{ kind: "theirs", lines: theirs }], hasConflict: false };
    if (theirsText === "") return { hunks: [{ kind: "ours", lines: ours }], hasConflict: false };
    return {
      hunks: [{ kind: "conflict", baseLines: [], oursLines: ours, theirsLines: theirs }],
      hasConflict: true,
    };
  }

  const oursOps = computeBaseOps(base, ours);
  const theirsOps = computeBaseOps(base, theirs);

  const hunks: MergeHunk[] = [];
  let hasConflict = false;
  let pos = 0;
  const n = base.length;

  function opAt(ops: BaseOp[], p: number): BaseOp {
    const op = ops.find((o) => p >= o.baseStart && p < o.baseEnd);
    if (!op) throw new Error("merge: base position out of range — this is a bug.");
    return op;
  }

  function zeroWidthAt(ops: BaseOp[], p: number): BaseOp | undefined {
    return ops.find((o) => o.baseStart === o.baseEnd && o.baseStart === p);
  }

  /** Emits a pure-insertion hunk (no base lines consumed) anchored at `p`,
   * if either side has one — independent of any ranged conflict there. */
  function emitInsertionsAt(p: number) {
    const oZero = zeroWidthAt(oursOps, p);
    const tZero = zeroWidthAt(theirsOps, p);
    if (!oZero && !tZero) return;
    if (oZero && tZero) {
      if (linesEqual(oZero.lines, tZero.lines)) {
        hunks.push({ kind: "same", lines: oZero.lines });
      } else {
        hunks.push({ kind: "conflict", baseLines: [], oursLines: oZero.lines, theirsLines: tZero.lines });
        hasConflict = true;
      }
    } else if (oZero) {
      hunks.push({ kind: "ours", lines: oZero.lines });
    } else if (tZero) {
      hunks.push({ kind: "theirs", lines: tZero.lines });
    }
  }

  emitInsertionsAt(0);

  while (pos < n) {
    const o = opAt(oursOps, pos);
    const t = opAt(theirsOps, pos);

    if (!o.changed && !t.changed) {
      const end = Math.min(o.baseEnd, t.baseEnd);
      hunks.push({ kind: "same", lines: base.slice(pos, end) });
      pos = end;
      emitInsertionsAt(pos);
      continue;
    }

    const ws = pos;
    let we = Math.max(o.changed ? o.baseEnd : ws, t.changed ? t.baseEnd : ws);
    for (;;) {
      let grew = false;
      for (const op of oursOps) {
        if (op.changed && op.baseStart < we && op.baseEnd > ws && op.baseEnd > we) {
          we = op.baseEnd;
          grew = true;
        }
      }
      for (const op of theirsOps) {
        if (op.changed && op.baseStart < we && op.baseEnd > ws && op.baseEnd > we) {
          we = op.baseEnd;
          grew = true;
        }
      }
      if (!grew) break;
    }

    const baseLines = base.slice(ws, we);
    const oursLines = reconstruct(oursOps, base, ws, we);
    const theirsLines = reconstruct(theirsOps, base, ws, we);

    if (linesEqual(oursLines, theirsLines)) {
      hunks.push({ kind: "same", lines: oursLines });
    } else if (linesEqual(oursLines, baseLines)) {
      hunks.push({ kind: "theirs", lines: theirsLines });
    } else if (linesEqual(theirsLines, baseLines)) {
      hunks.push({ kind: "ours", lines: oursLines });
    } else {
      hunks.push({ kind: "conflict", baseLines, oursLines, theirsLines });
      hasConflict = true;
    }
    pos = we;
    emitInsertionsAt(pos);
  }

  return { hunks, hasConflict };
}

export type ConflictResolution = "ours" | "theirs" | "both";

/** Applies per-conflict-hunk resolutions (in encounter order) and returns
 * the final merged text. `resolutions[i]` corresponds to the i-th conflict
 * hunk in `hunks` (in array order), not the overall hunk index. */
export function applyResolutions(
  hunks: MergeHunk[],
  resolutions: ConflictResolution[]
): string {
  const out: string[] = [];
  let ci = 0;
  for (const hunk of hunks) {
    if (hunk.kind === "conflict") {
      const resolution = resolutions[ci] ?? "ours";
      ci++;
      if (resolution === "ours") out.push(...hunk.oursLines);
      else if (resolution === "theirs") out.push(...hunk.theirsLines);
      else out.push(...hunk.oursLines, ...hunk.theirsLines);
    } else {
      out.push(...hunk.lines);
    }
  }
  return joinLines(out);
}
