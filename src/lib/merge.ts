export type ConflictSide = "ours" | "theirs" | "both";
export type ConflictHunk = { id: string; before: string[]; ours: string[]; theirs: string[] };

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
    hunks.push({ id: crypto.randomUUID(), before, ours, theirs });
  }
  return hunks;
}

export function resolveConflict(content: string, choices: Record<string, ConflictSide>): string {
  const hunks = parseConflictHunks(content);
  let index = 0;
  return content.replace(/<<<<<<<[^\n]*\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>>[^\n]*/g, (_m, ours: string, theirs: string) => {
    const h = hunks[index++];
    const choice = choices[h?.id ?? ""] ?? "ours";
    if (choice === "both") return `${ours}\n${theirs}`;
    return choice === "theirs" ? theirs : ours;
  });
}
