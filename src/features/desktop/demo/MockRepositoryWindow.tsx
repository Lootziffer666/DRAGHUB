"use client";
import { useState } from "react";
import type { WindowContentProps } from "../types";
import { RubberBand } from "../RubberBand";
import { useWindowManager } from "../WindowManagerProvider";
const data: Record<string, string[]> = {
  ANVIL: ["src", "docs", "assets", "README.md"],
  SHADED: ["shaders", "materials", "examples", "README.md"],
};
export function MockRepositoryWindow({
  windowId,
  resource,
}: WindowContentProps) {
  const wm = useWindowManager();
  const name =
    resource.type === "repository"
      ? (resource.repoKey.split("/").pop() ?? "Repository")
      : "Repository";
  const items = data[name] ?? ["src", "docs", "README.md"];
  const [folder, setFolder] = useState("/");
  const [selected, setSelected] = useState("");
  const [tabs, setTabs] = useState(["README.md"]);
  const [view, setView] = useState<"list" | "grid">("list");
  return (
    <div className="mock-repo">
      <RubberBand windowId={windowId} resource={resource} />
      <div className="repo-toolbar">
        <span className="demo-pill">DEMO DATA</span>
        <strong>{name}</strong>
        <span>/ {folder}</span>
        <button
          onClick={() => setView((v) => (v === "list" ? "grid" : "list"))}
        >
          {view === "list" ? "Grid" : "List"}
        </button>
      </div>
      <div className="repo-tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={selected === t ? "active" : ""}
            onClick={() => setSelected(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="repo-demo-body">
        <aside>
          <b>{name}</b>
          {["Repository", "Branches", "Pull requests", "Issues", "Actions"].map(
            (x) => (
              <button key={x}>{x}</button>
            ),
          )}
        </aside>
        <div
          className={`mock-files ${view}`}
          tabIndex={0}
          onScroll={(e) =>
            (e.currentTarget.dataset.scroll = String(e.currentTarget.scrollTop))
          }
        >
          {items.map((item) => (
            <button
              key={item}
              className={selected === item ? "selected" : ""}
              onClick={() => setSelected(item)}
              onDoubleClick={() => {
                if (!item.includes(".")) setFolder(item);
                else setTabs((t) => (t.includes(item) ? t : [...t, item]));
                if (name === "ANVIL" && item === "assets")
                  wm.openRepositoryChild(
                    windowId,
                    "image-viewer",
                    {
                      type: "file",
                      repoKey: "Lootziffer666/ANVIL",
                      path: "assets/anvil-mark.svg",
                    },
                    "anvil-mark.svg — Demo",
                  );
              }}
            >
              <span>{item.includes(".") ? "▤" : "◆"}</span>
              <b>{item}</b>
              <small>{item.includes(".") ? "Mock file" : "Folder"}</small>
            </button>
          ))}
        </div>
      </div>
      <footer>
        Independent window state · {selected || "Nothing selected"} · {view}{" "}
        view
      </footer>
    </div>
  );
}
