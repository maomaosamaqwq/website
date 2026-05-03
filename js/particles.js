/* ============================
   particles.js — 通用粒子引擎
   ============================ */
class ParticleSystem {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.mouseX = -1000;
    this.mouseY = -1000;
    this.running = false;
    this.options = {
      count: options.count || 100,
      speed: options.speed || 0.5,
      size: options.size || 2,
      color: options.color || '#444444',
      connectDistance: options.connectDistance || 150,
      connectOpacity: options.connectOpacity || 0.15,
      repulsionRadius: options.repulsionRadius || 80,
      repulsionStrength: options.repulsionStrength || 2,
      repulsionEnabled: options.repulsionEnabled || false,
      topicParticles: options.topicParticles || new Set(),
      ...options
    };

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.mouseX = -1000;
      this.mouseY = -1000;
    });
  }

  resize() {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
  }

  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.options.count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * this.options.speed,
        vy: (Math.random() - 0.5) * this.options.speed,
        size: this.options.size + Math.random() * this.options.size,
        alpha: 0.3 + Math.random() * 0.7,
        isTopic: this.options.topicParticles.has(i),
        topicLabel: null,
        baseX: Math.random() * this.canvas.width,
        baseY: Math.random() * this.canvas.height,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  update() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const p of this.particles) {
      // 鼠标排斥
      if (this.options.repulsionEnabled && !p.isTopic) {
        const dx = p.x - this.mouseX;
        const dy = p.y - this.mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.options.repulsionRadius && dist > 0) {
          const force = (this.options.repulsionRadius - dist) / this.options.repulsionRadius;
          p.vx += (dx / dist) * force * this.options.repulsionStrength;
          p.vy += (dy / dist) * force * this.options.repulsionStrength;
        }
      }

      // 速度衰减
      p.vx *= 0.98;
      p.vy *= 0.98;

      p.x += p.vx;
      p.y += p.vy;

      // 边界环绕
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 画连接线
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i];
        const b = this.particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.options.connectDistance) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          const alpha = (1 - dist / this.options.connectDistance) * this.options.connectOpacity;
          ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // 画粒子
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      
      if (p.isTopic) {
        ctx.fillStyle = `rgba(68, 68, 68, ${p.alpha})`;
        ctx.shadowColor = '#444444';
        ctx.shadowBlur = 15;
      } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.5})`;
        ctx.shadowBlur = 0;
      }
      
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  animate() {
    if (!this.running) return;
    this.update();
    this.draw();
    requestAnimationFrame(() => this.animate());
  }

  start() {
    this.running = true;
    this.createParticles();
    this.animate();
  }

  stop() {
    this.running = false;
  }
}
