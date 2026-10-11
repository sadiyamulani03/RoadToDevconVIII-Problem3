// Canvas renderer. Purely presentational: reads simulation state and draws
// it. Never feeds values back into the simulation (render-only effects such
// as particles and flashes live here and cannot affect determinism).

import { LEVEL } from "../generated/levelConfig";
import type { SimState } from "./engine";

export const WORLD_W = LEVEL.world.width;
export const WORLD_H = LEVEL.world.height;

const COLORS = {
  background: "#14171d",
  grid: "#1b1f27",
  solid: "#2b3240",
  solidTop: "#3d4657",
  hazard: "#d05252",
  hazardDark: "#8f3535",
  goalPole: "#9aa4b2",
  goalFlag: "#4cc38a",
  player: "#f0b429",
  playerDark: "#b8860b",
  ghost: "rgba(240, 180, 41, 0.38)",
  ghostOutline: "rgba(240, 180, 41, 0.75)",
} as const;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0..1
  color: string;
}

export interface RenderState {
  player: SimState;
  ghost: SimState | null;
  won: boolean;
  dead: boolean;
  particles: Particle[];
  flashAlpha: number;
  flashColor: string;
  wonAt: number | null; // ms timestamp for flag-wave animation
}

export function createRenderState(player: SimState): RenderState {
  return {
    player,
    ghost: null,
    won: false,
    dead: false,
    particles: [],
    flashAlpha: 0,
    flashColor: "#ffffff",
    wonAt: null,
  };
}

/** Emit a burst of render-only particles (win = gold, death = red). */
export function burstParticles(rs: RenderState, color: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = 40 + Math.random() * 90;
    rs.particles.push({
      x: rs.player.x + LEVEL.player.width / 2,
      y: rs.player.y + LEVEL.player.height / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 1,
      color,
    });
  }
}

export function updateParticles(rs: RenderState, dtSeconds: number): void {
  for (const p of rs.particles) {
    p.x += p.vx * dtSeconds;
    p.y += p.vy * dtSeconds;
    p.vy += 220 * dtSeconds;
    p.life -= dtSeconds * 1.6;
  }
  rs.particles = rs.particles.filter((p) => p.life > 0);
  if (rs.flashAlpha > 0) {
    rs.flashAlpha = Math.max(0, rs.flashAlpha - dtSeconds * 2.2);
  }
}

export function drawFrame(ctx: CanvasRenderingContext2D, rs: RenderState, now: number): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // subtle grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= WORLD_W; x += 32) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, WORLD_H);
  }
  for (let y = 0; y <= WORLD_H; y += 32) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(WORLD_W, y + 0.5);
  }
  ctx.stroke();

  // solids
  for (const r of LEVEL.solids) {
    ctx.fillStyle = COLORS.solid;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = COLORS.solidTop;
    ctx.fillRect(r.x, r.y, r.w, 2);
  }

  // hazards (spikes drawn as triangle rows)
  for (const h of LEVEL.hazards) {
    const spikes = Math.max(1, Math.floor(h.w / 8));
    const sw = h.w / spikes;
    ctx.fillStyle = COLORS.hazard;
    for (let i = 0; i < spikes; i++) {
      const sx = h.x + i * sw;
      ctx.beginPath();
      ctx.moveTo(sx, h.y + h.h);
      ctx.lineTo(sx + sw / 2, h.y);
      ctx.lineTo(sx + sw, h.y + h.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = COLORS.hazardDark;
    ctx.fillRect(h.x, h.y + h.h - 2, h.w, 2);
  }

  // goal flag
  const g = LEVEL.goal;
  const wave = rs.wonAt !== null ? Math.sin((now - rs.wonAt) / 90) * 2 : 0;
  ctx.fillStyle = COLORS.goalPole;
  ctx.fillRect(g.x + 1, g.y, 2, g.h);
  ctx.fillStyle = COLORS.goalFlag;
  ctx.beginPath();
  ctx.moveTo(g.x + 3, g.y + 2);
  ctx.lineTo(g.x + 3 + 12, g.y + 6 + wave);
  ctx.lineTo(g.x + 3, g.y + 12);
  ctx.closePath();
  ctx.fill();

  // ghost
  if (rs.ghost && rs.ghost.status === "playing") {
    drawPlayer(ctx, rs.ghost.x, rs.ghost.y, COLORS.ghost, COLORS.ghostOutline);
  }

  // player
  if (!rs.dead) {
    drawPlayer(ctx, rs.player.x, rs.player.y, COLORS.player, COLORS.playerDark);
  }

  // particles
  for (const p of rs.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;

  // flash
  if (rs.flashAlpha > 0) {
    ctx.globalAlpha = rs.flashAlpha;
    ctx.fillStyle = rs.flashColor;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.globalAlpha = 1;
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fill: string,
  outline: string,
): void {
  const p = LEVEL.player;
  ctx.fillStyle = outline;
  ctx.fillRect(x, y, p.width, p.height);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, p.width - 2, p.height - 2);
  // visor
  ctx.fillStyle = outline;
  ctx.fillRect(x + p.width - 5, y + 4, 3, 3);
}
