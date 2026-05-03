/* ============================
   page3-particles.js — 神经元粒子选择页
   ============================ */
const ParticlePage = {
  canvas: null,
  ctx: null,
  particles: [],
  connections: [],
  conversations: [],
  isActive: false,
  animFrame: null,
  tooltip: null,

  // 鼠标
  mouseX: -10000,
  mouseY: -10000,
  hoveredParticle: null,

  // 参数
  particleCount: 200,
  connectDistance: 180,
  repulsionRadius: 120,
  repulsionStrength: 4,
  topicGlowRadius: 25,

  init() {
    this.canvas = document.getElementById('particle-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.tooltip = document.getElementById('particle-tooltip');

    this.loadConversations();

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      this.checkHover();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mouseX = -10000;
      this.mouseY = -10000;
      this.hoveredParticle = null;
      if (this.tooltip) this.tooltip.classList.remove('visible');
    });

    // 点击粒子
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (const p of this.particles) {
        if (!p.isTopic) continue;
        const dist = Math.sqrt((p.x - mx) ** 2 + (p.y - my) ** 2);
        if (dist < p.size + 12) {
          const conv = this.conversations[p.convIndex];
          if (conv) this.selectConversation(conv);
          return;
        }
      }
    });

    document.getElementById('btn-new-chat').addEventListener('click', () => {
      this.startNewChat();
    });
  },

  checkHover() {
    let found = null;
    for (const p of this.particles) {
      if (!p.isTopic) continue;
      const dist = Math.sqrt((p.x - this.mouseX) ** 2 + (p.y - this.mouseY) ** 2);
      if (dist < p.size + 15) {
        found = p;
        break;
      }
    }

    if (found !== this.hoveredParticle) {
      this.hoveredParticle = found;
      if (found && this.tooltip) {
        const conv = this.conversations[found.convIndex];
        if (conv) {
          this.tooltip.textContent = conv.title;
          this.tooltip.style.left = (found.x + 15) + 'px';
          this.tooltip.style.top = (found.y - 10) + 'px';
          this.tooltip.classList.add('visible');
        }
      } else if (this.tooltip) {
        this.tooltip.classList.remove('visible');
      }
    } else if (found && this.tooltip) {
      // 更新 tooltip 位置跟随粒子移动
      this.tooltip.style.left = (found.x + 15) + 'px';
      this.tooltip.style.top = (found.y - 10) + 'px';
    }
  },

  loadConversations() {
    try {
      const saved = localStorage.getItem('maomao_conversations');
      this.conversations = saved ? JSON.parse(saved) : [];
    } catch {
      this.conversations = [];
    }

    if (this.conversations.length === 0) {
      this.conversations = [
        { id: '1', title: '帮我写一个 Python 脚本', date: new Date().toLocaleDateString() },
        { id: '2', title: '解释量子计算基础', date: new Date().toLocaleDateString() },
        { id: '3', title: '如何学习日语', date: new Date().toLocaleDateString() },
      ];
      this.saveConversations();
    }
  },

  saveConversations() {
    localStorage.setItem('maomao_conversations', JSON.stringify(this.conversations));
  },

  selectConversation(conv) {
    localStorage.setItem('maomao_current_conv', JSON.stringify(conv));
    MainController.switchPage('page-particles', 'page-chat');
  },

  startNewChat() {
    localStorage.removeItem('maomao_current_conv');
    MainController.switchPage('page-particles', 'page-chat');
  },

  resize() {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
  },

  createParticles() {
    this.particles = [];
    const w = this.canvas.width;
    const h = this.canvas.height;
    const topicCount = Math.min(this.conversations.length, Math.floor(this.particleCount * 0.3));

    for (let i = 0; i < this.particleCount; i++) {
      const isTopic = i < topicCount;
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        // 每个粒子都有自然的运动速度
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        size: isTopic ? 4 + Math.random() * 3 : 2 + Math.random() * 2,
        baseAlpha: isTopic ? 0.6 + Math.random() * 0.4 : 0.2 + Math.random() * 0.3,
        alpha: 1,
        isTopic,
        convIndex: isTopic ? i : -1,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.5 + Math.random() * 1.5,
        // 浮动偏移
        floatSpeed: 0.2 + Math.random() * 0.4,
        floatPhaseX: Math.random() * Math.PI * 2,
        floatPhaseY: Math.random() * Math.PI * 2,
        floatAmp: 5 + Math.random() * 10,
        currentSize: 2,
      });
    }
  },

  update() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const mx = this.mouseX;
    const my = this.mouseY;
    const now = Date.now() / 1000;

    for (const p of this.particles) {
      // 自然浮动（所有粒子持续运动）
      p.vx += Math.sin(now * p.floatSpeed + p.floatPhaseX) * 0.02 * (p.floatAmp / 8);
      p.vy += Math.cos(now * p.floatSpeed + p.floatPhaseY) * 0.02 * (p.floatAmp / 8);

      // 鼠标排斥（仅非主题粒子）
      if (!p.isTopic) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.repulsionRadius && dist > 0) {
          const force = (this.repulsionRadius - dist) / this.repulsionRadius;
          p.vx += (dx / dist) * force * this.repulsionStrength;
          p.vy += (dy / dist) * force * this.repulsionStrength;
        }
      }

      // 鼠标靠近主题粒子时高亮
      if (p.isTopic) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.topicGlowRadius) {
          p.alpha = Math.min(1, 0.5 + (1 - dist / this.topicGlowRadius) * 1.5);
          p.currentSize = p.size * (1 + (1 - dist / this.topicGlowRadius) * 0.5);
        } else {
          p.alpha = p.baseAlpha;
          p.currentSize = p.size;
        }
      }

      // 阻尼
      p.vx *= 0.97;
      p.vy *= 0.97;

      // 速度限制
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > 2) {
        p.vx = (p.vx / speed) * 2;
        p.vy = (p.vy / speed) * 2;
      }

      // 主题粒子脉动
      if (p.isTopic && !this.hoveredParticle) {
        const pulse = Math.sin(now * p.pulseSpeed + p.phase) * 0.1 + 1;
        p.currentSize = p.size * pulse;
      } else if (p.isTopic && this.hoveredParticle !== p) {
        p.currentSize = p.size;
      }

      p.x += p.vx;
      p.y += p.vy;

      // 边界
      const margin = 30;
      if (p.x < -margin) p.x = w + margin;
      if (p.x > w + margin) p.x = -margin;
      if (p.y < -margin) p.y = h + margin;
      if (p.y > h + margin) p.y = -margin;
    }

    // 生成连接
    this.connections = [];
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i];
        const b = this.particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.connectDistance) {
          this.connections.push({ a, b, dist, alpha: (1 - dist / this.connectDistance) * 0.12 });
        }
      }
    }
  },

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, w, h);

    // 连接线
    for (const conn of this.connections) {
      const { a, b, dist, alpha } = conn;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(68, 68, 68, ${alpha})`;
      ctx.lineWidth = 0.3 + (1 - dist / this.connectDistance) * 0.5;
      ctx.stroke();
    }

    // 粒子
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.currentSize || p.size, 0, Math.PI * 2);

      if (p.isTopic) {
        ctx.shadowColor = '#444444';
        ctx.shadowBlur = p.alpha * 15;
        ctx.fillStyle = `rgba(68, 68, 68, ${p.alpha})`;
        ctx.fill();
        ctx.shadowBlur = 0;

        // 高光
        ctx.beginPath();
        ctx.arc(p.x - p.currentSize * 0.2, p.y - p.currentSize * 0.2, p.currentSize * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.4})`;
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(200, 200, 200, ${p.alpha * 0.5})`;
        ctx.fill();
      }
    }
  },

  loop() {
    if (!this.isActive) return;
    this.update();
    this.draw();
    this.animFrame = requestAnimationFrame(() => this.loop());
  },

  start() {
    if (this.isActive) return;
    this.isActive = true;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.createParticles();
    this.loop();
  },

  stop() {
    this.isActive = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.tooltip) this.tooltip.classList.remove('visible');
  }
};
