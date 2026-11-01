/**
 * MEGA STAR – Main Game Engine
 * Manages game loop, state transitions, parallax background,
 * camera shake, score tracking, and input handling.
 */

import { Player } from './player.js';
import { ObstacleManager } from './obstacles.js';
import { audio } from './audio.js';
import { UIManager } from './ui.js';

export const GameState = {
  MENU: 'MENU',
  READY: 'READY',
  PLAYING: 'PLAYING',
  GAMEOVER: 'GAMEOVER'
};

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    // Virtual resolution (fixed logical game coordinates)
    this.logicalWidth = 440;
    this.logicalHeight = 720;

    // High Score Persistence
    const savedBest = localStorage.getItem('megastar_high_score');
    this.bestScore = savedBest ? parseInt(savedBest, 10) : 0;
    this.score = 0;

    // State
    this.state = GameState.MENU;
    window.__gameState = this.state;

    // Subsystems
    this.player = new Player(this.logicalWidth, this.logicalHeight);
    this.obstacles = new ObstacleManager(this.logicalWidth, this.logicalHeight);
    this.ui = new UIManager();

    // Background Image
    this.bgImage = new Image();
    this.bgImage.src = '/assets/background.jpg';
    this.bgLoaded = false;
    this.bgImage.onload = () => {
      this.bgLoaded = true;
    };
    this.bgScrollX = 0;

    // Daytime Visual Systems
    this.floatingScores = [];
    this.ambientSparks = [];
    this.screenShake = 0;
    this.flashAlpha = 0;
    this.lastTime = 0;

    // Init daytime floating sunlight sparkles & atmospheric motes
    for (let i = 0; i < 28; i++) {
      this.ambientSparks.push({
        x: Math.random() * this.logicalWidth,
        y: Math.random() * this.logicalHeight,
        vy: -(Math.random() * 20 + 10),
        vx: (Math.random() * 16 - 8),
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.65 + 0.25,
        color: Math.random() > 0.5 ? '#ffffff' : (Math.random() > 0.5 ? '#fff3c4' : '#bae6fd')
      });
    }

    this.initClouds();

    this.setupResize();
    this.setupInputs();
    this.setupUI();
  }

  /**
   * Pre-render fluffy white cloud textures onto offscreen canvases for crisp 60fps rendering
   */
  initClouds() {
    this.cloudTextures = [];

    // Helper to generate an organic, soft, volumetric fluffy cumulus cloud
    const createCloud = (w, h, lobes) => {
      const oc = document.createElement('canvas');
      oc.width = w;
      oc.height = h;
      const c = oc.getContext('2d');

      // 1. Draw unified cloud silhouette in one continuous path
      c.fillStyle = '#ffffff';
      c.beginPath();
      lobes.forEach(([cx, cy, r]) => {
        c.moveTo(cx + r, cy);
        c.arc(cx, cy, r, 0, Math.PI * 2);
      });
      c.closePath();
      c.fill();

      // Rounded bottom base
      const minX = Math.min(...lobes.map(l => l[0] - l[2] * 0.7));
      const maxX = Math.max(...lobes.map(l => l[0] + l[2] * 0.7));
      const maxY = Math.max(...lobes.map(l => l[1] + l[2] * 0.35));
      c.beginPath();
      c.roundRect(minX, maxY - 10, maxX - minX, 16, 8);
      c.fill();

      // 2. Clip strictly inside cloud shape for volumetric shading
      c.globalCompositeOperation = 'source-atop';

      // Soft underside sky-blue atmospheric shadow
      const shadowGrad = c.createLinearGradient(0, h * 0.15, 0, h);
      shadowGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      shadowGrad.addColorStop(0.5, 'rgba(238, 246, 255, 0.45)');
      shadowGrad.addColorStop(0.82, 'rgba(195, 222, 248, 0.8)');
      shadowGrad.addColorStop(1, 'rgba(165, 204, 238, 0.95)');
      c.fillStyle = shadowGrad;
      c.fillRect(0, 0, w, h);

      // Warm golden sunlit rim on top lobes
      lobes.forEach(([cx, cy, r]) => {
        const hg = c.createRadialGradient(cx + r * 0.2, cy - r * 0.5, 2, cx, cy - r * 0.2, r * 0.85);
        hg.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        hg.addColorStop(0.35, 'rgba(255, 252, 235, 0.55)');
        hg.addColorStop(0.8, 'rgba(255, 255, 255, 0)');
        c.fillStyle = hg;
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.fill();
      });

      c.globalCompositeOperation = 'source-over';
      return oc;
    };

    // Type 0: Classic 5-lobe puffy cumulus
    this.cloudTextures.push(createCloud(220, 120, [
      [50, 72, 32],
      [90, 52, 44],
      [135, 54, 40],
      [172, 74, 28],
      [112, 74, 34]
    ]));

    // Type 1: Broad billowing 7-lobe cloud cluster
    this.cloudTextures.push(createCloud(260, 130, [
      [48, 80, 30],
      [82, 58, 38],
      [125, 42, 46],
      [172, 48, 42],
      [212, 72, 32],
      [110, 78, 36],
      [158, 78, 36]
    ]));

    // Type 2: Gentle wispy 4-lobe drifting puff
    this.cloudTextures.push(createCloud(180, 100, [
      [40, 58, 26],
      [78, 44, 36],
      [120, 50, 32],
      [148, 64, 22]
    ]));

    // Parallax cloud layers at different heights, speeds, and depths
    this.clouds = [
      // High altitude tier (slower, gentle, higher in sky: y 35-120)
      { x: 20, y: 40, baseY: 40, w: 130, h: 70, speed: 7, alpha: 0.72, type: 0 },
      { x: 220, y: 90, baseY: 90, w: 150, h: 75, speed: 9, alpha: 0.68, type: 2 },
      { x: 390, y: 50, baseY: 50, w: 140, h: 70, speed: 8, alpha: 0.70, type: 1 },

      // Mid altitude tier (fluffy cumulus, rich volume: y 150-320)
      { x: -40, y: 155, baseY: 155, w: 185, h: 92, speed: 17, alpha: 0.90, type: 1 },
      { x: 160, y: 225, baseY: 225, w: 170, h: 88, speed: 20, alpha: 0.88, type: 0 },
      { x: 350, y: 180, baseY: 180, w: 190, h: 95, speed: 18, alpha: 0.92, type: 2 },

      // Lower sky tier (soft drifting clouds: y 340-520)
      { x: 30, y: 340, baseY: 340, w: 200, h: 100, speed: 26, alpha: 0.80, type: 1 },
      { x: 260, y: 420, baseY: 420, w: 190, h: 95, speed: 28, alpha: 0.76, type: 0 },
      { x: 440, y: 370, baseY: 370, w: 175, h: 88, speed: 25, alpha: 0.75, type: 2 },
      { x: -80, y: 480, baseY: 480, w: 220, h: 110, speed: 30, alpha: 0.70, type: 1 }
    ];
  }

  setupResize() {
    const resize = () => {
      const container = document.getElementById('game-container') || document.body;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5); // Cap for mobile battery/perf

      this.canvas.width = Math.floor(rect.width * dpr);
      this.canvas.height = Math.floor(rect.height * dpr);

      // Dynamic logical width for full-screen responsive layout without stretching
      this.logicalHeight = 720;
      this.logicalWidth = Math.max(320, Math.round(this.logicalHeight * (rect.width / Math.max(1, rect.height))));

      this.player.canvasWidth = this.logicalWidth;
      this.player.canvasHeight = this.logicalHeight;
      this.obstacles.canvasWidth = this.logicalWidth;
      this.obstacles.canvasHeight = this.logicalHeight;

      // Uniform scale for crisp, undistorted rendering across any aspect ratio
      const scale = this.canvas.height / this.logicalHeight;
      this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };

    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    resize();
  }

  setupUI() {
    this.ui.init(
      // onPlay
      () => {
        audio.unlockAudio();
        this.prepareGame();
      },
      // onRestart
      () => {
        audio.unlockAudio();
        this.restartGame();
      },
      // onHome
      () => {
        audio.unlockAudio();
        this.goToMenu();
      },
      // onToggleSound
      () => {
        this.audio.toggleMute();
        this.ui.updateSoundButton(this.audio.isMuted());
      },
      audio.isMuted(),
      this.bestScore,
      // onChangeMusic
      () => {
        audio.unlockAudio();
        this.audio.changeMusic();
      }
    );
  }

  get audio() {
    return audio;
  }

  setupInputs() {
    // Action trigger for flap / start
    const handleAction = (e) => {
      if (e) {
        if (e.target && (e.target.closest('button') || e.target.closest('#menu-screen') || e.target.closest('#game-over-screen'))) {
          // Allow clicks on buttons
          return;
        }
        if (e.cancelable) e.preventDefault();
      }

      audio.unlockAudio();

      if (this.state === GameState.READY) {
        this.startGameplay();
        this.player.flap();
      } else if (this.state === GameState.PLAYING) {
        this.player.flap();
      }
    };

    // Canvas and container mouse/touch events for desktop and mobile
    const container = document.getElementById('game-container') || this.canvas;
    container.addEventListener('mousedown', handleAction);
    container.addEventListener('touchstart', handleAction, { passive: false });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (this.state === GameState.READY || this.state === GameState.PLAYING) {
          e.preventDefault();
          handleAction();
        } else if (this.state === GameState.GAMEOVER && !this.ui.gameOverScreen.classList.contains('hidden')) {
          e.preventDefault();
          this.restartGame();
        }
      } else if (e.code === 'Enter') {
        if (this.state === GameState.GAMEOVER && !this.ui.gameOverScreen.classList.contains('hidden')) {
          e.preventDefault();
          this.restartGame();
        } else if (this.state === GameState.MENU) {
          e.preventDefault();
          this.prepareGame();
        }
      }
    });
  }

  goToMenu() {
    if (this.gameOverTimeout) {
      clearTimeout(this.gameOverTimeout);
      this.gameOverTimeout = null;
    }
    this.state = GameState.MENU;
    window.__gameState = this.state;
    this.score = 0;
    this.player.reset();
    this.obstacles.reset();
    this.floatingScores = [];
    this.screenShake = 0;
    this.flashAlpha = 0;
    audio.stopBgm();
    audio.resetForNewGame();
    this.ui.showMenu(this.bestScore);
  }

  prepareGame() {
    if (this.gameOverTimeout) {
      clearTimeout(this.gameOverTimeout);
      this.gameOverTimeout = null;
    }
    this.state = GameState.READY;
    window.__gameState = this.state;
    this.score = 0;
    this.player.reset();
    this.obstacles.reset();
    this.floatingScores = [];
    this.screenShake = 0;
    this.flashAlpha = 0;
    audio.resetForNewGame();
    this.ui.showReadyPrompt();
  }

  startGameplay() {
    this.state = GameState.PLAYING;
    window.__gameState = this.state;
    this.ui.hideReadyPrompt();
    audio.playBgm();
  }

  restartGame() {
    if (this.gameOverTimeout) {
      clearTimeout(this.gameOverTimeout);
      this.gameOverTimeout = null;
    }
    this.prepareGame();
  }

  onScore() {
    this.score++;
    this.ui.updateScore(this.score);
    audio.playScore();

    // Spawn floating golden score popup text
    this.floatingScores.push({
      x: this.player.x + 30,
      y: this.player.y - 20,
      text: '+1',
      alpha: 1,
      vy: -60,
      life: 0.8
    });
  }

  triggerGameOver() {
    if (this.state === GameState.GAMEOVER) return;

    this.state = GameState.GAMEOVER;
    window.__gameState = this.state;
    this.player.alive = false;

    // Camera shake and crimson flash
    this.screenShake = 16;
    this.flashAlpha = 0.65;

    // Check & persist high score
    let isNewRecord = false;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      isNewRecord = true;
      localStorage.setItem('megastar_high_score', this.bestScore.toString());
    }

    // Show Game Over UI after brief impact delay and play Game Over dialogue strictly once
    if (this.gameOverTimeout) {
      clearTimeout(this.gameOverTimeout);
    }
    this.gameOverTimeout = setTimeout(() => {
      if (this.state === GameState.GAMEOVER) {
        this.ui.showGameOver(this.score, this.bestScore, isNewRecord);
        audio.playLoseDialogue();
      }
    }, 450);
  }

  update(dt) {
    // Parallax background scrolling (smooth continuous scrolling)
    const bgSpeed = this.state === GameState.PLAYING ? 28 : 8;
    this.bgScrollX = (this.bgScrollX + bgSpeed * dt) % 151200;

    // Multi-layer parallax cloud movement
    const cloudSpeedMult = this.state === GameState.PLAYING ? 1.5 : 0.85;
    for (const cloud of this.clouds) {
      cloud.x -= cloud.speed * cloudSpeedMult * dt;
      if (cloud.x + cloud.w < -50) {
        cloud.x = this.logicalWidth + 30 + Math.random() * 80;
        cloud.y = cloud.baseY + (Math.random() * 24 - 12);
      }
    }

    // Ambient floating daytime sparkles & motes update
    for (const spark of this.ambientSparks) {
      spark.y += spark.vy * dt;
      spark.x += spark.vx * dt;
      if (spark.y < -10) {
        spark.y = this.logicalHeight + 10;
        spark.x = Math.random() * this.logicalWidth;
      }
    }

    // Update screen shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 40);
    }
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.5);
    }

    // Update floating score notifications
    for (let i = this.floatingScores.length - 1; i >= 0; i--) {
      const fs = this.floatingScores[i];
      fs.y += fs.vy * dt;
      fs.life -= dt;
      fs.alpha = Math.max(0, fs.life / 0.8);
      if (fs.life <= 0) {
        this.floatingScores.splice(i, 1);
      }
    }

    // State specific updates
    if (this.state === GameState.MENU || this.state === GameState.READY) {
      this.player.updateIdle(dt);
    } else if (this.state === GameState.PLAYING) {
      this.player.update(dt);
      this.obstacles.update(dt, this.score, () => this.onScore());

      // Collision Detection
      if (this.obstacles.checkCollision(this.player)) {
        this.triggerGameOver();
      }
    } else if (this.state === GameState.GAMEOVER) {
      this.player.update(dt);
    }
  }

  drawBackground() {
    const ctx = this.ctx;
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    // 1. Primary Daytime Sky: Clear, vibrant bright blue gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#177be5');    // Radiant deep daytime blue
    sky.addColorStop(0.28, '#2fa2f5'); // Clear azure
    sky.addColorStop(0.62, '#62c1fa'); // Soft cheerful sky blue
    sky.addColorStop(0.86, '#bae6fd'); // Atmospheric sky haze
    sky.addColorStop(1, '#fef3c7');    // Soft warm golden horizon kiss
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // 2. Radiant Sun & Warm Sunlight Beams
    ctx.save();
    const sunX = w * 0.78;
    const sunY = 75;
    const time = performance.now() * 0.001;

    // Outer warm atmospheric glow
    const outerGlow = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 180);
    outerGlow.addColorStop(0, 'rgba(255, 245, 190, 0.45)');
    outerGlow.addColorStop(0.4, 'rgba(255, 230, 140, 0.18)');
    outerGlow.addColorStop(0.7, 'rgba(255, 215, 100, 0.06)');
    outerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 180, 0, Math.PI * 2);
    ctx.fill();

    // Sun core corona
    const corona = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 55);
    corona.addColorStop(0, '#ffffff');
    corona.addColorStop(0.35, 'rgba(255, 252, 220, 0.95)');
    corona.addColorStop(0.7, 'rgba(255, 235, 150, 0.5)');
    corona.addColorStop(1, 'transparent');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 55, 0, Math.PI * 2);
    ctx.fill();

    // Bright solar disc
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
    ctx.fill();

    // Subtle warm golden sunlight rays angling down across the sky
    const rayCount = 5;
    for (let i = 0; i < rayCount; i++) {
      const baseAngle = 0.52 + (i * 0.23);
      const sway = Math.sin(time * 0.65 + i * 1.4) * 0.035;
      const angle = baseAngle + sway;
      const rayLength = h * 1.15;

      ctx.save();
      ctx.translate(sunX, sunY);
      ctx.rotate(angle);

      const rayGrad = ctx.createLinearGradient(0, 0, 0, rayLength);
      rayGrad.addColorStop(0, 'rgba(255, 250, 220, 0.16)');
      rayGrad.addColorStop(0.45, 'rgba(255, 238, 170, 0.07)');
      rayGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(-14, 22);
      ctx.lineTo(-50, rayLength);
      ctx.lineTo(50, rayLength);
      ctx.lineTo(14, 22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 4. Parallax Fluffy White Clouds (soft, at different heights, moving gently)
    ctx.save();
    for (const cloud of this.clouds) {
      if (this.cloudTextures[cloud.type]) {
        ctx.globalAlpha = cloud.alpha;
        ctx.drawImage(this.cloudTextures[cloud.type], cloud.x, cloud.y, cloud.w, cloud.h);
      }
    }
    ctx.restore();

    // 5. Beautiful Green Garden Landscape (Far Hills, Midground Meadows, Lush Garden Foreground)
    this.drawFarHills(ctx, w, h, this.bgScrollX);
    this.drawMidHills(ctx, w, h, this.bgScrollX);
    this.drawForegroundGarden(ctx, w, h, this.bgScrollX);

    // 6. Subtle daytime sunlight motes & floating sparkles
    ctx.save();
    for (const spark of this.ambientSparks) {
      ctx.globalAlpha = spark.alpha * 0.75;
      ctx.fillStyle = spark.color;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * 1. Far Distant Rolling Green Hills (Soft pale mint / sage-green with atmospheric haze)
   */
  drawFarHills(ctx, w, h, scroll) {
    ctx.save();
    const period = 540;
    const scrollOffset = scroll * 0.18;

    const grad = ctx.createLinearGradient(0, h - 90, 0, h);
    grad.addColorStop(0, '#8ecfa0');    // Soft sunlit sage
    grad.addColorStop(0.45, '#76be8c'); // Gentle meadow green
    grad.addColorStop(1, '#5ca674');    // Soft atmospheric base

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-20, h);

    const getFarY = (worldX) => {
      const theta = (worldX / period) * Math.PI * 2;
      return h - 74 + Math.sin(theta) * 16 + Math.cos(theta * 2) * 8;
    };

    const step = 15;
    for (let x = -20; x <= w + 30; x += step) {
      const worldX = x + scrollOffset;
      ctx.lineTo(x, getFarY(worldX));
    }
    ctx.lineTo(w + 30, h);
    ctx.closePath();
    ctx.fill();

    // Subtle sunlit crest highlight along the top edge
    ctx.strokeStyle = 'rgba(255, 255, 220, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = -20; x <= w + 30; x += step) {
      const worldX = x + scrollOffset;
      if (x === -20) ctx.moveTo(x, getFarY(worldX));
      else ctx.lineTo(x, getFarY(worldX));
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 2. Midground Rolling Hills & Soft Tree/Bush Groves
   */
  drawMidHills(ctx, w, h, scroll) {
    ctx.save();
    const period = 420;
    const scrollOffset = scroll * 0.38;

    const grad = ctx.createLinearGradient(0, h - 68, 0, h);
    grad.addColorStop(0, '#5cb843');    // Vibrant warm lime-green crest
    grad.addColorStop(0.5, '#429c30');  // Natural meadow green
    grad.addColorStop(1, '#2d7920');    // Rich depth green

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-20, h);

    const getMidY = (worldX) => {
      const theta = (worldX / period) * Math.PI * 2;
      return h - 52 + Math.sin(theta) * 12 + Math.sin(theta * 2 + 0.8) * 6;
    };

    const step = 12;
    for (let x = -20; x <= w + 30; x += step) {
      const worldX = x + scrollOffset;
      ctx.lineTo(x, getMidY(worldX));
    }
    ctx.lineTo(w + 30, h);
    ctx.closePath();
    ctx.fill();

    // Soft golden-green crest highlight
    ctx.strokeStyle = 'rgba(215, 255, 150, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = -20; x <= w + 30; x += step) {
      const worldX = x + scrollOffset;
      if (x === -20) ctx.moveTo(x, getMidY(worldX));
      else ctx.lineTo(x, getMidY(worldX));
    }
    ctx.stroke();

    // Midground soft rolling tree mounds along the crest
    const treeGroves = [
      { dx: 75, w: 28, h: 13 },
      { dx: 215, w: 36, h: 16 },
      { dx: 335, w: 26, h: 12 }
    ];
    const minSlice = Math.floor((scrollOffset - 60) / period);
    const maxSlice = Math.ceil((scrollOffset + w + 60) / period);

    for (let s = minSlice; s <= maxSlice; s++) {
      for (const tg of treeGroves) {
        const worldX = s * period + tg.dx;
        const screenX = worldX - scrollOffset;
        if (screenX < -40 || screenX > w + 40) continue;

        const groundY = getMidY(worldX);
        const r = tg.h;

        const tGrad = ctx.createLinearGradient(screenX, groundY - r * 1.2, screenX, groundY);
        tGrad.addColorStop(0, '#72d244');
        tGrad.addColorStop(0.5, '#4caa2c');
        tGrad.addColorStop(1, '#2c7a1c');

        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.arc(screenX - tg.w * 0.32, groundY - r * 0.45, r * 0.65, 0, Math.PI * 2);
        ctx.arc(screenX + tg.w * 0.32, groundY - r * 0.45, r * 0.65, 0, Math.PI * 2);
        ctx.arc(screenX, groundY - r * 0.75, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * 3. Foreground Lush Green Garden, Grass Tufts, Bushes & Colourful Arcade Flowers
   */
  drawForegroundGarden(ctx, w, h, scroll) {
    ctx.save();
    const period = 360;
    const scrollOffset = scroll * 0.85;

    const getForeY = (worldX) => {
      const theta = (worldX / period) * Math.PI * 2;
      return h - 34 + Math.sin(theta) * 6 + Math.cos(theta * 2 + 1.2) * 3;
    };

    // 1. Lush Green Ground Polygon
    const groundGrad = ctx.createLinearGradient(0, h - 42, 0, h);
    groundGrad.addColorStop(0, '#3ba82e');    // Sunlit fresh lawn green
    groundGrad.addColorStop(0.35, '#2b8720'); // Rich vibrant grass green
    groundGrad.addColorStop(0.75, '#1e6816'); // Deep garden turf
    groundGrad.addColorStop(1, '#144c10');    // Earthy garden base

    ctx.fillStyle = groundGrad;
    ctx.beginPath();
    ctx.moveTo(-20, h);

    const step = 8;
    for (let x = -20; x <= w + 25; x += step) {
      const worldX = x + scrollOffset;
      ctx.lineTo(x, getForeY(worldX));
    }
    ctx.lineTo(w + 25, h);
    ctx.closePath();
    ctx.fill();

    // 2. Vibrant sunlight rim along the grass edge
    ctx.strokeStyle = '#7ee840';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = -20; x <= w + 25; x += step) {
      const worldX = x + scrollOffset;
      if (x === -20) ctx.moveTo(x, getForeY(worldX));
      else ctx.lineTo(x, getForeY(worldX));
    }
    ctx.stroke();

    // Determine slice range for seamless looping
    const minSlice = Math.floor((scrollOffset - 40) / period);
    const maxSlice = Math.ceil((scrollOffset + w + 40) / period);

    // 3. Natural Grass Tufts along the undulating edge
    ctx.fillStyle = '#68dd32';
    for (let s = minSlice; s <= maxSlice; s++) {
      for (let offset = 8; offset < period; offset += 18) {
        const worldX = s * period + offset;
        const screenX = worldX - scrollOffset;
        if (screenX < -15 || screenX > w + 15) continue;

        const groundY = getForeY(worldX);
        const tuftHeight = 4 + (offset % 5);

        ctx.beginPath();
        ctx.moveTo(screenX - 2.5, groundY);
        ctx.quadraticCurveTo(screenX - 4, groundY - tuftHeight, screenX - 2, groundY - tuftHeight - 1);
        ctx.lineTo(screenX, groundY);
        ctx.quadraticCurveTo(screenX + 3, groundY - tuftHeight - 2, screenX + 3.5, groundY);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 4. Lush Garden Bushes (Natural soft organic clusters)
    const bushes = [
      { dx: 45, r: 12, colorTop: '#78df38', colorBase: '#267b1a' },
      { dx: 140, r: 10, colorTop: '#82e840', colorBase: '#2a8220' },
      { dx: 235, r: 13, colorTop: '#78df38', colorBase: '#227318' },
      { dx: 315, r: 9, colorTop: '#88ee45', colorBase: '#2a8220' }
    ];

    for (let s = minSlice; s <= maxSlice; s++) {
      for (const bush of bushes) {
        const worldX = s * period + bush.dx;
        const screenX = worldX - scrollOffset;
        if (screenX < -30 || screenX > w + 30) continue;

        const groundY = getForeY(worldX);
        const r = bush.r;

        // Soft organic multi-lobe foliage
        const bGrad = ctx.createLinearGradient(screenX, groundY - r * 1.3, screenX, groundY);
        bGrad.addColorStop(0, bush.colorTop);
        bGrad.addColorStop(0.55, '#399f24');
        bGrad.addColorStop(1, bush.colorBase);

        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(screenX - r * 0.5, groundY - r * 0.35, r * 0.65, 0, Math.PI * 2);
        ctx.arc(screenX + r * 0.5, groundY - r * 0.35, r * 0.65, 0, Math.PI * 2);
        ctx.arc(screenX, groundY - r * 0.65, r * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Subtle sunny leaf accent on top lobe
        ctx.fillStyle = 'rgba(235, 255, 170, 0.45)';
        ctx.beginPath();
        ctx.arc(screenX, groundY - r * 0.72, r * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Colourful Arcade Garden Flowers
    const flowers = [
      { dx: 22, type: 'gold', size: 4.5, dy: -2 },
      { dx: 68, type: 'white', size: 4.8, dy: -1 },
      { dx: 95, type: 'poppy', size: 4.5, dy: -3 },
      { dx: 122, type: 'violet', size: 4.2, dy: -1 },
      { dx: 165, type: 'gold', size: 4.8, dy: -4 },
      { dx: 195, type: 'white', size: 4.5, dy: -2 },
      { dx: 220, type: 'poppy', size: 4.6, dy: -2 },
      { dx: 255, type: 'violet', size: 4.3, dy: -3 },
      { dx: 285, type: 'white', size: 4.6, dy: -1 },
      { dx: 305, type: 'gold', size: 4.5, dy: -3 },
      { dx: 340, type: 'poppy', size: 4.4, dy: -2 }
    ];

    for (let s = minSlice; s <= maxSlice; s++) {
      for (const fl of flowers) {
        const worldX = s * period + fl.dx;
        const screenX = worldX - scrollOffset;
        if (screenX < -20 || screenX > w + 20) continue;

        const groundY = getForeY(worldX);
        const flowerY = groundY + fl.dy;

        // Stem
        ctx.strokeStyle = '#2d7c1e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(screenX, groundY + 3);
        ctx.quadraticCurveTo(screenX + 1, flowerY + 3, screenX, flowerY);
        ctx.stroke();

        // Tiny green leaf on stem
        ctx.fillStyle = '#48ab2c';
        ctx.beginPath();
        ctx.ellipse(screenX + 2, flowerY + 3, 2.5, 1.2, 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Petals & Center
        const r = fl.size;
        if (fl.type === 'poppy') {
          // Vibrant Red Poppy (4 petals)
          ctx.fillStyle = '#f43f5e';
          ctx.beginPath();
          ctx.arc(screenX - r * 0.45, flowerY, r * 0.55, 0, Math.PI * 2);
          ctx.arc(screenX + r * 0.45, flowerY, r * 0.55, 0, Math.PI * 2);
          ctx.arc(screenX, flowerY - r * 0.45, r * 0.55, 0, Math.PI * 2);
          ctx.arc(screenX, flowerY + r * 0.45, r * 0.55, 0, Math.PI * 2);
          ctx.fill();
          // Center
          ctx.fillStyle = '#881337';
          ctx.beginPath();
          ctx.arc(screenX, flowerY, r * 0.32, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(screenX - 0.8, flowerY - 0.8, 1, 0, Math.PI * 2);
          ctx.fill();
        } else if (fl.type === 'white') {
          // Dainty White Daisy (5 petals)
          ctx.fillStyle = '#ffffff';
          for (let p = 0; p < 5; p++) {
            const ang = (p / 5) * Math.PI * 2;
            const px = screenX + Math.cos(ang) * (r * 0.5);
            const py = flowerY + Math.sin(ang) * (r * 0.5);
            ctx.beginPath();
            ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
            ctx.fill();
          }
          // Golden center
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(screenX, flowerY, r * 0.35, 0, Math.PI * 2);
          ctx.fill();
        } else if (fl.type === 'gold') {
          // Buttercup (Bright Yellow with warm amber center)
          ctx.fillStyle = '#fde047';
          for (let p = 0; p < 5; p++) {
            const ang = (p / 5) * Math.PI * 2;
            const px = screenX + Math.cos(ang) * (r * 0.48);
            const py = flowerY + Math.sin(ang) * (r * 0.48);
            ctx.beginPath();
            ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#d97706';
          ctx.beginPath();
          ctx.arc(screenX, flowerY, r * 0.35, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Violet / Lavender (Soft violet-pink)
          ctx.fillStyle = '#d8b4fe';
          for (let p = 0; p < 5; p++) {
            const ang = (p / 5) * Math.PI * 2;
            const px = screenX + Math.cos(ang) * (r * 0.48);
            const py = flowerY + Math.sin(ang) * (r * 0.48);
            ctx.beginPath();
            ctx.arc(px, py, r * 0.45, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#fae8ff';
          ctx.beginPath();
          ctx.arc(screenX, flowerY, r * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();

    // Camera shake offset
    if (this.screenShake > 0) {
      const shakeX = (Math.random() * 2 - 1) * this.screenShake;
      const shakeY = (Math.random() * 2 - 1) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Draw Background
    this.drawBackground();

    // 2. Draw Obstacles (in READY, PLAYING, or GAMEOVER)
    if (this.state !== GameState.MENU) {
      this.obstacles.draw(ctx);
    }

    // 3. Draw Player Character (in READY, PLAYING, or GAMEOVER)
    if (this.state !== GameState.MENU) {
      this.player.draw(ctx);
    }

    // 4. Draw Floating Score Popups
    for (const fs of this.floatingScores) {
      ctx.save();
      ctx.globalAlpha = fs.alpha;
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#f5c518';
      ctx.shadowBlur = 10;
      ctx.font = '900 24px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText(fs.text, fs.x, fs.y);
      ctx.restore();
    }

    // 5. Impact Red Flash on Collision
    if (this.flashAlpha > 0) {
      ctx.fillStyle = `rgba(180, 20, 35, ${this.flashAlpha})`;
      ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
    }

    // 6. Subtle Atmospheric Daytime Perimeter
    const vignette = ctx.createRadialGradient(
      this.logicalWidth / 2, this.logicalHeight / 2, this.logicalHeight * 0.45,
      this.logicalWidth / 2, this.logicalHeight / 2, this.logicalHeight * 0.75
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(12, 54, 98, 0.16)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    ctx.restore();
  }

  start() {
    this.lastTime = performance.now();
    const loop = (currentTime) => {
      // Calculate delta time, clamped to 0.1s to prevent physics blowup on tab switch
      const dt = Math.min((currentTime - this.lastTime) * 0.001, 0.1);
      this.lastTime = currentTime;

      this.update(dt);
      this.draw();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}
