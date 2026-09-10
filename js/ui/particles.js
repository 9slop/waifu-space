// Ambient Sakura (Cherry Blossom) Petal Particle Canvas

export class SakuraParticleSystem {
  constructor(canvasElement, enabled = true) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.enabled = enabled;
    this.petals = [];
    this.maxPetals = 35;
    this.animationFrameId = null;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    for (let i = 0; i < this.maxPetals; i++) {
      this.petals.push(this.createPetal(true));
    }

    if (this.enabled) {
      this.start();
    }
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  createPetal(randomY = false) {
    return {
      x: Math.random() * this.width,
      y: randomY ? Math.random() * this.height : -20,
      size: 8 + Math.random() * 8,
      speedX: 0.5 + Math.random() * 1.5,
      speedY: 1.0 + Math.random() * 1.5,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 2,
      opacity: 0.4 + Math.random() * 0.45,
      flip: Math.random() * Math.PI,
      flipSpeed: 0.02 + Math.random() * 0.03
    };
  }

  start() {
    this.enabled = true;
    if (!this.animationFrameId) {
      this.loop();
    }
  }

  stop() {
    this.enabled = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  toggle(enable) {
    if (enable) this.start();
    else this.stop();
  }

  loop() {
    if (!this.enabled) return;

    this.ctx.clearRect(0, 0, this.width, this.height);

    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i];

      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotationSpeed;
      p.flip += p.flipSpeed;

      // Draw sakura petal shape
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.scale(1, Math.sin(p.flip));

      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.bezierCurveTo(-p.size / 2, -p.size / 2, -p.size / 2, p.size / 2, 0, p.size);
      this.ctx.bezierCurveTo(p.size / 2, p.size / 2, p.size / 2, -p.size / 2, 0, 0);

      this.ctx.fillStyle = `rgba(255, 183, 197, ${p.opacity})`;
      this.ctx.fill();
      this.ctx.restore();

      // Reset when off screen
      if (p.y > this.height + 20 || p.x > this.width + 20) {
        this.petals[i] = this.createPetal(false);
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }
}
