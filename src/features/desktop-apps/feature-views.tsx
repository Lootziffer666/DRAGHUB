"use client";

import { useEffect, useMemo, useState } from "react";
import { useActiveRepo } from "@/lib/store";
import { useChanges } from "@/features/changes";
import { classifyPr } from "@/features/pulls/classify";
import {
  closePull,
  listPulls,
  type PullRequestSummary,
} from "@/features/pulls/api";
import {
  getBranchProtection,
  getDependabot,
  getCodeScanning,
  getSecretScanning,
  codeownersTemplate,
} from "@/features/control-panel/api";
import {
  listReleases,
  codespacesUrl,
  wikiSpikeNote,
} from "@/features/start-menu/api";
import { Spinner, OpenRegular as ExternalLink } from "@/features/icons";

/**
 * Remaining repository-owned feature-window bodies (second integration
 * slice): Triage, Security, Releases/Codespaces/Wiki and repo Settings.
 * They reuse the existing feature APIs; owner/repo always come from the
 * window's resource, never from a globally focused repository.
 */

export function TriageView({ owner, repo }: { owner: string; repo: string }) {
  const [items, setItems] = useState<PullRequestSummary[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setLoading(true);
    listPulls(owner, repo)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load triage"))
      .finally(() => setLoading(false));
  }, [owner, repo]);

  const selectedItems = useMemo(
    () => items.filter((i) => selected.includes(i.number)),
    [items, selected]
  );

  async function bulkClose() {
    const expected = `CLOSE ${selectedItems.length}`;
    if (confirm !== expected) {
      setConfirm(expected);
      return;
    }
    setWorking(true);
    try {
      for (const pr of selectedItems) await closePull(owner, repo, pr.number);
      setItems((v) => v.filter((i) => !selected.includes(i.number)));
      setSelected([]);
      setConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk close failed");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="h-full overflow-auto bg-[var(--dh-surface)] p-3">
      {loading && <LoadingRow label="pull requests" />}
      {error && <ErrorRow message={error} />}
      <div className="mb-3 rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] p-3 text-sm text-[var(--dh-text-secondary)]">
        {selected.length} selected. Bulk close summary: {selected.length} PRs
        will be closed; branches are not deleted.{" "}
        {confirm && (
          <span className="text-amber-700 dark:text-amber-300">Click again to confirm ({confirm}).</span>
        )}
        <button
          disabled={selected.length === 0 || working}
          onClick={() => void bulkClose()}
          className="ml-3 rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50"
        >
          {working ? "Closing…" : "Bulk close"}
        </button>
      </div>
      <div className="space-y-1">
        {items.map((pr) => (
          <label
            key={pr.number}
            className="flex cursor-pointer items-center gap-3 rounded border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-2"
          >
            <input
              type="checkbox"
              checked={selected.includes(pr.number)}
              onChange={(e) =>
                setSelected((v) =>
                  e.target.checked
                    ? [...v, pr.number]
                    : v.filter((n) => n !== pr.number)
                )
              }
            />
            <span className="text-blue-700 dark:text-blue-300">#{pr.number}</span>
            <span className="flex-1 text-sm text-[var(--dh-text)]">{pr.title}</span>
            <span className="rounded bg-[var(--dh-surface-hover)] px-2 py-0.5 text-xs text-[var(--dh-text-secondary)]">
              {classifyPr(pr)}
            </span>
          </label>
        ))}
        {!loading && !error && items.length === 0 && (
          <p className="p-4 text-center text-sm text-[var(--dh-text-disabled)]">
            No open pull requests to triage.
          </p>
        )}
      </div>
    </div>
  );
}

type Probe = { ok: boolean; status: number; message: string };

/** Security overview: scope probes + CODEOWNERS staged as a normal working
 * change through the window's repository scope. */
export function SecurityView({
  owner,
  repo,
  branch,
}: {
  owner: string;
  repo: string;
  branch: string;
}) {
  const scoped = useActiveRepo();
  const changes = useChanges();
  const [probes, setProbes] = useState<Record<string, Probe | null>>({});
  const [staged, setStaged] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const entries: [string, Promise<Probe>][] = [
        ["Branch protection", getBranchProtection(owner, repo, branch)],
        ["Dependabot alerts", getDependabot(owner, repo)],
        ["Code scanning", getCodeScanning(owner, repo)],
        ["Secret scanning", getSecretScanning(owner, repo)],
      ];
      for (const [label, p] of entries) {
        const result = await p.catch(() => ({
          ok: false,
          status: 0,
          message: "Request failed",
        }));
        if (cancelled) return;
        setProbes((prev) => ({ ...prev, [label]: result }));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [owner, repo, branch]);

  const canStage = Boolean(scoped) && !staged;

  return (
    <div className="h-full overflow-auto bg-[var(--dh-surface)] p-4">
      <p className="mb-3 text-xs text-[var(--dh-text-secondary)]">
        Probes show what the current token can reach — a 403/404 usually means
        a missing scope or a feature that is disabled for this repository.
      </p>
      <div className="space-y-1.5">
        {["Branch protection", "Dependabot alerts", "Code scanning", "Secret scanning"].map(
          (label) => {
            const probe = probes[label];
            return (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-2"
              >
                <span
                  className={[
                    "h-2 w-2 shrink-0 rounded-full",
                    !probe ? "bg-[var(--dh-window-border-active)]" : probe.ok ? "bg-emerald-400" : "bg-amber-400",
                  ].join(" ")}
                />
                <span className="flex-1 text-sm text-[var(--dh-text)]">{label}</span>
                <span className="text-xs text-[var(--dh-text-secondary)]">
                  {probe ? probe.message : "Probing…"}
                </span>
              </div>
            );
          }
        )}
      </div>
      <div className="mt-4 rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] p-3">
        <div className="mb-1 text-sm font-medium text-[var(--dh-text)]">CODEOWNERS</div>
        <p className="mb-2 text-xs text-[var(--dh-text-secondary)]">
          Stages a starter <code>.github/CODEOWNERS</code> as a normal working
          change in this repository&apos;s changeset — nothing commits until you
          create a checkpoint.
        </p>
        <button
          disabled={!canStage}
          onClick={() => {
            void changes
              .stageAddFile(
                ".github/CODEOWNERS",
                new TextEncoder().encode(codeownersTemplate(owner))
              )
              .then(() => setStaged(true));
          }}
          className="rounded-md bg-[var(--dh-accent)] px-3 py-1.5 text-xs font-medium text-[var(--dh-accent-foreground)] hover:opacity-90 disabled:opacity-40"
        >
          {staged ? "Staged ✓" : "Stage CODEOWNERS template"}
        </button>
      </div>
    </div>
  );
}

export function ReleasesView({
  owner,
  repo,
  branch,
}: {
  owner: string;
  repo: string;
  branch: string;
}) {
  const [releases, setReleases] = useState<
    Array<{ id: number; name: string | null; tag_name: string; html_url: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [wikiOpen, setWikiOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    listReleases(owner, repo)
      .then(setReleases)
      .catch((e) => setError(e instanceof Error ? e.message : "Releases unavailable"))
      .finally(() => setLoading(false));
  }, [owner, repo]);

  return (
    <div className="h-full overflow-auto bg-[var(--dh-surface)] p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        <a
          href={codespacesUrl(owner, repo, branch)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-1.5 text-xs text-[var(--dh-text)] hover:border-[var(--dh-window-border-active)]"
        >
          <ExternalLink width={13} height={13} /> New Codespace on {branch}
        </a>
        <a
          href={`https://github.com/${owner}/${repo}/wiki`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-1.5 text-xs text-[var(--dh-text)] hover:border-[var(--dh-window-border-active)]"
        >
          <ExternalLink width={13} height={13} /> Wiki
        </a>
        <button
          onClick={() => setWikiOpen((v) => !v)}
          className="rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-1.5 text-xs text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
        >
          Why no in-app wiki editing?
        </button>
      </div>
      {wikiOpen && (
        <p className="mb-4 rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] p-3 text-xs text-[var(--dh-text-secondary)]">
          {wikiSpikeNote}
        </p>
      )}
      <h3 className="mb-2 text-sm font-semibold text-[var(--dh-text)]">Releases</h3>
      {loading && <LoadingRow label="releases" />}
      {error && <ErrorRow message={error} />}
      {!loading && !error && releases.length === 0 && (
        <p className="p-4 text-center text-sm text-[var(--dh-text-disabled)]">No releases.</p>
      )}
      <div className="space-y-1.5">
        {releases.map((r) => (
          <a
            key={r.id}
            href={r.html_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-2 hover:border-[var(--dh-window-border-active)]"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--dh-text)]">
              {r.name || r.tag_name}
            </span>
            <span className="shrink-0 text-xs text-[var(--dh-text-secondary)]">{r.tag_name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function RepoSettingsView({
  owner,
  repo,
  branch,
}: {
  owner: string;
  repo: string;
  branch: string;
}) {
  const [protection, setProtection] = useState<Probe | null>(null);

  useEffect(() => {
    getBranchProtection(owner, repo, branch)
      .then(setProtection)
      .catch(() => setProtection({ ok: false, status: 0, message: "Request failed" }));
  }, [owner, repo, branch]);

  return (
    <div className="h-full overflow-auto bg-[var(--dh-surface)] p-4">
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-2">
        <span
          className={[
            "h-2 w-2 shrink-0 rounded-full",
            !protection ? "bg-[var(--dh-window-border-active)]" : protection.ok ? "bg-emerald-400" : "bg-amber-400",
          ].join(" ")}
        />
        <span className="flex-1 text-sm text-[var(--dh-text)]">
          Branch protection on {branch}
        </span>
        <span className="text-xs text-[var(--dh-text-secondary)]">
          {protection ? protection.message : "Probing…"}
        </span>
      </div>
      <p className="mb-3 text-xs text-[var(--dh-text-secondary)]">
        Repository administration (rules, collaborators, webhooks) stays on
        GitHub — this window only probes what the current token can see.
      </p>
      <a
        href={`https://github.com/${owner}/${repo}/settings`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] px-3 py-1.5 text-xs text-[var(--dh-text)] hover:border-[var(--dh-window-border-active)]"
      >
        <ExternalLink width={13} height={13} /> Open repository settings on GitHub
      </a>
    </div>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-6 text-sm text-[var(--dh-text-secondary)]">
      <Spinner width={16} height={16} className="text-blue-700 dark:text-blue-400" /> Loading {label}…
    </div>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <p className="mb-2 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-2 text-sm text-red-600 dark:text-red-300">
      {message}
    </p>
  );
}
