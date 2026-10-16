import type { ModeDef, ModeId } from '../types/game';

export const MODES: Record<ModeId, ModeDef> = {
  classic: {
    id: 'classic', name: 'Clássico', description: 'Sobreviva a 10 ondas, com um chefe a cada 5.',
    totalWaves: 10, canAttack: true, startResources: 150, core: false, sandbox: false, daily: false,
  },
  core: {
    id: 'core', name: 'Defender o núcleo', description: 'Os inimigos vão atrás do cristal. Se ele cair, acabou.',
    totalWaves: 10, canAttack: true, startResources: 200, core: true, sandbox: false, daily: false,
  },
  daily: {
    id: 'daily', name: 'Desafio diário', description: 'Arena, regras das ondas e melhorias sorteadas pela data: iguais para todo mundo hoje.',
    totalWaves: 10, canAttack: true, startResources: 150, core: false, sandbox: false, daily: true,
  },
  builder: {
    id: 'builder', name: 'Só construtor', description: 'Você não ataca: só as suas defesas lutam.',
    totalWaves: 10, canAttack: false, startResources: 320, core: false, sandbox: false, daily: false,
  },
  sandbox: {
    id: 'sandbox', name: 'Sandbox', description: 'Materiais infinitos e sem ondas: chame os inimigos que quiser.',
    totalWaves: 0, canAttack: true, startResources: 9999, core: false, sandbox: true, daily: false,
  },
};

export const MODE_ORDER: readonly ModeId[] = ['classic', 'core', 'daily', 'builder', 'sandbox'];
