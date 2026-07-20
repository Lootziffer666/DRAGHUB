"use client";
import type { ReactNode } from "react";
export function DesktopContextMenu({
  x,
  y,
  onClose,
  children,
}: {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="desktop-menu"
      role="menu"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      {children}
    </div>
  );
}
