"use client";

import { useEffect, useState } from "react";
import { StoreProvider, useActiveRepo, useStore } from "@/lib/store";
import { StagingProvider } from "@/lib/staging";
import { UIProvider } from "@/components/ui-context";
import { AddressBar } from "@/components/AddressBar";
import { Explorer } from "@/components/Explorer";
import { Tabs } from "@/components/Tabs";
import { FileView } from "@/components/FileView";
import { SearchButton, SearchProvider } from "@/features/search";
import { ChangesButton, ChangesProvider } from "@/features/changes";
import { RecycleBinButton } from "@/features/recycle-bin";
import { PullsButton, PullsProvider } from "@/features/pulls";
import { IssuesButton, IssuesProvider } from "@/features/issues";
import { Dock } from "@/features/dock";
import { ControlPanelButton, ControlPanelProvider } from "@/features/control-panel";
import { StartMenuButton, StartMenuProvider } from "@/features/start-menu";
import { TriageButton, TriageProvider } from "@/features/triage";
import {
  GitBranch,
  GithubMark,
  Search,
  FileIcon,
} from "@/components/icons";

function Home() {
  const { state, openRepo } = useStore();
  const [recent, setRecent] = useState<string[]>([]);
  const [value, setValue] = useState("");

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem("gh-browser-recent") ?? "[]"));
    } catch {
      setRecent([]);
    }
  }, [state.repoLoading]);

  return (
    <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-black p-6">
      <div className="w-full max-w-xl">
        <div className="mb-4 flex justify-end">
          <SearchButton />
        </div>
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-900 ring-1 ring-neutral-800">
            <GithubMark width={34} height={34} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-100">
            GitHub Browser
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            A desktop-style repository explorer — tabs, context menus, drag &amp;
            drop and touch support.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) void openRepo(value);
          }}
          className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 focus-within:border-blue-600"
        >
          <Search width={18} height={18} className="text-neutral-500" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Open a repository — e.g. facebook/react"
            className="flex-1 bg-transparent text-base text-neutral-100 outline-none placeholder:text-neutral-600"
            spellCheck={false}
            autoFocus
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
          >
            Open
          </button>
        </form>

        {state.repoError && (
          <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-2 text-sm text-red-300">
            {state.repoError}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            ["Tabs", "Click to switch, drag to reorder, middle-click to close."],
            ["Context menu", "Right-click (or long-press) any file or folder."],
            ["Drag & drop", "Drag a node onto the tab bar to open it in a new tab."],
            ["Multi-select", "Ctrl/Cmd+click or Shift+click to select several."],
          ].map(([t, d]) => (
            <div
              key={t}
              className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3"
            >
              <div className="text-sm font-medium text-neutral-200">{t}</div>
              <div className="mt-0.5 text-xs text-neutral-500">{d}</div>
            </div>
          ))}
        </div>

        {recent.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Recent
            </div>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button
                  key={r}
                  onClick={() => void openRepo(r)}
                  className="flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-600 hover:text-neutral-100"
                >
                  <GitBranch width={13} height={13} className="text-neutral-500" />
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="mt-10 text-xs text-neutral-600">
        Data from the public GitHub REST API · unauthenticated rate limit applies
      </div>
    </div>
  );
}

function StatusBar() {
  const repo = useActiveRepo();
  const active = repo?.tabs.find((t) => t.id === repo.activeTabId);
  return (
    <div className="flex items-center gap-4 border-t border-neutral-800 bg-neutral-950 px-3 py-1 text-[11px] text-neutral-500">
      <span className="flex items-center gap-1">
        <GitBranch width={12} height={12} />
        {repo?.meta.branch}
      </span>
      {active && (
        <span className="flex items-center gap-1 truncate">
          <FileIcon width={12} height={12} />
          <span className="truncate">
            {repo?.meta.fullName} / {active.path || "/"}
          </span>
        </span>
      )}
      <span className="ml-auto">
        {repo && repo.selection.length > 0
          ? `${repo.selection.length} selected`
          : `${repo?.tabs.length ?? 0} tab${repo?.tabs.length === 1 ? "" : "s"}`}
      </span>
    </div>
  );
}

function TitleBar() {
  const { state, switchRepo } = useStore();
  const repo = useActiveRepo();
  return (
    <div className="flex items-center gap-3 border-b border-neutral-800 bg-neutral-950 px-3 py-1.5">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-red-500/90" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/90" />
        <span className="h-3 w-3 rounded-full bg-green-500/90" />
      </div>
      <div className="flex items-center gap-2 text-sm text-neutral-300">
        <GithubMark width={15} height={15} />
        <span className="font-medium">{repo?.meta.fullName}</span>
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-3">
        <div className="hidden max-w-[40vw] items-center gap-1 overflow-x-auto md:flex">
          {Object.keys(state.repos).map((repoKey) => (
            <button
              key={repoKey}
              onClick={() => switchRepo(repoKey)}
              className={[
                "shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                repoKey === state.activeRepoKey
                  ? "border-blue-500/60 bg-blue-500/15 text-blue-200"
                  : "border-neutral-800 bg-neutral-900 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300",
              ].join(" ")}
              title={`Switch to ${repoKey}`}
            >
              {repoKey}
            </button>
          ))}
        </div>
        <StartMenuButton />
        <ChangesButton />
        <RecycleBinButton />
        <PullsButton />
        <IssuesButton />
        <TriageButton />
        <ControlPanelButton />
        <SearchButton />
        <span className="text-[11px] text-neutral-600">GitHub Browser</span>
      </div>
    </div>
  );
}

function Workspace() {
  const { closeRepo } = useStore();
  const repo = useActiveRepo();
  if (!repo) return <Home />;
  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <AddressBar onGoHome={closeRepo} />
      <Dock />
      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 border-r border-neutral-800">
          <Explorer />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <Tabs />
          <div className="min-h-0 flex-1">
            <FileView />
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  );
}

export default function Page() {
  return (
    <StoreProvider>
      <StagingProvider>
        <ChangesProvider>
          <PullsProvider>
            <IssuesProvider>
              <ControlPanelProvider>
                <StartMenuProvider>
                  <TriageProvider>
                    <UIProvider>
                      <SearchProvider>
                        <div className="h-screen w-screen overflow-hidden">
                          <Workspace />
                        </div>
                      </SearchProvider>
                    </UIProvider>
                  </TriageProvider>
                </StartMenuProvider>
              </ControlPanelProvider>
            </IssuesProvider>
          </PullsProvider>
        </ChangesProvider>
      </StagingProvider>
    </StoreProvider>
  );
}
