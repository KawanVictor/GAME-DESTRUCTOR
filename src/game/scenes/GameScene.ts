import Phaser from 'phaser';
import { TILE, UPGRADES, type UpgradeId, VIEW_HEIGHT, VIEW_WIDTH, WAVES } from '../config';
import { composeWave, ENEMY_NAMES } from '../data/enemies';
import { setDebugScene } from '../debug';
import { Enemy, type EnemyWorld } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { audio, save } from '../services';
import { setupCollisions } from '../systems/CollisionSystem';
import { Effects } from '../systems/Effects';
import { buyUpgrade, createMatch, type MatchState, rollOffers } from '../systems/MatchState';
import { WaveSystem } from '../systems/WaveSystem';
import type { EnemyType, WaveDef } from '../types/game';
import { HUD } from '../ui/HUD';
import { openOptions, optionsOpen } from '../ui/Options';
import { PauseMenu } from '../ui/PauseMenu';
import { TouchControls } from '../ui/TouchControls';
import { TileView } from '../world/TileView';
import { TurretManager } from '../world/TurretManager';
import { BuildController } from './game/BuildController';
import { CombatController } from './game/CombatController';
import { createDebugApi } from './game/debugApi';
import type { GameContext } from './game/GameContext';
import { InputController } from './game/InputController';
import { PickupController } from './game/PickupController';
import type { GameOverData } from './GameOverScene';

/**
 * Cena da partida. Monta o mundo e coordena o quadro a quadro; o trabalho
 * fica nos controladores em ./game (entrada, combate, construção,
 * coletáveis) e as regras, nos sistemas. Tudo é criado em create() e
 * descartado no shutdown, então reiniciar a cena reinicia a partida sem sobras.
 */
export class GameScene extends Phaser.Scene {
  private match!: MatchState;
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
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private spawnPoints: Array<{ x: number; y: number }> = [];
  private spawnSide = 0;
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
    this.match = createMatch(save.data.settings.arena);
    this.waveDef = null;
    this.paused = false;
    this.ended = false;
    this.recorded = false;
    this.recordedKills = 0;
    this.spawnSide = 0;
    this.abort = new AbortController();
    const { level, building } = this.match;
    const worldW = level.cols * TILE;
    const worldH = level.rows * TILE;

    // Fundo em camadas (paralaxe em update).
    this.add.image(0, 0, 'bg-sky').setOrigin(0).setScrollFactor(0).setDepth(-30);
    this.far = this.add.tileSprite(0, VIEW_HEIGHT - 400, VIEW_WIDTH, 360, 'bg-far').setOrigin(0).setScrollFactor(0).setDepth(-20);
    this.near = this.add.tileSprite(0, VIEW_HEIGHT - 330, VIEW_WIDTH, 320, 'bg-near').setOrigin(0).setScrollFactor(0).setDepth(-10);

    this.physics.world.setBounds(0, 0, worldW, worldH);
    const view = new TileView(this, building);
    this.fx = new Effects(this);

    this.spawnPoints = level.enemySpawns.map((s) => ({ x: s.x * TILE + TILE / 2, y: (s.y + 1) * TILE - 24 }));
    for (const p of this.spawnPoints) {
      const portal = this.add.image(p.x, p.y - 12, 'portal').setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: portal, scaleX: 0.85, alpha: 0.7, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    this.player = new Player(this, level.playerSpawn.x * TILE + TILE / 2, level.playerSpawn.y * TILE, this.match.playerHealth, building, this.match.mods);
    this.enemies = this.add.group();
    this.hud = new HUD({
      onPause: () => this.togglePause(),
      onStartWave: () => this.waves.startNow(),
      onToggleBuild: () => this.build.setOpen(!this.build.open),
      onUpgrade: (id) => this.buy(id),
    });

    // Contexto compartilhado pelos controladores (ver ./game/GameContext).
    const scene = this;
    this.ctx = {
      scene, match: this.match, player: this.player, enemies: this.enemies, fx: this.fx, hud: this.hud,
      get now() { return scene.now; },
      get ended() { return scene.ended; },
      get paused() { return scene.paused; },
    };
    this.pickups = new PickupController(this.ctx);
    this.combat = new CombatController(this.ctx, this.pickups, {
      onEnemyKilled: (e) => this.waves.enemyRemoved(e.id),
      onPlayerDead: () => this.finish('defeat'),
    });
    this.turrets = new TurretManager(this, building, this.combat.turretBullets, () => this.match.mods.turretDamage, (x, y) => {
      this.fx.flash(x, y, 0xffb347, 0.5, 120);
      audio.play('turret');
    });
    this.build = new BuildController(this.ctx, view, this.turrets, this.combat, this.pickups);

    setupCollisions(this, {
      player: this.player, layer: view.layer, enemies: this.enemies, pickups: this.pickups.group,
      bullets: this.combat.bullets, turretBullets: this.combat.turretBullets, enemyBullets: this.combat.enemyBullets,
    }, {
      bulletHitsTile: (b, x, y) => this.combat.bulletHitsTile(b, x, y),
      bulletHitsEnemy: (b, e) => this.combat.bulletHitsEnemy(b, e),
      enemyBulletHitsTile: (b, x, y) => this.combat.enemyBulletHitsTile(b, x, y),
      enemyBulletHitsPlayer: (b) => this.combat.enemyBulletHitsPlayer(b),
      enemyTouchesPlayer: (e) => this.combat.enemyTouchesPlayer(e),
      playerCollects: (k) => this.pickups.collect(k),
    });

    this.waves = new WaveSystem({
      total: WAVES.total, firstPreparation: WAVES.firstPreparation, preparation: WAVES.preparation, completedPause: WAVES.completedPause,
      compose: composeWave,
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
    this.hud.banner(level.name, 'Monte suas defesas antes da primeira onda.', 3600);
    audio.setMusic('calm');

    this.exposeDebugApi();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
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
      spawnEnemy: (type, x, y) => this.spawnEnemy(type, x, y),
      finishAsVictory: () => this.finish('victory'),
    }));
  }

  // ---------------------------------------------------------------- laço

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);
    const now = this.now;
    const cam = this.cameras.main;
    this.far.tilePositionX = cam.scrollX * 0.12;
    this.near.tilePositionX = cam.scrollX * 0.3;

    if (!this.ended) {
      this.build.handleHotkeys(this.keys);
      if (this.keys.pressed('startWave')) this.waves.startNow();
      this.player.tick(now, dt, this.keys.playerInput(), {
        onJump: () => audio.play('jump'),
        onLand: () => { audio.play('land'); this.fx.burst(this.player.x, this.player.arcade.bottom, 0xcfd6ee, 4); },
        onJumpPad: () => { audio.play('pad'); this.fx.spark(this.player.x, this.player.arcade.bottom, 0x67e8f9, 12); },
        onMelee: () => audio.play('slash'),
        onShoot: () => this.combat.shoot(),
        onDash: () => { audio.play('dash'); this.fx.spark(this.player.x, this.player.arcade.center.y, 0x67e8f9, 10); },
      });
      this.combat.resolveMelee(now);
      this.waves.update(dt);
    }

    const boss = this.updateEnemies(now, dt);
    this.turrets.update(now, this.enemies.getChildren() as Enemy[]);
    this.pickups.update(now, dt);
    this.build.update();
    this.updateHud(now, boss);
    if (!this.ended) audio.setMusic(boss ? 'boss' : this.waves.phase === 'fighting' ? 'battle' : 'calm');
    this.keys.endFrame();
  }

  /** Atualiza a IA dos inimigos e os espinhos. Devolve o chefe em campo, se houver. */
  private updateEnemies(now: number, dt: number): Enemy | null {
    const pb = this.player.arcade;
    const world: EnemyWorld = {
      now, building: this.match.building,
      target: { x: pb.center.x, y: pb.center.y, bottom: pb.bottom, alive: !this.match.playerHealth.dead },
      spawnPoints: this.spawnPoints,
      hitBlock: (x, y, dmg) => this.combat.enemyHitsBlock(x, y, dmg),
      shoot: (e, x, y, tx, ty) => this.combat.enemyShoot(e, x, y, tx, ty),
      slam: (e) => this.combat.bossSlam(e),
      onRecovered: (e) => this.fx.flash(e.x, e.y, 0xb48cff, 1.2),
    };
    let boss: Enemy | null = null;
    for (const e of (this.enemies.getChildren() as Enemy[]).slice()) {
      e.tick(dt, world);
      if (!e.alive) continue;
      if (e.def.behavior !== 'flyer') this.combat.applySpikes(e, now);
      if (e.def.behavior === 'boss') boss = e;
    }
    return boss;
  }

  private updateHud(now: number, boss: Enemy | null): void {
    const h = this.match.playerHealth;
    this.hud.update({
      hp: h.hp, maxHp: h.max, resources: this.match.resources.value,
      wave: this.waves.number, totalWaves: WAVES.total, endless: this.waves.endless,
      phase: this.waves.phase, remaining: this.waves.remaining, timer: this.waves.timer,
      meleeCd: this.player.meleeCd.fraction(now), shotCd: this.player.shotCd.fraction(now), dashCd: this.player.dashCd.fraction(now),
      offers: this.match.offers,
      boss: boss ? { name: ENEMY_NAMES.boss, ratio: boss.health.hp / boss.health.max } : null,
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

  private spawnEnemy(type: EnemyType, x: number, y: number, hpScale = 1): Enemy {
    const e = new Enemy(this, x, y, type, hpScale);
    this.enemies.add(e);
    this.fx.flash(x, y, 0xb48cff, 1.1, 260);
    return e;
  }

  private spawnWaveEnemy(type: EnemyType): number | null {
    if (this.enemies.getLength() >= WAVES.maxActiveEnemies) return null;
    const p = this.spawnPoints[this.spawnSide++ % this.spawnPoints.length];
    // Grandes nascem mais alto para não ficar dentro do chão; voadores, no ar.
    const lift = type === 'boss' ? 30 : type === 'tank' ? 16 : type === 'flyer' ? TILE * 4 : 0;
    return this.spawnEnemy(type, p.x, p.y - lift, this.waveDef?.hpScale ?? 1).id;
  }

  private onWaveStart(def: WaveDef): void {
    this.waveDef = def;
    audio.play('waveStart');
    this.hud.banner(`Onda ${def.number}${def.boss ? ' — CHEFE' : ''}`, `${def.enemies.length} inimigos a caminho`, 2400);
  }

  private onWaveComplete(def: WaveDef): void {
    this.match.resources.add(def.reward);
    const healed = Math.round(this.match.playerHealth.heal(WAVES.healOnClear));
    rollOffers(this.match);
    audio.play('waveClear');
    this.hud.banner(`Onda ${def.number} concluída`, `+${def.reward} materiais${healed > 0 ? ` · +${healed} de vida` : ''}`, 2600);
    if (def.number > save.data.bestWave) { save.data.bestWave = def.number; save.save(); }
  }

  // ------------------------------------------------------ pausa e término

  private togglePause(): void {
    if (this.ended) return;
    this.paused = !this.paused;
    this.keys.release();
    this.pauseMenu.setOpen(this.paused);
    audio.play('click');
    if (this.paused) this.scene.pause();
    else this.scene.resume();
  }

  private finish(outcome: 'victory' | 'defeat'): void {
    if (this.ended) return;
    this.ended = true;
    this.match.outcome = outcome;
    this.build.close();
    this.keys.release();
    const waves = this.waves.completed;
    let record: boolean;
    if (!this.recorded) {
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
    audio.setMusic(null);
    audio.play(outcome === 'victory' ? 'victory' : 'defeat');
    if (outcome === 'defeat') {
      this.player.arcade.setAcceleration(0, 0);
      this.player.play('player-hurt', true);
      this.fx.burst(this.player.x, this.player.arcade.center.y, 0x67e8f9, 24);
    }
    const data: GameOverData = {
      outcome, waves, kills: this.match.kills, blocksPlaced: this.match.blocksPlaced,
      bestWave: Math.max(save.data.bestWave, waves), record,
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
    this.waves.continueEndless();
    this.scene.resume();
    this.hud.banner('Modo infinito', 'As ondas continuam ficando mais difíceis.', 2600);
    this.exposeDebugApi();
  }

  private cleanup(): void {
    this.abort.abort();
    this.build.destroy();
    this.turrets.destroy();
    this.hud.destroy();
    this.pauseMenu.destroy();
    this.touch.destroy();
    this.keys.destroy();
    this.input.off(Phaser.Input.Events.POINTER_DOWN);
  }
}
