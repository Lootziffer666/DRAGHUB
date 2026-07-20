"use client";

import { createContext, useContext } from "react";

/** Identity of the enclosing desktop window for components rendered inside a
 * repository application — used to open owned child windows. */
export type DesktopWindowScope = {
  windowId: string;
  repoKey: string;
};

export const DesktopWindowContext = createContext<DesktopWindowScope | null>(
  null
);

export function useDesktopWindowScope(): DesktopWindowScope | null {
  return useContext(DesktopWindowContext);
}
