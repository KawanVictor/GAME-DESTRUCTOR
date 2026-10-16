import type { ModifierId } from '../types/game';

export const MODIFIERS: Record<ModifierId, { name: string; description: string }> = {
  haste: { name: 'Pressa', description: 'Inimigos 30% mais rápidos.' },
  armored: { name: 'Blindados', description: 'Inimigos com 35% mais vida.' },
  meteors: { name: 'Chuva de meteoros', description: 'Pedras em chamas caem do céu — em todo mundo.' },
  fog: { name: 'Neblina', description: 'Só se enxerga perto do herói e das defesas.' },
  bounty: { name: 'Recompensa', description: 'Mais inimigos, e o dobro de materiais ao vencer.' },
};

export const MODIFIER_IDS = Object.keys(MODIFIERS) as ModifierId[];

/**
 * Regra especial da onda n. A partir da onda 3, fora das ondas de chefe,
 * há uma chance de a onda vir com uma regra (no desafio diário, sempre há).
 */
export function pickModifier(n: number, random: () => number, always = false): ModifierId | null {
  if (n < 3 || n % 5 === 0) return null;
  if (!always && random() >= 0.4) return null;
  return MODIFIER_IDS[Math.floor(random() * MODIFIER_IDS.length)];
}
