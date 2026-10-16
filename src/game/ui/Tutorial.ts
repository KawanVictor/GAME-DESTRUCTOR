import { el, onClick, show } from './dom';
import { applyKeyLabels } from './keys';

/** O que o tutorial observa na partida para saber se o passo foi cumprido. */
export interface TutorialState {
  moved: boolean;
  buildOpen: boolean;
  placed: boolean;
  fighting: boolean;
  kills: number;
}

const STEPS: ReadonlyArray<{ html: string; done: (s: TutorialState) => boolean }> = [
  { html: 'Ande com <kbd data-key="left"></kbd> <kbd data-key="right"></kbd> e pule com <kbd data-key="jump"></kbd>.', done: (s) => s.moved },
  { html: 'Abra o menu de construção com <kbd data-key="build"></kbd> (ou o botão Construir).', done: (s) => s.buildOpen },
  { html: 'Escolha uma peça (teclas 1–9) e clique no cenário para construir. Torretas e espinhos ajudam muito.', done: (s) => s.placed },
  { html: 'Pronto? Comece a onda com <kbd data-key="startWave"></kbd>. Os inimigos saem dos portais nas pontas.', done: (s) => s.fighting },
  { html: 'Golpeie com <kbd data-key="melee"></kbd> e atire com <kbd data-key="shoot"></kbd>. Derrote um inimigo!', done: (s) => s.kills > 0 },
];

/** Dicas passo a passo da primeira partida. Some ao terminar ou ao pular. */
export class Tutorial {
  private readonly abort = new AbortController();
  private index = -1;
  private finished = false;

  constructor(private readonly onDone: () => void) {
    onClick(el('btn-tutorial-skip'), this.abort.signal, () => this.finish());
    this.next();
  }

  get active(): boolean {
    return !this.finished;
  }

  /** Passo atual (0 = primeiro). */
  get step(): number {
    return this.index;
  }

  update(state: TutorialState): void {
    if (this.finished) return;
    // Um passo já cumprido antes da hora (ex.: abriu o menu antes de andar) também conta.
    while (!this.finished && STEPS[this.index].done(state)) this.next();
  }

  private next(): void {
    this.index++;
    if (this.index >= STEPS.length) { this.finish(); return; }
    const box = el('tutorial-text');
    box.innerHTML = `<span class="muted">Dica ${this.index + 1}/${STEPS.length} —</span> ${STEPS[this.index].html}`;
    applyKeyLabels(box);
    show(el('tutorial'), true);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    show(el('tutorial'), false);
    this.onDone();
  }

  destroy(): void {
    this.abort.abort();
    show(el('tutorial'), false);
  }
}
