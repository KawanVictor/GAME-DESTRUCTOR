import type Phaser from 'phaser';
import { TILE } from '../../config';
import { blockById, BUILDABLE } from '../../data/blocks';
import type { Enemy } from '../../entities/Enemy';
import { audio } from '../../services';
import { FAILURE_TEXT } from '../../systems/BuildingSystem';
import type { BlockId, BuildCheck, BuildContext, BuildEvent } from '../../types/game';
import { BuildMenu, type BuildTool } from '../../ui/BuildMenu';
import type { TileView } from '../../world/TileView';
import type { TurretManager } from '../../world/TurretManager';
import type { CombatController } from './CombatController';
import type { GameContext } from './GameContext';
import type { InputController } from './InputController';
import type { PickupController } from './PickupController';

const BLOCK_TINT: Record<string, number> = {
  crate: 0xd9a066, wood_platform: 0xd9a066, stone_block: 0xa3acc2, defensive_wall: 0x5d79b8,
  explosive_block: 0xf0575c, jump_pad: 0x67e8f9, spike_trap: 0xc9d2e6, turret: 0xffb347,
  ice_trap: 0x9fe7ff, cannon: 0xff7a3d, core: 0x67e8f9, bridge: 0xb9824a,
};

export interface BuildEvents {
  /** Uma peça do jogador foi construída. */
  onPiecePlaced?(id: BlockId): void;
  /** O núcleo foi destruído. */
  onCoreDestroyed?(): void;
}

/**
 * Construção durante a partida: a ferramenta escolhida, a prévia sob o
 * cursor, a confirmação por clique e a reação visual a cada mudança da grade
 * (tilemap, torretas, efeitos). As regras ficam em BuildingSystem.
 */
export class BuildController {
  private tool: BuildTool = { kind: 'none' };
  private readonly menu: BuildMenu;
  private readonly ghost: Phaser.GameObjects.Image;
  private readonly outline: Phaser.GameObjects.Graphics;

  constructor(
    private readonly ctx: GameContext,
    private readonly view: TileView,
    private readonly turrets: TurretManager,
    private readonly combat: CombatController,
    private readonly pickups: PickupController,
    private readonly events: BuildEvents = {},
  ) {
    this.menu = new BuildMenu((tool) => this.pickTool(tool));
    this.ghost = ctx.scene.add.image(0, 0, 'tiles', 0).setOrigin(0).setAlpha(0.6).setDepth(30).setVisible(false);
    this.outline = ctx.scene.add.graphics().setDepth(31);
    ctx.match.building.on((e) => this.onBuildEvent(e));
  }

  get open(): boolean {
    return this.menu.open;
  }

  /** O menu está aberto ou há uma ferramenta ativa. */
  get busy(): boolean {
    return this.menu.open || this.tool.kind !== 'none';
  }

  setOpen(open: boolean): void {
    if (this.ctx.ended) return;
    this.menu.setOpen(open);
    if (!open) this.tool = { kind: 'none' };
    audio.play('click');
  }

  /** Fecha tudo sem som (fim de partida). */
  close(): void {
    this.menu.setOpen(false);
    this.tool = { kind: 'none' };
  }

  pickTool(tool: BuildTool): void {
    if (this.ctx.ended) return;
    // Escolher de novo a ferramenta já ativa desfaz a seleção.
    const same = tool.kind === this.tool.kind && (tool.kind !== 'piece' || (this.tool.kind === 'piece' && tool.id === this.tool.id));
    this.tool = same && tool.kind !== 'none' ? { kind: 'none' } : tool;
    if (this.tool.kind !== 'none' && !this.menu.open) this.menu.setOpen(true);
    audio.play('click');
  }

  /** Atalhos de teclado da construção. */
  handleHotkeys(input: InputController): void {
    if (input.pressed('build')) this.setOpen(!this.menu.open);
    // Demolir e reparar alternam a ferramenta (e abrem o menu se preciso).
    for (const kind of ['demolish', 'repair'] as const) {
      if (input.pressed(kind)) this.pickTool(this.tool.kind === kind ? { kind: 'none' } : { kind });
    }
    BUILDABLE.forEach((def, i) => {
      if (input.digitPressed(i) && this.menu.open) this.pickTool({ kind: 'piece', id: def.id });
    });
  }

  /** Clique ou toque no cenário. */
  onPointerDown(p: Phaser.Input.Pointer): void {
    if (p.rightButtonDown()) {
      // Botão direito: cancela a prévia; sem prévia, fecha o menu.
      if (this.tool.kind !== 'none') this.pickTool({ kind: 'none' });
      else this.setOpen(false);
      return;
    }
    this.confirm(p);
  }

  private buildContext(): BuildContext {
    return {
      player: this.ctx.player.rect,
      enemies: (this.ctx.enemies.getChildren() as Enemy[]).filter((e) => e.alive).map((e) => e.rect),
    };
  }

  private pointerCell(p: Phaser.Input.Pointer): { x: number; y: number } {
    const wp = this.ctx.scene.cameras.main.getWorldPoint(p.x, p.y);
    return { x: Math.floor(wp.x / TILE), y: Math.floor(wp.y / TILE) };
  }

  /** Clique esquerdo com uma ferramenta ativa: confirma a ação na célula sob o cursor. */
  private confirm(p: Phaser.Input.Pointer): void {
    if (this.tool.kind === 'none') return;
    const cell = this.pointerCell(p);
    const b = this.ctx.match.building;
    const bc = this.buildContext();
    let r: Pick<BuildCheck, 'ok' | 'reason'>;
    if (this.tool.kind === 'piece') r = b.place(this.tool.id, cell.x, cell.y, bc);
    else if (this.tool.kind === 'repair') r = b.repair(cell.x, cell.y, bc);
    else r = b.remove(cell.x, cell.y, bc);
    if (!r.ok && r.reason) { this.ctx.hud.toast(FAILURE_TEXT[r.reason]); audio.play('deny'); }
  }

  /** A cada quadro: fantasma da peça sob o cursor (verde se válida, vermelho com o motivo se não) e estado do menu. */
  update(): void {
    this.menu.update(this.tool, this.ctx.match.resources.value);
    this.outline.clear();
    this.ghost.setVisible(false);
    if (this.tool.kind === 'none' || this.ctx.ended || this.ctx.paused) {
      this.ctx.hud.tip(null);
      return;
    }
    const cell = this.pointerCell(this.ctx.scene.input.activePointer);
    const b = this.ctx.match.building;
    const bc = this.buildContext();
    let ok: boolean;
    let text: string;
    if (this.tool.kind === 'piece') {
      const def = blockById(this.tool.id);
      const r = b.check(this.tool.id, cell.x, cell.y, bc);
      ok = r.ok;
      text = ok ? `${def.name} — custo ${r.cost} · clique para construir` : `${def.name} (${r.cost}) — ${FAILURE_TEXT[r.reason ?? 'occupied']}`;
      this.ghost.setFrame(def.index).setPosition(cell.x * TILE, cell.y * TILE).setVisible(true).setTint(ok ? 0xaaffcc : 0xff8a8a);
    } else if (this.tool.kind === 'repair') {
      const r = b.checkRepair(cell.x, cell.y, bc);
      ok = r.ok;
      text = ok ? `Reparar ${b.get(cell.x, cell.y).name} — custo ${r.cost}` : FAILURE_TEXT[r.reason ?? 'nothing_to_remove'];
    } else {
      const r = b.checkRemove(cell.x, cell.y, bc);
      ok = r.ok;
      text = ok ? `Demolir ${b.get(cell.x, cell.y).name} — devolve ${r.refund}` : FAILURE_TEXT[r.reason ?? 'nothing_to_remove'];
    }
    this.outline.lineStyle(2, ok ? 0x4ee3a4 : 0xff5d73, 1);
    this.outline.strokeRect(cell.x * TILE + 1, cell.y * TILE + 1, TILE - 2, TILE - 2);
    this.ctx.hud.tip(text, ok);
  }

  /** Reage às mudanças da grade: tilemap, colisão, torretas e efeitos. */
  private onBuildEvent(e: BuildEvent): void {
    const { fx, match } = this.ctx;
    const cx = e.x * TILE + TILE / 2;
    const cy = e.y * TILE + TILE / 2;
    const tint = BLOCK_TINT[e.block.id] ?? 0xffffff;
    switch (e.type) {
      case 'placed':
        this.view.sync(e.x, e.y);
        if (e.block.trap === 'turret' || e.block.trap === 'cannon') this.turrets.add(e.x, e.y, e.block.trap);
        match.blocksPlaced++;
        this.events.onPiecePlaced?.(e.block.id);
        fx.pop(cx, cy, e.block.index);
        fx.burst(cx, cy + TILE / 2, 0xcfd6ee, 6);
        audio.play('place');
        break;
      case 'removed':
        this.view.sync(e.x, e.y);
        this.turrets.remove(e.x, e.y);
        fx.burst(cx, cy, tint, 6);
        if (e.refund > 0) fx.number(cx, cy - 10, `+${e.refund}`, '#ffd166');
        audio.play('remove');
        break;
      case 'repaired':
        this.view.setDamage(e.x, e.y);
        fx.spark(cx, cy, 0x4ee3a4, 10);
        fx.number(cx, cy - 10, `-${e.cost}`, '#4ee3a4');
        audio.play('place');
        break;
      case 'damaged':
        this.view.setDamage(e.x, e.y);
        break;
      case 'destroyed':
        this.view.sync(e.x, e.y);
        this.turrets.remove(e.x, e.y);
        fx.burst(cx, cy, tint, 14);
        audio.play('break');
        if (e.block.drops) for (let i = 0; i < 3; i++) this.pickups.drop(cx, cy, Math.round(e.block.drops / 3));
        if (e.block.core) this.events.onCoreDestroyed?.();
        break;
      case 'explosion':
        this.combat.explode(e.x, e.y, e.explosive);
        break;
    }
  }

  refreshKeys(): void {
    this.menu.refreshKeys();
  }

  destroy(): void {
    this.ctx.match.building.clearListeners();
    this.menu.destroy();
  }
}
