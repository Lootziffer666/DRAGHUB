"use client";

import { useState } from "react";
import { getRepositoryBlob } from "@/lib/github";
import { ChevronDownRegular as ChevronDown, Spinner } from "@/features/icons";
import { handlersForSurface } from "./registry";
import type { FileHandlerDefinition, FileResource } from "./types";

/** Sentinel applicationId the "download" handler uses — never opens a
 * desktop window, downloads the authenticated blob directly instead. */
const DOWNLOAD_APPLICATION_ID = "__download__";

/**
 * Registry-driven "Open with" menu for a file resource. Replaces
 * hardcoded per-extension buttons: the list of choices, their order and
 * their behavior all come from the file handler registry, so adding a
 * handler (e.g. a future Archive Viewer) never requires touching this
 * component.
 */
export function OpenWithMenu({
  resource,
  meta,
  onOpenHandler,
}: {
  resource: FileResource;
  meta: { owner: string; repo: string; branch: string };
  onOpenHandler: (handler: FileHandlerDefinition) => void;
}) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const handlers = handlersForSurface(resource, "window");

  if (handlers.length === 0) return null;

  const select = async (handler: FileHandlerDefinition) => {
    setOpen(false);
    if (handler.applicationId === DOWNLOAD_APPLICATION_ID) {
      setDownloading(true);
      try {
        const blob = await getRepositoryBlob({
          owner: meta.owner,
          repo: meta.repo,
          branch: meta.branch,
          path: resource.path,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = resource.path.split("/").pop() ?? "download";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Firefox needs the anchor attached to the DOM to trigger a
        // download, and revoking the object URL synchronously can abort
        // the download in several browsers since it's handled
        // asynchronously by the download manager.
        setTimeout(() => URL.revokeObjectURL(url), 100);
      } finally {
        setDownloading(false);
      }
      return;
    }
    onOpenHandler(handler);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        title="Open with…"
        className="flex items-center gap-1.5 rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface)] px-2.5 py-1 text-xs text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)]"
      >
        {downloading ? (
          <Spinner width={13} height={13} className="text-blue-700 dark:text-blue-400" />
        ) : null}
        Open with
        <ChevronDown width={12} height={12} className="text-[var(--dh-text-secondary)]" />
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-1 min-w-40 overflow-hidden rounded-md border border-[var(--dh-window-border)] bg-[var(--dh-surface-raised)] py-1 shadow-xl">
          {handlers.map((h) => (
            <button
              key={h.id}
              onMouseDown={(e) => {
                e.preventDefault();
                void select(h);
              }}
              className="flex w-full items-center px-3 py-1.5 text-left text-xs text-[var(--dh-text)] hover:bg-[var(--dh-surface-hover)]"
            >
              {h.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
