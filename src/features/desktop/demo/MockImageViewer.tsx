"use client";
import { useRef, useState, type PointerEvent } from "react";
import type { WindowContentProps } from "../types";
const images = ["anvil-mark.svg", "blueprint.png", "forge-preview.png"];
export function MockImageViewer({ resource }: WindowContentProps) {
  const initial =
    resource.type === "file"
      ? Math.max(0, images.indexOf(resource.path.split("/").pop() ?? ""))
      : 0;
  const [index, setIndex] = useState(initial);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const move = (e: PointerEvent) => {
    if (drag.current)
      setPan({
        x: drag.current.px + e.clientX - drag.current.x,
        y: drag.current.py + e.clientY - drag.current.y,
      });
  };
  return (
    <div className="image-viewer">
      <div className="viewer-tools">
        <button onClick={() => setZoom((z) => Math.max(25, z - 25))}>−</button>
        <button onClick={() => setZoom((z) => Math.min(400, z + 25))}>+</button>
        <button
          onClick={() => {
            setZoom(75);
            setPan({ x: 0, y: 0 });
          }}
        >
          Fit
        </button>
        <button onClick={() => setZoom(100)}>100%</button>
        <span>{zoom}%</span>
      </div>
      <div
        className="image-stage"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
      >
        <div
          className="mock-art"
          style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom / 100})`,
          }}
        >
          <span>◈</span>
          <strong>ANVIL</strong>
          <small>LOCAL DEMO ASSET</small>
        </div>
      </div>
      <footer>
        <button
          onClick={() => setIndex((index + images.length - 1) % images.length)}
        >
          ← Previous
        </button>
        <div>
          <strong>{images[index]}</strong>
          <span>
            {resource.type === "file" ? resource.repoKey : "Demo repository"}
          </span>
        </div>
        <button onClick={() => setIndex((index + 1) % images.length)}>
          Next →
        </button>
      </footer>
    </div>
  );
}
