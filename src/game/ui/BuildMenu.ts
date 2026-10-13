import { TILE } from '../config';
import { drawTile } from '../art/draw';
import { BUILDABLE } from '../data/blocks';
import type { BlockId } from '../types/game';
import { el, onClick, show } from './dom';

export type BuildTool = { kind: 'none' } | { kind: 'piece'; id: BlockId } | { kind: 'demolish' };

/** Menu de construção: ícone, nome e custo de cada peça + ferramenta de demolição. */
export class BuildMenu {
  private readonly abort = new AbortController();
  private buttons = new Map<string, HTMLButtonElement>();
  private lastState = '';
  private baseDesc = '';
  open = false;

  constructor(private readonly onPick: (tool: BuildTool) => void) {
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
      b.addEventListener('pointerenter', () => this.describe(`${def.name} (${def.cost}) — ${def.description}`), { signal: this.abort.signal });
      b.addEventListener('pointerleave', () => this.describe(null), { signal: this.abort.signal });
      onClick(b, this.abort.signal, () => this.onPick({ kind: 'piece', id: def.id }));
      box.appendChild(b);
      this.buttons.set(def.id, b);
    });
    const d = document.createElement('button');
    d.className = 'piece tool';
    d.dataset.piece = 'demolish';
    d.title = 'Remove uma peça sua e devolve parte do custo.';
    d.setAttribute('aria-label', 'Demolir');
    d.innerHTML = '<span class="key">R</span><span class="glyph">✕</span><span class="cost">+50%</span>';
    onClick(d, this.abort.signal, () => this.onPick({ kind: 'demolish' }));
    box.appendChild(d);
    this.buttons.set('demolish', d);
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
    (this.buttons.get('demolish') as HTMLButtonElement).classList.toggle('selected', tool.kind === 'demolish');
    const picked = tool.kind === 'piece' ? BUILDABLE.find((b) => b.id === tool.id) : undefined;
    const desc = picked
      ? `${picked.name} (${picked.cost}) — ${picked.description}`
      : tool.kind === 'demolish'
        ? 'Clique em uma peça sua para demolir. Devolve metade do custo, menos o desgaste.'
        : 'Escolha uma peça (1–7) e clique no cenário. Botão direito cancela.';
    this.baseDesc = desc;
    this.describe(null);
  }

  /** Mostra a descrição da peça sob o cursor; null volta à da seleção atual. */
  private describe(text: string | null): void {
    el('build-desc').textContent = text ?? this.baseDesc;
  }

  destroy(): void {
    this.abort.abort();
    el('hud').classList.remove('building');
    show(el('build-menu'), false);
  }
}
