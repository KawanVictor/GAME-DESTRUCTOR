import { BUILD, REPAIR, TILE } from '../config';
import { blockById, blockByIndex, EMPTY } from '../data/blocks';
import type {
  BlockDef, BlockId, BuildCheck, BuildContext, BuildEvent, BuildFailure, LevelData, Rect, RemoveResult,
} from '../types/game';
import type { ResourceSystem } from './ResourceSystem';

export const FAILURE_TEXT: Record<BuildFailure, string> = {
  out_of_bounds: 'Fora dos limites do mapa',
  not_buildable: 'Peça não construível',
  occupied: 'Espaço ocupado',
  insufficient_resources: 'Materiais insuficientes',
  needs_support: 'Precisa encostar em outra estrutura',
  needs_floor: 'Precisa de uma base sólida embaixo',
  entity_in_way: 'Há alguém no caminho',
  out_of_reach: 'Fora de alcance',
  would_trap_player: 'Isso prenderia o herói',
  protected_zone: 'Área protegida (portal inimigo)',
  nothing_to_remove: 'Não há peça aqui',
  not_owned: 'Essa peça não é sua',
  not_damaged: 'A peça já está inteira',
  core_locked: 'O núcleo não pode ser demolido',
};

/**
 * Grade lógica de construção: quem decide o que pode ser colocado, quanto
 * custa, quanto resiste e o que acontece ao ser destruído. Não conhece o
 * Phaser — a cena escuta os eventos e atualiza tilemap, colisão e efeitos.
 */
export class BuildingSystem {
  readonly cols: number;
  readonly rows: number;
  private readonly cells: Uint8Array;
  private readonly hp: Float32Array;
  /** 1 = peça colocada pelo jogador (pode ser demolida por ele). */
  private readonly owned: Uint8Array;
  private readonly protectedZones: LevelData['protectedZones'];
  private listeners: Array<(e: BuildEvent) => void> = [];

  constructor(level: LevelData, private readonly resources: ResourceSystem) {
    this.cols = level.cols;
    this.rows = level.rows;
    this.cells = new Uint8Array(level.cells);
    this.hp = new Float32Array(this.cells.length);
    this.owned = new Uint8Array(this.cells.length);
    this.protectedZones = level.protectedZones;
    for (let i = 0; i < this.cells.length; i++) {
      const def = blockByIndex(this.cells[i]);
      this.hp[i] = Number.isFinite(def.maxHp) ? def.maxHp : 0;
    }
  }

  on(listener: (e: BuildEvent) => void): void {
    this.listeners.push(listener);
  }

  clearListeners(): void {
    this.listeners = [];
  }

  private emit(e: BuildEvent): void {
    for (const l of this.listeners) l(e);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  private idx(x: number, y: number): number {
    return y * this.cols + x;
  }

  get(x: number, y: number): BlockDef {
    return this.inBounds(x, y) ? blockByIndex(this.cells[this.idx(x, y)]) : EMPTY;
  }

  hpAt(x: number, y: number): number {
    return this.inBounds(x, y) ? this.hp[this.idx(x, y)] : 0;
  }

  isOwned(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.owned[this.idx(x, y)] === 1;
  }

  /** A célula bloqueia a passagem deste tipo de ator? (fora do mapa = sim) */
  blocks(actor: 'player' | 'enemy', x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    const c = this.get(x, y).collision;
    return c === 'solid' || (c === 'enemy_only' && actor === 'enemy');
  }

  /** Linha de visão entre dois pontos do mundo (px), barrada por blocos sólidos. */
  hasLineOfSight(x0: number, y0: number, x1: number, y1: number, ignore?: { x: number; y: number }): boolean {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (TILE / 2)));
    for (let i = 1; i < steps; i++) {
      const cx = Math.floor((x0 + (dx * i) / steps) / TILE);
      const cy = Math.floor((y0 + (dy * i) / steps) / TILE);
      if (ignore && ignore.x === cx && ignore.y === cy) continue;
      if (this.get(cx, cy).collision === 'solid') return false;
    }
    return true;
  }

  // ------------------------------------------------------------ construção

  /** Valida uma colocação sem alterar nada. */
  check(id: BlockId, x: number, y: number, ctx: BuildContext): BuildCheck {
    const def = blockById(id);
    const fail = (reason: BuildFailure): BuildCheck => ({ ok: false, cost: def.cost, reason });
    if (!def.buildable) return fail('not_buildable');
    if (!this.inBounds(x, y)) return fail('out_of_bounds');
    if (this.get(x, y).id !== 'empty') return fail('occupied');
    for (const z of this.protectedZones) {
      if (Math.abs(x - z.x) <= z.radius && Math.abs(y - z.y) <= z.radius) return fail('protected_zone');
    }
    if (!this.inReach(x, y, ctx.player)) return fail('out_of_reach');

    if (def.requiresFloor) {
      if (this.get(x, y + 1).collision !== 'solid') return fail('needs_floor');
    } else if (!this.hasSupport(x, y)) {
      return fail('needs_support');
    }

    const cell: Rect = { x: x * TILE, y: y * TILE, width: TILE, height: TILE };
    if (def.collision === 'solid' && overlaps(cell, ctx.player)) return fail('entity_in_way');
    if (def.collision === 'solid' || def.collision === 'enemy_only') {
      for (const e of ctx.enemies) if (overlaps(cell, e)) return fail('entity_in_way');
    }
    if (def.collision === 'solid' && this.wouldTrapPlayer(x, y, ctx.player)) return fail('would_trap_player');
    if (!this.resources.canAfford(def.cost)) return fail('insufficient_resources');
    return { ok: true, cost: def.cost };
  }

  /** Coloca a peça se for válida. Os materiais só saem quando dá certo. */
  place(id: BlockId, x: number, y: number, ctx: BuildContext): BuildCheck {
    const result = this.check(id, x, y, ctx);
    if (!result.ok) return result;
    const def = blockById(id);
    if (!this.resources.spend(def.cost)) return { ok: false, cost: def.cost, reason: 'insufficient_resources' };
    this.setCell(x, y, def, true);
    this.emit({ type: 'placed', x, y, block: def });
    return result;
  }

  private inReach(x: number, y: number, player: Rect): boolean {
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    return Math.hypot((x + 0.5) * TILE - px, (y + 0.5) * TILE - py) <= BUILD.reach * TILE;
  }

  /** Sem peças flutuando: precisa de um vizinho (4 direções) já existente. */
  private hasSupport(x: number, y: number): boolean {
    const n: Array<[number, number]> = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    return n.some(([nx, ny]) => this.inBounds(nx, ny) && this.get(nx, ny).id !== 'empty' && !this.get(nx, ny).trap);
  }

  /**
   * Simula a peça sólida em (x, y) e conta, por inundação, quantas células
   * livres o herói ainda alcança. Poucas demais = ele ficaria emparedado.
   */
  private wouldTrapPlayer(x: number, y: number, player: Rect): boolean {
    const sx = Math.floor((player.x + player.width / 2) / TILE);
    let sy = Math.floor((player.y + player.height / 2) / TILE);
    if (this.blocks('player', sx, sy)) sy -= 1;
    const seen = new Set<number>([this.idx(sx, sy)]);
    const queue: Array<[number, number]> = [[sx, sy]];
    while (queue.length && seen.size < BUILD.minFreeCells) {
      const [cx, cy] = queue.pop() as [number, number];
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as Array<[number, number]>) {
        if (!this.inBounds(nx, ny) || (nx === x && ny === y) || this.blocks('player', nx, ny)) continue;
        const k = this.idx(nx, ny);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
    return seen.size < BUILD.minFreeCells;
  }

  // ------------------------------------------------------------- demolição

  /** Quanto a demolição devolveria: metade do custo, proporcional à resistência restante. */
  refundFor(x: number, y: number): number {
    const def = this.get(x, y);
    if (!this.isOwned(x, y) || !Number.isFinite(def.maxHp)) return 0;
    const ratio = Math.max(0, Math.min(1, this.hpAt(x, y) / def.maxHp));
    return Math.floor(def.cost * BUILD.refundRatio * ratio);
  }

  checkRemove(x: number, y: number, ctx: BuildContext): RemoveResult {
    const fail = (reason: BuildFailure): RemoveResult => ({ ok: false, refund: 0, reason });
    if (!this.inBounds(x, y)) return fail('out_of_bounds');
    if (this.get(x, y).id === 'empty') return fail('nothing_to_remove');
    if (this.get(x, y).core) return fail('core_locked');
    if (!this.isOwned(x, y)) return fail('not_owned');
    if (!this.inReach(x, y, ctx.player)) return fail('out_of_reach');
    return { ok: true, refund: this.refundFor(x, y) };
  }

  /** Demolição manual de uma peça do jogador, com reembolso parcial. */
  remove(x: number, y: number, ctx: BuildContext): RemoveResult {
    const result = this.checkRemove(x, y, ctx);
    if (!result.ok) return result;
    const def = this.get(x, y);
    this.setCell(x, y, EMPTY, false);
    this.resources.add(result.refund);
    this.emit({ type: 'removed', x, y, block: def, refund: result.refund });
    this.dropUnsupported(x, y - 1);
    return result;
  }

  // ---------------------------------------------------------------- reparo

  /** Custo para restaurar a peça: metade do custo dela, proporcional ao dano sofrido. */
  repairCost(x: number, y: number): number {
    const def = this.get(x, y);
    if (!this.isOwned(x, y) || !Number.isFinite(def.maxHp)) return 0;
    const missing = 1 - Math.max(0, Math.min(1, this.hpAt(x, y) / def.maxHp));
    return missing <= 0 ? 0 : Math.max(1, Math.ceil(def.cost * REPAIR.costRatio * missing));
  }

  checkRepair(x: number, y: number, ctx: BuildContext): BuildCheck {
    const cost = this.repairCost(x, y);
    const fail = (reason: BuildFailure): BuildCheck => ({ ok: false, cost, reason });
    if (!this.inBounds(x, y)) return fail('out_of_bounds');
    if (this.get(x, y).id === 'empty') return fail('nothing_to_remove');
    if (this.get(x, y).core) return fail('core_locked');
    if (!this.isOwned(x, y)) return fail('not_owned');
    if (!this.inReach(x, y, ctx.player)) return fail('out_of_reach');
    if (cost <= 0) return fail('not_damaged');
    if (!this.resources.canAfford(cost)) return fail('insufficient_resources');
    return { ok: true, cost };
  }

  /** Restaura toda a resistência de uma peça do jogador. */
  repair(x: number, y: number, ctx: BuildContext): BuildCheck {
    const result = this.checkRepair(x, y, ctx);
    if (!result.ok) return result;
    if (!this.resources.spend(result.cost)) return { ok: false, cost: result.cost, reason: 'insufficient_resources' };
    const def = this.get(x, y);
    this.hp[this.idx(x, y)] = def.maxHp;
    this.emit({ type: 'repaired', x, y, block: def, cost: result.cost });
    return result;
  }

  // ------------------------------------------------------------------ dano

  /** Aplica dano a um bloco. Blocos destruídos não devolvem materiais. */
  damage(x: number, y: number, amount: number): 'none' | 'damaged' | 'destroyed' {
    if (!this.inBounds(x, y) || !(amount > 0)) return 'none';
    const def = this.get(x, y);
    if (def.id === 'empty' || !Number.isFinite(def.maxHp)) return 'none';
    const i = this.idx(x, y);
    this.hp[i] -= amount;
    if (this.hp[i] > 0) {
      this.emit({ type: 'damaged', x, y, block: def, hp: this.hp[i] });
      return 'damaged';
    }
    this.destroy(x, y);
    return 'destroyed';
  }

  private destroy(x: number, y: number): void {
    // Fila em vez de recursão: explosões em cadeia não estouram a pilha.
    const pending: Array<[number, number]> = [[x, y]];
    while (pending.length) {
      const [cx, cy] = pending.shift() as [number, number];
      const def = this.get(cx, cy);
      if (def.id === 'empty') continue;
      this.setCell(cx, cy, EMPTY, false);
      this.emit({ type: 'destroyed', x: cx, y: cy, block: def });
      this.dropUnsupported(cx, cy - 1);
      if (!def.explosive) continue;
      this.emit({ type: 'explosion', x: cx, y: cy, block: def, explosive: def.explosive });
      const r = Math.ceil(def.explosive.radius);
      for (let ny = cy - r; ny <= cy + r; ny++) {
        for (let nx = cx - r; nx <= cx + r; nx++) {
          const d = Math.hypot(nx - cx, ny - cy);
          if (d === 0 || d > def.explosive.radius || !this.inBounds(nx, ny)) continue;
          const target = this.get(nx, ny);
          if (target.id === 'empty' || !Number.isFinite(target.maxHp)) continue;
          const i = this.idx(nx, ny);
          this.hp[i] -= def.explosive.blockDamage * (1 - (d / def.explosive.radius) * 0.6);
          if (this.hp[i] <= 0) pending.push([nx, ny]);
          else this.emit({ type: 'damaged', x: nx, y: ny, block: target, hp: this.hp[i] });
        }
      }
    }
  }

  /** Armadilhas que perderam a base caem junto (sem reembolso). */
  private dropUnsupported(x: number, y: number): void {
    const def = this.get(x, y);
    if (def.requiresFloor && this.get(x, y + 1).collision !== 'solid') this.destroy(x, y);
  }

  /**
   * Coloca uma estrutura fixa da partida (ex.: o núcleo) antes do jogo começar,
   * sem custo nem eventos. Ela conta como do jogador, para poder ser reparada.
   */
  placeStructure(x: number, y: number, id: BlockId): void {
    if (!this.inBounds(x, y)) throw new Error(`Estrutura fora do mapa: ${x},${y}`);
    this.setCell(x, y, blockById(id), true);
  }

  /** Células do jogador que atendem ao filtro (para a IA do Sabotador). */
  ownedCells(filter: (def: BlockDef) => boolean): Array<{ x: number; y: number }> {
    const out: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < this.owned.length; i++) {
      if (!this.owned[i]) continue;
      const def = blockByIndex(this.cells[i]);
      if (filter(def)) out.push({ x: i % this.cols, y: Math.floor(i / this.cols) });
    }
    return out;
  }

  private setCell(x: number, y: number, def: BlockDef, owned: boolean): void {
    const i = this.idx(x, y);
    this.cells[i] = def.index;
    this.hp[i] = Number.isFinite(def.maxHp) ? def.maxHp : 0;
    this.owned[i] = owned ? 1 : 0;
  }

  /** Quantidade de peças do jogador em pé (HUD/estatísticas/testes). */
  countOwned(): number {
    let n = 0;
    for (let i = 0; i < this.owned.length; i++) n += this.owned[i];
    return n;
  }

  /** Percorre todas as células não vazias. */
  forEach(fn: (x: number, y: number, def: BlockDef) => void): void {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const def = this.get(x, y);
        if (def.id !== 'empty') fn(x, y, def);
      }
    }
  }
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
