import Phaser from 'phaser';
import { save } from '../services';
import type { Action } from '../types/game';

export const ACTION_NAMES: Record<Action, string> = {
  left: 'Esquerda',
  right: 'Direita',
  down: 'Baixo',
  jump: 'Pular',
  melee: 'Golpe',
  shoot: 'Disparo',
  dash: 'Investida',
  build: 'Menu de construção',
  demolish: 'Demolir',
  repair: 'Reparar',
  startWave: 'Começar a onda',
};

const PRETTY: Record<string, string> = {
  SPACE: 'Espaço', LEFT: '←', RIGHT: '→', UP: '↑', DOWN: '↓', ENTER: 'Enter', SHIFT: 'Shift', CTRL: 'Ctrl', ALT: 'Alt',
  TAB: 'Tab', BACKSPACE: 'Backspace', COMMA: ',', PERIOD: '.', SEMICOLON: ';', QUOTES: "'", FORWARD_SLASH: '/',
  ZERO: '0', ONE: '1', TWO: '2', THREE: '3', FOUR: '4', FIVE: '5', SIX: '6', SEVEN: '7', EIGHT: '8', NINE: '9',
};

/** Nome de tecla do Phaser em forma legível ("SPACE" -> "Espaço"). */
export function keyLabel(name: string): string {
  return PRETTY[name] ?? name.replace(/^NUMPAD_/, 'Num ');
}

/** Tecla principal de uma ação, pronta para exibir. */
function actionKey(action: Action): string {
  return keyLabel(save.data.settings.bindings[action][0] ?? '?');
}

/** Preenche todo elemento com data-key="acao" com a tecla atual dessa ação. */
export function applyKeyLabels(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-key]').forEach((node) => {
    node.textContent = actionKey(node.dataset.key as Action);
  });
}

// Teclas reservadas pelo jogo, que não podem ser atribuídas a ações.
const RESERVED = new Set(['ESC', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'F5', 'F11', 'F12']);
const CODES = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;

/** Converte um evento de teclado no nome de tecla do Phaser, ou null se não servir. */
export function keyNameFromEvent(e: KeyboardEvent): string | null {
  for (const name of Object.keys(CODES)) {
    if (CODES[name] === e.keyCode) return RESERVED.has(name) ? null : name;
  }
  return null;
}
