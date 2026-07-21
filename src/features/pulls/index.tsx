"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { PullsPanel } from "./PullsPanel";
const Ctx=createContext<{open:()=>void}|null>(null);
export function PullsProvider({children}:{children:ReactNode}){const [open,setOpen]=useState(false);return <Ctx.Provider value={{open:()=>setOpen(true)}}>{children}<PullsPanel open={open} onClose={()=>setOpen(false)}/></Ctx.Provider>}
export function usePulls(){const c=useContext(Ctx); if(!c) throw new Error("usePulls must be used within PullsProvider"); return c;}
export function PullsButton(){const {open}=usePulls(); return <button onClick={open} className="rounded border border-[var(--dh-window-border)] px-2 py-1 text-xs text-[var(--dh-text-secondary)] hover:border-[var(--dh-window-border-active)] hover:text-[var(--dh-text)]">PRs</button>}
