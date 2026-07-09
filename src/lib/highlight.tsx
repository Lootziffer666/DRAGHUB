export type Token = { text: string; type: TokenType };
export type TokenType =
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "ident"
  | "ws"
  | "punct"
  | "plain";

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "do", "switch", "case", "break", "continue", "new", "class", "extends",
  "super", "this", "import", "from", "export", "default", "async", "await",
  "yield", "try", "catch", "finally", "throw", "typeof", "instanceof", "in",
  "of", "delete", "void", "null", "undefined", "true", "false", "enum",
  "interface", "type", "implements", "public", "private", "protected",
  "readonly", "static", "abstract", "as", "namespace", "declare", "def",
  "elif", "lambda", "pass", "with", "raise", "except", "print", "func",
  "package", "func", "struct", "map", "range", "go", "defer", "chan", "select",
  "mut", "fn", "pub", "use", "mod", "trait", "impl", "self", "where", "loop",
  "match", "endif", "then", "fi", "echo", "foreach", "end", "begin", "rescue",
]);

const MASTER =
  /(\/\/[^\n]*|#[^\n]*|--[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|\b([A-Za-z_$][\w$]*)\b|(\s+)|([^\s\w])/g;

export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let inBlock = false;
  let i = 0;
  const len = code.length;

  while (i < len) {
    if (inBlock) {
      const end = code.indexOf("*/", i);
      const stop = end === -1 ? len : end + 2;
      tokens.push({ text: code.slice(i, stop), type: "comment" });
      i = stop;
      if (end !== -1) inBlock = false;
      continue;
    }
    MASTER.lastIndex = i;
    const m = MASTER.exec(code);
    if (!m || m.index !== i) {
      tokens.push({ text: code[i], type: "plain" });
      i++;
      continue;
    }
    if (m[1] !== undefined) {
      if (m[1].startsWith("/*")) {
        const end = m[1].indexOf("*/");
        if (end === -1 || end + 2 < m[1].length) {
          inBlock = true;
        }
      }
      tokens.push({ text: m[1], type: "comment" });
    } else if (m[2] !== undefined) {
      tokens.push({ text: m[2], type: "string" });
    } else if (m[3] !== undefined) {
      tokens.push({ text: m[3], type: "number" });
    } else if (m[4] !== undefined) {
      tokens.push({
        text: m[4],
        type: KEYWORDS.has(m[4]) ? "keyword" : "ident",
      });
    } else if (m[5] !== undefined) {
      tokens.push({ text: m[5], type: "ws" });
    } else {
      tokens.push({ text: m[6], type: "punct" });
    }
    i = MASTER.lastIndex;
  }
  return tokens;
}

export function tokenizeLines(code: string): Token[][] {
  const tokens = tokenize(code);
  const lines: Token[][] = [[]];
  for (const tok of tokens) {
    const parts = tok.text.split("\n");
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([]);
      if (part.length > 0) lines[lines.length - 1].push({ text: part, type: tok.type });
    });
  }
  return lines;
}
