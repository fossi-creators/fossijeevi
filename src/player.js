/**
 * MEGA STAR – Playable Character: Megastar Chiranjeevi on Galloping White Horse
 * Renders the complete, uncut horse-and-rider composition with pure PNG transparency,
 * proportional scaling, dynamic flight inertia tilt, and star particles.
 */

export class Player {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    // Dimensions calibrated for complete horse & rider (1024x682 original ratio 1.501)
    this.width = 96;
    this.height = 64;
    this.hitRadius = 20; // Fair arcade hitbox centered at rider/saddle

    this.x = 110;
    this.y = canvasHeight * 0.42;
    this.vy = 0;
    this.rotation = 0;

    // Physics parameters
    this.gravity = 1180; // px/sec^2
    this.flapStrength = -390; // px/sec
    this.maxDownwardVelocity = 720;

    // Animation & Polish
    this.idleTime = 0;
    this.alive = true;
    this.particles = [];
    this.jumpSquish = 1.0;

    // Horse sound effect with preloading and moderate volume (20–25%, quieter than BGM)
    this.horseAudio = new Audio('/assets/horse-sound-effect.mp3');
    this.horseAudio.preload = 'auto';
    this.horseAudio.volume = 0.22;
    this.lastHorseSoundTime = 0;

    // Load exact original horse-and-rider PNG image
    this.image = new Image();
    this.image.src = `/assets/chiranjeevi.png?v=${Date.now()}`;
    this.imageLoaded = false;
    this.image.onload = () => {
      this.imageLoaded = true;
      if (this.image.naturalWidth && this.image.naturalHeight) {
        this.height = Math.round(this.width / (this.image.naturalWidth / this.image.naturalHeight));
      }
    };
  }

  reset() {
    this.x = 110;
    this.y = this.canvasHeight * 0.42;
    this.vy = 0;
    this.rotation = 0;
    this.alive = true;
    this.idleTime = 0;
    this.particles = [];
    this.jumpSquish = 1.0;
  }

  flap() {
    if (!this.alive) return;
    this.vy = this.flapStrength;
    this.jumpSquish = 0.86; // Dynamic elastic gallop squish on flap

    // Play horse sound effect with 250ms cooldown to avoid overlapping on rapid inputs
    const now = performance.now();
    if (now - this.lastHorseSoundTime > 250) {
      this.lastHorseSoundTime = now;
      if (localStorage.getItem('megastar_sound_muted') !== 'true') {
        try {
          this.horseAudio.currentTime = 0;
          const p = this.horseAudio.play();
          if (p !== undefined) {
            p.catch(() => {});
          }
        } catch (e) {}
      }
    }

    // Burst golden sparks behind horse's galloping hind legs & tail
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: this.x - this.width * 0.45,
        y: this.y + (Math.random() * 16 - 8),
        vx: -(Math.random() * 130 + 70),
        vy: (Math.random() * 70 - 35),
        size: Math.random() * 4 + 2,
        alpha: 1,
        color: Math.random() > 0.4 ? '#f5c518' : '#ff7a18',
        life: 0.35 + Math.random() * 0.2
      });
    }
  }

  updateIdle(dt) {
    this.idleTime += dt * 3.2;
    this.y = this.canvasHeight * 0.42 + Math.sin(this.idleTime) * 14;
    this.rotation = Math.sin(this.idleTime * 0.7) * 0.06;
    this.updateParticles(dt);
  }

  update(dt) {
    if (!this.alive) {
      // Tumble after crash
      this.vy += this.gravity * 0.8 * dt;
      this.y += this.vy * dt;
      this.rotation += 3.5 * dt;
      this.updateParticles(dt);
      return;
    }

    // Apply gravity
    this.vy += this.gravity * dt;
    if (this.vy > this.maxDownwardVelocity) {
      this.vy = this.maxDownwardVelocity;
    }
    this.y += this.vy * dt;

    // Elastic bounce back from squish
    if (this.jumpSquish < 1.0) {
      this.jumpSquish = Math.min(1.0, this.jumpSquish + dt * 2.5);
    }

    // Target rotation based on velocity (subtle horse jump incline)
    let targetRot = 0;
    if (this.vy < 0) {
      // Ascending: slight upward gallop incline
      targetRot = Math.max(-0.35, (this.vy / 450) * 0.35);
    } else {
      // Descending: forward gallop descent
      targetRot = Math.min(0.65, (this.vy / 650) * 0.65);
    }

    // Smooth rotational interpolation
    this.rotation += (targetRot - this.rotation) * Math.min(1, dt * 10);

    // Continuous ambient star trail drifting from the horse's tail
    if (Math.random() < 0.45) {
      this.particles.push({
        x: this.x - this.width * 0.42,
        y: this.y + (Math.random() * 12 - 6),
        vx: -(Math.random() * 80 + 40),
        vy: (Math.random() * 30 - 15),
        size: Math.random() * 3 + 1.5,
        alpha: 0.85,
        color: '#ffd700',
        life: 0.28
      });
    }

    this.updateParticles(dt);
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life * 2.5);
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    // 1. Draw glowing golden particles behind character
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Draw complete horse-and-rider character
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(1 / this.jumpSquish, this.jumpSquish);

    const dw = this.width;
    const dh = this.height;

    // Subtle golden cinematic rim glow behind the horse
    ctx.shadowColor = 'rgba(245, 197, 24, 0.75)';
    ctx.shadowBlur = 10;

    if (this.imageLoaded) {
      // Draw complete original image without any cropping or distortion
      ctx.drawImage(this.image, -dw * 0.5, -dh * 0.5, dw, dh);
    } else {
      // Procedural placeholder while image loads
      ctx.fillStyle = '#b8860b';
      ctx.fillRect(-dw * 0.5, -dh * 0.5, dw, dh);
    }

    ctx.restore();
  }
}
