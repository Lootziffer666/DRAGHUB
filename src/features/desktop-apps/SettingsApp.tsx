"use client";

import { useEffect, useState } from "react";
import { Radio, RadioGroup, type RadioGroupOnChangeData } from "@fluentui/react-components";
import {
  getGithubToken,
  setGithubToken,
  clearGithubToken,
} from "@/lib/github";
import { useWindowManager } from "@/features/desktop/WindowManagerProvider";
import { useDraghubTheme, type ThemeMode } from "@/features/theme";

/** Desktop Settings — GitHub access token and desktop-session maintenance. */
export function SettingsApp() {
  const wm = useWindowManager();
  const { mode, setMode } = useDraghubTheme();
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [hasStored, setHasStored] = useState(false);

  useEffect(() => {
    const stored = getGithubToken();
    setHasStored(Boolean(stored));
  }, []);

  const save = () => {
    if (!token.trim()) return;
    setGithubToken(token.trim());
    setHasStored(true);
    setToken("");
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  };

  return (
    <div className="h-full overflow-auto bg-[var(--dh-surface)] p-4 text-[var(--dh-text)]">
      <section className="mb-6">
        <h3 className="mb-1 text-sm font-semibold">Appearance</h3>
        <p className="mb-2 text-xs text-[var(--dh-text-secondary)]">
          Choose the DRAGHUB color theme. Your choice is saved in this browser
          and applied on the next visit.
        </p>
        <RadioGroup
          layout="horizontal"
          value={mode}
          onChange={(_e, data: RadioGroupOnChangeData) =>
            setMode(data.value as ThemeMode)
          }
        >
          <Radio value="light" label="Light" />
          <Radio value="dark" label="Dark" />
        </RadioGroup>
      </section>

      <section className="mb-6">
        <h3 className="mb-1 text-sm font-semibold">GitHub access</h3>
        <p className="mb-2 text-xs text-[var(--dh-text-secondary)]">
          A personal access token (repo scope) enables checkpoints, pull-request
          and issue actions, and raises the API rate limit. It is stored only in
          this browser&apos;s localStorage.
        </p>
        <div className="flex items-center gap-2">
          <input
            type={show ? "text" : "password"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={hasStored ? "Token stored — enter to replace" : "ghp_…"}
            className="flex-1 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-1.5 text-sm outline-none focus:border-[var(--dh-focus-ring)]"
          />
          <button
            onClick={() => setShow((v) => !v)}
            className="rounded-md border border-[var(--dh-window-border)] px-2 py-1.5 text-xs text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
          >
            {show ? "Hide" : "Show"}
          </button>
          <button
            onClick={save}
            className="rounded-md bg-[var(--dh-accent)] px-3 py-1.5 text-xs font-medium text-[var(--dh-accent-foreground)] hover:opacity-90"
          >
            Save
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs">
          <span className={hasStored ? "text-emerald-700 dark:text-emerald-400" : "text-[var(--dh-text-secondary)]"}>
            {savedFlash ? "Token saved." : hasStored ? "Token configured." : "No token configured."}
          </span>
          {hasStored && (
            <button
              onClick={() => {
                clearGithubToken();
                setHasStored(false);
              }}
              className="text-red-600 dark:text-red-400 hover:underline"
            >
              Remove token
            </button>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold">Desktop session</h3>
        <p className="mb-2 text-xs text-[var(--dh-text-secondary)]">
          Window layout, taskbar order and icons are stored locally. Resetting
          the desktop closes all windows but never touches repositories,
          pending changes or the Recycle Bin.
        </p>
        <button
          onClick={() => {
            if (window.confirm("Reset the desktop session? All windows will close; repositories and pending changes are kept."))
              wm.resetDesktopSession();
          }}
          className="rounded-md border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
        >
          Reset desktop session
        </button>
      </section>
    </div>
  );
}
