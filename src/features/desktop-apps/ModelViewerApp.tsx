"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useStore } from "@/lib/store";
import { getRepositoryBlob, formatBytes } from "@/lib/github";
import { createImageUrlManager } from "@/lib/image-url";
import {
  CubeRegular as Cube,
  PauseRegular as Pause,
  PlayRegular as Play,
  ArrowRotateClockwiseRegular as ResetView,
  Spinner,
} from "@/features/icons";
import type { WindowContentProps } from "@/features/desktop/types";

/**
 * 3D model viewer for `.glb`/`.gltf` file resources — a turntable preview,
 * the same category of feature as the image viewer or audio player (a
 * file-type viewer, opened for one file at a time). This is not the
 * Phase 2 "repository as a game world" — no repo data drives the scene,
 * nothing here is gamified; it just renders the one model the user opened,
 * the same way `<audio controls>` renders the one track they opened.
 */
export function ModelViewerApp({ resource }: WindowContentProps) {
  const { state } = useStore();
  const requestedKey = resource.type === "file" ? resource.repoKey : "";
  const path = resource.type === "file" ? resource.path : "";
  const repoKey =
    (state.repos[requestedKey]
      ? requestedKey
      : Object.keys(state.repos).find(
          (k) => k.toLowerCase() === requestedKey.toLowerCase()
        )) ?? requestedKey;
  const repo = state.repos[repoKey];
  const meta = repo?.meta ?? null;

  const [manager] = useState(() => createImageUrlManager());
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setModelUrl(null);
    getRepositoryBlob({ owner: meta.owner, repo: meta.repo, branch: meta.branch, path })
      .then((blob) => {
        if (cancelled) return;
        setSize(blob.size);
        setModelUrl(manager.create(blob));
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meta, path, manager]);

  useEffect(() => () => manager.revoke(), [manager]);

  if (!repo || !meta) {
    return (
      <Center>
        <Spinner width={20} height={20} className="text-blue-700 dark:text-blue-400" />
        <p className="text-sm text-[var(--dh-text-secondary)]">
          Waiting for repository {requestedKey}…
        </p>
      </Center>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[var(--dh-surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--dh-window-border)] px-3 py-1.5">
        <Cube width={14} height={14} className="shrink-0 text-[var(--dh-text-secondary)]" />
        <span className="min-w-0 truncate text-xs text-[var(--dh-text)]" title={path}>
          {path}
        </span>
        <span className="shrink-0 text-[11px] text-[var(--dh-text-secondary)]">
          {meta.branch}
          {size !== null ? ` · ${formatBytes(size)}` : ""}
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        {loading && (
          <Center absolute>
            <Spinner width={20} height={20} className="text-blue-700 dark:text-blue-400" />
            <p className="text-sm text-[var(--dh-text-secondary)]">Loading {path.split("/").pop()}…</p>
          </Center>
        )}
        {error && (
          <Center absolute>
            <p className="max-w-md text-sm text-red-600 dark:text-red-300">{error}</p>
          </Center>
        )}
        {modelUrl && <Turntable url={modelUrl} />}
      </div>
    </div>
  );
}

function Center({
  children,
  absolute,
}: {
  children: React.ReactNode;
  absolute?: boolean;
}) {
  return (
    <div
      className={`${absolute ? "absolute inset-0" : "h-full"} flex flex-col items-center justify-center gap-3 bg-[var(--dh-surface)] p-6 text-center`}
    >
      {children}
    </div>
  );
}

/**
 * The actual WebGL turntable: loads the GLB/GLTF into a Three.js scene,
 * auto-fits the camera to the model's bounding sphere, and turns it slowly
 * on a pedestal — OrbitControls' built-in `autoRotate` does the turning,
 * so dragging to inspect the model and the constant slow spin share one
 * camera-motion system instead of two competing ones.
 */
function Turntable({ url }: { url: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [spinning, setSpinning] = useState(true);
  const controlsRef = useRef<OrbitControls | null>(null);
  const resetRef = useRef<() => void>(() => {});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let frame = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x14181f, 1);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3f4a, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-4, 2, -3);
    scene.add(fill);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.4;
    controlsRef.current = controls;

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let defaultTarget = new THREE.Vector3();
    let defaultPosition = new THREE.Vector3(0, 0, 5);
    resetRef.current = () => {
      camera.position.copy(defaultPosition);
      controls.target.copy(defaultTarget);
      controls.update();
    };

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        scene.add(model);

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center); // center the model at the origin

        const radius = Math.max(size.length() / 2, 0.001);
        const distance = (radius / Math.sin((Math.PI * camera.fov) / 360)) * 1.25;
        // A classic three-quarter product-shot angle rather than a
        // dead-on front view, which reads as a flat rectangle for
        // box-like models until the turntable has spun a bit.
        const azimuth = Math.PI / 5; // ~36° around
        const elevation = Math.PI / 7; // ~26° up
        defaultPosition = new THREE.Vector3(
          distance * Math.sin(azimuth) * Math.cos(elevation),
          distance * Math.sin(elevation),
          distance * Math.cos(azimuth) * Math.cos(elevation)
        );
        defaultTarget = new THREE.Vector3(0, 0, 0);
        camera.near = distance / 100;
        camera.far = distance * 100;
        camera.updateProjectionMatrix();
        resetRef.current();
      },
      undefined,
      (err) => {
        if (!disposed)
          setLoadError(
            err instanceof Error ? err.message : "Could not parse this file as glTF/GLB."
          );
      }
    );

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m?.dispose();
        }
      });
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [url]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = spinning;
  }, [spinning]);

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="h-full w-full touch-none" />
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--dh-surface)] p-6 text-center">
          <p className="max-w-md text-sm text-red-600 dark:text-red-300">{loadError}</p>
        </div>
      )}
      <div className="absolute bottom-2 right-2 flex items-center gap-1">
        <button
          onClick={() => setSpinning((v) => !v)}
          title={spinning ? "Pause turntable" : "Resume turntable"}
          className="flex h-7 w-7 items-center justify-center rounded border border-[var(--dh-window-border)] bg-[color-mix(in_srgb,var(--dh-surface-raised)_82%,transparent)] text-[var(--dh-text-secondary)] backdrop-blur hover:text-[var(--dh-text)]"
        >
          {spinning ? <Pause width={13} height={13} /> : <Play width={13} height={13} />}
        </button>
        <button
          onClick={() => resetRef.current()}
          title="Reset view"
          className="flex h-7 w-7 items-center justify-center rounded border border-[var(--dh-window-border)] bg-[color-mix(in_srgb,var(--dh-surface-raised)_82%,transparent)] text-[var(--dh-text-secondary)] backdrop-blur hover:text-[var(--dh-text)]"
        >
          <ResetView width={13} height={13} />
        </button>
      </div>
    </div>
  );
}
