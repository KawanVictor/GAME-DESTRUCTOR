// Efeitos sonoros sintetizados com WebAudio: o jogo não depende de arquivos
// de áudio. Para usar arquivos no futuro, basta registrar um tocador com o
// mesmo nome em `samples`; o resto do jogo só chama audio.play('nome').

export type SoundName =
  | 'jump' | 'land' | 'slash' | 'shoot' | 'hit' | 'hurt' | 'enemyDie' | 'place' | 'remove' | 'deny'
  | 'break' | 'explode' | 'pickup' | 'turret' | 'pad' | 'waveStart' | 'waveClear' | 'victory' | 'defeat' | 'click' | 'upgrade';

type AC = AudioContext;

export class AudioSystem {
  private ctx: AC | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<SoundName, number>();
  private volume = 0.6;
  private muted = false;
  /** Sons vindos de arquivo, quando existirem. */
  readonly samples = new Map<SoundName, () => void>();

  /**
   * Navegadores só liberam áudio depois de um gesto do usuário; chame isto
   * em um clique ou tecla. Sem WebAudio, o jogo segue mudo, sem erro.
   */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.apply();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setVolume(volume: number, muted: boolean): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.muted = muted;
    this.apply();
  }

  private apply(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  play(name: SoundName): void {
    const sample = this.samples.get(name);
    if (sample) { sample(); return; }
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== 'running' || this.muted) return;
    const now = ctx.currentTime;
    if (now - (this.last.get(name) ?? -1) < 0.04) return;      // não empilha o mesmo som
    this.last.set(name, now);
    try {
      this.synth(name);
    } catch {
      /* som nunca derruba o jogo */
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const ctx = this.ctx as AC;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master as GainNode);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hiss(dur: number, vol: number, freq: number, delay = 0): void {
    const ctx = this.ctx as AC;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    src.buffer = this.noise;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.2), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master as GainNode);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private synth(name: SoundName): void {
    switch (name) {
      case 'jump': this.tone('triangle', 320, 640, 0.14, 0.16); break;
      case 'land': this.hiss(0.08, 0.14, 500); break;
      case 'slash': this.hiss(0.1, 0.22, 3200); this.tone('sawtooth', 700, 240, 0.09, 0.05); break;
      case 'shoot': this.tone('square', 980, 320, 0.09, 0.08); break;
      case 'hit': this.tone('square', 240, 90, 0.08, 0.14); this.hiss(0.06, 0.12, 1800); break;
      case 'hurt': this.tone('sawtooth', 420, 110, 0.26, 0.2); break;
      case 'enemyDie': this.tone('square', 520, 120, 0.18, 0.13); this.hiss(0.12, 0.1, 1200); break;
      case 'place': this.tone('sine', 220, 360, 0.08, 0.2); this.hiss(0.05, 0.08, 900); break;
      case 'remove': this.tone('sine', 360, 200, 0.1, 0.16); break;
      case 'deny': this.tone('square', 150, 110, 0.12, 0.09); break;
      case 'break': this.hiss(0.22, 0.26, 1500); this.tone('square', 130, 60, 0.12, 0.08); break;
      case 'explode': this.hiss(0.7, 0.55, 900); this.tone('sine', 120, 30, 0.55, 0.4); break;
      case 'pickup': this.tone('sine', 880, 880, 0.06, 0.12); this.tone('sine', 1320, 1320, 0.12, 0.12, 0.06); break;
      case 'turret': this.tone('square', 620, 260, 0.07, 0.06); break;
      case 'pad': this.tone('sine', 220, 980, 0.24, 0.2); break;
      case 'waveStart': [392, 523, 659].forEach((f, i) => this.tone('triangle', f, f, 0.16, 0.16, i * 0.12)); break;
      case 'waveClear': [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.16, i * 0.1)); break;
      case 'victory': [523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.2, 0.16, i * 0.13)); break;
      case 'defeat': [392, 330, 262, 196].forEach((f, i) => this.tone('triangle', f, f, 0.32, 0.18, i * 0.22)); break;
      case 'click': this.tone('sine', 660, 660, 0.04, 0.1); break;
      case 'upgrade': [523, 784, 1047].forEach((f, i) => this.tone('sine', f, f, 0.14, 0.14, i * 0.07)); break;
    }
  }
}
