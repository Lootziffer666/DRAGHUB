"use client";
import { DesktopShell, WindowManagerProvider } from "@/features/desktop";
export default function Page() {
  return (
    <WindowManagerProvider>
      <DesktopShell />
    </WindowManagerProvider>
  );
}
