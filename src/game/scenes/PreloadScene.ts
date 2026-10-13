import Phaser from 'phaser';
import { TILE, VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import * as art from '../art/draw';
import { TILESET_FRAMES } from '../data/blocks';
import { ENEMY_DEFS } from '../data/enemies';
import type { EnemyType } from '../types/game';

type Ctx = CanvasRenderingContext2D;

/**
 * Gera todas as texturas e animações. Hoje tudo é desenhado por código
 * (art/draw.ts). Para usar arte final, carregue arquivos com as MESMAS
 * chaves em preload(): uma textura que já existe não é gerada de novo.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    // Um arquivo que falhe ao carregar não trava o jogo: o placeholder gerado assume.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`Recurso não carregado (${file.key}); usando arte gerada.`);
    });
  }

  create(): void {
    this.sheet('tiles', TILE, TILE, TILESET_FRAMES, (c, i) => art.drawTile(c, i));
    this.sheet('cracks', TILE, TILE, 2, (c, i) => art.drawCrack(c, i));

    const pf = art.PLAYER_FRAME;
    const order: Array<[art.PlayerAnim, number]> = [];
    for (const key of Object.keys(art.PLAYER_ANIMS) as art.PlayerAnim[]) {
      for (let i = 0; i < art.PLAYER_ANIMS[key].count; i++) order.push([key, i]);
    }
    this.sheet('player', pf.width, pf.height, art.PLAYER_FRAME_COUNT, (c, i) => art.drawPlayer(c, order[i][0], order[i][1]));
    for (const key of Object.keys(art.PLAYER_ANIMS) as art.PlayerAnim[]) {
      const a = art.PLAYER_ANIMS[key];
      this.anim(`player-${key}`, 'player', a.start, a.count, a.rate, a.repeat);
    }

    for (const type of Object.keys(ENEMY_DEFS) as EnemyType[]) {
      const f = ENEMY_DEFS[type].frame;
      this.sheet(`enemy-${type}`, f.width, f.height, art.ENEMY_FRAME_COUNT, (c, i) => art.drawEnemy(c, type, i));
      this.anim(`enemy-${type}-walk`, `enemy-${type}`, 0, 4, type === 'fast' ? 14 : type === 'tank' ? 5 : 8, -1);
    }

    this.single('bullet', 18, 8, art.drawBullet);
    this.single('turret-bullet', 10, 10, art.drawTurretBullet);
    this.single('spark', 8, 8, art.drawSpark);
    this.single('glow', 64, 64, art.drawGlow);
    this.single('pickup', 16, 16, art.drawPickup);
    this.single('turret-head', 34, 16, art.drawTurretHead);
    this.single('portal', 56, 80, art.drawPortal);
    this.single('bg-sky', VIEW_WIDTH, VIEW_HEIGHT, (c) => art.drawSky(c, VIEW_WIDTH, VIEW_HEIGHT));
    this.single('bg-far', 1024, 360, (c) => art.drawRidge(c, 1024, 360, '#181d44', 190, 70, 34, 2, 5, 1.3));
    this.single('bg-near', 1024, 320, (c) => art.drawRuins(c, 1024, 320));

    this.scene.start('Menu');
  }

  /** Tira de quadros em uma textura de canvas; os quadros são numerados de 0 em diante. */
  private sheet(key: string, fw: number, fh: number, count: number, draw: (c: Ctx, i: number) => void): void {
    if (this.textures.exists(key)) return;
    const tex = this.textures.createCanvas(key, fw * count, fh);
    if (!tex) throw new Error(`Não foi possível criar a textura "${key}"`);
    const ctx = tex.getContext();
    for (let i = 0; i < count; i++) {
      ctx.save();
      ctx.translate(i * fw, 0);
      ctx.beginPath();
      ctx.rect(0, 0, fw, fh);
      ctx.clip();
      draw(ctx, i);
      ctx.restore();
      tex.add(i, 0, i * fw, 0, fw, fh);
    }
    tex.refresh();
  }

  private single(key: string, w: number, h: number, draw: (c: Ctx) => void): void {
    this.sheet(key, w, h, 1, (c) => draw(c));
  }

  private anim(key: string, texture: string, start: number, count: number, frameRate: number, repeat: number): void {
    if (this.anims.exists(key)) return;
    const frames = Array.from({ length: count }, (_, i) => ({ key: texture, frame: start + i }));
    this.anims.create({ key, frames, frameRate, repeat });
  }
}
