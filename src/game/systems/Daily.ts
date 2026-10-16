import { ARENA_IDS } from './SaveSystem';
import type { ArenaId } from '../types/game';

/** Data local no formato AAAA-MM-DD. */
export function dateKey(d: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Gerador pseudoaleatório determinístico (mulberry32): mesma semente, mesma sequência. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semente numérica de um texto (FNV-1a). */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** O desafio de uma data: arena do dia e um gerador para ondas e ofertas. */
export function dailyChallenge(date: string): { arena: ArenaId; random: () => number } {
  const random = seededRandom(hashSeed(`destructor:${date}`));
  const arena = ARENA_IDS[Math.floor(random() * ARENA_IDS.length)];
  return { arena, random };
}
