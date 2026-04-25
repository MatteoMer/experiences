import { onMount, onCleanup } from "solid-js";

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

function shouldDraw(pattern: Pattern, r: number, c: number, grid: number): boolean {
  switch (pattern) {
    case "solid":
      return true;
    case "hlines":
      // horizontal stripes: 2 rows on, 1 row off
      return r % 3 !== 2;
    case "vlines":
      // vertical stripes: 2 cols on, 1 col off
      return c % 3 !== 2;
    case "dots":
      // sparse grid of dots
      return r % 3 === 1 && c % 3 === 1;
    case "cross":
      // grid lines in both directions
      return r % 3 === 0 || c % 3 === 0;
    case "checker":
      // checkerboard
      return (Math.floor(r / 2) + Math.floor(c / 2)) % 2 === 0;
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

export default function RubiksCube() {
  let canvas!: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext("2d")!;
    const cubies = buildCubies();
    const W = canvas.width, H = canvas.height;
    const scale = 65, grid = 10, inset = 0.42;
    let viewAngleY = 0;
    const viewAngleX = -0.5;

    // animation state
    let animInfo: MoveInfo | null = null;
    let animProgress = 0;
    let animStart = 0;
    const animDuration = 600;

    // move queue & phase
    let moveQueue: string[] = [];
    let pauseUntil = 0;
    let scrambleMoves: string[] = [];

    // start already scrambled
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

    let raf: number;
    const loop = (now: number) => {
      viewAngleY += 0.003;

      // phase transitions
      if (phase === "idle-solved" && now - phaseStart > 15000) {
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

      // advance animation
      if (animInfo) {
        animProgress = Math.min(1, (now - animStart) / animDuration);
        if (animProgress >= 1) {
          applyMove(cubies, animInfo);
          animInfo = null;
          if (moveQueue.length > 0) pauseUntil = now + 150;
        }
      } else if (moveQueue.length > 0 && now >= pauseUntil) {
        startNextMove(now);
      }

      // eased animation angle
      const eased = animInfo ? animProgress * (2 - animProgress) : 0;
      const animAngle = animInfo ? animInfo.angle * eased : 0;

      // render
      ctx.clearRect(0, 0, W, H);

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
          let corners = stickerCorners(cubie.pos, normal, inset);
          let n: Vec3 = [...normal];

          if (isAnimated) {
            corners = corners.map((c) => rotAxis(c, animInfo!.axis, animAngle));
            n = rotAxis(n, animInfo!.axis, animAngle);
          }

          corners = corners.map((c) => rotAxis(rotAxis(c, 1, viewAngleY), 0, viewAngleX));
          n = rotAxis(rotAxis(n, 1, viewAngleY), 0, viewAngleX);

          if (n[2] <= 0) continue;

          const avgZ = (corners[0][2] + corners[1][2] + corners[2][2] + corners[3][2]) / 4;
          const projected = corners.map((c) => [W / 2 + c[0] * scale, H / 2 - c[1] * scale]);

          visible.push({ projected, pattern, avgZ, facing: n[2] });
        }
      }

      visible.sort((a, b) => a.avgZ - b.avgZ);

      ctx.fillStyle = "#2a2a2a";
      for (const s of visible) {
        const [c0, c1, c2, c3] = s.projected;

        for (let r = 0; r < grid; r++) {
          for (let c = 0; c < grid; c++) {
            if (!shouldDraw(s.pattern, r, c, grid)) continue;
            const u = (c + 0.5) / grid;
            const v = (r + 0.5) / grid;
            const x = (1 - v) * ((1 - u) * c0[0] + u * c1[0]) + v * ((1 - u) * c3[0] + u * c2[0]);
            const y = (1 - v) * ((1 - u) * c0[1] + u * c1[1]) + v * ((1 - u) * c3[1] + u * c2[1]);
            const jx = Math.sin(r * 3.7 + c * 5.1 + viewAngleY * 2) * 2;
            const jy = Math.cos(r * 5.3 + c * 2.9 + viewAngleY * 2) * 2;
            const sz = 1 + Math.abs(Math.sin(r * 2.1 + c * 4.3 + s.avgZ)) * 2.5;
            ctx.globalAlpha = 0.5 + Math.abs(Math.sin(r * 1.3 + c * 2.7)) * 0.2;
            ctx.fillRect(Math.round(x + jx), Math.round(y + jy), sz, sz);
          }
        }
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    onCleanup(() => cancelAnimationFrame(raf));
  });

  return (
    <div class="flex justify-center mt-16">
      <canvas ref={canvas} width={400} height={400} />
    </div>
  );
}
