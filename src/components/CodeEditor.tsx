"use client";

import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { Compartment, EditorState, EditorSelection, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { rust } from "@codemirror/lang-rust";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { flubberSelection } from "@/lib/flubber-selection";
import { useDraghubTheme, type ThemeMode } from "@/features/theme";

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

export type EditorViewState = {
  selection: { anchor: number; head: number };
  scrollTop: number;
};

/** Light-mode editor chrome, driven by the same --dh-* semantic tokens as
 * the rest of the app (rather than a hardcoded palette), paired with
 * CodeMirror's own reference light-appropriate syntax highlighting. Dark
 * mode keeps the existing `oneDark` theme, which already bundles its own
 * chrome + highlight style. */
const lightEditorTheme = EditorView.theme(
  {
    "&": { backgroundColor: "var(--dh-surface)", color: "var(--dh-text)" },
    ".cm-content": { caretColor: "var(--dh-accent)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--dh-accent)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "var(--dh-surface-selected)",
    },
    ".cm-gutters": {
      backgroundColor: "var(--dh-surface-raised)",
      color: "var(--dh-text-secondary)",
      borderRight: "1px solid var(--dh-window-border)",
    },
    ".cm-activeLine": { backgroundColor: "var(--dh-surface-hover)" },
    ".cm-activeLineGutter": { backgroundColor: "var(--dh-surface-hover)" },
    ".cm-matchingBracket, .cm-nonmatchingBracket": {
      backgroundColor: "var(--dh-surface-selected)",
    },
    ".cm-searchMatch": {
      backgroundColor: "color-mix(in srgb, var(--dh-accent) 30%, transparent)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--dh-surface-raised)",
      border: "1px solid var(--dh-window-border)",
      color: "var(--dh-text)",
    },
  },
  { dark: false },
);

/** Extensions held in a Compartment so the theme mode can be swapped with
 * `view.dispatch({ effects: themeCompartment.reconfigure(...) })` — a plain
 * extension reconfiguration, not a document/session recreation, so it never
 * touches undo history, selection, scroll position or dirty state. A single
 * Compartment instance may be safely shared across every CodeEditor
 * instance: CodeMirror resolves a reconfigure against the state it was
 * dispatched to, not globally. */
const themeCompartment = new Compartment();

function themeExtensions(mode: ThemeMode): Extension[] {
  return mode === "dark" ? [oneDark] : [lightEditorTheme, syntaxHighlighting(defaultHighlightStyle)];
}

/**
 * CodeMirror 6 editor (M3b). basicSetup provides line numbers, syntax
 * highlighting, search/replace (Ctrl/Cmd+F), undo/redo history, bracket
 * matching/closing, indentation handling and multi-selection. On top of
 * that: Tab indentation, a Mod-S save binding that stages the draft as a
 * Working Change, and FLUBBER two-long-press touch selection.
 */
export function CodeEditor({
  path,
  initialValue,
  initialViewState,
  onChange,
  onSave,
  onViewState,
}: {
  path: string;
  initialValue: string;
  initialViewState?: EditorViewState;
  onChange: (value: string, selection: { anchor: number; head: number }) => void;
  onSave: () => void;
  onViewState?: (state: EditorViewState) => void;
}) {
  const { mode } = useDraghubTheme();
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onViewStateRef = useRef(onViewState);
  onViewStateRef.current = onViewState;

  useEffect(() => {
    if (!hostRef.current) return;
    const docLength = initialValue.length;
    const clamp = (n: number) => Math.max(0, Math.min(n, docLength));
    const state = EditorState.create({
      doc: initialValue,
      selection: initialViewState
        ? EditorSelection.single(
            clamp(initialViewState.selection.anchor),
            clamp(initialViewState.selection.head)
          )
        : undefined,
      extensions: [
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              onSaveRef.current();
              return true;
            },
          },
          indentWithTab,
        ]),
        basicSetup,
        themeCompartment.of(themeExtensions(modeRef.current)),
        ...languageExtensionFor(path),
        flubberSelection(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged || update.selectionSet) {
            const main = update.state.selection.main;
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString(), {
                anchor: main.anchor,
                head: main.head,
              });
            }
          }
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "12.5px" },
          ".cm-scroller": { fontFamily: "var(--font-mono, monospace)", overflow: "auto" },
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    if (initialViewState?.scrollTop) {
      view.scrollDOM.scrollTop = initialViewState.scrollTop;
    }
    return () => {
      const main = view.state.selection.main;
      onViewStateRef.current?.({
        selection: { anchor: main.anchor, head: main.head },
        scrollTop: view.scrollDOM.scrollTop,
      });
      view.destroy();
      viewRef.current = null;
    };
    // Only (re)create the editor when switching files; `initialValue` changes
    // on every keystroke via onChange and must not reset the document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Swaps only the theme Compartment's extensions when the app's light/dark
  // mode changes — a plain reconfigure, so document, undo history,
  // selection and scroll position are all preserved (no session recreation).
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeCompartment.reconfigure(themeExtensions(mode)),
    });
  }, [mode]);

  return <div ref={hostRef} className="h-full min-h-0 flex-1 overflow-hidden" />;
}
