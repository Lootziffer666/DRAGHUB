"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Spinner, X, GitBranch, ExternalLink, Download, Archive } from "@/components/icons";
import { fetchReleases, fetchPackages, type ReleasesResult, type PackagesResult } from "./releases-api";
import { fetchCodespaces, createCodespace, codespacesDeepLink, type CodespacesResult } from "./codespaces-api";
import { formatBytes } from "@/lib/github";

function ReleasesSection() {
  const { state } = useStore();
  const meta = state.meta;
  const [result, setResult] = useState<ReleasesResult | null>(null);
  const [packages, setPackages] = useState<PackagesResult | null>(null);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    void fetchReleases(meta.owner, meta.repo).then((r) => {
      if (!cancelled) setResult(r);
    });
    void fetchPackages(meta.owner, meta.repo).then((r) => {
      if (!cancelled) setPackages(r);
    });
    return () => {
      cancelled = true;
    };
  }, [meta]);

  if (!meta) return null;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-neutral-800 p-3">
        <h3 className="mb-2 text-sm font-semibold text-neutral-200">Releases</h3>
        {result === null && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Spinner width={14} height={14} className="text-blue-400" /> Loading…
          </div>
        )}
        {result?.status === "forbidden" && <p className="text-sm text-amber-400">{result.message}</p>}
        {result?.status === "error" && <p className="text-sm text-red-400">{result.message}</p>}
        {result?.status === "ok" && result.items.length === 0 && (
          <p className="text-sm text-neutral-500">No releases yet.</p>
        )}
        {result?.status === "ok" && result.items.length > 0 && (
          <ul className="space-y-2">
            {result.items.slice(0, 8).map((r) => (
              <li key={r.tag} className="rounded-md border border-neutral-800 p-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-200">{r.name ?? r.tag}</span>
                  {r.draft && <span className="rounded bg-neutral-700/50 px-1.5 py-0.5 text-[11px] text-neutral-400">draft</span>}
                  {r.prerelease && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] text-amber-400">prerelease</span>}
                  <a href={r.htmlUrl} target="_blank" rel="noreferrer" className="ml-auto text-blue-400 hover:underline">
                    <ExternalLink width={13} height={13} />
                  </a>
                </div>
                {r.assets.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-1">
                    {r.assets.map((a) => (
                      <li key={a.name} className="flex items-center gap-2 text-xs text-neutral-400">
                        <Download width={11} height={11} />
                        <a href={a.downloadUrl} className="hover:text-blue-400 hover:underline">
                          {a.name}
                        </a>
                        <span className="text-neutral-600">{formatBytes(a.size)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-neutral-800 p-3">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-200">
          <Archive width={14} height={14} /> Packages
        </h3>
        {packages === null && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Spinner width={14} height={14} className="text-blue-400" /> Checking…
          </div>
        )}
        {packages?.status === "forbidden" && <p className="text-sm text-amber-400">{packages.message}</p>}
        {packages?.status === "unavailable" && <p className="text-sm text-neutral-500">{packages.message}</p>}
        {packages?.status === "error" && <p className="text-sm text-red-400">{packages.message}</p>}
        {packages?.status === "ok" && (
          <ul className="space-y-1">
            {packages.items.map((p) => (
              <li key={p.name} className="flex items-center justify-between text-sm text-neutral-300">
                <span>{p.name}</span>
                <a href={p.htmlUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">
                  {p.packageType}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CodespacesSection() {
  const { state } = useStore();
  const meta = state.meta;
  const [result, setResult] = useState<CodespacesResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    void fetchCodespaces(meta.fullName).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [meta]);

  if (!meta) return null;

  async function create() {
    setCreating(true);
    setCreateError(null);
    const r = await createCodespace(meta!.owner, meta!.repo, meta!.branch);
    setCreating(false);
    if (r.ok) window.open(r.webUrl, "_blank", "noreferrer");
    else setCreateError(r.error);
  }

  return (
    <div className="rounded-lg border border-neutral-800 p-3">
      <h3 className="mb-2 text-sm font-semibold text-neutral-200">Codespaces</h3>
      <p className="mb-2 text-xs text-neutral-500">
        Opens in a new browser tab — this app does not embed a VM client.
      </p>
      {result === null && (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Spinner width={14} height={14} className="text-blue-400" /> Checking…
        </div>
      )}
      {result?.status === "forbidden" && <p className="mb-2 text-sm text-amber-400">{result.message}</p>}
      {result?.status === "error" && <p className="mb-2 text-sm text-red-400">{result.message}</p>}
      {result?.status === "ok" && result.items.length > 0 && (
        <ul className="mb-2 space-y-1">
          {result.items.map((c) => (
            <li key={c.name} className="flex items-center justify-between text-sm text-neutral-300">
              <span>{c.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">{c.state}</span>
                <a href={c.webUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                  Open
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}
      {createError && <p className="mb-2 text-sm text-red-400">{createError}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => void create()}
          disabled={creating}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {creating && <Spinner width={13} height={13} />}
          Create codespace on {meta.branch}
        </button>
        <a
          href={codespacesDeepLink(meta.owner, meta.repo, meta.branch)}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600"
        >
          Open in github.com
        </a>
      </div>
    </div>
  );
}

function WikiSection() {
  const { state } = useStore();
  const meta = state.meta;
  if (!meta) return null;
  return (
    <div className="rounded-lg border border-neutral-800 p-3">
      <h3 className="mb-2 text-sm font-semibold text-neutral-200">Wiki</h3>
      <p className="mb-2 text-sm text-neutral-500">
        Not a browser-in-app feature (yet). A GitHub wiki is a separate git
        repository (<code>{meta.fullName}.wiki.git</code>) with no Contents-API
        equivalent — cloning/pushing it needs real git-over-HTTP, and GitHub&apos;s
        git smart-HTTP endpoints don&apos;t send permissive CORS headers, so a
        pure browser client can&apos;t clone it directly (this is the spike
        PLAN.md M11 asked for; see PLAN.md for the full note).
      </p>
      <a
        href={`https://github.com/${meta.fullName}/wiki`}
        target="_blank"
        rel="noreferrer"
        className="flex w-fit items-center gap-1 text-sm text-blue-400 hover:underline"
      >
        <ExternalLink width={14} height={14} /> Open wiki on GitHub
      </a>
    </div>
  );
}

export function StartMenuPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"releases" | "codespaces" | "wiki">("releases");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
          <GitBranch width={18} height={18} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-neutral-100">Start Menu</h2>
          <button
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <X width={16} height={16} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-neutral-800 px-4 pt-2">
          {(
            [
              ["releases", "Releases & Packages"],
              ["codespaces", "Codespaces"],
              ["wiki", "Wiki"],
            ] as [typeof tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={[
                "rounded-t-md px-3 py-1.5 text-sm",
                tab === id ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "releases" && <ReleasesSection />}
          {tab === "codespaces" && <CodespacesSection />}
          {tab === "wiki" && <WikiSection />}
        </div>
      </div>
    </div>
  );
}
