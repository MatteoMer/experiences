import { onMount, onCleanup, createSignal, For } from "solid-js";
import * as notesFromUnderground from "../covers/notes-from-underground";
import * as sunAlsoRises from "../covers/sun-also-rises";
import * as popeye from "../covers/popeye";
import * as betweenWorlds from "../covers/between-worlds";
import * as fiveLevels from "../covers/5-levels";
import * as categoryTheory from "../covers/category-theory";
import * as soloistInACage from "../covers/soloist-in-a-cage";

const coverData: Record<string, { width: number; height: number; rects: [number, number, number, number, number][]; scale?: number; speed?: number }> = {
  "/notes-from-underground": { ...notesFromUnderground, scale: 0.8 },
  "/sun-also-rises": { ...sunAlsoRises, scale: 1.1, speed: 200 },
  "/popeye": { ...popeye, scale: 1, speed: 300 },
  "/between-worlds": { ...betweenWorlds, scale: 0.7, speed: 500 },
  "/5-levels": { ...fiveLevels, scale: 0.8, speed: 300 },
  "/category-theory": { ...categoryTheory, scale: 0.9, speed: 80 },
  "/soloist-in-a-cage": { ...soloistInACage, scale: 1, speed: 300 },
};

// --- Particle types ---
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
}

// --- Cube types ---
type Pattern = "solid" | "hlines" | "vlines" | "dots" | "cross" | "checker";
type Vec3 = [number, number, number];

function v3key(v: Vec3): string { return `${v[0]},${v[1]},${v[2]}`; }
function parseV3(s: string): Vec3 { return s.split(",").map(Number) as Vec3; }

interface Cubie {
  pos: Vec3;
  faces: Map<string, Pattern>;
}

interface MoveInfo {
  axis: number;
  slice: number;
  angle: number;
}

const MOVE_MAP: Record<string, MoveInfo> = {
  R:   { axis: 0, slice:  1, angle: -Math.PI / 2 },
  "R'":{ axis: 0, slice:  1, angle:  Math.PI / 2 },
  L:   { axis: 0, slice: -1, angle:  Math.PI / 2 },
  "L'":{ axis: 0, slice: -1, angle: -Math.PI / 2 },
  U:   { axis: 1, slice:  1, angle: -Math.PI / 2 },
  "U'":{ axis: 1, slice:  1, angle:  Math.PI / 2 },
  D:   { axis: 1, slice: -1, angle:  Math.PI / 2 },
  "D'":{ axis: 1, slice: -1, angle: -Math.PI / 2 },
  F:   { axis: 2, slice:  1, angle: -Math.PI / 2 },
  "F'":{ axis: 2, slice:  1, angle:  Math.PI / 2 },
  B:   { axis: 2, slice: -1, angle:  Math.PI / 2 },
  "B'":{ axis: 2, slice: -1, angle: -Math.PI / 2 },
};

const MOVE_NAMES = Object.keys(MOVE_MAP);

function inverseName(m: string): string {
  return m.includes("'") ? m[0] : m + "'";
}

function rotAxis(p: Vec3, axis: number, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  const r: Vec3 = [p[0], p[1], p[2]];
  if (axis === 0) { r[1] = p[1] * c - p[2] * s; r[2] = p[1] * s + p[2] * c; }
  else if (axis === 1) { r[0] = p[0] * c + p[2] * s; r[2] = -p[0] * s + p[2] * c; }
  else { r[0] = p[0] * c - p[1] * s; r[1] = p[0] * s + p[1] * c; }
  return r;
}

function roundV(v: Vec3): Vec3 {
  return [Math.round(v[0]), Math.round(v[1]), Math.round(v[2])];
}

function buildCubies(): Cubie[] {
  const facePatterns: [Vec3, Pattern][] = [
    [[1, 0, 0], "cross"], [[-1, 0, 0], "vlines"],
    [[0, 1, 0], "solid"], [[0, -1, 0], "dots"],
    [[0, 0, 1], "hlines"], [[0, 0, -1], "checker"],
  ];
  const cubies: Cubie[] = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        const faces = new Map<string, Pattern>();
        for (const [n, p] of facePatterns) {
          if ((n[0] === 1 && x === 1) || (n[0] === -1 && x === -1) ||
              (n[1] === 1 && y === 1) || (n[1] === -1 && y === -1) ||
              (n[2] === 1 && z === 1) || (n[2] === -1 && z === -1)) {
            faces.set(v3key(n), p);
          }
        }
        cubies.push({ pos: [x, y, z], faces });
      }
    }
  }
  return cubies;
}

function applyMove(cubies: Cubie[], info: MoveInfo) {
  for (const c of cubies) {
    if (Math.round(c.pos[info.axis]) !== info.slice) continue;
    c.pos = roundV(rotAxis(c.pos, info.axis, info.angle));
    const nf = new Map<string, Pattern>();
    for (const [k, p] of c.faces) {
      nf.set(v3key(roundV(rotAxis(parseV3(k), info.axis, info.angle))), p);
    }
    c.faces = nf;
  }
}

function stickerCorners(pos: Vec3, normal: Vec3, inset: number): Vec3[] {
  let right: Vec3, up: Vec3;
  if (normal[0] !== 0) {
    right = [0, 0, normal[0]]; up = [0, 1, 0];
  } else if (normal[1] !== 0) {
    right = [1, 0, 0]; up = [0, 0, -normal[1]];
  } else {
    right = [normal[2], 0, 0]; up = [0, 1, 0];
  }
  const cx = pos[0] + normal[0] * 0.5;
  const cy = pos[1] + normal[1] * 0.5;
  const cz = pos[2] + normal[2] * 0.5;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([du, dv]) => [
    cx + right[0] * du * inset + up[0] * dv * inset,
    cy + right[1] * du * inset + up[1] * dv * inset,
    cz + right[2] * du * inset + up[2] * dv * inset,
  ] as Vec3);
}

function shouldDraw(pattern: Pattern, r: number, c: number): boolean {
  switch (pattern) {
    case "solid": return true;
    case "hlines": return r % 3 !== 2;
    case "vlines": return c % 3 !== 2;
    case "dots": return r % 3 === 1 && c % 3 === 1;
    case "cross": return r % 3 === 0 || c % 3 === 0;
    case "checker": return (Math.floor(r / 2) + Math.floor(c / 2)) % 2 === 0;
  }
}

function generateScramble(n: number): string[] {
  const moves: string[] = [];
  let last = "";
  for (let i = 0; i < n; i++) {
    let m: string;
    do { m = MOVE_NAMES[Math.floor(Math.random() * MOVE_NAMES.length)]; }
    while (m[0] === last[0]);
    moves.push(m);
    last = m;
  }
  return moves;
}

// --- Component ---
export default function CursorTrail() {
  let trailCanvas!: HTMLCanvasElement;
  let inkCanvas!: HTMLCanvasElement;
  const [showShortcuts, setShowShortcuts] = createSignal(false);
  const [showHistory, setShowHistory] = createSignal(false);
  const [cmdOpen, setCmdOpen] = createSignal(false);
  const [cmdQuery, setCmdQuery] = createSignal("");
  const [cmdIndex, setCmdIndex] = createSignal(0);
  let cmdInput!: HTMLInputElement;

  const pages = ["home", "about", "bookshelf"] as const;

  const filteredPages = () => {
    const q = cmdQuery().toLowerCase();
    if (!q) return [...pages];
    return pages.filter((p) => p.includes(q));
  };

  const navigateTo = (page: string) => {
    const path = page === "home" ? "/" : `/${page}`;
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
    setCmdOpen(false);
    setCmdQuery("");
  };

  interface HistoryEntry {
    label: string;
    ink: ImageData;
    erasePoints: { x: number; y: number }[];
    cubeDestroyed: boolean;
  }
  const [history, setHistory] = createSignal<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = createSignal(-1);
  let restoreEntry: (idx: number) => void = () => {};

  onMount(() => {
    const trailCtx = trailCanvas.getContext("2d")!;
    const inkCtx = inkCanvas.getContext("2d")!;
    const particles: Particle[] = [];
    let mouseDown = false;
    type Tool = "cursor" | "eraser";
    let activeTool: Tool = "cursor";

    const eraserCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30'%3E%3Ccircle cx='15' cy='15' r='14' fill='none' stroke='%232a2a2a' stroke-width='1.5' stroke-dasharray='3 3'/%3E%3C/svg%3E") 15 15, crosshair`;

    let cubeDestroyed = false;

    // --- Book cover rects (drawn like the cube) ---
    type CoverRect = { x: number; y: number; w: number; h: number; opacity: number };
    let coverRects: CoverRect[] = [];
    let coverRectsVisible = 0;
    let coverRectsPerFrame = 600;

    const isMobile = () => window.innerWidth < 768;

    const onShowCover = (e: Event) => {
      const key = (e as CustomEvent).detail as string;
      if (!key) { coverRects = []; coverRectsVisible = 0; return; }
      if (isMobile()) { coverRects = []; coverRectsVisible = 0; return; }
      const cover = coverData[key];
      if (!cover) { coverRects = []; coverRectsVisible = 0; return; }

      const scale = cover.scale ?? 0.8;
      const offsetX = window.innerWidth * 0.15 - (cover.width * scale) / 2;
      const offsetY = 350 - (cover.height * scale) / 2;

      coverRects = cover.rects.map(([x, y, w, h, o]) => ({
        x: x * scale + offsetX,
        y: y * scale + offsetY,
        w: w * scale,
        h: h * scale,
        opacity: o,
      }));
      coverRects.sort((a, b) => a.y - b.y);
      coverRectsVisible = 0;
      coverRectsPerFrame = cover.speed ?? 600;
    };
    window.addEventListener("show-cover", onShowCover);

    function pushHistory(label: string) {
      const idx = historyIndex();
      // trim any future entries if we acted after undoing
      const current = history().slice(0, idx + 1);
      const entry: HistoryEntry = {
        label,
        ink: inkCtx.getImageData(0, 0, inkCanvas.width, inkCanvas.height),
        erasePoints: [...erasePoints],
        cubeDestroyed,
      };
      const next = [...current, entry].slice(-30);
      setHistory(next);
      setHistoryIndex(next.length - 1);
    }

    restoreEntry = (idx: number) => {
      const entries = history();
      if (idx < 0 || idx >= entries.length) return;
      const entry = entries[idx];
      inkCtx.putImageData(entry.ink, 0, 0);
      erasePoints.length = 0;
      erasePoints.push(...entry.erasePoints);
      cubeDestroyed = entry.cubeDestroyed;
      setHistoryIndex(idx);
    };

    function undoInk() {
      const idx = historyIndex();
      if (idx < 0) return;
      restoreEntry(idx - 1 >= 0 ? idx - 1 : 0);
      if (idx === 0) {
        // undo past first entry — clear everything
        inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
        erasePoints.length = 0;
        cubeDestroyed = false;
        setHistoryIndex(-1);
      }
    }

    function clearAll() {
      pushHistory("clear all");
      inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
      erasePoints.length = 0;
      cubeDestroyed = true;
      coverRects = [];
      coverRectsVisible = 0;
    }

    function setTool(tool: Tool) {
      activeTool = tool;
      const el = document.getElementById("eraser-toggle");
      if (el) el.style.textDecoration = tool === "eraser" ? "line-through" : "";
      document.body.style.cursor = tool === "eraser" ? eraserCursor : "";
    }

    function resetAll() {
      // restore ink
      inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
      erasePoints.length = 0;
      // restore cube
      cubeDestroyed = false;
      cubeOffsetX = 0;
      cubeOffsetY = 0;
      cubeTargetX = 0;
      cubeTargetY = 0;
      cubePaused = false;
      cubeSpeedBoost = false;
      coverRects = [];
      coverRectsVisible = 0;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // when command palette is open, only handle its keys
      if (cmdOpen()) {
        if (e.key === "Escape") {
          e.preventDefault();
          setCmdOpen(false);
          setCmdQuery("");
        } else if (e.key === "Enter") {
          e.preventDefault();
          const matches = filteredPages();
          if (matches.length > 0) navigateTo(matches[cmdIndex()]);
        } else if (e.key === "ArrowDown" || (e.key === "j" && e.ctrlKey)) {
          e.preventDefault();
          setCmdIndex(Math.min(cmdIndex() + 1, filteredPages().length - 1));
        } else if (e.key === "ArrowUp" || (e.key === "k" && e.ctrlKey)) {
          e.preventDefault();
          setCmdIndex(Math.max(cmdIndex() - 1, 0));
        }
        return;
      }
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      switch (e.key) {
        // tools
        case "b":
          e.preventDefault();
          setTool("eraser");
          break;
        case "v":
        case "Escape":
          e.preventDefault();
          setTool("cursor");
          setShowShortcuts(false);
          break;
        case "x":
          e.preventDefault();
          clearAll();
          break;
        case "z":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            undoInk();
          }
          break;
        // vim undo
        case "u":
          e.preventDefault();
          undoInk();
          break;
        // reset
        case "r":
          e.preventDefault();
          resetAll();
          break;
        // move cube: hjkl + arrows
        case "h":
        case "ArrowLeft":
          e.preventDefault();
          cubeTargetX -= 20;
          break;
        case "l":
        case "ArrowRight":
          e.preventDefault();
          cubeTargetX += 20;
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          cubeTargetY -= 20;
          break;
        case "j":
        case "ArrowDown":
          e.preventDefault();
          cubeTargetY += 20;
          break;
        // cube controls
        case "s":
          e.preventDefault();
          cubePaused = !cubePaused;
          break;
        case "w":
          e.preventDefault();
          cubeSpeedBoost = !cubeSpeedBoost;
          break;
        // command palette
        case "/":
          e.preventDefault();
          setCmdOpen(true);
          setCmdQuery("");
          setCmdIndex(0);
          setTimeout(() => cmdInput?.focus(), 0);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);

    const resize = () => {
      const inkData = inkCtx.getImageData(0, 0, inkCanvas.width, inkCanvas.height);
      trailCanvas.width = window.innerWidth;
      trailCanvas.height = window.innerHeight;
      inkCanvas.width = window.innerWidth;
      inkCanvas.height = window.innerHeight;
      inkCtx.putImageData(inkData, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const eraseRadius = 15;
    const erasePoints: { x: number; y: number }[] = [];

    const eraseAt = (x: number, y: number) => {
      // erase from ink canvas
      inkCtx.save();
      inkCtx.globalCompositeOperation = "destination-out";
      inkCtx.globalAlpha = 1;
      inkCtx.beginPath();
      inkCtx.arc(x, y, eraseRadius, 0, Math.PI * 2);
      inkCtx.fill();
      inkCtx.restore();
      // store point so we punch the trail canvas after drawing
      erasePoints.push({ x, y });
    };

    const onMove = (e: MouseEvent) => {
      // trail particles always show except in eraser mode
      if (activeTool !== "eraser") {
        for (let i = 0; i < 2; i++) {
          particles.push({
            x: e.clientX + (Math.random() - 0.5) * 4,
            y: e.clientY + (Math.random() - 0.5) * 4,
            vx: 0,
            vy: 0,
            size: Math.random() * 2 + 1,
            life: 1,
          });
        }
      }

      if (!mouseDown) return;

      if (activeTool === "eraser") {
        eraseAt(e.clientX, e.clientY);
      } else {
        for (let i = 0; i < 3; i++) {
          const x = e.clientX + (Math.random() - 0.5) * 4;
          const y = e.clientY + (Math.random() - 0.5) * 4;
          const size = Math.random() * 2.5 + 1;
          inkCtx.globalAlpha = 0.5 + Math.random() * 0.2;
          inkCtx.fillStyle = "#2a2a2a";
          inkCtx.fillRect(Math.round(x), Math.round(y), size, size);
        }
      }
    };
    window.addEventListener("mousemove", onMove);

    const onDown = (e: MouseEvent) => {
      if (activeTool === "eraser") {
        mouseDown = true;
        pushHistory("erase");
        eraseAt(e.clientX, e.clientY);
        return;
      }
      if ((e.target as HTMLElement).closest("a, button, .select-text")) return;
      mouseDown = true;
      pushHistory("draw");
    };

    const onUp = (e: MouseEvent) => {
      if (!mouseDown) return;
      mouseDown = false;

      // sparks on release (pen & cursor modes)
      if (activeTool !== "eraser") {
        const count = 20 + Math.floor(Math.random() * 15);
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 2.5 + 0.5;
          particles.push({
            x: e.clientX + (Math.random() - 0.5) * 6,
            y: e.clientY + (Math.random() - 0.5) * 6,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 2.5 + 1,
            life: 1.5 + Math.random() * 0.8,
          });
        }
      }
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    // --- Cube state ---
    const cubies = buildCubies();
    const cubeScale = 65, cubeGrid = 10, cubeInset = 0.42;
    let viewAngleY = 0;
    const viewAngleX = -0.5;
    let cubeOffsetX = 0;
    let cubeOffsetY = 0;
    let cubeTargetX = 0;
    let cubeTargetY = 0;
    let cubePaused = false;
    let cubeSpeedBoost = false;
    let cubePageTarget = 0;
    let cubePageOffset = 0;
    let cubeHidden = false;

    function updatePageShift() {
      const path = window.location.pathname;
      cubeHidden = path !== "/";
      if (path === "/about") cubePageTarget = -window.innerWidth * 0.35;
      else if (path === "/bookshelf") cubePageTarget = window.innerWidth * 0.35;
      else cubePageTarget = 0;
      // clear book cover when leaving bookshelf
      if (path !== "/bookshelf") coverRects = [];
    }
    updatePageShift();
    cubePageOffset = cubePageTarget; // no animation on initial load

    // listen for client-side navigation
    const origPushState = window.history.pushState.bind(window.history);
    window.history.pushState = function (...args: Parameters<typeof origPushState>) {
      origPushState(...args);
      updatePageShift();
    };
    window.addEventListener("popstate", updatePageShift);

    let animInfo: MoveInfo | null = null;
    let animProgress = 0;
    let animStart = 0;
    const animDuration = 600;

    let moveQueue: string[] = [];
    let pauseUntil = 0;
    let scrambleMoves: string[] = [];

    scrambleMoves = generateScramble(20);
    for (const m of scrambleMoves) applyMove(cubies, MOVE_MAP[m]);
    let phase: "idle-solved" | "scrambling" | "idle-scrambled" | "solving" = "idle-scrambled";
    let phaseStart = performance.now();

    function startNextMove(now: number) {
      if (moveQueue.length === 0) return;
      animInfo = MOVE_MAP[moveQueue.shift()!];
      animProgress = 0;
      animStart = now;
    }

    // --- Main loop ---
    let raf: number;
    const loop = (now: number) => {
      const W = trailCanvas.width, H = trailCanvas.height;
      trailCtx.clearRect(0, 0, W, H);

      // --- Trail particles ---
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= 0.016;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;
        trailCtx.globalAlpha = Math.min(p.life, 1) * 0.7;
        trailCtx.fillStyle = "#2a2a2a";
        trailCtx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }

      // --- Cube ---
      if (!cubeDestroyed && !cubeHidden) {
        if (!cubePaused) viewAngleY += cubeSpeedBoost ? 0.015 : 0.003;

        // phase transitions (skip when paused)
        if (cubePaused) {
          phaseStart = now; // keep phase timer fresh so it doesn't fire immediately on unpause
        } else if (phase === "idle-solved" && now - phaseStart > 15000) {
          scrambleMoves = generateScramble(15);
          moveQueue = [...scrambleMoves];
          phase = "scrambling";
          startNextMove(now);
        } else if (phase === "scrambling" && moveQueue.length === 0 && !animInfo) {
          phase = "idle-scrambled";
          phaseStart = now;
        } else if (phase === "idle-scrambled" && now - phaseStart > 2000) {
          moveQueue = scrambleMoves.slice().reverse().map(inverseName);
          phase = "solving";
          startNextMove(now);
        } else if (phase === "solving" && moveQueue.length === 0 && !animInfo) {
          phase = "idle-solved";
          phaseStart = now;
        }

        if (cubePaused && animInfo) {
          animStart = now - animProgress * animDuration; // freeze progress
        } else if (animInfo) {
          animProgress = Math.min(1, (now - animStart) / animDuration);
          if (animProgress >= 1) {
            applyMove(cubies, animInfo);
            animInfo = null;
            if (moveQueue.length > 0) pauseUntil = now + 150;
          }
        } else if (moveQueue.length > 0 && now >= pauseUntil) {
          startNextMove(now);
        }

        const eased = animInfo ? animProgress * (2 - animProgress) : 0;
        const animAngle = animInfo ? animInfo.angle * eased : 0;

        cubeOffsetX += (cubeTargetX - cubeOffsetX) * 0.12;
        cubeOffsetY += (cubeTargetY - cubeOffsetY) * 0.12;
        cubePageOffset += (cubePageTarget - cubePageOffset) * 0.06;

        const cubeCx = W / 2 + cubeOffsetX + cubePageOffset;
        const cubeCy = 350 + cubeOffsetY;

        const visible: {
          projected: number[][];
          pattern: Pattern;
          avgZ: number;
          facing: number;
        }[] = [];

        for (const cubie of cubies) {
          const isAnimated = animInfo && Math.round(cubie.pos[animInfo.axis]) === animInfo.slice;

          for (const [key, pattern] of cubie.faces) {
            const normal = parseV3(key);
            let corners = stickerCorners(cubie.pos, normal, cubeInset);
            let n: Vec3 = [...normal];

            if (isAnimated) {
              corners = corners.map((c) => rotAxis(c, animInfo!.axis, animAngle));
              n = rotAxis(n, animInfo!.axis, animAngle);
            }

            corners = corners.map((c) => rotAxis(rotAxis(c, 1, viewAngleY), 0, viewAngleX));
            n = rotAxis(rotAxis(n, 1, viewAngleY), 0, viewAngleX);

            if (n[2] <= 0) continue;

            const avgZ = (corners[0][2] + corners[1][2] + corners[2][2] + corners[3][2]) / 4;
            const projected = corners.map((c) => [cubeCx + c[0] * cubeScale, cubeCy - c[1] * cubeScale]);

            visible.push({ projected, pattern, avgZ, facing: n[2] });
          }
        }

        visible.sort((a, b) => a.avgZ - b.avgZ);

        trailCtx.fillStyle = "#2a2a2a";
        for (const s of visible) {
          const [c0, c1, c2, c3] = s.projected;

          for (let r = 0; r < cubeGrid; r++) {
            for (let c = 0; c < cubeGrid; c++) {
              if (!shouldDraw(s.pattern, r, c)) continue;
              const u = (c + 0.5) / cubeGrid;
              const v = (r + 0.5) / cubeGrid;
              const x = (1 - v) * ((1 - u) * c0[0] + u * c1[0]) + v * ((1 - u) * c3[0] + u * c2[0]);
              const y = (1 - v) * ((1 - u) * c0[1] + u * c1[1]) + v * ((1 - u) * c3[1] + u * c2[1]);
              const jx = Math.sin(r * 3.7 + c * 5.1 + viewAngleY * 2) * 2;
              const jy = Math.cos(r * 5.3 + c * 2.9 + viewAngleY * 2) * 2;
              const sz = 1 + Math.abs(Math.sin(r * 2.1 + c * 4.3 + s.avgZ)) * 2.5;
              trailCtx.globalAlpha = 0.5 + Math.abs(Math.sin(r * 1.3 + c * 2.7)) * 0.2;
              trailCtx.fillRect(Math.round(x + jx), Math.round(y + jy), sz, sz);
            }
          }
        }
      }

      // --- Book cover (progressive draw) ---
      if (coverRects.length > 0) {
        if (coverRectsVisible < coverRects.length) {
          coverRectsVisible = Math.min(coverRectsVisible + coverRectsPerFrame, coverRects.length);
        }
        trailCtx.fillStyle = "#2a2a2a";
        for (let i = 0; i < coverRectsVisible; i++) {
          const r = coverRects[i];
          trailCtx.globalAlpha = r.opacity;
          trailCtx.fillRect(Math.round(r.x), Math.round(r.y), r.w, r.h);
        }
      }

      // punch erase holes through everything (trail + cube)
      if (erasePoints.length > 0) {
        trailCtx.save();
        trailCtx.globalCompositeOperation = "destination-out";
        trailCtx.globalAlpha = 1;
        for (const ep of erasePoints) {
          trailCtx.beginPath();
          trailCtx.arc(ep.x, ep.y, eraseRadius, 0, Math.PI * 2);
          trailCtx.fill();
        }
        trailCtx.restore();
      }

      trailCtx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    onCleanup(() => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", updatePageShift);
      window.removeEventListener("show-cover", onShowCover);
      document.body.style.cursor = "";
      cancelAnimationFrame(raf);
    });
  });

  return (
    <>
      <canvas
        ref={inkCanvas}
        class="fixed inset-0 w-screen h-screen pointer-events-none z-[9998]"
      />
      <canvas
        ref={trailCanvas}
        class="fixed inset-0 w-screen h-screen pointer-events-none z-[9999]"
      />
      {/* Command palette — bottom left */}
      {cmdOpen() && (
        <div class="fixed bottom-0 left-0 z-[10001] font-['Quicksand'] w-full">
          <div class="flex items-center bg-[#f0efe9] border-t border-gray-200 px-4 py-2">
            <span class="text-gray-400 text-sm mr-2">/</span>
            <input
              ref={cmdInput}
              type="text"
              value={cmdQuery()}
              onInput={(e) => { setCmdQuery(e.currentTarget.value); setCmdIndex(0); }}
              class="bg-transparent outline-none text-sm text-gray-800 flex-1 font-['Quicksand']"
              placeholder="home, about, bookshelf..."
            />
          </div>
          {filteredPages().length > 0 && (
            <div class="bg-[#f0efe9] border-t border-gray-100 px-4 py-1">
              <For each={filteredPages()}>{(p, i) =>
                <button
                  onClick={() => navigateTo(p)}
                  class={`block w-full text-left text-sm py-1 transition-colors ${
                    i() === cmdIndex() ? "text-gray-800" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {p}
                </button>
              }</For>
            </div>
          )}
        </div>
      )}
      {/* Mobile warning */}
      <div class="fixed bottom-8 left-0 right-0 z-[10001] flex justify-center font-['Quicksand'] md:hidden">
        <p class="text-sm text-gray-400 px-8 text-center">this experience is made for computers</p>
      </div>
      {/* Shortcuts panel — bottom right, desktop only */}
      <div class="fixed bottom-8 right-10 z-[10000] font-['Quicksand'] hidden md:block">
        {showShortcuts() && (
          <div class="mb-2 px-4 py-3 text-xs text-gray-400 space-y-1.5 min-w-[160px]">
            <div class="flex justify-between gap-6"><span>cursor</span><span class="text-gray-500 font-semibold">V</span></div>
            <div class="flex justify-between gap-6"><span>eraser</span><span class="text-gray-500 font-semibold">B</span></div>
            <div class="flex justify-between gap-6"><span>undo</span><span class="text-gray-500 font-semibold">U</span></div>
            <div class="flex justify-between gap-6"><span>clear all</span><span class="text-gray-500 font-semibold">X</span></div>
            <div class="flex justify-between gap-6"><span>reset</span><span class="text-gray-500 font-semibold">R</span></div>
            <div class="border-t border-gray-200 my-1" />
            <div class="flex justify-between gap-6"><span>move cube</span><span class="text-gray-500 font-semibold">H J K L</span></div>
            <div class="flex justify-between gap-6"><span>pause</span><span class="text-gray-500 font-semibold">S</span></div>
            <div class="flex justify-between gap-6"><span>speed up</span><span class="text-gray-500 font-semibold">W</span></div>
            <div class="border-t border-gray-200 my-1" />
            <div class="flex justify-between gap-6"><span>navigate</span><span class="text-gray-500 font-semibold">/</span></div>
            <div class="flex justify-between gap-6"><span>close</span><span class="text-gray-500 font-semibold">Esc</span></div>
          </div>
        )}
        <button
          onClick={(e) => { setShowShortcuts(!showShortcuts()); (e.currentTarget as HTMLElement).blur(); }}
          class="block ml-auto text-sm font-medium text-gray-800 hover:text-gray-600 transition-colors"
        >
          shortcuts
        </button>
      </div>
    </>
  );
}
