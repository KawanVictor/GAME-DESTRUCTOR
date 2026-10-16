import Phaser from 'phaser';
import { ABYSS, TILE, UPGRADES, type UpgradeId, VIEW_HEIGHT, VIEW_WIDTH, WAVES } from '../config';
import { composeWave, ENEMY_NAMES } from '../data/enemies';
import { MODIFIERS, pickModifier } from '../data/modifiers';
import { setDebugScene } from '../debug';
import type { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { audio, save } from '../services';
import { setupCollisions } from '../systems/CollisionSystem';
import { dailyChallenge, dateKey } from '../systems/Daily';
import { Effects } from '../systems/Effects';
import { buyUpgrade, createMatch, type MatchState, rollOffers } from '../systems/MatchState';
import { WaveSystem } from '../systems/WaveSystem';
import type { EnemyType, ModeDef, ModifierId, WaveDef } from '../types/game';
import { HUD } from '../ui/HUD';
import { openOptions, optionsOpen } from '../ui/Options';
import { PauseMenu } from '../ui/PauseMenu';
import { SandboxPanel } from '../ui/SandboxPanel';
import { TouchControls } from '../ui/TouchControls';
import { TileView } from '../world/TileView';
import { TurretManager } from '../world/TurretManager';
import { BuildController } from './game/BuildController';
import { CombatController } from './game/CombatController';
import { Darkness, type Light } from './game/Darkness';
import { createDebugApi } from './game/debugApi';
import { EnemyController } from './game/EnemyController';
import type { GameContext } from './game/GameContext';
import { InputController, padStartDown } from './game/InputController';
import { Meteors } from './game/Meteors';
import { PickupController } from './game/PickupController';
import { ProgressController } from './game/ProgressController';
import type { GameOverData } from './GameOverScene';

/** Materiais do sandbox nunca acabam: o saldo volta a este valor. */
const SANDBOX_RESOURCES = 9999;

/**
 * Cena da partida. Monta o mundo e coordena o quadro a quadro; o trabalho
 * fica nos controladores em ./game (entrada, combate, construção,
 * coletáveis, perigos) e as regras, nos sistemas. Tudo é criado em create() e
 * descartado no shutdown, então reiniciar a cena reinicia a partida sem sobras.
 */
export class GameScene extends Phaser.Scene {
  private match!: MatchState;
  private mode!: ModeDef;
  private ctx!: GameContext;
  private waves!: WaveSystem;
  private waveDef: WaveDef | null = null;
  private player!: Player;
  private enemies!: Phaser.GameObjects.Group;
  private turrets!: TurretManager;
  private fx!: Effects;
  private hud!: HUD;
  private pauseMenu!: PauseMenu;
  private touch!: TouchControls;
  private keys!: InputController;
  private combat!: CombatController;
  private build!: BuildController;
  private pickups!: PickupController;
  private foes!: EnemyController;
  private darkness!: Darkness;
  private meteors!: Meteors;
  private progress!: ProgressController;
  private sandbox: SandboxPanel | null = null;
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private dailyDate = '';
  /** Regra imposta para a próxima onda (só pela API de testes); undefined = sorteio normal. */
  private forcedModifier: ModifierId | null | undefined = undefined;
  private paused = false;
  private ended = false;
  private recorded = false;
  private recordedKills = 0;
  private abort = new AbortController();

  constructor() {
    super('Game');
  }

  /** Tempo da cena em segundos (para junto com a pausa). */
  private get now(): number {
    return this.time.now / 1000;
  }

  // ------------------------------------------------------------------ criação

  create(): void {
    const settings = save.data.settings;
    // Desafio diário: arena e sorteios vêm da data, iguais para todo mundo no mesmo dia.
    this.dailyDate = dateKey();
    const daily = settings.mode === 'daily' ? dailyChallenge(this.dailyDate) : null;
    this.match = createMatch(daily?.arena ?? settings.arena, settings.mode, daily?.random);
    this.mode = this.match.mode;
    this.waveDef = null;
    this.forcedModifier = undefined;
    this.paused = false;
    this.ended = false;
    this.recorded = false;
    this.recordedKills = 0;
    this.abort = new AbortController();
    const { level, building } = this.match;
    const worldW = level.cols * TILE;
    const worldH = level.rows * TILE;

    // Fundo em camadas (paralaxe em update). Na Noite, tudo bem mais escuro.
    const night = level.dark ? 0x3a3f66 : 0xffffff;
    this.add.image(0, 0, 'bg-sky').setOrigin(0).setScrollFactor(0).setDepth(-30).setTint(night);
    this.far = this.add.tileSprite(0, VIEW_HEIGHT - 400, VIEW_WIDTH, 360, 'bg-far').setOrigin(0).setScrollFactor(0).setDepth(-20).setTint(night);
    this.near = this.add.tileSprite(0, VIEW_HEIGHT - 330, VIEW_WIDTH, 320, 'bg-near').setOrigin(0).setScrollFactor(0).setDepth(-10).setTint(night);

    this.physics.world.setBounds(0, 0, worldW, worldH);
    // Na Ponte o mundo não tem fundo: quem cai some no abismo.
    this.physics.world.setBoundsCollision(true, true, true, !level.abyss);
    const view = new TileView(this, building);
    this.fx = new Effects(this);

    const portals = level.enemySpawns.map((s) => ({ x: s.x * TILE + TILE / 2, y: (s.y + 1) * TILE - 24 }));
    for (const p of portals) {
      const portal = this.add.image(p.x, p.y - 12, 'portal').setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: portal, scaleX: 0.85, alpha: 0.7, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    if (this.match.core) {
      const c = this.match.core;
      const glow = this.add.image((c.x + 0.5) * TILE, (c.y + 0.5) * TILE, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x67e8f9).setScale(1.6).setDepth(9);
      this.tweens.add({ targets: glow, alpha: 0.45, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    this.player = new Player(this, level.playerSpawn.x * TILE + TILE / 2, level.playerSpawn.y * TILE, this.match.playerHealth, building, this.match.mods);
    this.enemies = this.add.group();
    this.hud = new HUD({
      onPause: () => this.togglePause(),
      onStartWave: () => this.waves.startNow(),
      onToggleBuild: () => this.build.setOpen(!this.build.open),
      onUpgrade: (id) => this.buy(id),
    });
    // No Só construtor o herói não ataca: some o que é de ataque na tela.
    document.body.classList.toggle('no-attack', !this.mode.canAttack);

    // Contexto compartilhado pelos controladores (ver ./game/GameContext).
    const scene = this;
    this.ctx = {
      scene, match: this.match, player: this.player, enemies: this.enemies, fx: this.fx, hud: this.hud,
      get now() { return scene.now; },
      get ended() { return scene.ended; },
      get paused() { return scene.paused; },
    };
    // Primeira partida no Clássico: dicas passo a passo e um preparo mais longo.
    const withTutorial = !save.data.tutorialDone && this.mode.id === 'classic';
    this.progress = new ProgressController(this.ctx, withTutorial);
    this.pickups = new PickupController(this.ctx);
    this.combat = new CombatController(this.ctx, this.pickups, {
      onEnemyKilled: (e, cause) => { this.waves.enemyRemoved(e.id); this.progress.enemyKilled(e.def.type, cause); },
      onPlayerDead: () => this.finish('defeat'),
      onPlayerHurt: (amount) => this.progress.damageTaken(amount),
      onExplosionKills: (n) => this.progress.explosionKills(n),
    });
    this.turrets = new TurretManager(this, building, this.combat.turretBullets, () => this.match.mods.turretDamage, (x, y) => {
      this.fx.flash(x, y, 0xffb347, 0.5, 120);
      audio.play('turret');
    });
    this.build = new BuildController(this.ctx, view, this.turrets, this.combat, this.pickups, {
      onPiecePlaced: (id) => this.progress.piecePlaced(id),
      onCoreDestroyed: () => this.finish('defeat', 'core'),
    });
    this.foes = new EnemyController(this.ctx, this.combat);
    this.darkness = new Darkness(this);
    this.meteors = new Meteors(this.ctx, this.combat);

    setupCollisions(this, {
      player: this.player, layer: view.layer, enemies: this.enemies, pickups: this.pickups.group,
      bullets: this.combat.bullets, turretBullets: this.combat.turretBullets, enemyBullets: this.combat.enemyBullets,
    }, {
      bulletHitsTile: (b, x, y) => this.combat.bulletHitsTile(b, x, y),
      bulletHitsEnemy: (b, e) => this.combat.bulletHitsEnemy(b, e),
      turretBulletHitsTile: (b) => this.combat.turretBulletHitsTile(b),
      enemyBulletHitsTile: (b, x, y) => this.combat.enemyBulletHitsTile(b, x, y),
      enemyBulletHitsPlayer: (b) => this.combat.enemyBulletHitsPlayer(b),
      enemyTouchesPlayer: (e) => this.combat.enemyTouchesPlayer(e),
      playerCollects: (k) => this.pickups.collect(k),
    });

    this.waves = new WaveSystem({
      total: this.mode.totalWaves,
      firstPreparation: withTutorial ? 40 : WAVES.firstPreparation,
      preparation: WAVES.preparation, completedPause: WAVES.completedPause,
      // Uma regra especial pode valer na onda; no desafio diário sempre há uma.
      compose: (n) => composeWave(n, this.nextModifier(n)),
      spawn: (type) => this.spawnWaveEnemy(type),
      onWaveStart: (def) => this.onWaveStart(def),
      onWaveComplete: (def) => this.onWaveComplete(def),
      onVictory: () => this.finish('victory'),
    });

    // Câmera segue o herói com suavidade, dentro dos limites do mapa.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, worldW, worldH);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setDeadzone(90, 60);
    cam.fadeIn(300, 7, 11, 31);

    this.pauseMenu = new PauseMenu({
      onResume: () => this.togglePause(),
      onRestart: () => this.restartMatch(),
      onOptions: () => openOptions(() => this.optionsChanged()),
      onQuit: () => this.quitToMenu(),
    });
    this.touch = new TouchControls();
    this.keys = new InputController(this, this.touch);
    this.setupListeners();
    if (this.mode.sandbox) {
      this.match.resources.add(SANDBOX_RESOURCES - this.match.resources.value);
      this.sandbox = new SandboxPanel((type) => this.spawnSandboxEnemy(type), () => this.combat.clearEnemies());
    }
    this.hud.banner(`${level.name} · ${this.mode.name}`, this.introText(), 3600);
    audio.setMusic('calm');

    this.exposeDebugApi();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private introText(): string {
    if (this.mode.sandbox) return 'Materiais infinitos. Chame inimigos no painel de baixo.';
    if (this.mode.core) return 'Proteja o cristal: os inimigos vão direto nele.';
    if (this.mode.daily) return `Desafio de ${this.dailyDate.split('-').reverse().join('/')}: toda onda tem uma regra especial.`;
    if (!this.mode.canAttack) return 'Você não ataca: só as suas defesas lutam.';
    return 'Monte suas defesas antes da primeira onda.';
  }

  /** Clique no cenário, Esc e perda de foco. */
  private setupListeners(): void {
    this.input.mouse?.disableContextMenu();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (this.paused || this.ended) return;
      audio.unlock();
      this.build.onPointerDown(p);
    });

    // Esc precisa funcionar com a cena pausada, por isso é ouvido na janela.
    const s = this.abort.signal;
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' || e.repeat || this.ended || optionsOpen()) return;
      e.preventDefault();
      if (!this.paused && this.build.busy) this.build.setOpen(false);
      else this.togglePause();
    }, { signal: s });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.paused && !this.ended) this.togglePause();
    }, { signal: s });
  }

  /** As opções foram fechadas: reaplica teclas, rótulos e controles de toque. */
  private optionsChanged(): void {
    this.keys.applyBindings();
    this.hud.refreshKeys();
    this.build.refreshKeys();
    this.touch.refresh();
  }

  private exposeDebugApi(): void {
    setDebugScene('game', () => createDebugApi({
      ctx: this.ctx, waves: this.waves, combat: this.combat, pickups: this.pickups, turrets: this.turrets,
      spawnEnemy: (type, x, y) => this.foes.spawn(type, x, y),
      finishAsVictory: () => this.finish('victory'),
      forceModifier: (id) => { this.forcedModifier = id; },
      extra: () => ({
        mode: this.mode.id, modifier: this.waveDef?.modifier ?? null, core: this.coreRatio(),
        darkness: this.darkness.strength, meteors: this.meteors.pending, tutorial: this.progress.tutorialStep,
      }),
    }));
  }

  // ---------------------------------------------------------------- laço

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    const now = this.now;
    const cam = this.cameras.main;
    this.far.tilePositionX = cam.scrollX * 0.12;
    this.near.tilePositionX = cam.scrollX * 0.3;
    this.keys.pollGamepad();

    const fighting = this.waves.phase === 'fighting';
    const modifier = fighting ? this.waveDef?.modifier ?? null : null;
    if (!this.ended) {
      if (this.keys.padPausePressed) { this.togglePause(); return; }
      this.build.handleHotkeys(this.keys);
      if (this.keys.pressed('startWave')) this.waves.startNow();
      const input = this.keys.playerInput();
      if (!this.mode.canAttack) { input.melee = false; input.shoot = false; }
      this.player.tick(now, dt, input, {
        onJump: () => audio.play('jump'),
        onLand: () => { audio.play('land'); this.fx.burst(this.player.x, this.player.arcade.bottom, 0xcfd6ee, 4); },
        onJumpPad: () => { audio.play('pad'); this.fx.spark(this.player.x, this.player.arcade.bottom, 0x67e8f9, 12); },
        onMelee: () => audio.play('slash'),
        onShoot: () => this.combat.shoot(),
        onDash: () => { audio.play('dash'); this.fx.spark(this.player.x, this.player.arcade.center.y, 0x67e8f9, 10); },
      });
      this.combat.resolveMelee(now);
      if (this.mode.sandbox) {
        const r = this.match.resources;
        if (r.value < SANDBOX_RESOURCES) r.add(SANDBOX_RESOURCES - r.value);
      } else {
        this.waves.update(dt);
      }
      this.meteors.update(now, modifier === 'meteors');
      this.checkPlayerFall();
      this.progress.update(this.waves.phase !== 'preparing', this.build.open);
    }

    const boss = this.foes.update(now, dt);
    this.turrets.update(now, this.enemies.getChildren() as Enemy[]);
    this.pickups.update(now, dt);
    this.build.update();
    this.darkness.update(dt, this.match.level.dark ? 1 : modifier === 'fog' ? 0.85 : 0, this.lightSources());
    this.updateHud(now, boss, modifier);
    if (!this.ended) {
      const busy = fighting || (this.mode.sandbox && this.enemies.getLength() > 0);
      audio.setMusic(boss ? 'boss' : busy ? 'battle' : 'calm');
    }
    this.keys.endFrame();
  }

  /** Fontes de luz no escuro: herói, defesas, portais e núcleo. */
  private lightSources(): Light[] {
    if (!this.match.level.dark && this.waveDef?.modifier !== 'fog') return [];
    const out: Light[] = [{ x: this.player.x, y: this.player.arcade.center.y, radius: 190 }];
    for (const p of this.turrets.positions()) out.push({ ...p, radius: 110 });
    for (const p of this.foes.spawnPoints) out.push({ x: p.x, y: p.y - 12, radius: 120 });
    const c = this.match.core;
    if (c) out.push({ x: (c.x + 0.5) * TILE, y: (c.y + 0.5) * TILE, radius: 150 });
    return out;
  }

  /** Abismo da Ponte: o herói que cai perde vida e volta ao início (inimigos: EnemyController). */
  private checkPlayerFall(): void {
    if (!this.match.level.abyss) return;
    const limit = this.physics.world.bounds.bottom + TILE;
    const pb = this.player.arcade;
    if (pb.top <= limit) return;
    const spawn = this.match.level.playerSpawn;
    pb.reset(spawn.x * TILE + TILE / 2, spawn.y * TILE);
    this.combat.hurtPlayer(ABYSS.playerDamage, this.player.x);
    this.fx.flash(this.player.x, pb.center.y, 0x67e8f9, 1.4, 300);
  }

  private coreRatio(): number | null {
    const c = this.match.core;
    if (!c) return null;
    const b = this.match.building;
    return b.get(c.x, c.y).core ? b.hpAt(c.x, c.y) / b.get(c.x, c.y).maxHp : 0;
  }

  private updateHud(now: number, boss: Enemy | null, modifier: WaveDef['modifier']): void {
    const h = this.match.playerHealth;
    this.hud.update({
      hp: h.hp, maxHp: h.max, resources: this.match.resources.value,
      wave: this.waves.number, totalWaves: this.mode.totalWaves, endless: this.waves.endless,
      phase: this.waves.phase, remaining: this.waves.remaining, timer: this.waves.timer,
      meleeCd: this.player.meleeCd.fraction(now), shotCd: this.player.shotCd.fraction(now), dashCd: this.player.dashCd.fraction(now),
      offers: this.mode.sandbox ? [] : this.match.offers,
      boss: boss ? { name: ENEMY_NAMES.boss, ratio: boss.health.hp / boss.health.max } : null,
      core: this.coreRatio(),
      modifier: modifier ? MODIFIERS[modifier].name : null,
      sandbox: this.mode.sandbox ? this.enemies.getLength() : null,
    });
  }

  private buy(id: UpgradeId): void {
    if (this.ended) return;
    if (buyUpgrade(this.match, id)) {
      audio.play('upgrade');
      this.fx.spark(this.player.x, this.player.arcade.center.y, 0x4ee3a4, 16);
      this.hud.toast(`${UPGRADES[id].label} comprado`, 1200, true);
    } else {
      audio.play('deny');
    }
  }

  // ---------------------------------------------------------------- ondas

  private nextModifier(n: number): ModifierId | null {
    const forced = this.forcedModifier;
    this.forcedModifier = undefined;
    return forced !== undefined ? forced : pickModifier(n, this.match.random, this.mode.daily);
  }

  private spawnWaveEnemy(type: EnemyType): number | null {
    if (this.foes.count >= WAVES.maxActiveEnemies) return null;
    return this.foes.spawnAtPortal(type, this.waveDef?.hpScale ?? 1, this.waveDef?.speedScale ?? 1).id;
  }

  private spawnSandboxEnemy(type: EnemyType): void {
    if (this.ended || this.foes.count >= WAVES.maxActiveEnemies) { audio.play('deny'); return; }
    audio.play('click');
    this.foes.spawnAtPortal(type);
  }

  private onWaveStart(def: WaveDef): void {
    this.waveDef = def;
    this.progress.waveStarted();
    audio.play('waveStart');
    const m = def.modifier ? MODIFIERS[def.modifier] : null;
    this.hud.banner(`Onda ${def.number}${def.boss ? ' — CHEFE' : ''}`, m ? `${m.name}: ${m.description}` : `${def.enemies.length} inimigos a caminho`, m ? 3200 : 2400);
  }

  private onWaveComplete(def: WaveDef): void {
    this.match.resources.add(def.reward);
    const healed = Math.round(this.match.playerHealth.heal(WAVES.healOnClear));
    rollOffers(this.match, this.match.random);
    audio.play('waveClear');
    this.hud.banner(`Onda ${def.number} concluída`, `+${def.reward} materiais${healed > 0 ? ` · +${healed} de vida` : ''}`, 2600);
    if (def.number > save.data.bestWave) { save.data.bestWave = def.number; save.save(); }
    this.progress.waveCompleted(def);
  }

  // ------------------------------------------------------ pausa e término

  private togglePause(): void {
    if (this.ended) return;
    this.paused = !this.paused;
    this.keys.release();
    this.pauseMenu.setOpen(this.paused);
    audio.play('click');
    if (this.paused) {
      this.scene.pause();
      this.watchPadWhilePaused();
    } else {
      this.scene.resume();
    }
  }

  /** Com a cena pausada o update não roda: o Start do controle é vigiado à parte. */
  private watchPadWhilePaused(): void {
    let wasDown = padStartDown();
    const loop = (): void => {
      if (!this.paused || this.abort.signal.aborted) return;
      const down = padStartDown();
      if (down && !wasDown && !optionsOpen()) { this.togglePause(); return; }
      wasDown = down;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private finish(outcome: 'victory' | 'defeat', reason: 'hero' | 'core' = 'hero'): void {
    if (this.ended) return;
    this.ended = true;
    this.match.outcome = outcome;
    this.build.close();
    this.keys.release();
    const waves = this.waves.completed;
    let record = false;
    if (this.mode.sandbox) {
      // Sandbox não conta para recordes nem estatísticas.
    } else if (!this.recorded) {
      record = save.recordMatch(waves, this.match.kills, this.match.blocksPlaced);
      this.recorded = true;
    } else {
      // Partida que seguiu no modo infinito: soma só o que veio depois.
      record = waves > save.data.bestWave;
      if (record) save.data.bestWave = waves;
      save.data.stats.kills += this.match.kills - this.recordedKills;
      save.save();
    }
    this.recordedKills = this.match.kills;
    const dailyRecord = this.mode.daily ? save.recordDaily(this.dailyDate, waves) : false;
    this.progress.matchEnded(outcome);
    audio.setMusic(null);
    audio.play(outcome === 'victory' ? 'victory' : 'defeat');
    if (outcome === 'defeat') {
      this.player.arcade.setAcceleration(0, 0);
      this.player.play('player-hurt', true);
      this.fx.burst(this.player.x, this.player.arcade.center.y, 0x67e8f9, 24);
      const c = this.match.core;
      if (reason === 'core' && c) this.cameras.main.pan((c.x + 0.5) * TILE, (c.y + 0.5) * TILE, 500);
    }
    const data: GameOverData = {
      outcome, reason, waves, kills: this.match.kills, blocksPlaced: this.match.blocksPlaced,
      bestWave: Math.max(save.data.bestWave, waves), record,
      mode: this.mode.id, modeName: this.mode.name,
      daily: this.mode.daily ? { best: save.data.daily.bestWave, record: dailyRecord } : null,
      achievements: this.progress.takeUnlocked(),
    };
    this.time.delayedCall(900, () => {
      this.scene.pause();
      this.scene.launch('GameOver', data);
    });
  }

  /** Recomeça a partida do zero, sem recarregar a página. */
  restartMatch(): void {
    this.scene.stop('GameOver');
    this.scene.restart();
  }

  quitToMenu(): void {
    this.scene.stop('GameOver');
    this.scene.start('Menu');
  }

  /** Depois da vitória: segue com ondas além da última. */
  continueEndless(): void {
    if (this.match.outcome !== 'victory') return;
    this.match.outcome = 'playing';
    this.ended = false;
    this.progress.takeUnlocked(true);
    this.waves.continueEndless();
    this.scene.resume();
    this.hud.banner('Modo infinito', 'As ondas continuam ficando mais difíceis.', 2600);
    this.exposeDebugApi();
  }

  private cleanup(): void {
    this.abort.abort();
    this.build.destroy();
    this.turrets.destroy();
    this.meteors.destroy();
    this.darkness.destroy();
    this.progress.destroy();
    this.sandbox?.destroy();
    this.sandbox = null;
    this.hud.destroy();
    this.pauseMenu.destroy();
    this.touch.destroy();
    this.keys.destroy();
    document.body.classList.remove('no-attack');
    this.input.off(Phaser.Input.Events.POINTER_DOWN);
  }
}
