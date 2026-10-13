// Regras de dano independentes do motor: vida, invulnerabilidade, recargas
// e o controle que impede um mesmo golpe de ferir o alvo a cada quadro.

/** Vida de uma entidade. O tempo é passado em segundos pelo chamador. */
export class Health {
  private current: number;
  private invulnerableUntil = -Infinity;

  constructor(private maximum: number, private readonly invulnerability = 0) {
    this.current = maximum;
  }

  get hp(): number {
    return this.current;
  }

  get max(): number {
    return this.maximum;
  }

  get dead(): boolean {
    return this.current <= 0;
  }

  isInvulnerable(now: number): boolean {
    return now < this.invulnerableUntil;
  }

  /**
   * Aplica dano e devolve quanto foi realmente tirado.
   * Mortos, invulneráveis e valores inválidos resultam em 0.
   */
  damage(amount: number, now: number): number {
    if (this.dead || !Number.isFinite(amount) || amount <= 0 || this.isInvulnerable(now)) return 0;
    const dealt = Math.min(this.current, amount);
    this.current -= dealt;
    this.invulnerableUntil = now + this.invulnerability;
    return dealt;
  }

  /** Concede invulnerabilidade por `seconds` (ex.: investida). Nunca encurta uma já ativa. */
  shield(now: number, seconds: number): void {
    this.invulnerableUntil = Math.max(this.invulnerableUntil, now + seconds);
  }

  heal(amount: number): number {
    if (this.dead || !(amount > 0)) return 0;
    const healed = Math.min(this.maximum - this.current, amount);
    this.current += healed;
    return healed;
  }

  raiseMax(amount: number): void {
    if (!(amount > 0)) return;
    this.maximum += amount;
    this.current += amount;
  }
}

/** Recarga simples baseada em tempo. */
export class Cooldown {
  private readyAt = -Infinity;
  private duration = 0;

  ready(now: number): boolean {
    return now >= this.readyAt;
  }

  /** Dispara se estiver pronta. Retorna se disparou. */
  trigger(now: number, duration: number): boolean {
    if (!this.ready(now)) return false;
    this.duration = duration;
    this.readyAt = now + duration;
    return true;
  }

  /** 0 = pronta, 1 = acabou de ser usada. */
  fraction(now: number): number {
    if (this.duration <= 0 || this.ready(now)) return 0;
    return Math.min(1, (this.readyAt - now) / this.duration);
  }
}

/**
 * Um golpe corpo a corpo dura vários quadros; cada alvo só pode ser
 * atingido uma vez por golpe.
 */
export class SwingTracker {
  private hit = new Set<number>();
  private activeUntil = -Infinity;

  begin(now: number, activeTime: number): void {
    this.hit.clear();
    this.activeUntil = now + activeTime;
  }

  isActive(now: number): boolean {
    return now < this.activeUntil;
  }

  /** True na primeira vez que o alvo é registrado neste golpe. */
  tryHit(targetId: number, now: number): boolean {
    if (!this.isActive(now) || this.hit.has(targetId)) return false;
    this.hit.add(targetId);
    return true;
  }
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Mira assistida: o alvo mais próximo à frente do atirador, dentro do cone e
 * do alcance, com linha de visão. Retorna null se não houver (tiro reto).
 */
export function pickAimTarget<T extends Point>(
  origin: Point,
  facing: 1 | -1,
  candidates: readonly T[],
  range: number,
  coneDegrees: number,
  hasLineOfSight: (x: number, y: number) => boolean,
): T | null {
  const cone = (coneDegrees * Math.PI) / 180;
  let best: T | null = null;
  let bestDist = range;
  for (const c of candidates) {
    const dx = (c.x - origin.x) * facing;
    const dy = c.y - origin.y;
    if (dx <= 0) continue;                              // atrás do atirador
    const dist = Math.hypot(dx, dy);
    if (dist > bestDist || Math.abs(Math.atan2(dy, dx)) > cone) continue;
    if (!hasLineOfSight(c.x, c.y)) continue;
    best = c;
    bestDist = dist;
  }
  return best;
}

/** Dano de explosão: máximo no centro, 40% na borda, zero fora do raio. */
export function explosionDamage(base: number, distance: number, radius: number): number {
  if (distance >= radius || radius <= 0) return 0;
  return Math.round(base * (1 - (distance / radius) * 0.6));
}
