"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useChanges } from "@/features/changes";
import { Spinner } from "@/components/icons";
import { fetchCollaborators, fetchTeams, generateCodeowners, type ScopedResult } from "./api";

function ScopedList<T>({
  title,
  load,
  renderItem,
}: {
  title: string;
  load: () => Promise<ScopedResult<T>>;
  renderItem: (item: T) => { key: string; label: string; sub: string };
}) {
  const [result, setResult] = useState<ScopedResult<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    void load().then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-lg border border-neutral-800 p-3">
      <h3 className="mb-2 text-sm font-semibold text-neutral-200">{title}</h3>
      {result === null && (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Spinner width={14} height={14} className="text-blue-400" /> Checking…
        </div>
      )}
      {result?.status === "forbidden" && <p className="text-sm text-amber-400">Disabled — {result.message}</p>}
      {result?.status === "unavailable" && <p className="text-sm text-neutral-500">{result.message}</p>}
      {result?.status === "error" && <p className="text-sm text-red-400">{result.message}</p>}
      {result?.status === "ok" && result.items.length === 0 && (
        <p className="text-sm text-neutral-500">None found.</p>
      )}
      {result?.status === "ok" && result.items.length > 0 && (
        <ul className="space-y-1">
          {result.items.map((item) => {
            const r = renderItem(item);
            return (
              <li key={r.key} className="flex items-center justify-between text-sm text-neutral-300">
                <span>{r.label}</span>
                <span className="text-xs text-neutral-500">{r.sub}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function AccessApplet() {
  const { state } = useStore();
  const { stageEdit } = useChanges();
  const meta = state.meta;
  const [collaborators, setCollaborators] = useState<ScopedResult<{ login: string; permission: string; htmlUrl: string }> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [staged, setStaged] = useState(false);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    void fetchCollaborators(meta.owner, meta.repo).then((r) => {
      if (!cancelled) setCollaborators(r);
    });
    return () => {
      cancelled = true;
    };
  }, [meta]);

  if (!meta) return null;

  function toggle(login: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(login)) next.delete(login);
      else next.add(login);
      return next;
    });
  }

  async function writeCodeowners() {
    const content = generateCodeowners(Array.from(selected));
    await stageEdit(".github/CODEOWNERS", new TextEncoder().encode(content), "manual");
    setStaged(true);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-neutral-800 p-3">
        <h3 className="mb-2 text-sm font-semibold text-neutral-200">Collaborators</h3>
        {collaborators === null && (
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <Spinner width={14} height={14} className="text-blue-400" /> Checking…
          </div>
        )}
        {collaborators?.status === "forbidden" && (
          <p className="text-sm text-amber-400">Disabled — {collaborators.message}</p>
        )}
        {collaborators?.status === "unavailable" && <p className="text-sm text-neutral-500">{collaborators.message}</p>}
        {collaborators?.status === "error" && <p className="text-sm text-red-400">{collaborators.message}</p>}
        {collaborators?.status === "ok" && collaborators.items.length === 0 && (
          <p className="text-sm text-neutral-500">None found.</p>
        )}
        {collaborators?.status === "ok" && collaborators.items.length > 0 && (
          <ul className="space-y-1">
            {collaborators.items.map((c) => (
              <li key={c.login} className="flex items-center justify-between text-sm text-neutral-300">
                <span>{c.login}</span>
                <span className="text-xs text-neutral-500">{c.permission}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ScopedList
        title="Teams"
        load={() => fetchTeams(meta.owner, meta.repo)}
        renderItem={(t) => ({ key: t.slug, label: t.name, sub: t.permission })}
      />

      <div className="rounded-lg border border-neutral-800 p-3">
        <h3 className="mb-2 text-sm font-semibold text-neutral-200">CODEOWNERS generator</h3>
        <p className="mb-2 text-xs text-neutral-500">
          Pick collaborators to own every path (<code>*</code>) as a starting point — refine paths
          later. Writing stages <code>.github/CODEOWNERS</code> as a working change (M1/M2), not a
          direct commit.
        </p>
        {collaborators?.status === "ok" && (
          <div className="mb-3 flex flex-wrap gap-2">
            {collaborators.items.map((c) => (
              <label key={c.login} className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={selected.has(c.login)}
                  onChange={() => toggle(c.login)}
                  className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-900"
                />
                {c.login}
              </label>
            ))}
          </div>
        )}
        <button
          onClick={() => void writeCodeowners()}
          disabled={selected.size === 0}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40"
        >
          Stage .github/CODEOWNERS
        </button>
        {staged && <span className="ml-2 text-xs text-emerald-400">Staged — open Changes to checkpoint.</span>}
      </div>
    </div>
  );
}
