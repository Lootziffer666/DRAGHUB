"use client";

import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { rust } from "@codemirror/lang-rust";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";

/** Best-effort language extension by file extension — falls back to plain text. */
function languageExtensionFor(path: string): Extension[] {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
      return [javascript({ jsx: true, typescript: true })];
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return [javascript({ jsx: true })];
    case "json":
      return [json()];
    case "py":
      return [python()];
    case "css":
    case "scss":
      return [css()];
    case "html":
    case "htm":
      return [html()];
    case "md":
    case "mdx":
      return [markdown()];
    case "rs":
      return [rust()];
    case "c":
    case "h":
    case "cpp":
    case "cc":
    case "hpp":
      return [cpp()];
    case "java":
    case "kt":
      return [java()];
    default:
      return [];
  }
}

export function CodeEditor({
  path,
  initialValue,
  onChange,
}: {
  path: string;
  initialValue: string;
  onChange: (value: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        oneDark,
        ...languageExtensionFor(path),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "12.5px" },
          ".cm-scroller": { fontFamily: "var(--font-mono, monospace)", overflow: "auto" },
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only (re)create the editor when switching files; `initialValue` changes
    // on every keystroke via onChange and must not reset the document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return <div ref={hostRef} className="h-full min-h-0 flex-1 overflow-hidden" />;
}
