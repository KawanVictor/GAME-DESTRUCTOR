import type { BlockDef, BlockId } from '../types/game';

// Registro central das peças. Para criar um bloco novo basta acrescentar
// uma definição aqui (e o desenho em art/draw.ts): o sistema de construção
// lê tudo destas propriedades.
export const BLOCK_DEFS: readonly BlockDef[] = [
  { id: 'empty', index: 0, name: 'Vazio', description: '', cost: 0, maxHp: Infinity, collision: 'none', buildable: false },
  { id: 'terrain', index: 1, name: 'Terreno', description: 'Chão da arena.', cost: 0, maxHp: Infinity, collision: 'solid', buildable: false },
  { id: 'bedrock', index: 2, name: 'Rocha-mãe', description: 'Limite da arena.', cost: 0, maxHp: Infinity, collision: 'solid', buildable: false },
  { id: 'crate', index: 3, name: 'Caixote', description: 'Quebre para coletar materiais.', cost: 0, maxHp: 30, collision: 'solid', buildable: false, drops: 15 },
  {
    id: 'wood_platform', index: 4, name: 'Plataforma de madeira', cost: 10, maxHp: 45, collision: 'oneway', buildable: true,
    description: 'Atravessável por baixo. Baixo + pulo para descer.',
  },
  {
    id: 'stone_block', index: 5, name: 'Bloco de pedra', cost: 20, maxHp: 220, collision: 'solid', buildable: true,
    description: 'Estrutura resistente. Bloqueia todos.',
  },
  {
    id: 'defensive_wall', index: 6, name: 'Parede defensiva', cost: 15, maxHp: 130, collision: 'enemy_only', buildable: true,
    description: 'Barra inimigos; você e seus tiros atravessam.',
  },
  {
    id: 'explosive_block', index: 7, name: 'Bloco explosivo', cost: 25, maxHp: 30, collision: 'solid', buildable: true,
    description: 'Explode ao ser destruído. Ative com um golpe ou tiro.',
    explosive: { radius: 2.6, damage: 70, blockDamage: 90 },
  },
  {
    id: 'jump_pad', index: 8, name: 'Plataforma de impulso', cost: 20, maxHp: 80, collision: 'solid', buildable: true,
    description: 'Lança o herói para o alto.',
  },
  {
    id: 'spike_trap', index: 9, name: 'Armadilha de espinhos', cost: 30, maxHp: 24, collision: 'none', buildable: true, requiresFloor: true, trap: 'spikes',
    description: 'Fere inimigos que pisam. Desgasta com o uso.',
  },
  {
    id: 'turret', index: 10, name: 'Torreta', cost: 50, maxHp: 90, collision: 'solid', buildable: true, requiresFloor: true, trap: 'turret',
    description: 'Atira sozinha em inimigos próximos. Pode ser destruída.',
  },
  {
    id: 'ice_trap', index: 11, name: 'Armadilha de gelo', cost: 25, maxHp: 30, collision: 'none', buildable: true, requiresFloor: true, trap: 'ice',
    description: 'Deixa lento quem pisa. Desgasta com o uso.',
  },
  {
    id: 'cannon', index: 12, name: 'Canhão', cost: 70, maxHp: 110, collision: 'solid', buildable: true, requiresFloor: true, trap: 'cannon',
    description: 'Atira devagar, mas cada tiro explode e atinge um grupo.',
  },
  {
    id: 'core', index: 13, name: 'Núcleo', cost: 25, maxHp: 400, collision: 'solid', buildable: false, core: true,
    description: 'Defenda o cristal: se ele cair, a partida acaba.',
  },
  {
    id: 'bridge', index: 14, name: 'Ponte', cost: 0, maxHp: 120, collision: 'solid', buildable: false,
    description: 'Tábuas sobre o abismo. Quebre para derrubar inimigos; reconstrua com plataformas.',
  },
];

const BY_ID = new Map<BlockId, BlockDef>(BLOCK_DEFS.map((d) => [d.id, d]));
const BY_INDEX: BlockDef[] = [];
for (const d of BLOCK_DEFS) BY_INDEX[d.index] = d;

export const EMPTY = BY_INDEX[0];

export function blockById(id: BlockId): BlockDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`Bloco desconhecido: ${id}`);
  return def;
}

export function blockByIndex(index: number): BlockDef {
  return BY_INDEX[index] ?? EMPTY;
}

/** Peças do menu de construção, na ordem das teclas 1–9. */
export const BUILDABLE: readonly BlockDef[] = BLOCK_DEFS.filter((d) => d.buildable);

/** Quadro extra do tileset: terreno com topo (não é um bloco). */
export const TERRAIN_TOP_FRAME = BLOCK_DEFS.length;
export const TILESET_FRAMES = BLOCK_DEFS.length + 1;
