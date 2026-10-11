// ============================================================
// AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
// Source of truth: shared/level.json
// Regenerate:      npm run generate:level
// Verify:          npm run check:level
// ============================================================

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const LEVEL = {
  id: "ghost-sprint-v1",
  name: "Ghost Sprint",
  world: { width: 480, height: 272 },
  player: {
    spawnX: 16,
    spawnY: 232,
    width: 12,
    height: 16,
  },
  solids: [
    { x: 0, y: 248, w: 144, h: 24 }, // groundA,
    { x: 192, y: 248, w: 112, h: 24 }, // groundB,
    { x: 344, y: 248, w: 136, h: 24 }, // groundC,
    { x: 96, y: 216, w: 48, h: 10 }, // ledgeP1,
    { x: 264, y: 216, w: 12, h: 32 }, // wallW1,
    { x: 312, y: 216, w: 24, h: 10 }, // stepP2
  ] as readonly Rect[],
  hazards: [
    { x: 56, y: 238, w: 24, h: 10 }, // spikesA,
    { x: 232, y: 238, w: 16, h: 10 }, // spikesB,
    { x: 392, y: 238, w: 24, h: 10 }, // spikesC
  ] as readonly Rect[],
  goal: { x: 448, y: 200, w: 16, h: 48 } as Rect,
  physics: {
    tickRate: 60,
    maxInputLength: 1200,
    moveSpeed: 768,
    jumpVelocity: 1536,
    gravity: 102,
    terminalVelocity: 1792,
    positionScale: 256,
  },
  input: {
    bitLeft: 1,
    bitRight: 2,
    bitJump: 4,
    invalidMask: 248,
  },
} as const;

export default LEVEL;
