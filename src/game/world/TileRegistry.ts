import { blockById, TERRAIN_TOP_FRAME } from '../data/blocks';
import type { BuildingSystem } from '../systems/BuildingSystem';
import type { BlockId } from '../types/game';

// Ponte entre o registro de blocos (dados) e o tileset do Phaser.

/** Índice do tile de um bloco no tileset. */
function tileIndex(id: BlockId): number {
  return blockById(id).index;
}

export const WALL_INDEX = tileIndex('defensive_wall');
export const PLATFORM_INDEX = tileIndex('wood_platform');

/** Quadro a desenhar para a célula: terreno exposto ganha o quadro com topo. */
export function frameFor(building: BuildingSystem, x: number, y: number): number {
  const def = building.get(x, y);
  if (def.id !== 'terrain') return def.index;
  const above = building.get(x, y - 1).id;
  return above === 'terrain' || above === 'bedrock' ? def.index : TERRAIN_TOP_FRAME;
}
