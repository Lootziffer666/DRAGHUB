import {
  StateField,
  StateEffect,
  EditorSelection,
  type Extension,
} from "@codemirror/state";
import {
  EditorView,
  ViewPlugin,
  Decoration,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";

/**
 * FLUBBER two-long-press touch selection (Phase-1 contract,
 * docs/DRAGHUB_PLAN_CORRECTION_RECORD.md §4.2):
 *
 *   long press 1 → set selection start (visible marker)
 *   → scroll freely through the document (the started selection survives)
 *   → long press 2 → set selection end (forward or backward)
 *   → adjust either end with DRAGHUB's own draggable grips
 *   → copy / cut / cancel via a floating action bar
 *
 * Touch-only: mouse and keyboard behavior is untouched. The grips are our
 * own widgets positioned from editor document positions — the implementation
 * does not depend on forcing native OS selection handles.
 */

const setAnchorEffect = StateEffect.define<number | null>();

type FlubberPhase = { anchor: number | null };

const flubberField = StateField.define<FlubberPhase>({
  create: () => ({ anchor: null }),
  update(value, tr) {
    let anchor = value.anchor;
    if (anchor !== null) anchor = tr.changes.mapPos(anchor);
    for (const e of tr.effects) {
      if (e.is(setAnchorEffect)) anchor = e.value;
    }
    return anchor === value.anchor ? value : { anchor };
  },
  provide: (field) =>
    EditorView.decorations.from(field, (value) => anchorDecoration(value)),
});

class AnchorWidget extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "flubber-anchor";
    el.setAttribute("aria-label", "Selection start");
    return el;
  }
  override ignoreEvent(): boolean {
    return true;
  }
}

function anchorDecoration(value: FlubberPhase): DecorationSet {
  if (value.anchor === null) return Decoration.none;
  return Decoration.set([
    Decoration.widget({ widget: new AnchorWidget(), side: -1 }).range(value.anchor),
  ]);
}

const LONG_PRESS_MS = 500;
const MOVE_SLOP_PX = 12;

class FlubberPlugin {
  view: EditorView;
  overlay: HTMLDivElement;
  startGrip: HTMLDivElement;
  endGrip: HTMLDivElement;
  actionBar: HTMLDivElement;
  statusChip: HTMLDivElement;
  pressTimer: number | null = null;
  pressStart: { x: number; y: number } | null = null;
  gripsActive = false;
  draggingGrip: "start" | "end" | null = null;
  scrollListener: () => void;

  constructor(view: EditorView) {
    this.view = view;
    this.overlay = document.createElement("div");
    this.overlay.className = "flubber-overlay";
    this.startGrip = this.makeGrip("start");
    this.endGrip = this.makeGrip("end");
    this.actionBar = this.makeActionBar();
    this.statusChip = this.makeStatusChip();
    this.overlay.append(this.startGrip, this.endGrip, this.actionBar, this.statusChip);
    view.dom.appendChild(this.overlay);
    this.scrollListener = () => this.position();
    view.scrollDOM.addEventListener("scroll", this.scrollListener, { passive: true });
    this.position();
  }

  makeGrip(kind: "start" | "end"): HTMLDivElement {
    const grip = document.createElement("div");
    grip.className = `flubber-grip flubber-grip-${kind}`;
    grip.setAttribute("role", "slider");
    grip.setAttribute(
      "aria-label",
      kind === "start" ? "Selection start handle" : "Selection end handle"
    );
    grip.style.display = "none";
    grip.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      grip.setPointerCapture(e.pointerId);
      this.draggingGrip = kind;
    });
    grip.addEventListener("pointermove", (e) => {
      if (this.draggingGrip !== kind) return;
      e.preventDefault();
      const pos = this.view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos === null) return;
      const main = this.view.state.selection.main;
      const range =
        kind === "start"
          ? EditorSelection.range(pos, main.head)
          : EditorSelection.range(main.anchor, pos);
      this.view.dispatch({ selection: range });
    });
    const release = () => {
      this.draggingGrip = null;
    };
    grip.addEventListener("pointerup", release);
    grip.addEventListener("pointercancel", release);
    return grip;
  }

  makeActionBar(): HTMLDivElement {
    const bar = document.createElement("div");
    bar.className = "flubber-actions";
    bar.style.display = "none";
    const mk = (label: string, onClick: () => void) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      });
      bar.appendChild(btn);
      return btn;
    };
    mk("Copy", () => {
      void navigator.clipboard?.writeText(this.selectedText()).catch(() => {});
      this.reset();
    });
    mk("Cut", () => {
      const text = this.selectedText();
      void navigator.clipboard?.writeText(text).catch(() => {});
      const main = this.view.state.selection.main;
      this.view.dispatch({
        changes: { from: main.from, to: main.to, insert: "" },
      });
      this.reset();
    });
    mk("Cancel", () => this.reset());
    return bar;
  }

  makeStatusChip(): HTMLDivElement {
    const chip = document.createElement("div");
    chip.className = "flubber-status";
    chip.style.display = "none";
    const label = document.createElement("span");
    label.textContent = "Selection started — long-press the end point";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "✕";
    cancel.setAttribute("aria-label", "Cancel selection");
    cancel.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.reset();
    });
    chip.append(label, cancel);
    return chip;
  }

  selectedText(): string {
    const main = this.view.state.selection.main;
    return this.view.state.sliceDoc(main.from, main.to);
  }

  anchor(): number | null {
    return this.view.state.field(flubberField).anchor;
  }

  reset() {
    this.gripsActive = false;
    const main = this.view.state.selection.main;
    this.view.dispatch({
      effects: setAnchorEffect.of(null),
      selection: EditorSelection.cursor(main.head),
    });
  }

  handleLongPress(x: number, y: number) {
    const pos = this.view.posAtCoords({ x, y });
    if (pos === null) return;
    const anchor = this.anchor();
    if (anchor === null || this.gripsActive) {
      // First long press (or restarting after a completed selection).
      this.gripsActive = false;
      this.view.dispatch({ effects: setAnchorEffect.of(pos) });
    } else {
      // Second long press completes the range — forward or backward.
      this.gripsActive = true;
      this.view.dispatch({
        selection: EditorSelection.range(anchor, pos),
        effects: setAnchorEffect.of(anchor),
      });
    }
  }

  onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) {
      this.clearPressTimer();
      return;
    }
    const touch = e.touches[0];
    this.pressStart = { x: touch.clientX, y: touch.clientY };
    this.clearPressTimer();
    this.pressTimer = window.setTimeout(() => {
      this.pressTimer = null;
      if (this.pressStart) this.handleLongPress(this.pressStart.x, this.pressStart.y);
    }, LONG_PRESS_MS);
  }

  onTouchMove(e: TouchEvent) {
    if (!this.pressStart || this.pressTimer === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - this.pressStart.x);
    const dy = Math.abs(touch.clientY - this.pressStart.y);
    // Movement means scrolling, not a long press — cancel the timer but
    // keep any started selection state intact.
    if (dx > MOVE_SLOP_PX || dy > MOVE_SLOP_PX) this.clearPressTimer();
  }

  onTouchEnd() {
    this.clearPressTimer();
  }

  clearPressTimer() {
    if (this.pressTimer !== null) {
      window.clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  update(update: ViewUpdate) {
    const fieldChanged =
      update.state.field(flubberField) !== update.startState.field(flubberField);
    if (update.selectionSet || update.docChanged || update.viewportChanged || fieldChanged) {
      this.position();
    }
  }

  /** Schedules a measure cycle — layout reads are not allowed synchronously
   * inside plugin update(), so read coords in the measure phase and apply
   * styles in the write phase. */
  position() {
    this.view.requestMeasure({
      read: () => this.readPositions(),
      write: (m) => this.applyPositions(m),
    });
  }

  readPositions() {
    const anchor = this.anchor();
    const main = this.view.state.selection.main;
    const editorRect = this.view.dom.getBoundingClientRect();
    const rel = (coords: { left: number; top: number; bottom: number } | null) =>
      coords
        ? {
            left: coords.left - editorRect.left,
            top: coords.top - editorRect.top,
            bottom: coords.bottom - editorRect.top,
          }
        : null;
    if (this.gripsActive && !main.empty) {
      return {
        mode: "grips" as const,
        from: rel(this.view.coordsAtPos(main.from)),
        to: rel(this.view.coordsAtPos(main.to)),
      };
    }
    return { mode: "chip" as const, anchored: anchor !== null };
  }

  applyPositions(m: ReturnType<FlubberPlugin["readPositions"]>) {
    if (m.mode === "grips") {
      const place = (
        el: HTMLElement,
        coords: { left: number; bottom: number } | null
      ) => {
        if (!coords) {
          el.style.display = "none";
          return;
        }
        el.style.display = "block";
        el.style.left = `${coords.left}px`;
        el.style.top = `${coords.bottom}px`;
      };
      place(this.startGrip, m.from);
      place(this.endGrip, m.to);
      if (m.to) {
        this.actionBar.style.display = "flex";
        this.actionBar.style.left = `${Math.max(4, m.to.left - 40)}px`;
        this.actionBar.style.top = `${Math.max(4, m.to.top - 40)}px`;
      } else {
        this.actionBar.style.display = "none";
      }
      this.statusChip.style.display = "none";
    } else {
      this.startGrip.style.display = "none";
      this.endGrip.style.display = "none";
      this.actionBar.style.display = "none";
      this.statusChip.style.display = m.anchored ? "flex" : "none";
    }
  }

  destroy() {
    this.clearPressTimer();
    this.view.scrollDOM.removeEventListener("scroll", this.scrollListener);
    this.overlay.remove();
  }
}

const flubberPlugin = ViewPlugin.fromClass(FlubberPlugin, {
  eventHandlers: {
    touchstart(e) {
      this.onTouchStart(e);
    },
    touchmove(e) {
      this.onTouchMove(e);
    },
    touchend() {
      this.onTouchEnd();
    },
    touchcancel() {
      this.onTouchEnd();
    },
  },
});

const flubberTheme = EditorView.baseTheme({
  ".flubber-overlay": {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
    zIndex: "10",
  },
  ".flubber-anchor": {
    display: "inline-block",
    width: "2px",
    height: "1.2em",
    verticalAlign: "text-bottom",
    background: "#f59e0b",
    boxShadow: "0 0 0 1px rgba(245, 158, 11, 0.4)",
  },
  ".flubber-grip": {
    position: "absolute",
    width: "18px",
    height: "18px",
    marginLeft: "-9px",
    borderRadius: "50% 50% 50% 0",
    background: "#3b82f6",
    border: "2px solid #dbeafe",
    pointerEvents: "auto",
    touchAction: "none",
    transform: "rotate(-45deg)",
  },
  ".flubber-grip-start": { background: "#f59e0b", borderColor: "#fef3c7" },
  ".flubber-actions": {
    position: "absolute",
    display: "flex",
    gap: "4px",
    padding: "4px",
    borderRadius: "8px",
    background: "#171717",
    border: "1px solid #404040",
    pointerEvents: "auto",
  },
  ".flubber-actions button": {
    padding: "4px 10px",
    borderRadius: "6px",
    background: "#262626",
    color: "#e5e5e5",
    fontSize: "12px",
    border: "none",
  },
  ".flubber-status": {
    position: "absolute",
    top: "6px",
    right: "6px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "rgba(245, 158, 11, 0.15)",
    border: "1px solid rgba(245, 158, 11, 0.5)",
    color: "#fbbf24",
    fontSize: "11px",
    pointerEvents: "auto",
  },
  ".flubber-status button": {
    background: "none",
    border: "none",
    color: "#fbbf24",
    fontSize: "12px",
  },
});

export function flubberSelection(): Extension {
  return [flubberField, flubberPlugin, flubberTheme];
}
