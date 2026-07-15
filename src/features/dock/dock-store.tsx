"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getRateLimitStatus, type RateLimitStatus } from "@/lib/github";
import { loadPins, savePins } from "./pins";
import { fetchRepoBadge, type RepoBadge } from "./badges-api";

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const MIN_RATE_LIMIT_REMAINING = 50;

type DockContextValue = {
  pins: string[];
  isPinned: (fullName: string) => boolean;
  togglePin: (fullName: string) => void;
  badges: Record<string, RepoBadge>;
  rateLimit: RateLimitStatus | null;
  refreshNow: () => void;
};

const DockContext = createContext<DockContextValue | null>(null);

export function DockProvider({ children }: { children: ReactNode }) {
  const [pins, setPins] = useState<string[]>([]);
  const pinsRef = useRef<string[]>([]);
  pinsRef.current = pins;
  const [badges, setBadges] = useState<Record<string, RepoBadge>>({});
  const [rateLimit, setRateLimit] = useState<RateLimitStatus | null>(null);

  useEffect(() => {
    setPins(loadPins());
  }, []);

  const poll = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    const status = getRateLimitStatus();
    if (status) setRateLimit(status);
    if (status && status.remaining < MIN_RATE_LIMIT_REMAINING) return; // back off this cycle
    for (const fullName of pinsRef.current) {
      const badge = await fetchRepoBadge(fullName);
      setBadges((prev) => ({ ...prev, [fullName]: badge }));
      setRateLimit(getRateLimitStatus());
    }
  }, []);

  // Re-poll whenever the pin list itself changes (initial load from
  // localStorage, or a pin/unpin action) — not just on the next interval
  // tick, so a freshly pinned repo gets a badge right away.
  useEffect(() => {
    void poll();
  }, [pins, poll]);

  useEffect(() => {
    const id = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [poll]);

  const isPinned = useCallback((fullName: string) => pins.includes(fullName), [pins]);

  const togglePin = useCallback((fullName: string) => {
    setPins((prev) => {
      const next = prev.includes(fullName)
        ? prev.filter((p) => p !== fullName)
        : [...prev, fullName];
      savePins(next);
      return next;
    });
  }, []);

  const refreshNow = useCallback(() => {
    void poll();
  }, [poll]);

  const value = useMemo<DockContextValue>(
    () => ({ pins, isPinned, togglePin, badges, rateLimit, refreshNow }),
    [pins, isPinned, togglePin, badges, rateLimit, refreshNow]
  );

  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

export function useDock(): DockContextValue {
  const ctx = useContext(DockContext);
  if (!ctx) throw new Error("useDock must be used within DockProvider");
  return ctx;
}
