import type { MeleeWeaponDef, RangedWeaponDef } from '../types/game';

/** Lâmina (golpe corpo a corpo). */
export const MELEE: MeleeWeaponDef = {
  damage: 22,
  range: 46,
  height: 44,
  cooldown: 0.36,
  activeTime: 0.14,
  knockback: 260,
  blockDamage: 15,
};

/** Disparador (projéteis). */
export const RANGED: RangedWeaponDef = {
  damage: 11,
  speed: 640,
  range: 520,
  cooldown: 0.3,
  blockDamage: 8,
};
