// Lógica das armadilhas que não depende do Phaser.

export interface TurretCandidate {
  id: number;
  x: number;
  y: number;
  alive: boolean;
}

/**
 * Escolhe o alvo da torreta: o inimigo vivo mais próximo dentro do raio e
 * com linha de visão. Retorna null se não houver alvo válido.
 */
export function selectTurretTarget<T extends TurretCandidate>(
  originX: number,
  originY: number,
  candidates: readonly T[],
  range: number,
  hasLineOfSight: (x: number, y: number) => boolean,
): T | null {
  let best: T | null = null;
  let bestDist = range;
  for (const c of candidates) {
    if (!c.alive) continue;
    const d = Math.hypot(c.x - originX, c.y - originY);
    if (d > bestDist || !hasLineOfSight(c.x, c.y)) continue;
    best = c;
    bestDist = d;
  }
  return best;
}

/** Controla o intervalo entre danos de espinhos por inimigo. */
export class SpikeTimer {
  private next = new Map<number, number>();

  /** True se o inimigo pode levar dano agora (e agenda o próximo). */
  tryDamage(enemyId: number, now: number, interval: number): boolean {
    const at = this.next.get(enemyId) ?? -Infinity;
    if (now < at) return false;
    this.next.set(enemyId, now + interval);
    return true;
  }

  forget(enemyId: number): void {
    this.next.delete(enemyId);
  }
}
