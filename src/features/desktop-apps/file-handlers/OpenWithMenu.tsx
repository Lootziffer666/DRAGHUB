"use client";

import { useState } from "react";
import { getRepositoryBlob } from "@/lib/github";
import { ChevronDown, Spinner } from "@/components/icons";
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
        a.click();
        URL.revokeObjectURL(url);
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
        className="flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1 text-xs text-neutral-300 hover:border-neutral-600"
      >
        {downloading ? (
          <Spinner width={13} height={13} className="text-blue-400" />
        ) : null}
        Open with
        <ChevronDown width={12} height={12} className="text-neutral-500" />
      </button>
      {open && (
        <div className="absolute left-0 z-40 mt-1 min-w-40 overflow-hidden rounded-md border border-neutral-700 bg-neutral-900 py-1 shadow-xl">
          {handlers.map((h) => (
            <button
              key={h.id}
              onMouseDown={(e) => {
                e.preventDefault();
                void select(h);
              }}
              className="flex w-full items-center px-3 py-1.5 text-left text-xs text-neutral-200 hover:bg-neutral-800"
            >
              {h.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
