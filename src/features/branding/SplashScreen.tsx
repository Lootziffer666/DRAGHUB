"use client";

import { useEffect, useState } from "react";

const VISIBLE_MS = 1400;
const FADE_MS = 500;

/**
 * DRAGHUB's boot splash — Lootziffer's Anvil Studio artwork, shown briefly
 * on first load and then faded out. Renders identically on the server and
 * the first client paint (always visible, no theme/localStorage read), so
 * it never causes a hydration mismatch. It's a purely cosmetic overlay: the
 * desktop tree beneath it mounts and becomes interactive immediately, the
 * splash just covers it visually until the fade completes — so a slow
 * splash timer never delays real interactivity.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setPhase("fading"), VISIBLE_MS);
    const goneTimer = window.setTimeout(() => setPhase("gone"), VISIBLE_MS + FADE_MS);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(goneTimer);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#04202a",
        opacity: phase === "fading" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: phase === "fading" ? "none" : "auto",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/branding/splash.png"
        alt="Lootziffer's Anvil Studio"
        style={{
          maxWidth: "min(720px, 90vw)",
          maxHeight: "90vh",
          width: "auto",
          height: "auto",
        }}
      />
    </div>
  );
}
