# DRAGHUB theming conventions

DRAGHUB's visual system is built on Fluent UI React v9 (`@fluentui/react-components`)
and Fluent System Icons (`@fluentui/react-icons`), with **light as the
default/reference design** and a tonal dark mode as an equally supported
alternative. This document is the reference for extending it — read it before
adding a new surface, color, or icon.

## Theme mode

- `src/features/theme/theme-storage.ts` — pure functions: `ThemeMode =
  "light" | "dark"`, `loadStoredThemeMode()`, `storeThemeMode()`,
  `applyThemeToDocument()`. `DEFAULT_THEME_MODE` is `"light"`. The persisted
  key is `draghub-theme` (`localStorage`). An invalid/missing stored value
  falls back to light.
- `src/features/theme/DraghubThemeProvider.tsx` — the single top-level
  `FluentProvider` for the app (wraps `draghubLightTheme`/`draghubDarkTheme`
  from `themes.ts`, built from one `BrandVariants` ramp so Fluent's own
  components pick up the DRAGHUB brand automatically). It owns theme mode
  only: it never touches `WindowManagerProvider`, `StoreProvider` or
  `StagingProvider`, so toggling the theme re-renders (never remounts) the
  desktop tree — open windows, positions, editor drafts and tabs are
  untouched. Read the mode with `useDraghubTheme()`.
- `src/app/layout.tsx` — a blocking inline script sets
  `document.documentElement.dataset.theme` and `style.colorScheme` from
  `localStorage` *before* hydration, so there is no light→dark (or
  dark→light) flash. `<html>`/`<body>` carry `suppressHydrationWarning`
  because this is an intentional SSR/first-paint mismatch, resolved by a
  mount-only effect in `DraghubThemeProvider` that syncs React state
  immediately after mount.

**Do not** introduce a second theme provider, a second persistence key, or
`dark:`-by-`prefers-color-scheme` styling — the mode is a user choice, not
an OS setting (see the `@custom-variant dark` override in `globals.css`,
which binds Tailwind's `dark:` variant to `[data-theme="dark"]`).

## Semantic tokens (`--dh-*`)

Defined once on `:root` (light) and overridden under `[data-theme="dark"]`
in `src/app/globals.css`:

| Token | Purpose |
|---|---|
| `--dh-desktop-background`, `--dh-desktop-pattern` | Desktop canvas backdrop + grid |
| `--dh-surface`, `--dh-surface-raised`, `--dh-surface-hover`, `--dh-surface-selected` | Window/panel/chrome surfaces, in ascending elevation/emphasis |
| `--dh-window-border`, `--dh-window-border-active` | Borders; `-active` for the focused window / hovered controls |
| `--dh-text`, `--dh-text-secondary`, `--dh-text-disabled` | Text, in descending emphasis |
| `--dh-accent`, `--dh-accent-foreground` | The DRAGHUB brand color used for interactive state (focus rings, thin controls, primary buttons) — darker/olive in light mode for contrast on white, bright lime in dark mode. Foreground is the color to put *on* an accent-filled surface. |
| `--dh-danger` | Destructive actions (discard, delete) |
| `--dh-focus-ring` | Keyboard focus outline color (mirrors `--dh-accent`) |
| `--dh-shadow-window`, `--dh-shadow-taskbar` | Elevation shadows |
| `--dh-checker-light`, `--dh-checker-dark` | Image-viewer transparency checkerboard |
| `--dh-lime-brand` | **Not re-themed.** The fixed, always-bright DRAGHUB lime, reserved for the brand mark (`DraghubMark`) and "active" indicators (taskbar active-group underline, active-tab underline, launcher icon) — these stay bright lime in both modes, per the design direction ("active indicators/brand marks... preserved in dark"). Do not use it for regular text, icons, or interactive state — that's `--dh-accent`. |

Use these via Tailwind arbitrary values on content surfaces —
`bg-[var(--dh-surface)]`, `text-[var(--dh-text-secondary)]`, etc. — rather
than a Tailwind neutral-scale utility (`bg-neutral-950`, `text-neutral-100`,
`border-neutral-800`, ...), which is fixed to one hardcoded shade and won't
repaint between modes.

**Categorical/status colors are the deliberate exception.** File-status
badges (new/modified/renamed/deleted), PR/issue-type badges, diff
add/remove markers, and similar "this represents category X" colors keep
using a plain Tailwind hue (`text-emerald-700 dark:text-emerald-400`, etc.)
— that's encoding *meaning*, not chrome, and forcing it onto the accent
token would make every category look like the brand color. When you do pair
a dark-tuned pastel/soft color with a light equivalent, **keep the
light/dark values under the same interaction modifier** — `hover:text-red-600
dark:hover:text-red-400`, not `hover:text-red-600 dark:text-red-400` (the
latter silently drops the `hover:` scope from the dark branch and makes the
color permanent in dark mode; this was a real regression caught during this
migration's browser verification — grep for `dark:` immediately following
`hover:`/`focus:`/`group-hover:`/`focus-within:` without repeating the
modifier if you're ever bulk-editing these).

## Icons (`src/features/icons`)

- `fluent-icons.tsx` — the **only** place that imports from
  `@fluentui/react-icons`. Every name in it has been checked against the
  installed package's `.d.ts` files — never guess an icon name; grep
  `node_modules/@fluentui/react-icons/lib/icons/*.d.ts` for the exact
  export before adding one.
- `app-icon-registry.tsx` — `AppIconKey` (semantic keys: `repository`,
  `settings`, `pull-requests`, ...) → Fluent icon component. `appIconFor(key)`
  is the resolver every window/desktop-icon call site should use; it maps
  legacy persisted `iconKey` strings (`repo`, `tool`, `bin`) onto the
  semantic keys and falls back to `DraghubMark` for an unrecognized key
  (so an old session with a removed application's icon key still renders
  something instead of throwing).
- `file-icon-registry.tsx` — extension → file-type icon, same pattern.
- `brand-marks.tsx` — `GithubMark` and `DraghubMark`, hand-drawn SVGs kept
  as the two intentional exceptions to "everything is a Fluent icon" (a
  third-party brand mark and DRAGHUB's own mark aren't in Fluent's set).
- **Convention**: Regular is the default/inactive state; the matching
  Filled variant is for active/selected/emphasized state — decided
  per-usage, not a blanket swap.
- Window/desktop-icon state stores the `iconKey` **string only**
  (`DesktopWindowState.iconKey`, `DesktopIconState.iconKey`,
  `WindowApplicationDefinition.iconKey`) and resolves it to a component at
  render time via `appIconFor`/`fileIconForPath`. Never persist a component
  or icon object.

## CodeMirror

`src/components/CodeEditor.tsx` keeps the editor's theme extension in a
`Compartment` (`themeCompartment`), reconfigured with
`view.dispatch({ effects: themeCompartment.reconfigure(...) })` when
`useDraghubTheme()`'s mode changes. This is a plain extension swap, not a
document/session recreation — undo history, selection, scroll position and
dirty state all survive a theme toggle. Dark mode uses `@codemirror/theme-one-dark`
unchanged; light mode is a `--dh-*`-token-driven `EditorView.theme(...)`
paired with `@codemirror/language`'s `defaultHighlightStyle` (CodeMirror's
own reference light-appropriate syntax highlighting, not a hand-picked
palette).

## Adding a new component

1. Prefer a real Fluent component (`@fluentui/react-components`) over a
   plain styled `<button>`/`<div>` for anything with interactive states
   (buttons, dialogs, menus, form controls) — it inherits the FluentProvider
   theme automatically.
2. If a plain element is more appropriate (e.g. you need exact control over
   hover/focus CSS and don't want to fight Griffel's generated classes —
   see `WindowFrame.tsx`'s window controls for why), style it with `--dh-*`
   tokens, never a raw hex or an unpaired Tailwind color utility.
3. Any icon: import from `@/features/icons`, verified against the installed
   package. Never a hand-drawn SVG, an emoji, or a different icon library.
4. Run `bun test src`, `bun run typecheck`, `bun run lint`, `bun run build`
   before considering the change done — and actually load the app in both
   themes if the change touches anything visual; several real regressions
   in this migration (a hover-scope bug, an invisible-while-focused close
   button) were only caught by doing that, not by the type/lint/test gates
   alone.
