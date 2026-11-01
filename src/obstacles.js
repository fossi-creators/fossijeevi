/**
 * MEGA STAR – Cinematic Brick Wall Obstacles
 * Renders beveled red and dark-gold textured brick fortresses with stone capitals,
 * glowing lanterns, floating embers, and precise arcade hitboxes.
 */

export class ObstacleManager {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    this.obstacles = [];
    this.wallWidth = 74;
    this.capitalHeight = 28;
    this.capitalOverhang = 7;
    this.spawnDistance = 351; // Increased by 30% from 270 for smoother reaction time and comfortable navigation
    this.lastSpawnX = 0;

    // Embers emitted by brick wall lanterns
    this.wallEmbers = [];
  }

  reset() {
    this.obstacles = [];
    this.wallEmbers = [];
    this.lastSpawnX = 0;
  }

  getSpeed(score) {
    // Smooth progressive speed scale from 185 px/s up to 265 px/s
    return Math.min(265, 185 + Math.floor(score * 3.2));
  }

  getGapSize(score) {
    // Starts comfortable at 172px, gracefully tightens to 155px
    return Math.max(154, 172 - Math.floor(score * 0.7));
  }

  spawnObstacle(score) {
    const gapSize = this.getGapSize(score);
    const minGapTop = 85;
    const maxGapTop = this.canvasHeight - gapSize - 95;
    const gapTop = Math.floor(minGapTop + Math.random() * (maxGapTop - minGapTop));
    const gapBottom = gapTop + gapSize;

    const x = this.canvasWidth + 20;

    this.obstacles.push({
      x,
      gapTop,
      gapBottom,
      gapSize,
      scored: false,
      flameTime: Math.random() * 10
    });

    this.lastSpawnX = x;
  }

  update(dt, score, onScore) {
    const speed = this.getSpeed(score);

    // Spawn logic based on distance
    if (this.obstacles.length === 0) {
      this.spawnObstacle(score);
    } else {
      const last = this.obstacles[this.obstacles.length - 1];
      if (this.canvasWidth - last.x >= this.spawnDistance) {
        this.spawnObstacle(score);
      }
    }

    // Update obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= speed * dt;
      obs.flameTime += dt * 8;

      // Score detection
      if (!obs.scored && obs.x + this.wallWidth < 110) {
        obs.scored = true;
        if (onScore) onScore();
      }

      // Periodically emit warm embers from lanterns
      if (Math.random() < 0.22 && obs.x > -50 && obs.x < this.canvasWidth + 50) {
        // Upper lantern ember
        this.wallEmbers.push({
          x: obs.x + this.wallWidth * 0.5 + (Math.random() * 8 - 4),
          y: obs.gapTop - 10,
          vx: -(Math.random() * 50 + 20),
          vy: -(Math.random() * 40 + 10),
          size: Math.random() * 2.5 + 1.2,
          life: 0.6 + Math.random() * 0.4,
          maxLife: 1.0,
          color: Math.random() > 0.5 ? '#ffae19' : '#ff471a'
        });

        // Lower lantern ember
        this.wallEmbers.push({
          x: obs.x + this.wallWidth * 0.5 + (Math.random() * 8 - 4),
          y: obs.gapBottom + 10,
          vx: -(Math.random() * 50 + 20),
          vy: -(Math.random() * 40 + 10),
          size: Math.random() * 2.5 + 1.2,
          life: 0.6 + Math.random() * 0.4,
          maxLife: 1.0,
          color: Math.random() > 0.5 ? '#ffae19' : '#ff471a'
        });
      }

      // Remove offscreen obstacles
      if (obs.x + this.wallWidth + 30 < 0) {
        this.obstacles.splice(i, 1);
      }
    }

    // Update Wall Embers
    for (let i = this.wallEmbers.length - 1; i >= 0; i--) {
      const e = this.wallEmbers[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.life -= dt;
      if (e.life <= 0) {
        this.wallEmbers.splice(i, 1);
      }
    }
  }

  /**
   * Precise Circle vs AABB (Rectangle) collision test
   */
  checkCircleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));

    const distanceX = cx - closestX;
    const distanceY = cy - closestY;

    return distanceX * distanceX + distanceY * distanceY < radius * radius;
  }

  /**
   * Check player collision against all walls and capitals
   */
  checkCollision(player) {
    const px = player.x;
    const py = player.y;
    const pr = player.hitRadius;

    // Check ceiling and floor boundaries
    if (py - pr <= 0 || py + pr >= this.canvasHeight) {
      return true;
    }

    for (const obs of this.obstacles) {
      const x = obs.x;
      const w = this.wallWidth;
      const capH = this.capitalHeight;
      const capO = this.capitalOverhang;
      const capW = w + capO * 2;
      const capX = x - capO;

      // 1. Upper Wall Shaft
      const upperShaftH = Math.max(0, obs.gapTop - capH);
      if (upperShaftH > 0) {
        if (this.checkCircleRectCollision(px, py, pr, x, 0, w, upperShaftH)) {
          return true;
        }
      }

      // 2. Upper Wall Stone Capital / Cornice
      if (this.checkCircleRectCollision(px, py, pr, capX, obs.gapTop - capH, capW, capH)) {
        return true;
      }

      // 3. Lower Wall Stone Capital / Cornice
      if (this.checkCircleRectCollision(px, py, pr, capX, obs.gapBottom, capW, capH)) {
        return true;
      }

      // 4. Lower Wall Shaft
      const lowerShaftY = obs.gapBottom + capH;
      const lowerShaftH = Math.max(0, this.canvasHeight - lowerShaftY);
      if (lowerShaftH > 0) {
        if (this.checkCircleRectCollision(px, py, pr, x, lowerShaftY, w, lowerShaftH)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Draw beautiful textured red and golden brick pattern with bevels
   */
  drawBrickShaft(ctx, x, y, width, height) {
    if (height <= 0) return;

    ctx.save();
    // Base warm earthy mortar background
    ctx.fillStyle = '#452619';
    ctx.fillRect(x, y, width, height);

    const brickH = 18;
    const brickW = 34;
    const rows = Math.ceil(height / brickH);

    for (let r = 0; r < rows; r++) {
      const by = y + r * brickH;
      const currentH = Math.min(brickH - 2, (y + height) - by);
      if (currentH <= 0) continue;

      // Stagger alternate rows
      const offset = (r % 2 === 0) ? 0 : -brickW / 2;
      const cols = Math.ceil((width - offset) / brickW) + 1;

      for (let c = 0; c < cols; c++) {
        const bx = x + offset + c * brickW;
        // Clamp brick bounds to shaft
        const drawX = Math.max(x, bx);
        const drawW = Math.min(bx + brickW - 2, x + width) - drawX;
        if (drawW <= 0) continue;

        // Brick color palette: warm golden sandstone, light terracotta, and sun-baked amber
        const seed = (Math.sin(r * 99 + c * 33) * 10000) % 1;
        let grad;
        if (seed > 0.65) {
          // Warm Golden Sandstone brick
          grad = ctx.createLinearGradient(drawX, by, drawX, by + currentH);
          grad.addColorStop(0, '#f8c76b');
          grad.addColorStop(0.45, '#e09a36');
          grad.addColorStop(1, '#a66717');
        } else if (seed > 0.32) {
          // Light Terracotta brick
          grad = ctx.createLinearGradient(drawX, by, drawX, by + currentH);
          grad.addColorStop(0, '#e88860');
          grad.addColorStop(0.45, '#cc5c32');
          grad.addColorStop(1, '#923a1a');
        } else {
          // Sun-baked Warm Sandstone brick
          grad = ctx.createLinearGradient(drawX, by, drawX, by + currentH);
          grad.addColorStop(0, '#f2af62');
          grad.addColorStop(0.45, '#d67a3a');
          grad.addColorStop(1, '#96481b');
        }

        ctx.fillStyle = grad;
        ctx.fillRect(drawX, by, drawW, currentH);

        // Brick Top Highlight for 3D Bevel depth (sunlit warm gold)
        ctx.fillStyle = 'rgba(255, 248, 220, 0.48)';
        ctx.fillRect(drawX, by, drawW, 1.5);

        // Brick Bottom Shadow for realistic depth
        ctx.fillStyle = 'rgba(45, 18, 10, 0.42)';
        ctx.fillRect(drawX, by + currentH - 1.5, drawW, 1.5);
      }
    }

    // Cinematic Wall Rim Highlights & Shadows for daytime atmosphere
    // Left rim warm sunlit highlight
    const leftGleam = ctx.createLinearGradient(x, 0, x + 9, 0);
    leftGleam.addColorStop(0, 'rgba(255, 242, 190, 0.42)');
    leftGleam.addColorStop(1, 'transparent');
    ctx.fillStyle = leftGleam;
    ctx.fillRect(x, y, 9, height);

    // Right depth shadow
    const rightShadow = ctx.createLinearGradient(x + width - 12, 0, x + width, 0);
    rightShadow.addColorStop(0, 'transparent');
    rightShadow.addColorStop(1, 'rgba(45, 18, 10, 0.52)');
    ctx.fillStyle = rightShadow;
    ctx.fillRect(x + width - 12, y, 12, height);

    ctx.restore();
  }

  /**
   * Draw ornate architectural stone capital / cornice with golden trim & lantern
   */
  drawCapital(ctx, cx, cy, width, height, isUpper, flameTime) {
    ctx.save();

    // 1. Warm carved terracotta / sandstone architectural block
    const stoneGrad = ctx.createLinearGradient(cx, cy, cx, cy + height);
    stoneGrad.addColorStop(0, '#7e4732');
    stoneGrad.addColorStop(0.4, '#5c2d1e');
    stoneGrad.addColorStop(1, '#3d1c12');
    ctx.fillStyle = stoneGrad;
    ctx.fillRect(cx, cy, width, height);

    // 2. Beveled Gold Border Moulding
    const trimGrad = ctx.createLinearGradient(cx, 0, cx + width, 0);
    trimGrad.addColorStop(0, '#ffe587');
    trimGrad.addColorStop(0.5, '#f5c518');
    trimGrad.addColorStop(1, '#b07a10');

    ctx.fillStyle = trimGrad;
    if (isUpper) {
      // Golden moulding along the opening edge (bottom)
      ctx.fillRect(cx, cy + height - 5, width, 5);
      ctx.fillStyle = '#fff0a8';
      ctx.fillRect(cx, cy + height - 5, width, 1.5);
    } else {
      // Golden moulding along the opening edge (top)
      ctx.fillRect(cx, cy, width, 5);
      ctx.fillStyle = '#fff0a8';
      ctx.fillRect(cx, cy, width, 1.5);
    }

    // Outer subtle golden border
    ctx.strokeStyle = 'rgba(245, 197, 24, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx, cy, width, height);

    // 3. Central Carved Golden Star Emblem
    const midX = cx + width / 2;
    const midY = cy + height / 2;

    ctx.fillStyle = '#f5c518';
    ctx.shadowColor = 'rgba(245, 197, 24, 0.8)';
    ctx.shadowBlur = 6;
    ctx.font = 'bold 12px Cinzel';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', midX, midY + (isUpper ? 2 : -2));

    // 4. Glowing Cinematic Torch / Lantern at the opening
    const lanternY = isUpper ? cy + height - 2 : cy + 2;
    const flameFlicker = Math.sin(flameTime) * 3 + Math.cos(flameTime * 1.7) * 2;

    // Torch Light Radial Cast
    const lightGlow = ctx.createRadialGradient(midX, lanternY, 4, midX, lanternY, 40);
    lightGlow.addColorStop(0, 'rgba(255, 180, 50, 0.6)');
    lightGlow.addColorStop(0.5, 'rgba(255, 100, 20, 0.25)');
    lightGlow.addColorStop(1, 'rgba(178, 31, 53, 0)');

    ctx.fillStyle = lightGlow;
    ctx.beginPath();
    ctx.arc(midX, lanternY, 40, 0, Math.PI * 2);
    ctx.fill();

    // Lantern flame core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(midX, lanternY, 3 + flameFlicker * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.arc(midX, lanternY, 5 + flameFlicker * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  draw(ctx) {
    const w = this.wallWidth;
    const capH = this.capitalHeight;
    const capO = this.capitalOverhang;
    const capW = w + capO * 2;

    for (const obs of this.obstacles) {
      const x = obs.x;
      const capX = x - capO;

      // 1. Draw Upper Wall
      const upperShaftH = obs.gapTop - capH;
      if (upperShaftH > 0) {
        this.drawBrickShaft(ctx, x, 0, w, upperShaftH);
      }
      this.drawCapital(ctx, capX, obs.gapTop - capH, capW, capH, true, obs.flameTime);

      // 2. Draw Lower Wall
      this.drawCapital(ctx, capX, obs.gapBottom, capW, capH, false, obs.flameTime);
      const lowerShaftY = obs.gapBottom + capH;
      const lowerShaftH = this.canvasHeight - lowerShaftY;
      if (lowerShaftH > 0) {
        this.drawBrickShaft(ctx, x, lowerShaftY, w, lowerShaftH);
      }
    }

    // 3. Draw drifting wall embers
    ctx.save();
    for (const e of this.wallEmbers) {
      const alpha = Math.max(0, e.life / e.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
