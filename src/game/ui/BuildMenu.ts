import { TILE } from '../config';
import { drawTile } from '../art/draw';
import { BUILDABLE } from '../data/blocks';
import type { BlockId } from '../types/game';
import { el, onClick, show } from './dom';
import { applyKeyLabels } from './keys';

export type BuildTool = { kind: 'none' } | { kind: 'piece'; id: BlockId } | { kind: 'demolish' } | { kind: 'repair' };

const TOOL_TEXT = {
  demolish: 'Clique em uma peça sua para demolir. Devolve metade do custo, menos o desgaste.',
  repair: 'Clique em uma peça sua danificada para restaurar a resistência.',
  none: 'Escolha uma peça (1–7) e clique no cenário. Botão direito cancela.',
} as const;

/** Menu de construção: ícone e custo de cada peça, mais as ferramentas de reparo e demolição. */
export class BuildMenu {
  private readonly abort = new AbortController();
  private buttons = new Map<string, HTMLButtonElement>();
  private lastState = '';
  private baseDesc = '';
  open = false;

  constructor(private readonly onPick: (tool: BuildTool) => void) {
    const s = this.abort.signal;
    const box = el('build-items');
    box.innerHTML = '';
    BUILDABLE.forEach((def, i) => {
      const b = document.createElement('button');
      b.className = 'piece';
      b.dataset.piece = def.id;
      b.title = def.description;
      const icon = document.createElement('canvas');
      icon.width = TILE;
      icon.height = TILE;
      const ctx = icon.getContext('2d');
      if (ctx) drawTile(ctx, def.index);
      b.append(icon);
      b.setAttribute('aria-label', `${def.name}, custo ${def.cost}`);
      b.insertAdjacentHTML('beforeend', `<span class="key">${i + 1}</span><span class="cost">${def.cost}</span>`);
      b.addEventListener('pointerenter', () => this.describe(`${def.name} (${def.cost}) — ${def.description}`), { signal: s });
      b.addEventListener('pointerleave', () => this.describe(null), { signal: s });
      onClick(b, s, () => this.onPick({ kind: 'piece', id: def.id }));
      box.appendChild(b);
      this.buttons.set(def.id, b);
    });
    const tool = (kind: 'repair' | 'demolish', glyph: string, label: string, cost: string): void => {
      const b = document.createElement('button');
      b.className = 'piece tool';
      b.dataset.piece = kind;
      b.title = TOOL_TEXT[kind];
      b.setAttribute('aria-label', label);
      b.innerHTML = `<span class="key" data-key="${kind}"></span><span class="glyph">${glyph}</span><span class="cost">${cost}</span>`;
      b.addEventListener('pointerenter', () => this.describe(`${label} — ${TOOL_TEXT[kind]}`), { signal: s });
      b.addEventListener('pointerleave', () => this.describe(null), { signal: s });
      onClick(b, s, () => this.onPick({ kind }));
      box.appendChild(b);
      this.buttons.set(kind, b);
    };
    tool('repair', '✚', 'Reparar', '½');
    tool('demolish', '✕', 'Demolir', '+50%');
    applyKeyLabels(box);
    show(el('build-menu'), false);
  }

  setOpen(open: boolean): void {
    this.open = open;
    show(el('build-menu'), open);
    el('hud').classList.toggle('building', open);
  }

  /** Atualiza seleção e destaca o que o jogador não pode pagar. */
  update(tool: BuildTool, resources: number): void {
    const key = `${tool.kind}:${tool.kind === 'piece' ? tool.id : ''}:${resources}`;
    if (key === this.lastState) return;
    this.lastState = key;
    for (const def of BUILDABLE) {
      const b = this.buttons.get(def.id) as HTMLButtonElement;
      b.classList.toggle('selected', tool.kind === 'piece' && tool.id === def.id);
      b.classList.toggle('poor', resources < def.cost);
    }
    for (const kind of ['repair', 'demolish'] as const) {
      (this.buttons.get(kind) as HTMLButtonElement).classList.toggle('selected', tool.kind === kind);
    }
    const picked = tool.kind === 'piece' ? BUILDABLE.find((b) => b.id === tool.id) : undefined;
    this.baseDesc = picked
      ? `${picked.name} (${picked.cost}) — ${picked.description}`
      : TOOL_TEXT[tool.kind === 'piece' ? 'none' : tool.kind];
    this.describe(null);
  }

  /** Mostra a descrição da peça sob o cursor; null volta à da seleção atual. */
  private describe(text: string | null): void {
    el('build-desc').textContent = text ?? this.baseDesc;
  }

  refreshKeys(): void {
    applyKeyLabels(el('build-items'));
  }

  destroy(): void {
    this.abort.abort();
    el('hud').classList.remove('building');
    show(el('build-menu'), false);
  }
}
