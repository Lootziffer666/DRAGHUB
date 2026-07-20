import type { ReactNode } from "react";

/**
 * Minimal dependency-free Markdown renderer for the M3b preview
 * (docs/DRAGHUB_PLAN_CORRECTION_RECORD.md §5: "gerenderte Markdown-Vorschau").
 * Renders to React elements — never injects raw HTML, so untrusted content
 * cannot execute. Inline HTML in the source is shown as literal text.
 */

type InlinePart = ReactNode;

function renderInline(text: string, keyPrefix: string): InlinePart[] {
  const parts: InlinePart[] = [];
  // Order matters: code spans first (their content is literal), then images,
  // links, bold, italic, strikethrough.
  const pattern =
    /(`[^`]+`)|(!\[[^\]]*\]\([^)\s]+\))|(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(~~[^~]+~~)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (match[1]) {
      parts.push(
        <code key={key} className="rounded bg-neutral-800 px-1 py-0.5 text-[0.9em] text-amber-200">
          {token.slice(1, -1)}
        </code>
      );
    } else if (match[2]) {
      const m = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(token);
      const src = m?.[2] ?? "";
      if (/^https?:\/\//i.test(src)) {
        // eslint-disable-next-line @next/next/no-img-element
        parts.push(<img key={key} src={src} alt={m?.[1] ?? ""} className="my-1 inline-block max-w-full rounded border border-neutral-800" />);
      } else {
        parts.push(token);
      }
    } else if (match[3]) {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const href = m?.[2] ?? "";
      if (/^https?:\/\//i.test(href) || href.startsWith("#")) {
        parts.push(
          <a key={key} href={href} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
            {renderInline(m?.[1] ?? "", `${key}-t`)}
          </a>
        );
      } else {
        parts.push(m?.[1] ?? token);
      }
    } else if (match[4]) {
      parts.push(<strong key={key}>{renderInline(token.slice(2, -2), `${key}-b`)}</strong>);
    } else if (match[5]) {
      parts.push(<em key={key}>{renderInline(token.slice(1, -1), `${key}-i`)}</em>);
    } else if (match[6]) {
      parts.push(<del key={key}>{renderInline(token.slice(2, -2), `${key}-s`)}</del>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const HEADING_CLASS: Record<number, string> = {
  1: "mt-6 mb-3 text-2xl font-bold text-neutral-100 border-b border-neutral-800 pb-2",
  2: "mt-5 mb-2 text-xl font-semibold text-neutral-100 border-b border-neutral-800/60 pb-1",
  3: "mt-4 mb-2 text-lg font-semibold text-neutral-100",
  4: "mt-3 mb-1.5 text-base font-semibold text-neutral-200",
  5: "mt-3 mb-1 text-sm font-semibold text-neutral-200",
  6: "mt-3 mb-1 text-sm font-semibold text-neutral-400",
};

export function renderMarkdown(source: string): ReactNode {
  const lines = source.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block
    const fence = /^```(\w*)/.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++; // closing fence
      blocks.push(
        <pre key={key++} className="my-3 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-[12.5px] leading-5 text-neutral-200">
          <code>{code.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      blocks.push(
        <Tag key={key++} className={HEADING_CLASS[level]}>
          {renderInline(heading[2], `h${key}`)}
        </Tag>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="my-4 border-neutral-800" />);
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote key={key++} className="my-3 border-l-4 border-neutral-700 pl-3 text-neutral-400">
          {renderMarkdown(quote.join("\n"))}
        </blockquote>
      );
      continue;
    }

    // Lists (unordered / ordered)
    const listMatch = /^(\s*)([-*+]|\d+\.)\s+/.exec(line);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[2]);
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (!m) break;
        items.push(
          <li key={items.length} className="my-0.5">
            {renderInline(m[3], `li${key}-${items.length}`)}
          </li>
        );
        i++;
      }
      const cls = "my-2 ml-5 text-neutral-300 " + (ordered ? "list-decimal" : "list-disc");
      blocks.push(
        ordered ? (
          <ol key={key++} className={cls}>{items}</ol>
        ) : (
          <ul key={key++} className={cls}>{items}</ul>
        )
      );
      continue;
    }

    // Paragraph: gather until blank line or a structural line
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6})\s|^```|^>\s?|^(\s*)([-*+]|\d+\.)\s|^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-2 leading-6 text-neutral-300">
        {renderInline(para.join(" "), `p${key}`)}
      </p>
    );
  }

  return <div className="markdown-body px-4 py-3">{blocks}</div>;
}
