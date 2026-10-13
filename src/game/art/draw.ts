// Arte provisória original, desenhada por código em Canvas 2D. Cada função
// desenha um quadro a partir da origem (0,0). Para trocar por arte final,
// basta carregar imagens com as mesmas chaves e tamanhos de quadro em
// PreloadScene — nenhuma regra de jogo depende destes desenhos.
import { TILE } from '../config';
import { BLOCK_DEFS, TERRAIN_TOP_FRAME } from '../data/blocks';
import type { EnemyType } from '../types/game';

type Ctx = CanvasRenderingContext2D;

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function grad(c: Ctx, y0: number, y1: number, a: string, b: string): CanvasGradient {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

/** Segmento arredondado saindo de (x,y). Ângulo 0 = para baixo, π/2 = para a frente. */
function limb(c: Ctx, x: number, y: number, len: number, angle: number, width: number, color: string): [number, number] {
  const ex = x + Math.sin(angle) * len;
  const ey = y + Math.cos(angle) * len;
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(ex, ey);
  c.stroke();
  return [ex, ey];
}

function tri(c: Ctx, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, color: string): void {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.lineTo(x2, y2);
  c.closePath();
  c.fill();
}

// ------------------------------------------------------------------ tiles

/** Desenha o quadro `frame` do tileset (índice do bloco, ou TERRAIN_TOP_FRAME). */
export function drawTile(c: Ctx, frame: number): void {
  const T = TILE;
  const id = frame === TERRAIN_TOP_FRAME ? 'terrain_top' : BLOCK_DEFS[frame]?.id ?? 'empty';
  c.save();
  switch (id) {
    case 'terrain':
    case 'terrain_top': {
      c.fillStyle = grad(c, 0, T, '#2c3557', '#232a47');
      c.fillRect(0, 0, T, T);
      c.fillStyle = 'rgba(12,16,34,0.35)';
      for (const [x, y, r] of [[7, 20, 3], [22, 13, 4], [14, 27, 2], [27, 26, 2]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
      if (id === 'terrain_top') {
        c.fillStyle = grad(c, 0, 8, '#4ee3a4', '#1f9d6b');
        c.fillRect(0, 0, T, 7);
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.fillRect(0, 0, T, 1.5);
        c.fillStyle = '#167a52';
        for (let x = 2; x < T; x += 8) tri(c, x, 7, x + 6, 7, x + 3, 11, '#167a52');
      }
      break;
    }
    case 'bedrock': {
      c.fillStyle = '#141829';
      c.fillRect(0, 0, T, T);
      c.strokeStyle = 'rgba(80,92,140,0.35)';
      c.lineWidth = 2;
      for (let k = -T; k < T; k += 10) { c.beginPath(); c.moveTo(k, T); c.lineTo(k + T, 0); c.stroke(); }
      break;
    }
    case 'crate': {
      rr(c, 1, 1, T - 2, T - 2, 4); c.fillStyle = grad(c, 0, T, '#d9a066', '#b07a3f'); c.fill();
      c.strokeStyle = '#7a4f24'; c.lineWidth = 3; c.stroke();
      c.beginPath(); c.moveTo(5, 5); c.lineTo(T - 5, T - 5); c.moveTo(T - 5, 5); c.lineTo(5, T - 5); c.stroke();
      c.fillStyle = '#ffd166'; c.beginPath(); c.arc(T / 2, T / 2, 4, 0, 7); c.fill();
      break;
    }
    case 'wood_platform': {
      rr(c, 0, 0, T, 10, 3); c.fillStyle = grad(c, 0, 10, '#e2b07a', '#b9824a'); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(2, 1, T - 4, 2);
      c.fillStyle = '#7a4f24'; c.fillRect(0, 9, T, 2);
      c.fillRect(4, 11, 3, 6); c.fillRect(T - 7, 11, 3, 6);
      break;
    }
    case 'stone_block': {
      rr(c, 0.5, 0.5, T - 1, T - 1, 4); c.fillStyle = grad(c, 0, T, '#a3acc2', '#6f7890'); c.fill();
      c.strokeStyle = '#4b5368'; c.lineWidth = 2; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.28)'; rr(c, 3, 3, T - 6, 5, 2); c.fill();
      c.strokeStyle = 'rgba(40,46,66,0.5)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(8, 14); c.lineTo(14, 20); c.lineTo(11, 26); c.moveTo(22, 12); c.lineTo(25, 19); c.stroke();
      break;
    }
    case 'defensive_wall': {
      for (let i = 0; i < 3; i++) {
        const x = 2 + i * 10;
        c.fillStyle = grad(c, 0, T, '#5d79b8', '#35487a');
        c.beginPath(); c.moveTo(x, T); c.lineTo(x, 7); c.lineTo(x + 4, 0); c.lineTo(x + 8, 7); c.lineTo(x + 8, T); c.closePath(); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(x + 1, 8, 2, T - 9);
      }
      c.shadowColor = '#67e8f9'; c.shadowBlur = 6;
      c.fillStyle = '#67e8f9'; c.fillRect(1, 13, T - 2, 3); c.fillRect(1, 24, T - 2, 3);
      break;
    }
    case 'explosive_block': {
      rr(c, 1, 1, T - 2, T - 2, 6); c.fillStyle = grad(c, 0, T, '#f0575c', '#b3262b'); c.fill();
      c.strokeStyle = '#6e1216'; c.lineWidth = 2; c.stroke();
      c.save(); rr(c, 1, 11, T - 2, 10, 0); c.clip();
      c.fillStyle = '#ffd166'; c.fillRect(0, 11, T, 10);
      c.fillStyle = '#231a12';
      for (let x = -8; x < T; x += 10) { c.beginPath(); c.moveTo(x, 21); c.lineTo(x + 6, 11); c.lineTo(x + 11, 11); c.lineTo(x + 5, 21); c.closePath(); c.fill(); }
      c.restore();
      c.fillStyle = '#ffe8a3'; c.beginPath(); c.arc(T / 2, 5.5, 2.5, 0, 7); c.fill();
      break;
    }
    case 'jump_pad': {
      rr(c, 0.5, 6, T - 1, T - 6.5, 4); c.fillStyle = grad(c, 6, T, '#3a4263', '#232843'); c.fill();
      c.shadowColor = '#67e8f9'; c.shadowBlur = 8;
      rr(c, 1, 2, T - 2, 6, 3); c.fillStyle = '#67e8f9'; c.fill();
      c.strokeStyle = '#67e8f9'; c.lineWidth = 2.5; c.lineCap = 'round';
      for (const y of [16, 23]) { c.beginPath(); c.moveTo(9, y + 3); c.lineTo(16, y - 3); c.lineTo(23, y + 3); c.stroke(); }
      break;
    }
    case 'spike_trap': {
      c.fillStyle = '#3a4263'; rr(c, 0, T - 6, T, 6, 2); c.fill();
      for (let i = 0; i < 4; i++) {
        const x = i * 8;
        tri(c, x, T - 5, x + 8, T - 5, x + 4, 9, '#c9d2e6');
        tri(c, x + 4, T - 5, x + 8, T - 5, x + 4, 9, '#8d97b0');
        tri(c, x + 2.5, 14, x + 5.5, 14, x + 4, 9, '#ff5d73');
      }
      break;
    }
    case 'turret': {
      rr(c, 2, 12, T - 4, T - 12, 4); c.fillStyle = grad(c, 12, T, '#59627f', '#2d3350'); c.fill();
      c.strokeStyle = '#1b1f33'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#1b1f33'; c.fillRect(12, 6, 8, 8);
      c.shadowColor = '#ffb347'; c.shadowBlur = 8;
      c.fillStyle = '#ffb347'; c.fillRect(6, 22, T - 12, 3);
      break;
    }
    default:
      break;
  }
  c.restore();
}

// ------------------------------------------------------------------ herói

export const PLAYER_FRAME = { width: 48, height: 48 };
/** Quadro inicial e quantidade de quadros de cada animação na tira. */
export const PLAYER_ANIMS = {
  idle: { start: 0, count: 4, rate: 6, repeat: -1 },
  run: { start: 4, count: 8, rate: 16, repeat: -1 },
  jump: { start: 12, count: 1, rate: 1, repeat: 0 },
  fall: { start: 13, count: 1, rate: 1, repeat: 0 },
  attack: { start: 14, count: 4, rate: 26, repeat: 0 },
  hurt: { start: 18, count: 1, rate: 1, repeat: 0 },
} as const;
export const PLAYER_FRAME_COUNT = 19;
export type PlayerAnim = keyof typeof PLAYER_ANIMS;

export function drawPlayer(c: Ctx, anim: PlayerAnim, i: number): void {
  let bob = 0, legF = 0.12, legB = -0.12, armF = 0.3, armB = -0.25, lean = 0, blade = 2.5, slashFrom = -1;
  if (anim === 'idle') bob = [0, 0.6, 1, 0.6][i];
  else if (anim === 'run') {
    const t = (i / 8) * Math.PI * 2;
    legF = Math.sin(t) * 0.95; legB = -legF; armF = -Math.sin(t) * 0.7 + 0.25; armB = Math.sin(t) * 0.7;
    bob = -Math.abs(Math.cos(t)) * 1.6; lean = 1.2; blade = 2.2;
  } else if (anim === 'jump') { legF = 0.75; legB = -0.35; armF = 2.6; armB = -0.9; bob = -1; blade = 2.9; }
  else if (anim === 'fall') { legF = -0.3; legB = 0.55; armF = 2.2; armB = -2.2; blade = 2.6; }
  else if (anim === 'attack') {
    const sweep = [2.9, 2.0, 1.15, 0.7];
    armF = sweep[i]; blade = sweep[i]; lean = 1.6; legF = 0.5; legB = -0.5;
    slashFrom = i > 0 ? sweep[i - 1] : -1;
  } else if (anim === 'hurt') { lean = -2.2; armF = 2.7; armB = -2.4; legF = 0.5; legB = -0.55; bob = 1; blade = 3.3; }

  const hx = 24 + lean, hy = 33 + bob;
  const dark = '#2a3966', body = '#4466b8', light = '#7ea6ff';
  c.save();
  limb(c, hx - 1, hy, 12, legB, 5, dark);
  limb(c, hx - 2, hy - 12, 10, armB, 4, dark);
  // cachecol
  c.fillStyle = '#f43f5e';
  c.beginPath();
  c.moveTo(hx - 2, hy - 15); c.lineTo(hx - 15 - lean * 1.5, hy - 13 + (i % 2) * 2); c.lineTo(hx - 12 - lean, hy - 9 - (i % 2)); c.lineTo(hx - 2, hy - 11);
  c.closePath(); c.fill();
  // tronco
  rr(c, hx - 6, hy - 16, 12, 18, 5); c.fillStyle = grad(c, hy - 16, hy + 2, light, body); c.fill();
  c.fillStyle = '#4f8cff'; c.fillRect(hx - 1, hy - 12, 4, 7);
  // cabeça e visor
  c.fillStyle = body; c.beginPath(); c.arc(hx + 1 + lean * 0.6, hy - 22, 7.5, 0, 7); c.fill();
  c.save(); c.shadowColor = '#67e8f9'; c.shadowBlur = 6;
  rr(c, hx + 1 + lean * 0.6, hy - 25, 7, 5, 2); c.fillStyle = '#67e8f9'; c.fill(); c.restore();
  limb(c, hx + 1, hy, 12, legF, 5, body);
  // braço da frente + lâmina
  const sx = hx + 2, sy = hy - 12;
  if (slashFrom >= 0) {
    c.save(); c.strokeStyle = 'rgba(103,232,249,0.55)'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.arc(sx, sy, 22, Math.PI / 2 - slashFrom, Math.PI / 2 - armF); c.stroke(); c.restore();
  }
  const [ax, ay] = limb(c, sx, sy, 8, armF, 4, light);
  c.save(); c.shadowColor = '#67e8f9'; c.shadowBlur = 8;
  limb(c, ax, ay, 17, blade, 3, '#e6fbff'); c.restore();
  c.restore();
}

// ---------------------------------------------------------------- inimigos

/** Cada inimigo: 4 quadros de caminhada + 1 de ataque. */
export const ENEMY_FRAME_COUNT = 5;

export function drawEnemy(c: Ctx, type: EnemyType, i: number): void {
  const attack = i === 4;
  const t = (i / 4) * Math.PI * 2;
  const sw = attack ? 0.3 : Math.sin(t);
  c.save();
  if (type === 'basic') {
    const by = 21 - Math.abs(Math.cos(t)) * 1.5;
    limb(c, 17, 30, 8, sw * 0.7, 5, '#3c2378'); limb(c, 27, 30, 8, -sw * 0.7, 5, '#3c2378');
    tri(c, 11, 13, 16, 3, 20, 12, '#e9d5ff'); tri(c, 25, 12, 30, 3, 33, 13, '#e9d5ff');
    const g = c.createRadialGradient(18, by - 5, 2, 22, by, 15);
    g.addColorStop(0, '#c4a1ff'); g.addColorStop(1, '#6d3fd1');
    c.fillStyle = g; c.beginPath(); c.arc(22, by, 13, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(27, by - 3, 5, 0, 7); c.fill();
    c.fillStyle = '#1a0f33'; c.beginPath(); c.arc(29, by - 3, 2.4, 0, 7); c.fill();
    if (attack) {
      c.fillStyle = '#1a0f33'; c.beginPath(); c.arc(27, by + 6, 5, 0, Math.PI); c.fill();
      tri(c, 23, by + 6, 26, by + 6, 24.5, by + 9, '#fff'); tri(c, 28, by + 6, 31, by + 6, 29.5, by + 9, '#fff');
    } else { c.strokeStyle = '#1a0f33'; c.lineWidth = 2; c.beginPath(); c.moveTo(23, by + 6); c.lineTo(31, by + 5); c.stroke(); }
  } else if (type === 'fast') {
    const by = 16 - Math.abs(Math.cos(t));
    for (const [x, s] of [[13, sw], [19, -sw], [29, -sw], [35, sw]] as Array<[number, number]>) limb(c, x, by + 4, 10, s * 0.9, 3, '#7a2a10');
    tri(c, 8, by, 0, by - 5, 9, by + 4, '#e2571e');
    for (const x of [14, 21, 28]) tri(c, x, by - 6, x + 3, by - 13, x + 7, by - 6, '#ffd166');
    c.fillStyle = grad(c, by - 8, by + 8, '#ffb15c', '#e2571e');
    c.beginPath(); c.ellipse(23, by, 16, 8, 0, 0, 7); c.fill();
    tri(c, 36, by - 6, 47, by + (attack ? -2 : 1), 36, by + 6, '#e2571e');
    c.save(); c.shadowColor = '#fff3a3'; c.shadowBlur = 5;
    tri(c, 31, by - 4, 38, by - 2, 31, by, '#fff3a3'); c.restore();
    if (attack) tri(c, 38, by + 2, 46, by + 2, 41, by + 7, '#fff');
  } else {
    const by = 30 - Math.abs(Math.cos(t)) * 1.2;
    limb(c, 24, 50, 10, sw * 0.4, 12, '#22302a'); limb(c, 44, 50, 10, -sw * 0.4, 12, '#22302a');
    limb(c, 14, by - 8, 20, attack ? 1.9 : -0.15 + sw * 0.2, 11, '#3d5548');
    rr(c, 12, by - 20, 44, 42, 10); c.fillStyle = grad(c, by - 20, by + 22, '#7a9d87', '#33483d'); c.fill();
    c.strokeStyle = '#1c2a22'; c.lineWidth = 2; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.14)'; rr(c, 17, by - 15, 34, 9, 4); c.fill();
    c.fillStyle = '#2a3b32'; rr(c, 17, by + 2, 34, 6, 3); c.fill(); rr(c, 17, by + 11, 34, 6, 3); c.fill();
    tri(c, 12, by - 12, 6, by - 24, 20, by - 18, '#c9d2e6'); tri(c, 56, by - 12, 62, by - 24, 48, by - 18, '#c9d2e6');
    rr(c, 30, by - 30, 20, 14, 5); c.fillStyle = '#4a6657'; c.fill();
    c.save(); c.shadowColor = '#ff5d73'; c.shadowBlur = 8; c.fillStyle = '#ff5d73';
    c.fillRect(40, by - 25, 7, 3); c.restore();
    limb(c, 52, by - 8, 21, attack ? 1.7 : 0.2 - sw * 0.2, 12, '#55735f');
  }
  c.restore();
}

// ------------------------------------------------------------------ outros

export function drawBullet(c: Ctx): void {          // 18×8
  c.save(); c.shadowColor = '#67e8f9'; c.shadowBlur = 6;
  rr(c, 1, 2, 16, 4, 2); c.fillStyle = '#e6fbff'; c.fill(); c.restore();
}

export function drawTurretBullet(c: Ctx): void {    // 10×10
  c.save(); c.shadowColor = '#ffb347'; c.shadowBlur = 6;
  c.fillStyle = '#ffe1a8'; c.beginPath(); c.arc(5, 5, 3, 0, 7); c.fill(); c.restore();
}

export function drawSpark(c: Ctx): void {           // 8×8
  const g = c.createRadialGradient(4, 4, 0, 4, 4, 4);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 8, 8);
}

export function drawGlow(c: Ctx): void {            // 64×64
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
}

export function drawPickup(c: Ctx): void {          // 16×16
  c.save(); c.shadowColor = '#ffd166'; c.shadowBlur = 5;
  c.fillStyle = '#ffb347';
  c.beginPath(); c.moveTo(8, 1); c.lineTo(14, 5); c.lineTo(14, 11); c.lineTo(8, 15); c.lineTo(2, 11); c.lineTo(2, 5); c.closePath(); c.fill();
  c.restore();
  c.fillStyle = '#fff3c4'; c.beginPath(); c.moveTo(8, 3); c.lineTo(12, 6); c.lineTo(8, 8); c.lineTo(4, 6); c.closePath(); c.fill();
}

export function drawTurretHead(c: Ctx): void {      // 34×16, apontando para a direita
  rr(c, 12, 5, 21, 6, 2); c.fillStyle = '#8d97b0'; c.fill();
  c.fillStyle = '#ffb347'; c.fillRect(29, 6, 4, 4);
  c.fillStyle = grad(c, 0, 16, '#7f8aa8', '#3d4566'); c.beginPath(); c.arc(9, 8, 8, 0, 7); c.fill();
  c.fillStyle = '#ffb347'; c.beginPath(); c.arc(9, 8, 3, 0, 7); c.fill();
}

export function drawPortal(c: Ctx): void {          // 56×80
  const g = c.createRadialGradient(28, 40, 4, 28, 40, 38);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, 'rgba(180,120,255,0.8)'); g.addColorStop(1, 'rgba(110,60,220,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(28, 40, 24, 38, 0, 0, 7); c.fill();
  c.strokeStyle = 'rgba(220,190,255,0.9)'; c.lineWidth = 2; c.beginPath(); c.ellipse(28, 40, 15, 28, 0, 0, 7); c.stroke();
}

export function drawCrack(c: Ctx, stage: number): void {   // 32×32, estágio 0 ou 1
  c.strokeStyle = 'rgba(8,10,20,0.75)'; c.lineWidth = 2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(15, 3); c.lineTo(12, 11); c.lineTo(18, 16); c.lineTo(14, 24);
  if (stage > 0) { c.moveTo(18, 16); c.lineTo(27, 19); c.moveTo(12, 11); c.lineTo(4, 14); c.moveTo(14, 24); c.lineTo(20, 30); }
  c.stroke();
}

// ------------------------------------------------------------------ fundos

export function drawSky(c: Ctx, w: number, h: number): void {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#070b1f'); g.addColorStop(0.55, '#1d1b47'); g.addColorStop(1, '#52306b');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 110; i++) {
    c.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.6})`;
    c.beginPath(); c.arc(rnd() * w, rnd() * h * 0.7, rnd() * 1.3 + 0.3, 0, 7); c.fill();
  }
  const m = c.createRadialGradient(w * 0.76, h * 0.24, 10, w * 0.76, h * 0.24, 150);
  m.addColorStop(0, 'rgba(255,240,220,0.5)'); m.addColorStop(1, 'rgba(255,240,220,0)');
  c.fillStyle = m; c.fillRect(0, 0, w, h);
  c.fillStyle = '#fff4e0'; c.beginPath(); c.arc(w * 0.76, h * 0.24, 42, 0, 7); c.fill();
  c.fillStyle = 'rgba(200,180,170,0.5)';
  for (const [x, y, r] of [[-12, -8, 9], [14, 10, 6], [8, -18, 4]]) { c.beginPath(); c.arc(w * 0.76 + x, h * 0.24 + y, r, 0, 7); c.fill(); }
}

/** Silhueta que emenda sem costura (senos com período igual à largura). */
export function drawRidge(c: Ctx, w: number, h: number, color: string, base: number, a1: number, a2: number, k1: number, k2: number, ph: number): void {
  c.fillStyle = color;
  c.beginPath(); c.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) {
    const u = (x / w) * Math.PI * 2;
    c.lineTo(x, h - (base + a1 * Math.sin(u * k1 + ph) + a2 * Math.sin(u * k2 + ph * 2.3)));
  }
  c.lineTo(w, h); c.closePath(); c.fill();
}

export function drawRuins(c: Ctx, w: number, h: number): void {
  drawRidge(c, w, h, '#10142e', 70, 18, 10, 3, 7, 4.1);
  let seed = 31;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 9; i++) {
    const x = 30 + i * (w / 9) + rnd() * 30, ph = 90 + rnd() * 130, pw = 22 + rnd() * 18;
    c.fillStyle = '#10142e';
    c.fillRect(x, h - 60 - ph, pw, ph + 60);
    c.fillRect(x - 6, h - 60 - ph, pw + 12, 10);
    if (i % 3 === 0) c.fillRect(x, h - 60 - ph + 26, w / 9 + 20, 12);
    c.fillStyle = 'rgba(255,190,110,0.55)';
    if (i % 2 === 0) c.fillRect(x + pw / 2 - 3, h - 60 - ph + 44, 6, 12);
  }
}
