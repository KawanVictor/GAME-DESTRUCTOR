import { ENEMY_NAMES } from '../data/enemies';
import type { EnemyType } from '../types/game';
import { el, onClick, show } from './dom';

const ORDER: readonly EnemyType[] = ['basic', 'fast', 'flyer', 'tank', 'saboteur', 'spitter', 'healer', 'boss'];

/** Painel do modo Sandbox: chama inimigos de cada tipo e limpa o campo. */
export class SandboxPanel {
  private readonly abort = new AbortController();

  constructor(onSpawn: (type: EnemyType) => void, onClear: () => void) {
    const box = el('sandbox');
    box.innerHTML = '<span class="muted">Chamar:</span>';
    for (const type of ORDER) {
      const b = document.createElement('button');
      b.className = 'btn small';
      b.dataset.spawn = type;
      b.textContent = ENEMY_NAMES[type];
      onClick(b, this.abort.signal, () => onSpawn(type));
      box.appendChild(b);
    }
    const clear = document.createElement('button');
    clear.className = 'btn small';
    clear.dataset.spawn = 'clear';
    clear.textContent = 'Limpar';
    onClick(clear, this.abort.signal, onClear);
    box.appendChild(clear);
    show(box, true);
  }

  destroy(): void {
    this.abort.abort();
    show(el('sandbox'), false);
  }
}
