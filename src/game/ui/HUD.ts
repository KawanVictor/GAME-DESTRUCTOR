import { UPGRADES, type UpgradeId } from '../config';
import type { WavePhase } from '../types/game';
import { el, onClick, show } from './dom';

export interface HudView {
  hp: number;
  maxHp: number;
  resources: number;
  wave: number;
  totalWaves: number;
  endless: boolean;
  phase: WavePhase;
  remaining: number;
  timer: number;
  /** 0 = pronta, 1 = recém-usada. */
  meleeCd: number;
  shotCd: number;
}

export interface HudCallbacks {
  onPause(): void;
  onStartWave(): void;
  onToggleBuild(): void;
  onUpgrade(id: UpgradeId): void;
}

/** HUD em HTML. Só toca no DOM quando o valor exibido muda. */
export class HUD {
  private readonly abort = new AbortController();
  private cache = new Map<string, string>();
  private bannerTimer = 0;
  private toastTimer = 0;
  private upgradeButtons = new Map<UpgradeId, HTMLButtonElement>();

  constructor(cb: HudCallbacks) {
    const s = this.abort.signal;
    onClick(el('btn-pause'), s, cb.onPause);
    onClick(el('btn-start-wave'), s, cb.onStartWave);
    onClick(el('btn-build'), s, cb.onToggleBuild);
    const box = el('upgrades');
    box.innerHTML = '<span class="muted">Melhorias:</span>';
    for (const id of Object.keys(UPGRADES) as UpgradeId[]) {
      const b = document.createElement('button');
      b.className = 'btn small';
      b.dataset.upgrade = id;
      b.innerHTML = `${UPGRADES[id].label} <span>${UPGRADES[id].cost}</span>`;
      onClick(b, s, () => cb.onUpgrade(id));
      box.appendChild(b);
      this.upgradeButtons.set(id, b);
    }
    show(el('hud'), true);
    show(el('banner'), false);
    show(el('toast'), false);
    show(el('build-tip'), false);
  }

  private set(key: string, value: string, apply: (v: string) => void): void {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply(value);
  }

  update(v: HudView): void {
    const hp = Math.max(0, Math.ceil(v.hp));
    this.set('hp', `${hp}/${v.maxHp}`, (t) => {
      el('hp-text').textContent = t;
      el('hp-fill').style.width = `${Math.max(0, Math.min(100, (v.hp / v.maxHp) * 100))}%`;
      el('hp-bar').setAttribute('aria-valuenow', String(hp));
      el('hp-bar').setAttribute('aria-valuemax', String(v.maxHp));
    });
    this.set('res', String(v.resources), (t) => { el('res-value').textContent = t; });
    this.set('wave', `Onda ${v.wave}${v.endless ? ' (infinito)' : ` de ${v.totalWaves}`}`, (t) => { el('wave-title').textContent = t; });

    let sub = '';
    if (v.phase === 'preparing') sub = `Preparação — começa em ${Math.max(0, Math.ceil(v.timer))} s`;
    else if (v.phase === 'fighting') sub = `Inimigos restantes: ${v.remaining}`;
    else if (v.phase === 'completed') sub = 'Onda concluída!';
    else sub = 'Todas as ondas vencidas!';
    this.set('sub', sub, (t) => { el('wave-sub').textContent = t; });
    this.set('prep', String(v.phase === 'preparing'), (t) => {
      show(el('btn-start-wave'), t === 'true');
      show(el('upgrades'), t === 'true');
    });
    for (const [id, b] of this.upgradeButtons) {
      const blocked = v.resources < UPGRADES[id].cost || (id === 'heal' && v.hp >= v.maxHp);
      this.set(`up-${id}`, String(blocked), (t) => { b.disabled = t === 'true'; });
    }
    this.set('cdm', (1 - v.meleeCd).toFixed(2), (t) => { el('cd-melee').style.width = `${Number(t) * 100}%`; });
    this.set('cds', (1 - v.shotCd).toFixed(2), (t) => { el('cd-shot').style.width = `${Number(t) * 100}%`; });
  }

  banner(title: string, sub: string, ms = 2600): void {
    el('banner-title').textContent = title;
    el('banner-sub').textContent = sub;
    show(el('banner'), true);
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => show(el('banner'), false), ms);
  }

  /** Aviso curto. `good` troca a borda de alerta pela de confirmação. */
  toast(text: string, ms = 1400, good = false): void {
    el('toast').textContent = text;
    el('toast').classList.toggle('good', good);
    show(el('toast'), true);
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => show(el('toast'), false), ms);
  }

  /** Linha de prévia da construção: custo e validade (ou motivo). */
  tip(text: string | null, ok = true): void {
    const node = el('build-tip');
    this.set('tip', `${text}|${ok}`, () => {
      show(node, text !== null);
      node.textContent = text ?? '';
      node.classList.toggle('ok', ok);
      node.classList.toggle('bad', !ok);
    });
  }

  destroy(): void {
    this.abort.abort();
    window.clearTimeout(this.bannerTimer);
    window.clearTimeout(this.toastTimer);
    show(el('hud'), false);
  }
}
