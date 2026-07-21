"use client";

import { useEffect, useState } from "react";

const VISIBLE_MS = 1400;
const FADE_MS = 500;

/**
 * DRAGHUB's boot splash — the Lootziffer's Anvil Studio logo composited
 * over the desktop wallpaper (not the flat splash.png mockup: the logo and
 * the wallpaper are two separate layers here, so the logo can be
 * repositioned/animated independently of the background art). Shown
 * briefly on first load, then faded out.
 *
 * Renders identically on the server and the first client paint (always
 * visible, no theme/localStorage read), so it never causes a hydration
 * mismatch. It's a purely cosmetic overlay: the desktop tree beneath it
 * mounts and becomes interactive immediately, the splash just covers it
 * visually until the fade completes — so a slow splash timer never delays
 * real interactivity.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");
  const [logoIn, setLogoIn] = useState(false);

  useEffect(() => {
    const logoTimer = window.setTimeout(() => setLogoIn(true), 50);
    const fadeTimer = window.setTimeout(() => setPhase("fading"), VISIBLE_MS);
    const goneTimer = window.setTimeout(() => setPhase("gone"), VISIBLE_MS + FADE_MS);
    return () => {
      window.clearTimeout(logoTimer);
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
        overflow: "hidden",
        background:
          "linear-gradient(180deg, rgba(4, 20, 26, 0.55), rgba(4, 20, 26, 0.7)), url(/branding/wallpaper.png) center/cover no-repeat",
        opacity: phase === "fading" ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: phase === "fading" ? "none" : "auto",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/branding/logo.png"
        alt="Lootziffer's Anvil Studio"
        style={{
          width: "min(520px, 70vw)",
          height: "auto",
          filter: "drop-shadow(0 6px 24px rgba(0, 0, 0, 0.6))",
          opacity: logoIn ? 1 : 0,
          transform: logoIn ? "scale(1)" : "scale(0.94)",
          transition: "opacity 500ms ease, transform 500ms ease",
        }}
      />
    </div>
  );
}
