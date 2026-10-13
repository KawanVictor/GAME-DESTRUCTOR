/** Materiais do jogador. Nunca fica negativo e só gasta o que existe. */
export class ResourceSystem {
  private amount: number;

  constructor(initial: number) {
    this.amount = Math.max(0, Math.floor(initial));
  }

  get value(): number {
    return this.amount;
  }

  canAfford(cost: number): boolean {
    return Number.isFinite(cost) && cost >= 0 && this.amount >= cost;
  }

  /** Gasta `cost` se houver saldo. Retorna false (sem alterar nada) caso contrário. */
  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.amount -= Math.floor(cost);
    return true;
  }

  add(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.amount += Math.floor(amount);
  }
}
