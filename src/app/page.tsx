"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { StoreProvider, useActiveRepo, useStore } from "@/lib/store";
import { StagingProvider } from "@/lib/staging";
import { UIProvider } from "@/components/ui-context";
import { AddressBar } from "@/components/AddressBar";
import { Explorer } from "@/components/Explorer";
import { Tabs } from "@/components/Tabs";
import { FileView } from "@/components/FileView";
import { SearchButton, SearchProvider } from "@/features/search";
import { ChangesButton, ChangesProvider } from "@/features/changes";
import { RecycleBinButton } from "@/features/recycle-bin";
import { PullsButton, PullsProvider } from "@/features/pulls";
import { IssuesButton, IssuesProvider } from "@/features/issues";
import { ControlPanelButton, ControlPanelProvider } from "@/features/control-panel";
import { StartMenuButton, StartMenuProvider } from "@/features/start-menu";
import { TriageButton, TriageProvider } from "@/features/triage";
import { FileIcon, Folder, GithubMark, Search } from "@/components/icons";

type WindowInstance = { id: string; app: "launcher" | "repository"; repoKey?: string; title: string; x: number; y: number; w: number; h: number; z: number; minimized: boolean; maximized: boolean; restore?: Pick<WindowInstance,"x"|"y"|"w"|"h"> };
const STORAGE = "draghub-desktop-windows-v1";
const starter: WindowInstance[] = [{ id:"welcome", app:"launcher", title:"Open repository", x:170, y:105, w:520, h:380, z:1, minimized:false, maximized:false }];

function Launcher({ onOpened }: { onOpened: (repo: string) => void }) {
  const { state, openRepo } = useStore();
  const [value,setValue]=useState("");
  const submit=async()=>{ const repo=value.trim(); if(!repo)return; await openRepo(repo); onOpened(repo.replace(/^https?:\/\/github\.com\//,"").replace(/\/$/,"")); };
  return <div className="launcher-app">
    <div className="launcher-mark"><GithubMark width={30} height={30}/></div>
    <div><p className="eyebrow">DRAGHUB SYSTEM</p><h1>Your code has a place.</h1><p className="launcher-copy">Mount a GitHub repository as a drive. It opens in its own window—not on a new page.</p></div>
    <form onSubmit={e=>{e.preventDefault();void submit()}} className="mount-form"><Search width={18}/><input value={value} onChange={e=>setValue(e.target.value)} placeholder="owner/repository" autoFocus/><button disabled={state.repoLoading}>{state.repoLoading?"Mounting…":"Mount drive"}</button></form>
    {state.repoError&&<p className="mount-error">{state.repoError}</p>}
    <div className="launcher-tip"><span>⌘ K</span><p><strong>System search</strong><br/>Find repositories, releases and tools from anywhere.</p></div>
  </div>
}

function RepositoryApp() {
  const repo=useActiveRepo();
  if(!repo)return <div className="empty-app">This drive is not mounted.</div>;
  return <div className="repo-app"><AddressBar onGoHome={()=>{}}/><div className="repo-work"><aside><Explorer/></aside><main><Tabs/><div className="file-area"><FileView/></div></main></div></div>
}

function WindowFrame({ win, active, onFocus, onClose, onMinimize, onMaximize, onMove, onResize, children }:{win:WindowInstance;active:boolean;onFocus:()=>void;onClose:()=>void;onMinimize:()=>void;onMaximize:()=>void;onMove:(x:number,y:number)=>void;onResize:(w:number,h:number)=>void;children:ReactNode}){
  const drag=useRef<{sx:number;sy:number;x:number;y:number}|null>(null); const resize=useRef<{sx:number;sy:number;w:number;h:number}|null>(null);
  const startDrag=(e:ReactPointerEvent)=>{if(win.maximized||(e.target as HTMLElement).closest("button"))return;onFocus();drag.current={sx:e.clientX,sy:e.clientY,x:win.x,y:win.y};(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)};
  const dragMove=(e:ReactPointerEvent)=>{if(!drag.current)return;onMove(Math.max(0,drag.current.x+e.clientX-drag.current.sx),Math.max(48,drag.current.y+e.clientY-drag.current.sy))};
  const startResize=(e:ReactPointerEvent)=>{e.stopPropagation();onFocus();resize.current={sx:e.clientX,sy:e.clientY,w:win.w,h:win.h};(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)};
  const resizeMove=(e:ReactPointerEvent)=>{if(resize.current)onResize(Math.max(420,resize.current.w+e.clientX-resize.current.sx),Math.max(260,resize.current.h+e.clientY-resize.current.sy))};
  if(win.minimized)return null;
  return <section className={`os-window ${active?"is-active":""} ${win.maximized?"is-maximized":""}`} style={{left:win.maximized?0:win.x,top:win.maximized?48:win.y,width:win.maximized?"100%":win.w,height:win.maximized?"calc(100% - 126px)":win.h,zIndex:win.z}} onPointerDown={onFocus}>
    <header className="window-titlebar" onDoubleClick={onMaximize} onPointerDown={startDrag} onPointerMove={dragMove} onPointerUp={()=>drag.current=null}>
      <div className="window-app-icon">{win.app==="repository"?"◆":"+"}</div><div className="window-title"><strong>{win.title}</strong><span>{win.app==="repository"?"Repository Explorer":"System"}</span></div>
      <div className="window-controls"><button onClick={onMinimize} aria-label="Minimize">—</button><button onClick={onMaximize} aria-label="Maximize">□</button><button className="close" onClick={onClose} aria-label="Close">×</button></div>
    </header><div className="window-content">{children}</div>{!win.maximized&&<div className="resize-handle" onPointerDown={startResize} onPointerMove={resizeMove} onPointerUp={()=>resize.current=null}/>}</section>
}

function Desktop(){
  const { state,switchRepo }=useStore(); const [windows,setWindows]=useState<WindowInstance[]>(starter); const [ready,setReady]=useState(false); const z=useRef(2);
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(STORAGE)||"null");if(Array.isArray(saved)&&saved.length)setWindows(saved)}catch{}setReady(true)},[]);
  useEffect(()=>{if(ready)localStorage.setItem(STORAGE,JSON.stringify(windows))},[windows,ready]);
  const patch=useCallback((id:string,part:Partial<WindowInstance>)=>setWindows(ws=>ws.map(w=>w.id===id?{...w,...part}:w)),[]);
  const focus=useCallback((w:WindowInstance)=>{z.current+=1;patch(w.id,{z:z.current});if(w.repoKey&&state.repos[w.repoKey])switchRepo(w.repoKey)},[patch,state.repos,switchRepo]);
  const openLauncher=()=>{const existing=windows.find(w=>w.app==="launcher");if(existing){patch(existing.id,{minimized:false,z:++z.current});return}setWindows(ws=>[...ws,{...starter[0],id:crypto.randomUUID(),z:++z.current}])};
  const openRepoWindow=useCallback((repoKey:string)=>{const key=Object.keys(state.repos).find(k=>k.toLowerCase()===repoKey.toLowerCase())||state.activeRepoKey||repoKey;setWindows(ws=>[...ws,{id:crypto.randomUUID(),app:"repository",repoKey:key,title:key,x:90+(ws.length%5)*38,y:76+(ws.length%4)*34,w:Math.min(1050,window.innerWidth-130),h:Math.min(680,window.innerHeight-170),z:++z.current,minimized:false,maximized:false}])},[state.activeRepoKey,state.repos]);
  const visible=windows.filter(w=>!w.minimized); const active=visible.reduce<WindowInstance|undefined>((a,w)=>!a||w.z>a.z?w:a,undefined);
  const clock=useMemo(()=>new Intl.DateTimeFormat(undefined,{hour:"2-digit",minute:"2-digit"}).format(new Date()),[]);
  return <div className="desktop-shell">
    <div className="wallpaper-orb orb-one"/><div className="wallpaper-orb orb-two"/>
    <header className="system-bar"><button className="brand" onClick={openLauncher}><span>◈</span> DRAGHUB</button><nav><span>Desktop</span><span>Window</span><span>Repository</span></nav><div className="system-status"><span className="online-dot"/> GitHub connected <kbd>⌘ K</kbd><strong>{clock}</strong></div></header>
    <div className="desktop-icons">
      <button onDoubleClick={openLauncher} onClick={openLauncher}><span className="desktop-icon add-drive">+</span><b>Mount repository</b></button>
      {Object.keys(state.repos).map(k=><button key={k} onDoubleClick={()=>openRepoWindow(k)}><span className="desktop-icon repo-drive"><Folder width={31}/><i>GIT</i></span><b>{k.split("/").pop()}</b><small>{k.split("/")[0]}</small></button>)}
      <button><span className="desktop-icon"><FileIcon width={30}/></span><b>Workspaces</b></button>
    </div>
    <div className="desktop-watermark"><span>DRAG</span><strong>HUB</strong><small>GITHUB, REIMAGINED AS A PLACE.</small></div>
    {windows.map(w=><WindowFrame key={w.id} win={w} active={active?.id===w.id} onFocus={()=>focus(w)} onClose={()=>setWindows(ws=>ws.filter(x=>x.id!==w.id))} onMinimize={()=>patch(w.id,{minimized:true})} onMaximize={()=>patch(w.id,w.maximized?{maximized:false,...w.restore}:{maximized:true,restore:{x:w.x,y:w.y,w:w.w,h:w.h}})} onMove={(x,y)=>patch(w.id,{x,y})} onResize={(width,height)=>patch(w.id,{w:width,h:height})}>{w.app==="launcher"?<Launcher onOpened={openRepoWindow}/>:<RepositoryApp/>}</WindowFrame>)}
    <footer className="taskbar"><button className="launcher-button" onClick={openLauncher}>◈</button><div className="task-separator"/><SearchButton label="Search" className="task-tool"/><div className="running-apps">{windows.map(w=><button key={w.id} className={`${active?.id===w.id?"active":""} ${w.minimized?"minimized":""}`} onClick={()=>{patch(w.id,{minimized:false,z:++z.current});if(w.repoKey)switchRepo(w.repoKey)}}><span>{w.app==="repository"?"◆":"+"}</span><em>{w.title}</em></button>)}</div><div className="task-tools"><StartMenuButton/><ChangesButton/><PullsButton/><IssuesButton/><TriageButton/><RecycleBinButton/><ControlPanelButton/></div></footer>
  </div>
}

export default function Page(){return <StoreProvider><StagingProvider><ChangesProvider><PullsProvider><IssuesProvider><ControlPanelProvider><StartMenuProvider><TriageProvider><UIProvider><SearchProvider><Desktop/></SearchProvider></UIProvider></TriageProvider></StartMenuProvider></ControlPanelProvider></IssuesProvider></PullsProvider></ChangesProvider></StagingProvider></StoreProvider>}
