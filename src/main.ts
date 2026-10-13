import Phaser from 'phaser';
import './styles/main.css';
import { GRAVITY, VIEW_HEIGHT, VIEW_WIDTH } from './game/config';
import { BootScene } from './game/scenes/BootScene';
import { GameOverScene } from './game/scenes/GameOverScene';
import { GameScene } from './game/scenes/GameScene';
import { MenuScene } from './game/scenes/MenuScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { audio } from './game/services';

function fatal(message: string): void {
  const box = document.getElementById('fatal');
  if (!box) return;
  box.textContent = `Ocorreu um erro inesperado.\n\n${message}\n\nRecarregue a página (F5). Recorde e configurações salvos foram mantidos.`;
  box.classList.remove('hidden');
}

window.addEventListener('error', (e) => fatal(`${e.message}\n${e.filename ?? ''}:${e.lineno ?? ''}`));
window.addEventListener('unhandledrejection', (e) => fatal(String(e.reason)));

// Navegadores só liberam áudio após um gesto do usuário.
for (const type of ['pointerdown', 'keydown'] as const) {
  window.addEventListener(type, () => audio.unlock(), { capture: true });
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  backgroundColor: '#070b1f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, roundPixels: true },
  // Vários dedos ao mesmo tempo: mover, pular e tocar no cenário.
  input: { activePointers: 3 },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: GRAVITY }, tileBias: 16 },
  },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, GameOverScene],
});
